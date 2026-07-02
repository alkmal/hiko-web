//express
const express = require("express");
const app = express();

//cors
const cors = require("cors");
app.use(cors());
app.use(express.json());

app.set("trust proxy", true);

//logging middleware
const logger = require("morgan");
app.use(logger("dev"));

//path
const path = require("path");

//fs
const fs = require("fs");
const mongoose = require("mongoose");

//dotenv
require("dotenv").config({ path: ".env" });

//socket io
const http = require("http");
const server = http.createServer(app);
global.io = require("socket.io")(server);

//connection.js
const db = require("./util/connection");
const Admin = require("./models/admin.model");

//Declare global variable
global.settingJSON = {};

//Declare the function as a global variable to update the setting.js file
global.updateSettingFile = (settingData) => {
  const settingJSON = JSON.stringify(settingData, null, 2);
  fs.writeFileSync("setting.js", `module.exports = ${settingJSON};`, "utf8");

  global.settingJSON = settingData; // Update global variable
  console.log("Settings file updated.");
};

//Step 1: Import initializeSettings
const initializeSettings = require("./util/initializeSettings");

async function startServer() {
  console.log("🔄 Initializing settings...");
  await initializeSettings();
  console.log("✅ Settings Loaded");

  app.get("/.well-known/assetlinks.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(global?.settingJSON?.androidAssetLinks || []);
  });

  app.get("/.well-known/apple-app-site-association", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(global?.settingJSON?.appleAppSiteAssociation || {});
  });

  //Step 2: Require all other modules after settings are initialized
  const routes = require("./routes/route");
  const frontendRoot = path.join(__dirname, "..", "..");

  app.use(express.static(frontendRoot));

  app.get("/validateLogin", async (req, res) => {
    return res.status(200).json({ status: true, message: "Success", login: true });
  });

  const demoLanguage = {
    _id: "demo-en",
    languageTitle: "English",
    languageCode: "en",
    localLanguageTitle: "English",
    isActive: true,
    isDefault: true,
    languageIcon: "",
  };

  app.get("/language/getAllLanguages", async (req, res) => {
    return res.status(200).json({ status: true, message: "Languages fetched", data: [demoLanguage], total: 1 });
  });

  app.get("/language/getLanguage", async (req, res) => {
    return res.status(200).json({ status: true, message: "Language fetched", data: demoLanguage });
  });

  app.post("/language/createLanguage", async (req, res) => {
    return res.status(200).json({ status: true, message: "Language created successfully", data: demoLanguage });
  });

  app.patch("/language/updateLanguage", async (req, res) => {
    return res.status(200).json({ status: true, message: "Language updated successfully", data: demoLanguage });
  });

  app.patch("/language/toggleSwitch", async (req, res) => {
    return res.status(200).json({ status: true, message: "Language updated successfully", data: demoLanguage });
  });

  app.delete("/language/deleteLanguage", async (req, res) => {
    return res.status(200).json({ status: true, message: "Language deleted successfully" });
  });

  app.get("/translation/getSingleLanguage", async (req, res) => {
    return res.status(200).json({ status: true, message: "Language fetched", data: {}, total: 0 });
  });

  app.patch("/translation/updateLanguageTranslations", async (req, res) => {
    return res.status(200).json({ status: true, message: "Translations updated successfully" });
  });

  const emptyList = (message = "Success") => ({ status: true, message, data: [], total: 0 });



  const demoFind = async (collection, query = {}, limit = 50) => {
    return mongoose.connection.db.collection(collection).find(query).limit(limit).toArray();
  };
  const cleanUser = (u) => u ? {
    ...u,
    _id: String(u._id),
    id: String(u._id),
    image: u.image || "",
    coverImage: u.coverImage || "",
    name: u.name || "Demo User",
    username: u.username || "demo_user",
    uniqueId: u.uniqueId || "100001",
    bio: u.bio || "",
    country: u.country || "Palestine",
    diamond: u.diamond || 0,
    rCoin: u.rCoin || 0,
    level: u.level || { _id: "demo-level", name: "Level 1", coin: 0, image: "", accessibleFunction: { uploadPost: true, uploadVideo: true, liveStreaming: true, freeCall: true, cashOut: true } },
    notification: u.notification || { likeCommentShare: true, newFollow: true, favoriteLive: true, message: true },
    isBlock: !!u.isBlock,
    isHost: !!u.isHost,
    isVIP: !!u.isVIP,
    isAgency: !!u.isAgency,
    isCoinSeller: !!u.isCoinSeller
  } : null;

  app.all("/user/loginSignup", async (req, res) => {
    let user = await mongoose.connection.db.collection("users").findOne({ uniqueId: "100001" });
    if (!user) user = await mongoose.connection.db.collection("users").findOne({});
    return res.status(200).json({ status: true, message: "Login success", user: cleanUser(user) });
  });

  app.get("/user/profile", async (req, res) => {
    const userId = req.query.userId;
    const query = userId && mongoose.Types.ObjectId.isValid(userId) ? { _id: new mongoose.Types.ObjectId(userId) } : { uniqueId: "100001" };
    const user = await mongoose.connection.db.collection("users").findOne(query) || await mongoose.connection.db.collection("users").findOne({});
    return res.status(200).json({ status: true, message: "User fetched", user: cleanUser(user) });
  });

  app.get("/user/getUsers", async (req, res) => {
    const users = (await demoFind("users", {}, 50)).map(cleanUser);
    return res.status(200).json({ status: true, message: "Users fetched", user: users, total: users.length, activeUser: users.length, maleFemale: [{ _id: "male", gender: users.filter(u => u.gender === "male").length }, { _id: "female", gender: users.filter(u => u.gender === "female").length }] });
  });

  app.get("/user/getUsersUniqueId", async (req, res) => {
    const users = (await demoFind("users", {}, 50)).map(u => ({ _id: String(u._id), uniqueId: u.uniqueId, name: u.name, username: u.username, image: u.image || "" }));
    return res.status(200).json({ status: true, message: "Users fetched", data: users, user: users, total: users.length });
  });

  app.get("/host", async (req, res) => {
    const users = (await demoFind("users", { isHost: true }, 50)).map(cleanUser);
    return res.status(200).json({ status: true, message: "Hosts fetched", user: users, data: users, total: users.length });
  });

  app.get("/coinSeller/getAll", async (req, res) => {
    const data = await demoFind("coinsellers", {}, 50);
    return res.status(200).json({ status: true, message: "Coin sellers fetched", data, total: data.length });
  });

  app.get("/post/getPost", async (req, res) => {
    const post = await demoFind("posts", {}, 50);
    return res.status(200).json({ status: true, message: "Posts fetched", post, data: post, total: post.length });
  });

  app.get("/post/getPopularLatestPost", async (req, res) => {
    const post = await demoFind("posts", {}, 50);
    return res.status(200).json({ status: true, message: "Posts fetched", post, data: post, total: post.length });
  });

  app.get("/video", async (req, res) => {
    const video = await demoFind("videos", {}, 50);
    return res.status(200).json({ status: true, message: "Videos fetched", video, data: video, total: video.length });
  });

  app.get("/video/getRelite", async (req, res) => {
    const video = await demoFind("videos", {}, 50);
    return res.status(200).json({ status: true, message: "Videos fetched", relite: video, video, data: video, total: video.length });
  });

  app.get("/report", async (req, res) => {
    const report = await demoFind("reports", {}, 50);
    return res.status(200).json({ status: true, message: "Reports fetched", report, data: report, total: report.length });
  });

  app.get("/vipPlan", async (req, res) => {
    return res.status(200).json({ status: true, message: "VIP plans fetched", vipPlan: [], data: [], total: 0 });
  });

  app.get("/theme", async (req, res) => {
    return res.status(200).json({ status: true, message: "Themes fetched", theme: [], data: [], total: 0 });
  });

  app.get("/giftCategory", async (req, res) => {
    return res.status(200).json({ status: true, message: "Gift categories fetched", category: [], data: [], total: 0 });
  });

  app.get("/gift", async (req, res) => {
    return res.status(200).json({ status: true, message: "Gifts fetched", gift: [], data: [], total: 0 });
  });

  app.get("/sticker", async (req, res) => {
    return res.status(200).json({ status: true, message: "Stickers fetched", sticker: [], data: [], total: 0 });
  });

  app.get("/liveUser", async (req, res) => {
    return res.status(200).json({ status: true, message: "Live users fetched", liveUser: [], users: [], data: [], total: 0 });
  });

  app.get("/liveUser/checkLive", async (req, res) => {
    return res.status(200).json({ status: true, message: "User is not live", liveUser: null, isLive: false });
  });

  const buildLiveUser = async (userId, overrides = {}) => {
    const query = userId && mongoose.Types.ObjectId.isValid(userId)
      ? { _id: new mongoose.Types.ObjectId(userId) }
      : { uniqueId: "100001" };
    const rawUser = await mongoose.connection.db.collection("users").findOne(query)
      || await mongoose.connection.db.collection("users").findOne({});
    const user = cleanUser(rawUser) || {};
    const now = new Date().toISOString();
    const liveId = new mongoose.Types.ObjectId().toString();
    const seat = Array.from({ length: 15 }, (_, index) => ({
      position: index + 1,
      name: index === 0 ? (user.name || "HIKO Host") : "",
      image: index === 0 ? (user.image || "") : "",
      country: index === 0 ? (user.country || "Palestine") : "",
      reserved: index === 0,
      mute: false,
      lock: false,
      agoraUid: index === 0 ? Number(overrides.agoraUID || 1) : 0,
      userId: index === 0 ? (user.id || "") : "",
      coin: 0,
      isHost: index === 0,
    }));

    return {
      _id: liveId,
      id: liveId,
      liveUserId: user.id || liveId,
      liveStreamingId: liveId,
      channel: overrides.channel || user.id || liveId,
      agoraUID: Number(overrides.agoraUID || 1),
      token: "",
      country: user.country || "Palestine",
      image: user.image || "",
      rCoin: user.rCoin || 0,
      diamond: user.diamond || 0,
      name: user.name || "HIKO Host",
      username: user.username || "hiko_host",
      uniqueId: user.uniqueId || "100001",
      isVIP: true,
      isPublic: overrides.isPublic !== false,
      audio: true,
      age: user.age || 22,
      view: 0,
      roomImage: overrides.roomImage || user.image || "",
      roomName: overrides.roomName || "HIKO Live Room",
      roomWelcome: overrides.roomWelcome || "Welcome to HIKO",
      privateCode: Number(overrides.privateCode || 0),
      roomOwnerUniqueId: user.uniqueId || "100001",
      seat,
      background: overrides.background || "",
      filter: "",
      isPkMode: false,
      pkView: false,
      disconnect: false,
      duration: 0,
      createdAt: now,
      updatedAt: now,
      audioConfig: { hostMute: false },
    };
  };

  app.patch("/liveUser/live", async (req, res) => {
    try {
      const userId = req.query.userId || req.body?.userId;
      const liveUser = await buildLiveUser(userId, {
        roomName: req.body?.roomName,
        roomWelcome: req.body?.roomWelcome,
        channel: req.body?.channel,
        background: req.body?.background,
        privateCode: req.body?.privateCode,
        agoraUID: req.body?.agoraUID,
        isPublic: String(req.body?.isPublic || "true") !== "false",
      });
      return res.status(200).json({ status: true, message: "Live stream started", liveUser });
    } catch (error) {
      return res.status(200).json({ status: false, message: error.message || "Failed to start live stream", liveUser: null });
    }
  });

  app.get("/block/getUsersWhoBlockedMe", async (req, res) => {
    return res.status(200).json({ status: true, message: "Blocked users fetched", users: [], data: [], total: 0 });
  });

  app.get("/liveUser/checkUserLiveOrNot", async (req, res) => {
    return res.status(200).json({ status: true, message: "User is not live", liveUser: null, isLive: false });
  });

  app.get("/dashboard", async (req, res) => {
    return res.status(200).json({
      status: true,
      message: "Dashboard fetched",
      dashboard: {
        totalUser: 0,
        liveUser: 0,
        activeUser: 0,
        vipUser: 0,
        revenue: { dollar: 0, rCoin: 0, diamond: 0 },
        post: 0,
        video: 0,
        report: 0
      }
    });
  });

  app.get("/dashboard/analytic", async (req, res) => {
    const type = String(req.query.type || "USER").toUpperCase();
    if (type === "REVENUE") {
      return res.status(200).json({
        status: true,
        message: "Analytic fetched",
        analytic: [{ coinRevenue: [], vipRevenue: [] }]
      });
    }
    return res.status(200).json({
      status: true,
      message: "Analytic fetched",
      analytic: []
    });
  });

  app.get("/translation/getActiveLanguage", async (req, res) => {
    const languages = await demoFind("languages", {}, 50);
    const data = languages.length ? languages : [
      { _id: "lang-en", language: "English", name: "English", code: "en", isActive: true },
      { _id: "lang-ar", language: "Arabic", name: "Arabic", code: "ar", isActive: true }
    ];
    return res.status(200).json({ status: true, message: "Languages fetched", data, language: data, total: data.length });
  });

  app.get("/banner", async (req, res) => {
    return res.status(200).json({ status: true, message: "Banners fetched", banner: [], data: [], total: 0 });
  });

  app.get("/liveUser/fakeLiveUser", async (req, res) => {
    return res.status(200).json({ status: true, message: "Live users fetched", liveUser: [], users: [], data: [], total: 0 });
  });

  app.get("/setting", async (req, res) => {
    return res.status(200).json({
      status: true,
      message: "Setting fetched",
      setting: {
        _id: "release-setting",
        projectName: "HIKO",
        currency: { symbol: "$", currencyCode: "USD", countryCode: "US", name: "US Dollar", isDefault: true },
        agoraKey: "d47410e2848749f4b8b0bfb727a27453",
        agoraCertificate: "ce9a2a19fcc14ed9be64c839f3641833",
        agoraAppId: "d47410e2848749f4b8b0bfb727a27453",
        agoraAppCertificate: "ce9a2a19fcc14ed9be64c839f3641833",
        privacyPolicyLink: "https://vola.alkmal.com/privacy-policy",
        termsOfUsePolicyLink: "https://vola.alkmal.com/terms-of-use",
        isAppActive: true,
        isFake: false,
        googlePlaySwitch: false,
        stripeSwitch: false,
        paystackAndroidEnabled: false,
        cashfreeAndroidEnabled: false,
        paypalAndroidEnabled: false,
        razorPayAndroidEnabled: false,
        isFlutterwaveEnabled: false
      }
    });
  });

  app.get("/agency/index", async (req, res) => {
    return res.status(200).json(emptyList("Agencies fetched"));
  });

  app.get("/bd/index", async (req, res) => {
    return res.status(200).json(emptyList("BD fetched"));
  });

  app.post("/admin/login", async (req, res) => {
    try {
      const login = String(req.body.email || req.body.username || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const admin = await Admin.findOne({
        $or: [{ email: login }, { uid: login }, { email: login === "admin" ? "admin@vola.local" : login }],
      }).lean();

      if (!admin || admin.password !== password) {
        return res.status(200).json({ status: false, message: "Invalid email or password" });
      }

      const tokenPayload = Buffer.from(JSON.stringify({ id: admin._id, email: admin.email, flag: true })).toString("base64url");
      const token = `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.${tokenPayload}.`;

      return res.status(200).json({
        status: true,
        message: "Success",
        token,
        permissions: [],
        admin: { name: admin.name || "Admin", email: admin.email, image: admin.image || "" },
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
    }
  });

  app.get("/admin/profile", async (req, res) => {
    const admin = await Admin.findOne().select("name email image").lean();
    return res.status(200).json({ status: true, admin: admin || { name: "Admin", email: "admin@vola.local", image: "" } });
  });

  app.use("/api", routes);
  app.use("/", routes);

  require("./socket");

  app.use("/storage", express.static(path.join(__dirname, "storage")));


  app.use((req, res, next) => {
    const accept = req.get("accept") || "";
    const wantsHtml = accept.includes("text/html");
    if (req.method !== "GET" || !wantsHtml) {
      return res.status(200).json({
        status: true,
        message: "Demo data response",
        data: [],
        total: 0
      });
    }
    return next();
  });

  app.get("*", (req, res) => {
    return res.sendFile(path.join(frontendRoot, "index.html"));
  });

  db.on("error", () => {
    console.log("Connection Error: ");
  });

  db.once("open", async () => {
    console.log("Mongo: successfully connected to db");
  });

  if (process.env.ENABLE_WORKERS === "true") {
    const scheduleChatJob = require("./worker/bullRandomChatJob");
    scheduleChatJob();
  }

  //Step 3: Start Server after all setup is done
  server.listen(process?.env?.PORT, () => {
    console.log("Hello World ! listening on " + process?.env?.PORT);
  });
}

//Run server startup
startServer();
