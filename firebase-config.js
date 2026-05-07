const admin = require('firebase-admin');
const path = require('path');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return admin;
  }

  try {
    // Try to load service account from environment variable
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Parse JSON from environment variable
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else if (process.env.FIREBASE_KEY_PATH) {
      // Load from file path
      serviceAccount = require(process.env.FIREBASE_KEY_PATH);
    } else {
      // Try default service-account.json in project root
      const defaultPath = path.join(__dirname, 'service-account.json');
      try {
        serviceAccount = require(defaultPath);
      } catch (e) {
        console.warn('Firebase service account not configured. Skipping Firebase initialization.');
        console.warn('To enable Firebase:');
        console.warn('  1. Download service-account.json from Firebase Console');
        console.warn('  2. Save to project root OR set FIREBASE_KEY_PATH or FIREBASE_SERVICE_ACCOUNT env var');
        return null;
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
      projectId: serviceAccount.project_id,
    });

    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully');
    return admin;
  } catch (error) {
    console.error('Failed to initialize Firebase:', error.message);
    return null;
  }
}

module.exports = {
  initializeFirebase,
  getFirebaseApp: () => firebaseInitialized ? admin : null,
  getFirestore: () => firebaseInitialized ? admin.firestore() : null,
  getAuth: () => firebaseInitialized ? admin.auth() : null,
  getDatabase: () => firebaseInitialized ? admin.database() : null,
};
