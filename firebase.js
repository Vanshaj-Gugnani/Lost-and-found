const admin = require("firebase-admin");
const dotenv = require("dotenv");
dotenv.config();

// Initialize Firebase Admin SDK using the service account key
const serviceAccount = require("./creds.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // Firestore instance
const auth = admin.auth();    // Firebase Authentication instance

module.exports = { db, auth };
