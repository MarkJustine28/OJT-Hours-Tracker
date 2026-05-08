const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Load environment variables from the environment or a .env file
dotenv.config();

// =====================
// Firebase Initialization
// =====================

let firebase = null;

try {
  if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT
    );

    firebase = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('Firebase initialized');
  }
} catch (error) {
  console.error('Firebase initialization error:', error.message);
}

function getFirestore() {
  if (!firebase) return null;
  return admin.firestore();
}

function getAuth() {
  if (!firebase) return null;
  return admin.auth();
}

function getDatabase() {
  if (!firebase) return null;
  return admin.database();
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id TINYINT PRIMARY KEY,
      required_hours INT NOT NULL DEFAULT 240,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    INSERT INTO settings (id, required_hours)
    VALUES (1, 240)
    ON DUPLICATE KEY UPDATE required_hours = required_hours
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      entry_date DATE PRIMARY KEY,
      hours DECIMAL(5,2) NOT NULL DEFAULT 0,
      status ENUM('work', 'holiday', 'no-schedule') NOT NULL DEFAULT 'work',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      ...createErrorPayload('Database connection failed', error),
    });
  }
});

app.get('/api/settings', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT required_hours FROM settings WHERE id = 1 LIMIT 1'
    );

    const requiredHours = rows.length
      ? Number(rows[0].required_hours)
      : 240;

    return res.json({ requiredHours });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch settings', error);
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const requiredHours = Number(req.body.requiredHours);

    if (!Number.isFinite(requiredHours) || requiredHours < 1) {
      return res.status(400).json({
        message: 'requiredHours must be a number greater than 0',
      });
    }

    await pool.query(
      `
      INSERT INTO settings (id, required_hours)
      VALUES (1, ?)
      ON DUPLICATE KEY UPDATE required_hours = VALUES(required_hours)
      `,
      [Math.round(requiredHours)]
    );

    return res.json({
      requiredHours: Math.round(requiredHours),
    });
  } catch (error) {
    return sendServerError(res, 'Failed to save settings', error);
  }
});

app.get('/api/entries', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        DATE_FORMAT(entry_date, "%Y-%m-%d") AS entryDate,
        hours,
        status
      FROM time_entries
      ORDER BY entry_date ASC
    `);

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
      return res.status(400).json({
        message: 'Date must be in YYYY-MM-DD format',
      });
    }

    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      return res.status(400).json({
        message: 'hours must be a number from 0 to 24',
      });
    }

    if (!['work', 'holiday', 'no-schedule'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status value',
      });
    }

    await pool.query(
      `
      INSERT INTO time_entries (entry_date, hours, status)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        hours = VALUES(hours),
        status = VALUES(status)
      `,
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

// =====================
// Firebase Endpoints
// =====================

app.get('/api/firebase/status', (_req, res) => {
  if (firebase) {
    return res.json({
      status: 'connected',
      projectId: firebase.options.projectId,
    });
  }

  return res.status(503).json({
    status: 'not-configured',
    message: 'Firebase not initialized',
  });
});

app.get('/api/firebase/entries', async (_req, res) => {
  try {
    const db = getFirestore();

    if (!db) {
      return res.status(503).json({
        message: 'Firebase not configured',
      });
    }

    const snapshot = await db.collection('entries').get();

    const data = {};

    snapshot.forEach((doc) => {
      data[doc.id] = doc.data();
    });

    return res.json({ data });
  } catch (error) {
    console.error('Firebase fetch error:', error);

    return res.status(500).json({
      message: 'Failed to fetch from Firebase',
      detail: error.message,
    });
  }
});

app.put('/api/firebase/entries/:date', async (req, res) => {
  try {
    const db = getFirestore();

    if (!db) {
      return res.status(503).json({
        message: 'Firebase not configured',
      });
    }

    const date = req.params.date;
    const hours = Number(req.body.hours);
    const status = req.body.status;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        message: 'Date must be in YYYY-MM-DD format',
      });
    }

    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      return res.status(400).json({
        message: 'hours must be a number from 0 to 24',
      });
    }

    if (!['work', 'holiday', 'no-schedule'].includes(status)) {
      return res.status(400).json({
        message: 'Invalid status value',
      });
    }

    await db.collection('entries').doc(date).set({
      hours,
      status,
      updated_at: new Date(),
    });

    return res.json({
      date,
      hours,
      status,
    });
  } catch (error) {
    console.error('Firebase save error:', error);

    return res.status(500).json({
      message: 'Failed to save to Firebase',
      detail: error.message,
    });
  }
});

function startServer(port, attempt = 0) {
  const server = app.listen(port, () => {
    const address = server.address();

    const actualPort =
      typeof address === 'object' && address
        ? address.port
        : port;

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
    console.error('Database initialization failed:');
    console.error(error && error.stack ? error.stack : error);
    try {
      console.error('DB settings:', {
        host: process.env.DB_HOST || 'undefined',
        port: process.env.DB_PORT || 'undefined',
        user: process.env.DB_USER || 'undefined',
        database: process.env.DB_NAME || 'undefined',
      });
    } catch (e) {
      // ignore
    }

    // Start server anyway so health endpoints return, but keep visible logs.
    startServer(INITIAL_PORT);
  });