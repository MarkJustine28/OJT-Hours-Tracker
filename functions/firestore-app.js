const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const { initializeFirebase, getFirestore } = require('./firebase-config');

const DEFAULT_REQUIRED_HOURS = 240;
const firebaseAdmin = initializeFirebase();

function createErrorPayload(message, error) {
  const base = { message };

  if (process.env.NODE_ENV !== 'production' && error) {
    base.detail = error.stack || error.message || 'Unknown error';
    base.code = error.code;
  }

  return base;
}

function sendServerError(res, message, error) {
  if (error) {
    console.error(message, error.code || '', error.stack || error.message || '');
  }

  return res.status(500).json(createErrorPayload(message, error));
}

function getDbOrRespond(res) {
  const db = getFirestore();

  if (!db) {
    res.status(503).json({ message: 'Firebase not configured' });
    return null;
  }

  return db;
}

function getProjectId() {
  try {
    if (!firebaseAdmin || !firebaseAdmin.apps.length) {
      return undefined;
    }

    return firebaseAdmin.app().options.projectId;
  } catch (error) {
    return undefined;
  }
}

function normalizeEntryData(data) {
  return {
    hours: Number(data.hours) || 0,
    status: data.status || 'work',
  };
}

async function initializeFirestoreDefaults() {
  const db = getFirestore();

  if (!db) {
    return;
  }

  try {
    const settingsRef = db.collection('settings').doc('global');
    const snapshot = await settingsRef.get();

    if (!snapshot.exists) {
      await settingsRef.set({
        requiredHours: DEFAULT_REQUIRED_HOURS,
        updated_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.warn('Skipping Firestore default initialization:', error.message);
  }
}

async function handleHealth(_req, res) {
  try {
    const firestore = getDbOrRespond(res);
    if (!firestore) {
      return;
    }

    await firestore.collection('settings').doc('global').get();

    return res.json({
      ok: true,
      backend: 'firestore',
      projectId: getProjectId(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      ...createErrorPayload('Firestore connection failed', error),
    });
  }
}

async function handleGetSettings(_req, res) {
  try {
    const firestore = getDbOrRespond(res);
    if (!firestore) {
      return;
    }

    const settingsRef = firestore.collection('settings').doc('global');
    const snapshot = await settingsRef.get();

    if (!snapshot.exists) {
      await settingsRef.set({
        requiredHours: DEFAULT_REQUIRED_HOURS,
        updated_at: new Date().toISOString(),
      });

      return res.json({ requiredHours: DEFAULT_REQUIRED_HOURS });
    }

    const data = snapshot.data() || {};

    return res.json({
      requiredHours: Number(data.requiredHours) || DEFAULT_REQUIRED_HOURS,
    });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch settings', error);
  }
}

async function handlePutSettings(req, res) {
  try {
    const firestore = getDbOrRespond(res);
    if (!firestore) {
      return;
    }

    const requiredHours = Number(req.body.requiredHours);

    if (!Number.isFinite(requiredHours) || requiredHours < 1) {
      return res.status(400).json({
        message: 'requiredHours must be a number greater than 0',
      });
    }

    await firestore.collection('settings').doc('global').set({
      requiredHours: Math.round(requiredHours),
      updated_at: new Date().toISOString(),
    });

    return res.json({
      requiredHours: Math.round(requiredHours),
    });
  } catch (error) {
    return sendServerError(res, 'Failed to save settings', error);
  }
}

async function handleGetEntries(_req, res) {
  try {
    const firestore = getDbOrRespond(res);
    if (!firestore) {
      return;
    }

    const snapshot = await firestore.collection('entries').get();
    const data = {};

    snapshot.docs
      .sort((left, right) => left.id.localeCompare(right.id))
      .forEach((doc) => {
        data[doc.id] = normalizeEntryData(doc.data());
      });

    return res.json({ data });
  } catch (error) {
    return sendServerError(res, 'Failed to fetch entries', error);
  }
}

async function handlePutEntry(req, res) {
  try {
    const firestore = getDbOrRespond(res);
    if (!firestore) {
      return;
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

    await firestore.collection('entries').doc(date).set({
      hours,
      status,
      updated_at: new Date().toISOString(),
    });

    return res.json({
      date,
      hours,
      status,
    });
  } catch (error) {
    return sendServerError(res, 'Failed to save entry', error);
  }
}

async function handleDeleteMonth(req, res) {
  try {
    const firestore = getDbOrRespond(res);
    if (!firestore) {
      return;
    }

    const month = req.params.month;
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({
        message: 'Month must be in YYYY-MM format',
      });
    }

    const snapshot = await firestore.collection('entries').get();
    const monthDocs = snapshot.docs.filter((doc) => doc.id.startsWith(`${month}-`));

    if (monthDocs.length === 0) {
      return res.json({ message: 'Month entries cleared' });
    }

    const batch = firestore.batch();
    monthDocs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    return res.json({ message: 'Month entries cleared' });
  } catch (error) {
    return sendServerError(res, 'Failed to clear month entries', error);
  }
}

async function handleFirebaseStatus(_req, res) {
  const db = getFirestore();

  if (!db) {
    return res.status(503).json({
      status: 'not-configured',
      message: 'Firebase not initialized',
    });
  }

  return res.json({
    status: 'connected',
    platform: 'firestore',
    projectId: getProjectId(),
  });
}

function createOJTApp({ staticDir } = {}) {
  const app = express();

  app.use(cors());
  app.use(express.json());

  if (staticDir) {
    app.use(express.static(staticDir));
  }

  app.get(['/api/health', '/health'], handleHealth);
  app.get(['/api/settings', '/api/firebase/settings'], handleGetSettings);
  app.put(['/api/settings', '/api/firebase/settings'], handlePutSettings);
  app.get(['/api/entries', '/api/firebase/entries'], handleGetEntries);
  app.put(['/api/entries/:date', '/api/firebase/entries/:date'], handlePutEntry);
  app.delete(['/api/entries/month/:month', '/api/firebase/entries/month/:month'], handleDeleteMonth);
  app.get('/api/firebase/status', handleFirebaseStatus);

  const ready = initializeFirestoreDefaults();

  return { app, ready };
}

module.exports = { createOJTApp };
