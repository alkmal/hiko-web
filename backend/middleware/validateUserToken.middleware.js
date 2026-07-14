const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

if (!privateKey) {
  console.error("❌ Firebase private key not found in global setting.");
  process.exit(1); // Exit process to prevent running without credentials
}

//import model
const User = require("../models/user.model");

const tokenCache = new Map();
const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000;
const TOKEN_CACHE_MAX_SIZE = 5000;

const verifyFirebaseToken = async (token) => {
  const now = Date.now();
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > now) return cached.decodedToken;

  const decodedToken = await admin.auth().verifyIdToken(token);
  const tokenExpiryMs = decodedToken.exp ? decodedToken.exp * 1000 - 30000 : now + TOKEN_CACHE_TTL_MS;
  const expiresAt = Math.min(now + TOKEN_CACHE_TTL_MS, tokenExpiryMs);

  if (expiresAt > now) {
    if (tokenCache.size >= TOKEN_CACHE_MAX_SIZE) tokenCache.clear();
    tokenCache.set(token, { decodedToken, expiresAt });
  }

  return decodedToken;
};

const validateUserAccessToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];
  const userUid = req.headers["x-user-uid"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ [AUTH] Missing or invalid authorization header.");
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  if (!userUid) {
    console.warn("⚠️ [AUTH] Missing API key or User UID.");
    return res.status(401).json({ status: false, message: "User UID required for authentication." });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const [decodedToken, mongoUser] = await Promise.all([verifyFirebaseToken(token), User.findOne({ firebaseUid: userUid }).select("_id isBlock").lean()]);

    if (!decodedToken) {
      console.warn("⚠️ [AUTH] Token verification failed.");
      return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
    }

    if (!mongoUser) {
      console.warn(`⚠️ [AUTH] No user found in MongoDB for Firebase UID: ${decodedToken.uid}`);
      return res.status(200).json({ status: false, message: "User not found in the database." });
    }

    if (mongoUser.isBlock) {
      console.warn(`⚠️ [AUTH] User is blocked by admin: ${decodedToken.uid}`);
      return res.status(403).json({ status: false, message: "🚷 User are blocked by the admin." });
    }

    req.user = {
      uid: decodedToken.uid,
      userId: mongoUser._id,
    };

    next();
  } catch (error) {
    console.error("❌ [AUTH ERROR] Token verification failed:", error.message);

    return res.status(401).json({
      status: false,
      message: error.code === "auth/id-token-expired" ? "Token expired. Please reauthenticate." : "Invalid token. Authorization failed.",
    });
  }
};

module.exports = validateUserAccessToken;
