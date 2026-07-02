const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

const hasUsablePrivateKey =
  privateKey &&
  typeof privateKey === "object" &&
  typeof privateKey.project_id === "string" &&
  typeof privateKey.client_email === "string" &&
  typeof privateKey.private_key === "string";

const initFirebase = async () => {
  try {
    if (!hasUsablePrivateKey) {
      console.warn("Firebase Admin SDK skipped: service account is not configured.");
      return admin;
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(privateKey),
      });
      console.log("✅ Firebase Admin SDK initialized successfully");
    }
    return admin;
  } catch (error) {
    console.error("Failed to initialize Firebase Admin SDK:", error);
    return admin;
  }
};

module.exports = initFirebase();
