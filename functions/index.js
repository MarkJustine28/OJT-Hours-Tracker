const functions = require('firebase-functions');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const { initializeFirebase, getFirestore } = require('./firebase-config');

// Initialize Firebase
initializeFirebase();

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ojt_hours_tracker',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0,
});

// Utility function for error handling
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

// =====================
// Health Check
// =====================

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ ok: false, ...createErrorPayload('Database connection failed', error) });
  }
});

// =====================
// MySQL Endpoints
// =====================

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

    return res.json({ date, hours, status });
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

// =====================
// Firebase Endpoints
// =====================

app.get('/api/firebase/status', (_req, res) => {
  return res.json({ 
    status: 'connected',
    platform: 'firebase-functions'
  });
});

app.get('/api/firebase/entries', async (_req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ message: 'Firebase not configured' });
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
      detail: error.message 
    });
  }
});

app.put('/api/firebase/entries/:date', async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ message: 'Firebase not configured' });
    }

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

    await db.collection('entries').doc(date).set({
      hours,
      status,
      updated_at: new Date(),
    });

    return res.json({ date, hours, status });
  } catch (error) {
    console.error('Firebase save error:', error);
    return res.status(500).json({ 
      message: 'Failed to save to Firebase',
      detail: error.message 
    });
  }
});

app.get('/api/firebase/settings', async (_req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ message: 'Firebase not configured' });
    }

    const doc = await db.collection('settings').doc('global').get();
    if (doc.exists) {
      return res.json(doc.data());
    }

    return res.json({ requiredHours: 240 });
  } catch (error) {
    console.error('Firebase fetch error:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch settings from Firebase',
      detail: error.message 
    });
  }
});

app.put('/api/firebase/settings', async (req, res) => {
  try {
    const db = getFirestore();
    if (!db) {
      return res.status(503).json({ message: 'Firebase not configured' });
    }

    const requiredHours = Number(req.body.requiredHours);
    if (!Number.isFinite(requiredHours) || requiredHours < 1) {
      return res.status(400).json({ message: 'requiredHours must be a number greater than 0' });
    }

    await db.collection('settings').doc('global').set({
      requiredHours: Math.round(requiredHours),
      updated_at: new Date(),
    });

    return res.json({ requiredHours: Math.round(requiredHours) });
  } catch (error) {
    console.error('Firebase save error:', error);
    return res.status(500).json({ 
      message: 'Failed to save settings to Firebase',
      detail: error.message 
    });
  }
});

// Export as a Cloud Function
exports.api = functions.https.onRequest(app);
