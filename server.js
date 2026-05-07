const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const express = require('express');
const cors = require('cors');

const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, '.env.example');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
  console.warn('Using .env.example because .env was not found.');
}

const pool = require('./db');

const app = express();
const INITIAL_PORT = Number(process.env.PORT || 3000);
const MAX_PORT_ATTEMPTS = 20;

function createErrorPayload(message, error) {
  const base = { message };
  if (process.env.NODE_ENV !== 'production' && error) {
    base.detail = error.sqlMessage || error.message || 'Unknown error';
    base.code = error.code;
  }
  return base;
}

function sendServerError(res, message, error) {
  if (error) {
    console.error(message, error.code || '', error.sqlMessage || error.message || '');
  }
  return res.status(500).json(createErrorPayload(message, error));
}

async function initializeDatabase() {
  const dbName = process.env.DB_NAME || 'ojt_hours_tracker';
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error('Invalid DB_NAME. Use letters, numbers, and underscores only.');
  }

  const adminPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 3,
    queueLimit: 0,
  });

  await adminPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await adminPool.end();

  await pool.query(
    `CREATE TABLE IF NOT EXISTS settings (
      id TINYINT PRIMARY KEY,
      required_hours INT NOT NULL DEFAULT 240,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );

  await pool.query(
    `INSERT INTO settings (id, required_hours)
     VALUES (1, 240)
     ON DUPLICATE KEY UPDATE required_hours = required_hours`
  );

  await pool.query(
    `CREATE TABLE IF NOT EXISTS time_entries (
      entry_date DATE PRIMARY KEY,
      hours DECIMAL(5,2) NOT NULL DEFAULT 0,
      status ENUM('work', 'holiday', 'no-schedule') NOT NULL DEFAULT 'work',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`
  );
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, ...createErrorPayload('Database connection failed', error) });
  }
});

app.get('/api/settings', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT required_hours FROM settings WHERE id = 1 LIMIT 1');
    const requiredHours = rows.length ? Number(rows[0].required_hours) : 240;
    return res.json({ requiredHours });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch settings', error);
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const requiredHours = Number(req.body.requiredHours);
    if (!Number.isFinite(requiredHours) || requiredHours < 1) {
      return res.status(400).json({ message: 'requiredHours must be a number greater than 0' });
    }

    await pool.query(
      `INSERT INTO settings (id, required_hours)
       VALUES (1, ?)
       ON DUPLICATE KEY UPDATE required_hours = VALUES(required_hours)`,
      [Math.round(requiredHours)]
    );

    return res.json({ requiredHours: Math.round(requiredHours) });
  } catch (error) {
    return sendServerError(res, 'Failed to save settings', error);
  }
});

app.get('/api/entries', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DATE_FORMAT(entry_date, "%Y-%m-%d") AS entryDate, hours, status FROM time_entries ORDER BY entry_date ASC'
    );

    const data = {};
    rows.forEach((row) => {
      data[row.entryDate] = {
        hours: Number(row.hours),
        status: row.status,
      };
    });

    return res.json({ data });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch entries', error);
  }
});

app.put('/api/entries/:date', async (req, res) => {
  try {
    const date = req.params.date;
    const hours = Number(req.body.hours);
    const status = req.body.status;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: 'Date must be in YYYY-MM-DD format' });
    }

    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      return res.status(400).json({ message: 'hours must be a number from 0 to 24' });
    }

    if (!['work', 'holiday', 'no-schedule'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    await pool.query(
      `INSERT INTO time_entries (entry_date, hours, status)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE
         hours = VALUES(hours),
         status = VALUES(status)`,
      [date, hours, status]
    );

    return res.json({
      date,
      hours,
      status,
    });
  } catch (error) {
    return sendServerError(res, 'Failed to save entry', error);
  }
});

app.delete('/api/entries/month/:month', async (req, res) => {
  try {
    const month = req.params.month;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: 'Month must be in YYYY-MM format' });
    }

    const startDate = `${month}-01`;
    await pool.query(
      'DELETE FROM time_entries WHERE entry_date >= ? AND entry_date < DATE_ADD(?, INTERVAL 1 MONTH)',
      [startDate, startDate]
    );

    return res.json({ message: 'Month entries cleared' });
  } catch (error) {
    return sendServerError(res, 'Failed to clear month entries', error);
  }
});

function startServer(port, attempt = 0) {
  const server = app.listen(port, () => {
    const address = server.address();
    const actualPort = typeof address === 'object' && address ? address.port : port;
    console.log(`Server is running at http://localhost:${actualPort}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempt < MAX_PORT_ATTEMPTS) {
      const nextPort = port + 1;
      console.warn(`Port ${port} is in use. Trying ${nextPort}...`);
      return startServer(nextPort, attempt + 1);
    }

    console.error('Server failed to start:', error.message);
    process.exit(1);
  });

  return server;
}

initializeDatabase()
  .then(() => startServer(INITIAL_PORT))
  .catch((error) => {
    console.error('Database initialization failed:', error.message);
    startServer(INITIAL_PORT);
  });
