const admin = require("firebase-admin");

const privateKey = settingJSON?.privateKey;

//import model
const Admin = require("../models/admin.model");
const Subadmin = require("../models/subAdmin.model");

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

const validateAdminFirebaseToken = async (req, res, next) => {
  if (process.env.DEMO_AUTH_BYPASS === "true" || !privateKey || Object.keys(privateKey).length === 0) {
    const adminUser = await Admin.findOne().select("_id email");
    if (adminUser) req.admin = adminUser;
    return next();
  }

  const authHeader = req.headers["authorization"];
  const adminUid = req.headers["x-admin-uid"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("⚠️ [AUTH] Missing or invalid authorization header.");
    return res.status(401).json({ status: false, message: "Authorization token required" });
  }

  if (!adminUid) {
    console.warn("⚠️ [AUTH] Missing API key or Admin UID.");
    return res.status(401).json({ status: false, message: "Admin UID required for authentication." });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const [decodedToken, adminUser, subadminUser] = await Promise.all([
      verifyFirebaseToken(token),
      Admin.findOne({ uid: adminUid }).select("_id email"),
      Subadmin.findOne({ authId: adminUid }).select("_id email").populate("role", "name permissions"),
    ]);

    if (!decodedToken || !decodedToken.email) {
      console.warn("⚠️ [AUTH] Invalid token. Email not found.");
      return res.status(401).json({ status: false, message: "Invalid token. Authorization failed." });
    }

    if (adminUser) {
      req.admin = adminUser;
    } else if (subadminUser) {
      req.subadmin = subadminUser;
    } else {
      console.warn("⚠️ [AUTH] Admin/Subadmin not found.");
      return res.status(401).json({ status: false, message: "Admin or Subadmin not found. Authorization failed." });
    }
    next();
  } catch (error) {
    console.error("❌ [AUTH ERROR] Token verification failed:", error.message);
    return res.status(401).json({ status: false, message: "Invalid or expired token. Authorization failed." });
  }
};

module.exports = validateAdminFirebaseToken;
