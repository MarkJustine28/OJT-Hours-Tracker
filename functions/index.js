const functions = require('firebase-functions');

const { createOJTApp } = require('./firestore-app');

const { app } = createOJTApp();

exports.api = functions.https.onRequest(app);
