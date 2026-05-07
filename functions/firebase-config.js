const admin = require('firebase-admin');
const path = require('path');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return admin;
  }

  try {
    // Firebase Admin SDK auto-authenticates with default credentials
    // when running in Cloud Functions environment
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT,
      });
    }

    firebaseInitialized = true;
    console.log('Firebase Admin SDK initialized in Cloud Functions');
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
