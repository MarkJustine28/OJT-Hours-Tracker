const admin = require('firebase-admin');
const path = require('path');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return admin;
  }

  try {
    // Render and local dev can provide a service account JSON directly.
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      const projectId =
        process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id;

      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
          databaseURL: process.env.FIREBASE_DATABASE_URL,
        });
      }

      firebaseInitialized = true;
      console.log('Firebase Admin SDK initialized with service account');
      return admin;
    }

    // Firebase Admin SDK can auto-authenticate in Cloud Functions and other
    // Google Cloud environments when a project ID is present.
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId:
          process.env.FIREBASE_PROJECT_ID ||
          process.env.GOOGLE_CLOUD_PROJECT ||
          process.env.GCLOUD_PROJECT,
      });
    }

    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized');
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
