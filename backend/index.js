//express
const express = require("express");
const app = express();

//cors
const cors = require("cors");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
const multer = require("multer");
const storage = require("./util/multer");
const upload = multer({ storage });

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

  const compatUpload = upload.fields([
    { name: "image", maxCount: 20 },
    { name: "coverImage", maxCount: 1 },
    { name: "imageVideo", maxCount: 20 },
    { name: "svgaImage", maxCount: 1 },
    { name: "roomImage", maxCount: 1 },
    { name: "post", maxCount: 1 },
    { name: "video", maxCount: 1 },
    { name: "screenshot", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]);

  const collection = (name) => mongoose.connection.db.collection(name);
  const toObjectId = (id) => (id && mongoose.Types.ObjectId.isValid(String(id)) ? new mongoose.Types.ObjectId(String(id)) : null);
  const filePath = (file) => (file?.path ? file.path.replace(/\\/g, "/") : "");
  const publicBaseUrl = (req = null) => {
    const fromRequest = req?.get ? `${req.protocol}://${req.get("host")}` : "";
    return (process.env.PUBLIC_BASE_URL || process.env.BASE_URL || fromRequest || "https://vola.alkmal.com").replace(/\/+$/, "");
  };
  const absoluteUrl = (value, req = null) => {
    const raw = textValue(value);
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("content://") || raw.startsWith("file://")) return raw;
    return `${publicBaseUrl(req)}/${raw.replace(/^\/+/, "")}`;
  };
  const firstUploadedFile = (req, field) => req.files?.[field]?.[0] || null;
  const splitCsv = (value) => textValue(value).split(",").map((item) => item.trim()).filter(Boolean);
  const timeLabel = () => "Just Now";
  const numberValue = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const pageOptions = (req) => {
    const start = Math.max(Number(req.query.start) || 1, 1);
    const limit = Math.max(Number(req.query.limit) || 20, 1);
    return { start, limit, skip: (start - 1) * limit };
  };

  const findOneUserByUniqueId = async (uniqueId) => {
    if (!uniqueId) return null;
    return collection("users").findOne({ uniqueId: String(uniqueId) });
  };

  const cleanPerson = (person = {}) => ({
    ...person,
    _id: person?._id,
    name: person?.name || "Demo User",
    username: person?.username || person?.email || "",
    uniqueId: person?.uniqueId || "",
    image: person?.image || "",
    country: person?.country || "",
    diamond: person?.diamond || person?.coin || 0,
    rCoin: person?.rCoin || person?.coin || 0,
    coin: person?.coin || 0,
  });

  const normalizeCoinPlan = (plan = {}) => ({
    ...plan,
    diamonds: plan.diamonds ?? plan.coins ?? 0,
    dollar: plan.dollar ?? plan.price ?? 0,
    productKey: plan.productKey || plan.productId || "",
    tag: plan.tag || "",
    isTop: !!(plan.isTop ?? plan.isFeatured),
  });

  const normalizeVipPlan = (plan = {}) => ({
    ...plan,
    dollar: plan.dollar ?? plan.price ?? 0,
    productKey: plan.productKey || plan.productId || "",
    tag: plan.tag || "",
    name: plan.name || "VIP Plan",
    isTop: !!(plan.isTop ?? plan.isFeatured),
    isAutoRenew: !!plan.isAutoRenew,
  });

  const normalizeGift = (gift = {}, category = null) => ({
    ...gift,
    image: gift.image || gift.icon || "",
    icon: gift.icon || gift.image || gift.svgaImage || "",
    svgaImage: gift.svgaImage || "",
    type: Number(gift.type || 1),
    category: category || gift.category || null,
  });

  const getGiftCategories = async () => {
    const [categories, giftCounts] = await Promise.all([
      collection("giftcategories").find({ isDelete: { $ne: true } }).sort({ createdAt: -1 }).toArray(),
      collection("gifts").aggregate([
        { $match: { isDelete: { $ne: true } } },
        { $group: { _id: "$giftCategoryId", count: { $sum: 1 } } },
      ]).toArray(),
    ]);
    const countMap = new Map(giftCounts.map((item) => [String(item._id), item.count]));
    return categories.map((category) => ({
      ...category,
      image: category.image || "",
      giftCount: countMap.get(String(category._id)) || 0,
    }));
  };

  const getSettingDocument = async () => {
    let setting = await collection("settings").findOne({});
    if (!setting) {
      setting = {
        privacyPolicyLink: "https://vola.alkmal.com/privacy-policy",
        termsOfUsePolicyLink: "https://vola.alkmal.com/terms-of-use",
        isAppEnabled: true,
        currency: { symbol: "$", currencyCode: "USD", countryCode: "US", name: "US Dollar", isDefault: true },
        game: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const inserted = await collection("settings").insertOne(setting);
      setting._id = inserted.insertedId;
    }
    if (!Array.isArray(setting.game) || setting.game.length === 0) {
      setting.game = [
        {
          _id: new mongoose.Types.ObjectId(),
          name: "Lucky Spin",
          link: "https://vola.alkmal.com/games/lucky-spin",
          image: "",
          minWinPercent: 10,
          maxWinPercent: 75,
          isActive: true,
          createdAt: new Date(),
        },
        {
          _id: new mongoose.Types.ObjectId(),
          name: "Treasure Box",
          link: "https://vola.alkmal.com/games/treasure-box",
          image: "",
          minWinPercent: 5,
          maxWinPercent: 60,
          isActive: true,
          createdAt: new Date(),
        },
      ];
      await collection("settings").updateOne({ _id: setting._id }, { $set: { game: setting.game, updatedAt: new Date() } });
    }
    return setting;
  };

  const withCompatError = (res, error) => {
    console.error(error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  };



  const demoFind = async (collection, query = {}, limit = 50) => {
    return mongoose.connection.db.collection(collection).find(query).limit(limit).toArray();
  };

  const textValue = (value) => (value === undefined || value === null ? "" : String(value).trim());
  const lowerValue = (value) => textValue(value).toLowerCase();
  const boolValue = (value) => value === true || value === "true" || value === 1 || value === "1";
  const makeUsername = (value) => {
    const cleaned = lowerValue(value).replace(/[^a-z0-9_.-]/g, "_").replace(/_+/g, "_");
    return cleaned.length >= 3 ? cleaned : `user_${Date.now().toString().slice(-6)}`;
  };
  const makeLocalEmail = (username) => (username.includes("@") ? username : `${username}@vola.local`);
  const makeUniqueUserId = async () => {
    for (let i = 0; i < 10; i++) {
      const id = String(Math.floor(100000 + Math.random() * 900000));
      const exists = await collection("users").findOne({ uniqueId: id });
      if (!exists) return id;
    }
    return `${Date.now()}`.slice(-9);
  };

  const cleanUser = (u) => u ? {
    ...u,
    _id: String(u._id),
    id: String(u._id),
    userId: String(u._id),
    image: absoluteUrl(u.image),
    coverImage: absoluteUrl(u.coverImage),
    name: u.name || "Demo User",
    username: u.username || "demo_user",
    uniqueId: u.uniqueId || "100001",
    email: u.email || "",
    gender: u.gender || "Male",
    age: Number(u.age) || 18,
    loginType: Number(u.loginType) || 3,
    identity: u.identity || "",
    fcmToken: u.fcmToken || "",
    countryFlagImage: u.countryFlagImage || "",
    bio: u.bio || "",
    country: u.country || "Palestine",
    diamond: u.diamond || 0,
    rCoin: u.rCoin || 0,
    level: u.level || { _id: "demo-level", name: "Level 1", coin: 0, image: "", accessibleFunction: { uploadPost: true, uploadVideo: true, liveStreaming: true, freeCall: true, cashOut: true } },
    notification: u.notification || { likeCommentShare: true, newFollow: true, favoriteLive: true, message: true },
    isBlock: !!u.isBlock,
    isHost: true,
    isVIP: true,
    enableToLive: true,
    isAgency: !!u.isAgency,
    isCoinSeller: !!u.isCoinSeller
  } : null;
  const cleanGuestUser = (u, isFollow = false) => {
    const user = cleanUser(u);
    if (!user) return null;
    return {
      ...user,
      userId: String(u._id),
      followers: Number(u.followers) || 0,
      following: Number(u.following) || 0,
      post: Number(u.post) || 0,
      video: Number(u.video) || 0,
      isFollow: !!isFollow,
      isFake: !!u.isFake,
      avatarFrameImage: u.avatarFrameImage || "",
      FollowStatus: u.FollowStatus || null,
    };
  };
  const followedUserIds = async (fromUserId, users = []) => {
    const followerId = toObjectId(fromUserId);
    if (!followerId || users.length === 0) return new Set();
    const ids = users.map((user) => toObjectId(user._id)).filter(Boolean);
    const rows = await collection("followerfollowings").find({ followerId, followingId: { $in: ids } }).toArray();
    return new Set(rows.map((row) => String(row.followingId)));
  };

  const peopleMapFor = async (items = []) => {
    const ids = idsFrom(items.map((item) => item.userId));
    if (!ids.length) return new Map();
    const users = await collection("users").find({ _id: { $in: ids } }).toArray();
    return new Map(users.map((user) => [String(user._id), cleanUser(user)]));
  };

  const formatPostForClient = (post = {}, user = null) => ({
    ...post,
    _id: String(post._id || ""),
    id: String(post._id || ""),
    userId: String(post.userId || user?._id || ""),
    post: post.post || post.image || "",
    caption: post.caption || "",
    location: post.location || "",
    hashtag: Array.isArray(post.hashtag) ? post.hashtag : splitCsv(post.hashtag),
    mentionPeople: Array.isArray(post.mentionPeople) ? post.mentionPeople : splitCsv(post.mentionPeople),
    showPost: Number(post.showPost || 0),
    allowComment: post.allowComment !== false && post.allowComment !== "false",
    like: Number(post.like || 0),
    comment: Number(post.comment || 0),
    isLike: !!post.isLike,
    isVIP: !!(post.isVIP || user?.isVIP),
    name: post.name || user?.name || "Demo User",
    userImage: absoluteUrl(post.userImage || user?.image || ""),
    avatarFrameImage: post.avatarFrameImage || user?.avatarFrameImage || "",
    time: post.time || timeLabel(),
    createdAt: post.createdAt || new Date(),
  });

  const fetchPostsForClient = async (query = {}, req, limit = 50) => {
    const posts = await collection("posts").find(query).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
    const users = await peopleMapFor(posts);
    return posts.map((post) => formatPostForClient(post, users.get(String(post.userId))));
  };

  const formatVideoForClient = (video = {}, user = null, req = null) => ({
    ...video,
    _id: String(video._id || ""),
    id: String(video._id || ""),
    userId: String(video.userId || user?._id || ""),
    video: absoluteUrl(video.video, req),
    screenshot: absoluteUrl(video.screenshot || video.thumbnail, req),
    thumbnail: absoluteUrl(video.thumbnail || video.screenshot, req),
    caption: video.caption || "",
    location: video.location || "",
    hashtag: Array.isArray(video.hashtag) ? video.hashtag : splitCsv(video.hashtag),
    mentionPeople: Array.isArray(video.mentionPeople) ? video.mentionPeople : splitCsv(video.mentionPeople),
    showVideo: Number(video.showVideo || 0),
    allowComment: video.allowComment !== false && video.allowComment !== "false",
    isOriginalAudio: video.isOriginalAudio !== false && video.isOriginalAudio !== "false",
    like: Number(video.like || 0),
    comment: Number(video.comment || 0),
    isLike: !!video.isLike,
    isVIP: !!(video.isVIP || user?.isVIP),
    name: video.name || user?.name || "Demo User",
    userImage: absoluteUrl(video.userImage || user?.image || ""),
    avatarFrameImage: video.avatarFrameImage || user?.avatarFrameImage || "",
    time: video.time || timeLabel(),
    song: video.song || null,
    createdAt: video.createdAt || new Date(),
  });

  const fetchVideosForClient = async (query = {}, req, limit = 50) => {
    const videos = await collection("videos").find(query).sort({ createdAt: -1, _id: -1 }).limit(limit).toArray();
    const users = await peopleMapFor(videos);
    return videos.map((video) => formatVideoForClient(video, users.get(String(video.userId)), req));
  };

  app.all("/user/loginSignup", async (req, res) => {
    try {
      const body = req.body || {};
      const users = collection("users");
      const password = textValue(body.password);
      const requestedAuthType = lowerValue(body.authType || body.type);
      const isCredentialRequest = !!password || requestedAuthType === "login" || requestedAuthType === "register" || body.isRegister !== undefined;

      if (isCredentialRequest) {
        const login = textValue(body.username || body.email || body.uniqueId);
        const loginKey = lowerValue(login);
        const isRegister = requestedAuthType === "register" || boolValue(body.isRegister);

        if (!loginKey || !password) {
          return res.status(200).json({ status: false, message: "Username and password are required" });
        }

        const loginQuery = {
          $or: [
            { usernameLower: loginKey },
            { emailLower: loginKey },
            { username: login },
            { email: login },
            { uniqueId: login },
          ],
        };

        const existingUser = await users.findOne(loginQuery);

        if (isRegister) {
          if (existingUser) {
            return res.status(200).json({ status: false, message: "Username already exists" });
          }

          const username = makeUsername(body.username || body.email);
          const email = lowerValue(body.email || makeLocalEmail(username));
          const now = new Date();
          const doc = {
            name: textValue(body.name) || username,
            username,
            usernameLower: lowerValue(username),
            email,
            emailLower: lowerValue(email),
            password,
            authProvider: "password",
            loginType: Number(body.loginType) || 3,
            uniqueId: await makeUniqueUserId(),
            identity: textValue(body.identity) || `local:${username}`,
            firebaseUid: textValue(body.firebaseUid) || textValue(body.identity) || `local:${username}`,
            fcmToken: textValue(body.fcmToken),
            image: textValue(body.image),
            coverImage: textValue(body.coverImage),
            gender: textValue(body.gender) || "Male",
            age: Number(body.age) || 18,
            country: textValue(body.country) || "Palestine",
            countryFlagImage: textValue(body.countryFlagImage),
            ip: textValue(body.ip),
            bio: "",
            diamond: 5000,
            rCoin: 0,
            spentCoin: 0,
            followers: 0,
            following: 0,
            post: 0,
            video: 0,
            isBlock: false,
            isOnline: true,
            isBusy: false,
            isVIP: true,
            isHost: true,
            isCoinSeller: false,
            isAgency: false,
            enableToLive: true,
            notification: { likeCommentShare: true, newFollow: true, favoriteLive: true, message: true },
            ad: { date: now, count: 0 },
            analyticDate: now,
            lastLogin: now,
            createdAt: now,
            updatedAt: now,
          };

          const insertResult = await users.insertOne(doc);
          const createdUser = await users.findOne({ _id: insertResult.insertedId });
          return res.status(200).json({ status: true, message: "Account created successfully", user: cleanUser(createdUser) });
        }

        if (!existingUser || existingUser.password !== password) {
          return res.status(200).json({ status: false, message: "Invalid username or password" });
        }

        await users.updateOne(
          { _id: existingUser._id },
          {
            $set: {
              identity: textValue(body.identity) || existingUser.identity || "",
              fcmToken: textValue(body.fcmToken) || existingUser.fcmToken || "",
              ip: textValue(body.ip) || existingUser.ip || "",
              lastLogin: new Date(),
              isOnline: true,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              usernameLower: lowerValue(existingUser.username),
              emailLower: lowerValue(existingUser.email),
            },
          }
        );

        const loggedInUser = await users.findOne({ _id: existingUser._id });
        return res.status(200).json({ status: true, message: "Login success", user: cleanUser(loggedInUser) });
      }

      const socialKey = textValue(body.email || body.identity);
      if (socialKey) {
        const socialQuery = {
          $or: [
            { email: socialKey },
            { emailLower: lowerValue(socialKey) },
            { identity: textValue(body.identity) },
          ],
        };
        let user = await users.findOne(socialQuery);
        const username = makeUsername(body.name || body.email || socialKey);
        const now = new Date();

        if (!user) {
          const doc = {
            name: textValue(body.name) || username,
            username,
            usernameLower: lowerValue(username),
            email: lowerValue(body.email || makeLocalEmail(username)),
            emailLower: lowerValue(body.email || makeLocalEmail(username)),
            authProvider: Number(body.loginType) === 0 ? "google" : "device",
            loginType: Number(body.loginType) || 0,
            uniqueId: await makeUniqueUserId(),
            identity: textValue(body.identity) || socialKey,
            firebaseUid: textValue(body.firebaseUid) || textValue(body.identity) || socialKey,
            fcmToken: textValue(body.fcmToken),
            image: textValue(body.image),
            gender: textValue(body.gender) || "Male",
            age: Number(body.age) || 18,
            country: textValue(body.country) || "Palestine",
            countryFlagImage: textValue(body.countryFlagImage),
            ip: textValue(body.ip),
            bio: "",
            diamond: 5000,
            rCoin: 0,
            isBlock: false,
            isOnline: true,
            isVIP: true,
            isHost: true,
            enableToLive: true,
            notification: { likeCommentShare: true, newFollow: true, favoriteLive: true, message: true },
            ad: { date: now, count: 0 },
            analyticDate: now,
            lastLogin: now,
            createdAt: now,
            updatedAt: now,
          };
          const insertResult = await users.insertOne(doc);
          user = await users.findOne({ _id: insertResult.insertedId });
        } else {
          await users.updateOne(
            { _id: user._id },
            {
              $set: {
                name: textValue(body.name) || user.name || username,
                image: textValue(body.image) || user.image || "",
                identity: textValue(body.identity) || user.identity || socialKey,
                fcmToken: textValue(body.fcmToken) || user.fcmToken || "",
                lastLogin: now,
                updatedAt: now,
              },
            }
          );
          user = await users.findOne({ _id: user._id });
        }

        return res.status(200).json({ status: true, message: "Login success", user: cleanUser(user) });
      }

      let user = await users.findOne({ uniqueId: "100001" });
      if (!user) user = await users.findOne({});
      return res.status(200).json({ status: true, message: "Login success", user: cleanUser(user) });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post("/user/update", compatUpload, async (req, res) => {
    try {
      const userId = toObjectId(req.body?.userId || req.query.userId);
      if (!userId) return res.status(200).json({ status: false, message: "userId is required.", user: null });

      const set = { updatedAt: new Date() };
      const name = textValue(req.body?.name);
      const username = textValue(req.body?.username);
      const bio = textValue(req.body?.bio);
      const gender = textValue(req.body?.gender);
      const age = Number(req.body?.age);
      const profileImage = filePath(firstUploadedFile(req, "image"));
      const coverImage = filePath(firstUploadedFile(req, "coverImage"));

      if (name) set.name = name;
      if (username) {
        set.username = username;
        set.usernameLower = lowerValue(username);
      }
      if (bio || req.body?.bio === "") set.bio = bio;
      if (gender) set.gender = lowerValue(gender);
      if (Number.isFinite(age) && age > 0) set.age = age;
      if (profileImage) set.image = absoluteUrl(profileImage, req);
      if (coverImage) set.coverImage = absoluteUrl(coverImage, req);

      await collection("users").updateOne({ _id: userId }, { $set: set });
      const user = await collection("users").findOne({ _id: userId });
      return res.status(200).json({ status: true, message: "Profile updated.", user: cleanUser(user) });
    } catch (error) {
      return withCompatError(res, error);
    }
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

  app.post("/user/user/search", async (req, res) => {
    try {
      const body = req.body || {};
      const keyword = textValue(body.value || body.search || req.query.value || req.query.search);
      const currentUserId = toObjectId(body.userId || req.query.userId);
      const start = Math.max(Number(body.start ?? req.query.start) || 0, 0);
      const limit = Math.min(Math.max(Number(body.limit ?? req.query.limit) || 20, 1), 50);
      const filter = { isBlock: { $ne: true } };

      if (currentUserId) {
        filter._id = { $ne: currentUserId };
      }

      if (keyword) {
        const rx = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [
          { name: rx },
          { username: rx },
          { usernameLower: rx },
          { uniqueId: rx },
          { email: rx },
          { country: rx },
        ];
      }

      const users = await collection("users").find(filter).sort({ isOnline: -1, updatedAt: -1, createdAt: -1 }).skip(start).limit(limit).toArray();
      const followSet = await followedUserIds(currentUserId, users);
      const payload = users.map((user) => cleanGuestUser(user, followSet.has(String(user._id))));
      return res.status(200).json({ status: true, message: "Users fetched", user: payload, data: payload, total: payload.length });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post("/user/getUser", async (req, res) => {
    try {
      const body = req.body || {};
      const targetId = toObjectId(body.toUserId || body.userId || req.query.userId);
      const fromUserId = body.fromUserId || req.query.fromUserId;
      if (!targetId) return res.status(200).json({ status: false, message: "User not found.", user: null });
      const user = await collection("users").findOne({ _id: targetId, isBlock: { $ne: true } });
      if (!user) return res.status(200).json({ status: false, message: "User not found.", user: null });
      const followSet = await followedUserIds(fromUserId, [user]);
      return res.status(200).json({ status: true, message: "User fetched", user: cleanGuestUser(user, followSet.has(String(user._id))) });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post("/follower/followUnfollow", async (req, res) => {
    try {
      const followerId = toObjectId(req.body?.fromUserId || req.query.fromUserId);
      const followingId = toObjectId(req.body?.toUserId || req.query.toUserId || req.body?.followingId || req.query.followingId);
      if (!followerId || !followingId) return res.status(200).json({ status: false, message: "Invalid request.", isFollow: false });
      if (String(followerId) === String(followingId)) return res.status(200).json({ status: false, message: "You cannot follow yourself.", isFollow: false });

      const existing = await collection("followerfollowings").findOne({ followerId, followingId });
      if (existing) {
        await Promise.all([
          collection("followerfollowings").deleteOne({ _id: existing._id }),
          collection("users").updateOne({ _id: followerId }, { $inc: { following: -1 }, $set: { updatedAt: new Date() } }),
          collection("users").updateOne({ _id: followingId }, { $inc: { followers: -1 }, $set: { updatedAt: new Date() } }),
        ]);
        return res.status(200).json({ status: true, message: "Unfollowed successfully.", isFollow: false });
      }

      await Promise.all([
        collection("followerfollowings").insertOne({ followerId, followingId, createdAt: new Date(), updatedAt: new Date() }),
        collection("users").updateOne({ _id: followerId }, { $inc: { following: 1 }, $set: { updatedAt: new Date() } }),
        collection("users").updateOne({ _id: followingId }, { $inc: { followers: 1 }, $set: { updatedAt: new Date() } }),
      ]);
      return res.status(200).json({ status: true, message: "Followed successfully.", isFollow: true });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post("/chatTopic/createRoom", async (req, res) => {
    try {
      const senderId = toObjectId(req.body?.senderUserId || req.body?.senderId);
      const receiverId = toObjectId(req.body?.receiverUserId || req.body?.receiverId);
      if (!senderId || !receiverId) return res.status(200).json({ status: false, message: "Invalid users.", chatTopic: null });
      const [sender, receiver] = await Promise.all([
        collection("users").findOne({ _id: senderId, isBlock: { $ne: true } }),
        collection("users").findOne({ _id: receiverId, isBlock: { $ne: true } }),
      ]);
      if (!sender || !receiver) return res.status(200).json({ status: false, message: "User not found.", chatTopic: null });

      let chatTopic = await collection("chattopics").findOne({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      });

      if (!chatTopic) {
        const now = new Date();
        chatTopic = { senderId, receiverId, chatId: null, messageCount: 0, createdAt: now, updatedAt: now };
        const inserted = await collection("chattopics").insertOne(chatTopic);
        chatTopic._id = inserted.insertedId;
      }

      return res.status(200).json({
        status: true,
        message: "Chat topic created",
        chatTopic: {
          _id: String(chatTopic._id),
          senderUser: String(chatTopic.senderId || senderId),
          receiverUser: String(chatTopic.receiverId || receiverId),
          chat: chatTopic.chatId ? String(chatTopic.chatId) : "",
          createdAt: chatTopic.createdAt,
          updatedAt: chatTopic.updatedAt,
        },
      });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  const cleanFakeUser = (host) => host ? {
    ...host,
    _id: String(host._id),
    id: String(host._id),
    userId: host.userId ? String(host.userId) : "",
    name: host.name || "Demo Host",
    username: host.username || (host.name || "demo_host").toLowerCase().replace(/\s+/g, "_"),
    uniqueId: host.uniqueId || String(host._id).slice(-6),
    image: host.image || "",
    coverImage: host.coverImage || host.image || "",
    bio: host.bio || "",
    gender: host.gender || "female",
    age: host.age || 18,
    dob: host.dob || "",
    country: host.country || "",
    countryFlagImage: host.countryFlagImage || "",
    diamond: host.diamond || host.coin || 0,
    coin: host.coin || 0,
    rCoin: host.rCoin || host.coin || 0,
    isBlock: !!host.isBlock,
    isFake: true,
    isHost: true,
    isOnline: !!host.isOnline,
    isBusy: !!host.isBusy,
    isLive: !!host.isLive,
    randomCallRate: host.randomCallRate || 0,
    randomCallFemaleRate: host.randomCallFemaleRate || 0,
    randomCallMaleRate: host.randomCallMaleRate || 0,
    privateCallRate: host.privateCallRate || 0,
    audioCallRate: host.audioCallRate || 0,
    chatRate: host.chatRate || 0,
    photoGallery: host.photoGallery || [],
    profileVideo: host.profileVideo || [],
    video: host.video || [],
    liveVideo: host.liveVideo || [],
    createdAt: host.createdAt,
    updatedAt: host.updatedAt,
  } : null;

  app.get("/user/getFakeData", async (req, res) => {
    try {
      const start = Math.max(parseInt(req.query.start) || 1, 1);
      const limit = Math.max(parseInt(req.query.limit) || 20, 1);
      const search = String(req.query.search || "All").trim();
      const startDate = req.query.startDate || "All";
      const endDate = req.query.endDate || "All";
      const sortByDiamond = !!req.query.sort;

      const filter = { isFake: true, status: 2 };
      if (search && search !== "All") {
        const safeSearch = search.replace(/[^a-z0-9 _@.-]/gi, "");
        const rx = new RegExp(safeSearch || search, "i");
        filter.$or = [{ name: rx }, { uniqueId: rx }, { email: rx }, { country: rx }];
      }
      if (startDate !== "All" && endDate !== "All") {
        const from = new Date(startDate);
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        filter.createdAt = { $gte: from, $lte: to };
      }

      const hostsCollection = mongoose.connection.db.collection("hosts");
      const sort = sortByDiamond ? { coin: -1, createdAt: -1 } : { createdAt: -1 };
      const [total, rawHosts, genderCounts] = await Promise.all([
        hostsCollection.countDocuments(filter),
        hostsCollection.find(filter).sort(sort).skip((start - 1) * limit).limit(limit).toArray(),
        hostsCollection.aggregate([
          { $match: { isFake: true, status: 2 } },
          { $group: { _id: { $toLower: "$gender" }, count: { $sum: 1 } } },
        ]).toArray(),
      ]);

      const user = rawHosts.map(cleanFakeUser);
      const male = genderCounts.find((g) => g._id === "male")?.count || 0;
      const female = genderCounts.find((g) => g._id === "female")?.count || 0;

      return res.status(200).json({
        status: true,
        message: "Fake users fetched",
        user,
        data: user,
        total,
        activeUser: total,
        maleFemale: [
          { _id: "Male", gender: male },
          { _id: "Female", gender: female },
        ],
      });
    } catch (error) {
      return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
    }
  });

  app.get("/host", async (req, res) => {
    const users = (await demoFind("users", { isHost: true }, 50)).map(cleanUser);
    return res.status(200).json({ status: true, message: "Hosts fetched", user: users, data: users, total: users.length });
  });

  app.get("/coinSeller/getAll", async (req, res) => {
    try {
      const { skip, limit } = pageOptions(req);
      const search = String(req.query.search || "ALL").trim();
      const filter = {};
      if (search && search.toUpperCase() !== "ALL") {
        const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        filter.$or = [{ name: rx }, { username: rx }, { uniqueId: rx }, { mobileNumber: rx }];
      }

      let [total, coinSeller] = await Promise.all([
        collection("coinsellers").countDocuments(filter),
        collection("coinsellers").find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      ]);

      if (total === 0) {
        const userFilter = { isCoinSeller: true };
        if (filter.$or) userFilter.$or = filter.$or;
        const users = await collection("users").find(userFilter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
        total = await collection("users").countDocuments(userFilter);
        coinSeller = users.map((user) => ({
          ...cleanPerson(user),
          userId: user._id,
          coin: user.coin || user.rCoin || 0,
          mobileNumber: user.mobileNumber || "",
          countryCode: user.countryCode || "",
          isActive: user.isBlock !== true,
          isShow: true,
        }));
      }

      return res.status(200).json({ status: true, message: "Coin sellers fetched", coinSeller, data: coinSeller, total });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post("/coinSeller/create", async (req, res) => {
    try {
      const user = await findOneUserByUniqueId(req.query.uniqueId);
      if (!user) return res.status(200).json({ status: false, message: "User not found." });

      const existing = await collection("coinsellers").findOne({ userId: user._id });
      if (existing) return res.status(200).json({ status: false, message: "Coin seller already exists." });

      const data = {
        ...cleanPerson(user),
        userId: user._id,
        coin: numberValue(req.query.coin, user.coin || 0),
        mobileNumber: req.query.mobileNumber || user.mobileNumber || "",
        countryCode: req.query.countryCode || user.countryCode || "",
        isActive: true,
        isShow: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const inserted = await collection("coinsellers").insertOne(data);
      data._id = inserted.insertedId;
      await collection("users").updateOne({ _id: user._id }, { $set: { isCoinSeller: true, updatedAt: new Date() } });
      return res.status(200).json({ status: true, message: "Coin seller created", data, coinSeller: data });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/coinSeller/coinByadmin", async (req, res) => {
    try {
      const id = toObjectId(req.query.coinSellerId);
      const amount = numberValue(req.query.coin, 0);
      if (!id) return res.status(200).json({ status: false, message: "coinSellerId is required." });
      const updated = await collection("coinsellers").findOneAndUpdate(
        { _id: id },
        { $inc: { coin: amount }, $set: { updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      const coinSeller = updated.value || await collection("coinsellers").findOne({ _id: id });
      return res.status(200).json({ status: !!coinSeller, message: "Coin seller updated", data: coinSeller, coinSeller });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/coinSeller/coinLessByAdmin", async (req, res) => {
    try {
      const id = toObjectId(req.query.coinSellerId);
      const amount = numberValue(req.query.coin, 0);
      if (!id) return res.status(200).json({ status: false, message: "coinSellerId is required." });
      const current = await collection("coinsellers").findOne({ _id: id });
      if (!current) return res.status(200).json({ status: false, message: "Coin seller not found." });
      const coin = Math.max(0, numberValue(current.coin, 0) - amount);
      await collection("coinsellers").updateOne({ _id: id }, { $set: { coin, updatedAt: new Date() } });
      const coinSeller = await collection("coinsellers").findOne({ _id: id });
      return res.status(200).json({ status: true, message: "Coin seller updated", data: coinSeller, coinSeller });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/coinSeller/activeOrNot", async (req, res) => {
    try {
      const id = toObjectId(req.query.coinSellerId);
      if (!id) return res.status(200).json({ status: false, message: "coinSellerId is required." });
      const current = await collection("coinsellers").findOne({ _id: id });
      if (!current) return res.status(200).json({ status: false, message: "Coin seller not found." });
      await collection("coinsellers").updateOne({ _id: id }, { $set: { isActive: !current.isActive, updatedAt: new Date() } });
      const coinSeller = await collection("coinsellers").findOne({ _id: id });
      return res.status(200).json({ status: true, message: "Coin seller status updated", coinSeller });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/coinSeller/show/:coinSellerId", async (req, res) => {
    try {
      const id = toObjectId(req.params.coinSellerId);
      if (!id) return res.status(200).json({ status: false, message: "coinSellerId is required." });
      const current = await collection("coinsellers").findOne({ _id: id });
      if (!current) return res.status(200).json({ status: false, message: "Coin seller not found." });
      await collection("coinsellers").updateOne({ _id: id }, { $set: { isShow: !current.isShow, updatedAt: new Date() } });
      const data = await collection("coinsellers").findOne({ _id: id });
      return res.status(200).json({ status: true, message: "Coin seller visibility updated", data });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/coinSeller/editMobileNumber", async (req, res) => {
    try {
      const id = toObjectId(req.query.coinSellerId);
      if (!id) return res.status(200).json({ status: false, message: "coinSellerId is required." });
      await collection("coinsellers").updateOne(
        { _id: id },
        { $set: { mobileNumber: req.query.mobileNumber || "", countryCode: req.query.countryCode || "", updatedAt: new Date() } },
      );
      const coinSeller = await collection("coinsellers").findOne({ _id: id });
      return res.status(200).json({ status: true, message: "Mobile number updated", coinSeller });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/post/getPost", async (req, res) => {
    const post = await fetchPostsForClient({}, req, 50);
    return res.status(200).json({ status: true, message: "Posts fetched", post, data: post, total: post.length });
  });

  app.get("/post/getPopularLatestPost", async (req, res) => {
    const post = await fetchPostsForClient({}, req, 50);
    return res.status(200).json({ status: true, message: "Posts fetched", post, data: post, total: post.length });
  });

  app.get("/post/getFollowingPost", async (req, res) => {
    const post = await fetchPostsForClient({}, req, 50);
    return res.status(200).json({ status: true, message: "Posts fetched", post, data: post, total: post.length });
  });

  app.get("/post/user", async (req, res) => {
    const userId = toObjectId(req.query.userId || req.query.uId);
    const post = await fetchPostsForClient(userId ? { userId } : {}, req, 50);
    return res.status(200).json({ status: true, message: "Posts fetched", post, data: post, total: post.length });
  });

  app.post("/post/uploadPost", compatUpload, async (req, res) => {
    try {
      const userId = toObjectId(req.body?.userId);
      const postPath = filePath(firstUploadedFile(req, "post") || firstUploadedFile(req, "image"));
      if (!userId || !postPath) return res.status(200).json({ status: false, message: "Missing post data." });

      const user = await collection("users").findOne({ _id: userId });
      const post = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        post: postPath,
        caption: req.body?.caption || "",
        location: req.body?.location || "",
        hashtag: splitCsv(req.body?.hashtag),
        mentionPeople: splitCsv(req.body?.mentionPeople),
        showPost: numberValue(req.body?.showPost, 0),
        allowComment: String(req.body?.allowComment ?? "true") !== "false",
        like: 0,
        comment: 0,
        isLike: false,
        isVIP: !!(user?.isVip || user?.isVIP),
        name: user?.name || "Demo User",
        userImage: user?.image || "",
        avatarFrameImage: user?.avatarFrameImage || "",
        time: timeLabel(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await Promise.all([
        collection("posts").insertOne(post),
        collection("users").updateOne({ _id: userId }, { $inc: { post: 1 }, $set: { updatedAt: new Date() } }),
      ]);
      return res.status(200).json({ status: true, message: "Post uploaded.", post: formatPostForClient(post, cleanUser(user)) });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/video", async (req, res) => {
    const video = await fetchVideosForClient({}, req, 50);
    return res.status(200).json({ status: true, message: "Videos fetched", video, data: video, total: video.length });
  });

  app.get("/video/getRelite", async (req, res) => {
    const video = await fetchVideosForClient({}, req, 50);
    return res.status(200).json({ status: true, message: "Videos fetched", relite: video, video, data: video, total: video.length });
  });

  app.post("/video/uploadRelite", compatUpload, async (req, res) => {
    try {
      const userId = toObjectId(req.body?.userId);
      const videoPath = filePath(firstUploadedFile(req, "video"));
      const screenshotPath = filePath(firstUploadedFile(req, "screenshot"));
      const thumbnailPath = filePath(firstUploadedFile(req, "thumbnail")) || screenshotPath;
      if (!userId || !videoPath) return res.status(200).json({ status: false, message: "Missing video data." });

      const user = await collection("users").findOne({ _id: userId });
      const video = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        username: req.body?.username || user?.username || "",
        video: absoluteUrl(videoPath, req),
        screenshot: absoluteUrl(screenshotPath || thumbnailPath, req),
        thumbnail: absoluteUrl(thumbnailPath || screenshotPath, req),
        caption: req.body?.caption || "",
        location: req.body?.location || "",
        hashtag: splitCsv(req.body?.hashtag),
        mentionPeople: splitCsv(req.body?.mentionPeople),
        showVideo: numberValue(req.body?.showVideo, 0),
        allowComment: String(req.body?.allowComment ?? "true") !== "false",
        isOriginalAudio: String(req.body?.isOriginalAudio ?? "true") !== "false",
        songId: req.body?.songId || "",
        duration: numberValue(req.body?.duration, 0),
        size: req.body?.size || "",
        like: 0,
        comment: 0,
        isLike: false,
        isVIP: !!(user?.isVip || user?.isVIP),
        name: user?.name || "Demo User",
        userImage: user?.image || "",
        avatarFrameImage: user?.avatarFrameImage || "",
        time: timeLabel(),
        song: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await Promise.all([
        collection("videos").insertOne(video),
        collection("users").updateOne({ _id: userId }, { $inc: { video: 1 }, $set: { updatedAt: new Date() } }),
      ]);
      return res.status(200).json({ status: true, message: "Relite uploaded.", video: formatVideoForClient(video, cleanUser(user), req) });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/report", async (req, res) => {
    try {
      const reports = await collection("reports").find({}).sort({ createdAt: -1 }).toArray();
      const users = await collection("users").find({}).toArray();
      const hosts = await collection("hosts").find({}).toArray();
      const people = new Map([...users, ...hosts].map((person) => [String(person._id), cleanPerson(person)]));
      const groups = new Map();

      reports.forEach((item) => {
        const target = people.get(String(item.targetId)) || { _id: item.targetId, name: "Reported User" };
        const reporter = people.get(String(item.reporterId)) || { _id: item.reporterId, name: "Reporter" };
        const key = String(item.targetId);
        if (!groups.has(key)) groups.set(key, { _id: target, count: 0, report: [] });
        groups.get(key).count += 1;
        groups.get(key).report.push({
          ...item,
          toUserId: reporter,
          description: item.reason || item.description || "",
        });
      });

      const report = Array.from(groups.values());
      return res.status(200).json({ status: true, message: "Reports fetched", report, data: report, total: report.length });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/vipPlan", async (req, res) => {
    try {
      const vipPlan = (await collection("vipplans").find({}).sort({ createdAt: -1 }).toArray()).map(normalizeVipPlan);
      return res.status(200).json({ status: true, message: "VIP plans fetched", vipPlan, data: vipPlan, total: vipPlan.length });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post("/vipPlan", async (req, res) => {
    try {
      const vipPlan = normalizeVipPlan({
        validity: numberValue(req.body.validity, 1),
        validityType: req.body.validityType || "day",
        coin: numberValue(req.body.coin, 0),
        price: numberValue(req.body.dollar ?? req.body.price, 0),
        dollar: numberValue(req.body.dollar ?? req.body.price, 0),
        productId: req.body.productKey || req.body.productId || "",
        productKey: req.body.productKey || req.body.productId || "",
        tag: req.body.tag || "",
        name: req.body.name || "VIP Plan",
        isActive: true,
        isTop: false,
        isAutoRenew: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const inserted = await collection("vipplans").insertOne(vipPlan);
      vipPlan._id = inserted.insertedId;
      return res.status(200).json({ status: true, message: "VIP plan created", vipPlan, data: vipPlan });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/vipPlan/:vipPlanId", async (req, res) => {
    try {
      const id = toObjectId(req.params.vipPlanId);
      if (!id) return res.status(200).json({ status: false, message: "vipPlanId is required." });
      const update = {
        validity: numberValue(req.body.validity, undefined),
        validityType: req.body.validityType || undefined,
        price: req.body.dollar !== undefined ? numberValue(req.body.dollar, 0) : undefined,
        dollar: req.body.dollar !== undefined ? numberValue(req.body.dollar, 0) : undefined,
        productId: req.body.productKey || req.body.productId || undefined,
        productKey: req.body.productKey || req.body.productId || undefined,
        tag: req.body.tag,
        name: req.body.name,
        updatedAt: new Date(),
      };
      Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);
      await collection("vipplans").updateOne({ _id: id }, { $set: update });
      const vipPlan = normalizeVipPlan(await collection("vipplans").findOne({ _id: id }));
      return res.status(200).json({ status: true, message: "VIP plan updated", vipPlan, data: vipPlan });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.delete("/vipPlan/:vipPlanId", async (req, res) => {
    try {
      const id = toObjectId(req.params.vipPlanId);
      if (!id) return res.status(200).json({ status: false, message: "vipPlanId is required." });
      await collection("vipplans").deleteOne({ _id: id });
      return res.status(200).json({ status: true, message: "VIP plan deleted." });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.put("/vipPlan/:vipPlanId", async (req, res) => {
    try {
      const id = toObjectId(req.params.vipPlanId);
      const current = await collection("vipplans").findOne({ _id: id });
      if (!current) return res.status(200).json({ status: false, message: "VIP plan not found." });
      await collection("vipplans").updateOne({ _id: id }, { $set: { isAutoRenew: !current.isAutoRenew, updatedAt: new Date() } });
      const vipPlan = normalizeVipPlan(await collection("vipplans").findOne({ _id: id }));
      return res.status(200).json({ status: true, message: "VIP renewal updated", vipPlan });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/vipPlan/isTopToggle", async (req, res) => {
    try {
      const id = toObjectId(req.query.planId);
      const current = await collection("vipplans").findOne({ _id: id });
      if (!current) return res.status(200).json({ status: false, message: "VIP plan not found." });
      await collection("vipplans").updateOne({ _id: id }, { $set: { isTop: !current.isTop, isFeatured: !current.isTop, updatedAt: new Date() } });
      const data = normalizeVipPlan(await collection("vipplans").findOne({ _id: id }));
      return res.status(200).json({ status: true, message: "VIP plan updated", data });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/coinPlan", async (req, res) => {
    try {
      const coinPlan = (await collection("coinplans").find({}).sort({ createdAt: -1 }).toArray()).map(normalizeCoinPlan);
      return res.status(200).json({ status: true, message: "Coin plans fetched", coinPlan, data: coinPlan, total: coinPlan.length });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post("/coinPlan", async (req, res) => {
    try {
      const coinPlan = normalizeCoinPlan({
        coins: numberValue(req.body.diamonds ?? req.body.coins, 0),
        diamonds: numberValue(req.body.diamonds ?? req.body.coins, 0),
        bonusCoins: numberValue(req.body.bonusCoins, 0),
        price: numberValue(req.body.dollar ?? req.body.price, 0),
        dollar: numberValue(req.body.dollar ?? req.body.price, 0),
        productId: req.body.productKey || req.body.productId || "",
        productKey: req.body.productKey || req.body.productId || "",
        tag: req.body.tag || "",
        isFeatured: false,
        isTop: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const inserted = await collection("coinplans").insertOne(coinPlan);
      coinPlan._id = inserted.insertedId;
      return res.status(200).json({ status: true, message: "Coin plan created", coinPlan, data: coinPlan });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/coinPlan/:coinPlanId", async (req, res) => {
    try {
      const id = toObjectId(req.params.coinPlanId);
      if (!id) return res.status(200).json({ status: false, message: "coinPlanId is required." });
      const update = {
        coins: req.body.diamonds !== undefined ? numberValue(req.body.diamonds, 0) : undefined,
        diamonds: req.body.diamonds !== undefined ? numberValue(req.body.diamonds, 0) : undefined,
        price: req.body.dollar !== undefined ? numberValue(req.body.dollar, 0) : undefined,
        dollar: req.body.dollar !== undefined ? numberValue(req.body.dollar, 0) : undefined,
        productId: req.body.productKey || req.body.productId || undefined,
        productKey: req.body.productKey || req.body.productId || undefined,
        tag: req.body.tag,
        updatedAt: new Date(),
      };
      Object.keys(update).forEach((key) => update[key] === undefined && delete update[key]);
      await collection("coinplans").updateOne({ _id: id }, { $set: update });
      const coinPlan = normalizeCoinPlan(await collection("coinplans").findOne({ _id: id }));
      return res.status(200).json({ status: true, message: "Coin plan updated", coinPlan, data: coinPlan });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.delete("/coinPlan/:coinPlanId", async (req, res) => {
    try {
      const id = toObjectId(req.params.coinPlanId);
      if (!id) return res.status(200).json({ status: false, message: "coinPlanId is required." });
      await collection("coinplans").deleteOne({ _id: id });
      return res.status(200).json({ status: true, message: "Coin plan deleted." });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/coinPlan/isTopToggle", async (req, res) => {
    try {
      const id = toObjectId(req.query.planId);
      const current = await collection("coinplans").findOne({ _id: id });
      if (!current) return res.status(200).json({ status: false, message: "Coin plan not found." });
      await collection("coinplans").updateOne({ _id: id }, { $set: { isTop: !current.isTop, isFeatured: !current.isTop, updatedAt: new Date() } });
      const data = normalizeCoinPlan(await collection("coinplans").findOne({ _id: id }));
      return res.status(200).json({ status: true, message: "Coin plan updated", data });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/theme", async (req, res) => {
    return res.status(200).json({ status: true, message: "Themes fetched", theme: [], data: [], total: 0 });
  });

  app.get("/giftCategory", async (req, res) => {
    try {
      const category = await getGiftCategories();
      return res.status(200).json({ status: true, message: "Gift categories fetched", category, data: category, total: category.length });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post("/giftCategory", compatUpload, async (req, res) => {
    try {
      const file = req.files?.image?.[0];
      const category = {
        name: req.body.name || "Gift Category",
        image: filePath(file),
        isDelete: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const inserted = await collection("giftcategories").insertOne(category);
      category._id = inserted.insertedId;
      category.giftCount = 0;
      return res.status(200).json({ status: true, message: "Gift category created", category, data: category });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/giftCategory/:categoryId", compatUpload, async (req, res) => {
    try {
      const id = toObjectId(req.params.categoryId);
      if (!id) return res.status(200).json({ status: false, message: "categoryId is required." });
      const update = { updatedAt: new Date() };
      if (req.body.name) update.name = req.body.name;
      if (req.files?.image?.[0]) update.image = filePath(req.files.image[0]);
      await collection("giftcategories").updateOne({ _id: id }, { $set: update });
      const category = { ...(await collection("giftcategories").findOne({ _id: id })), giftCount: await collection("gifts").countDocuments({ giftCategoryId: id }) };
      return res.status(200).json({ status: true, message: "Gift category updated", category, data: category });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.delete("/giftCategory/:categoryId", async (req, res) => {
    try {
      const id = toObjectId(req.params.categoryId);
      if (!id) return res.status(200).json({ status: false, message: "categoryId is required." });
      await Promise.all([
        collection("giftcategories").deleteOne({ _id: id }),
        collection("gifts").deleteMany({ giftCategoryId: id }),
      ]);
      return res.status(200).json({ status: true, message: "Gift category deleted." });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/gift", async (req, res) => {
    try {
      const categories = await getGiftCategories();
      const gifts = await collection("gifts").find({ isDelete: { $ne: true } }).sort({ createdAt: -1 }).toArray();
      const groups = categories.map((category) => ({
        ...category,
        gift: gifts.filter((gift) => String(gift.giftCategoryId) === String(category._id)).map((gift) => normalizeGift(gift, category)),
      }));
      return res.status(200).json({ status: true, message: "Gifts fetched", gift: groups, data: groups, total: groups.length });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/gift/:categoryId", async (req, res) => {
    try {
      const categoryId = req.params.categoryId;
      const categories = await getGiftCategories();
      const categoryMap = new Map(categories.map((category) => [String(category._id), category]));

      if (String(categoryId).toLowerCase() === "all") {
        const gifts = await collection("gifts").find({ isDelete: { $ne: true } }).sort({ createdAt: -1 }).toArray();
        const groups = categories.map((category) => ({
          ...category,
          gift: gifts.filter((gift) => String(gift.giftCategoryId) === String(category._id)).map((gift) => normalizeGift(gift, category)),
        }));
        return res.status(200).json({ status: true, message: "Gifts fetched", gift: groups, data: groups, total: groups.length });
      }

      const objectId = toObjectId(categoryId);
      if (!objectId) return res.status(200).json({ status: false, message: "Invalid gift category." });
      const gifts = (await collection("gifts").find({ giftCategoryId: objectId, isDelete: { $ne: true } }).sort({ createdAt: -1 }).toArray())
        .map((gift) => normalizeGift(gift, categoryMap.get(String(gift.giftCategoryId))));
      return res.status(200).json({ status: true, message: "Gifts fetched", gift: gifts, data: gifts, total: gifts.length });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.post(["/gift", "/gift/svgaAdd"], compatUpload, async (req, res) => {
    try {
      const categoryId = toObjectId(req.body.category || req.body.giftCategoryId);
      if (!categoryId) return res.status(200).json({ status: false, message: "Gift category is required." });
      const files = [...(req.files?.imageVideo || []), ...(req.files?.image || []), ...(req.files?.svgaImage || [])];
      const category = await collection("giftcategories").findOne({ _id: categoryId });
      if (!category) return res.status(200).json({ status: false, message: "Gift category not found." });

      const created = [];
      const inputFiles = files.length ? files : [null];
      for (const file of inputFiles) {
        const pathName = filePath(file);
        const isSvga = /\.svga$/i.test(pathName);
        const gift = {
          giftCategoryId: categoryId,
          type: isSvga ? 2 : numberValue(req.body.type, 1),
          image: isSvga ? "" : pathName,
          svgaImage: isSvga ? pathName : "",
          icon: pathName,
          coin: numberValue(req.body.coin, 0),
          isDelete: false,
          filename: file?.filename || "",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const inserted = await collection("gifts").insertOne(gift);
        gift._id = inserted.insertedId;
        created.push(normalizeGift(gift, category));
      }
      return res.status(200).json({ status: true, message: "Gift created", gift: created, data: created });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/gift/:giftId", compatUpload, async (req, res) => {
    try {
      const id = toObjectId(req.params.giftId);
      if (!id) return res.status(200).json({ status: false, message: "giftId is required." });
      const categoryId = toObjectId(req.body.category || req.body.giftCategoryId);
      const update = { updatedAt: new Date() };
      if (categoryId) update.giftCategoryId = categoryId;
      if (req.body.coin !== undefined) update.coin = numberValue(req.body.coin, 0);
      if (req.body.type !== undefined) update.type = numberValue(req.body.type, 1);
      const image = req.files?.image?.[0] || req.files?.imageVideo?.[0];
      const svga = req.files?.svgaImage?.[0];
      if (image) {
        update.image = filePath(image);
        update.icon = update.image;
        update.type = /\.svga$/i.test(update.image) ? 2 : update.type || 1;
      }
      if (svga) {
        update.svgaImage = filePath(svga);
        update.icon = update.svgaImage;
        update.type = 2;
      }
      await collection("gifts").updateOne({ _id: id }, { $set: update });
      const stored = await collection("gifts").findOne({ _id: id });
      const category = stored?.giftCategoryId ? await collection("giftcategories").findOne({ _id: stored.giftCategoryId }) : null;
      const gift = normalizeGift(stored, category);
      return res.status(200).json({ status: true, message: "Gift updated", gift, data: gift });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.delete("/gift/:giftId", async (req, res) => {
    try {
      const id = toObjectId(req.params.giftId);
      if (!id) return res.status(200).json({ status: false, message: "giftId is required." });
      await collection("gifts").deleteOne({ _id: id });
      return res.status(200).json({ status: true, message: "Gift deleted." });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/sticker", async (req, res) => {
    return res.status(200).json({ status: true, message: "Stickers fetched", sticker: [], data: [], total: 0 });
  });

  const liveSeatList = (user, liveId, agoraUID = 1) => Array.from({ length: 15 }, (_, index) => ({
    _id: new mongoose.Types.ObjectId().toString(),
    position: index + 1,
    name: "",
    image: "",
    avatarFrameImage: "",
    country: "",
    reserved: false,
    mute: 0,
    lock: false,
    agoraUid: 0,
    userId: "",
    coin: 0,
    invite: false,
    isSpeaking: false,
    isHost: false,
  }));

  const normalizeLiveUser = (live = {}, user = {}, host = {}) => {
    const liveId = String(live._id || live.id || "");
    const liveHistoryId = String(live.liveHistoryId || live.liveStreamingId || liveId);
    const liveUserId = String(live.userId || live.liveUserId || host.userId || user._id || "");
    const country = live.country || host.country || user.country || "Palestine";
    const image = absoluteUrl(live.image || host.image || user.image || "");
    const roomImage = absoluteUrl(live.roomImage || image);
    const agoraUID = Number(live.agoraUID ?? live.agoraUid ?? 1);
    const baseUser = {
      _id: liveUserId,
      id: liveUserId,
      name: live.name || host.name || user.name || "HIKO Host",
      image,
      avatarFrameImage: user.avatarFrameImage || "",
      country,
    };

    return {
      ...live,
      _id: liveId,
      id: liveId,
      hostId: String(live.hostId || host._id || ""),
      liveUserId,
      liveStreamingId: liveHistoryId,
      channel: live.channel || liveUserId || liveId,
      agoraUID,
      token: live.token || "",
      country,
      countryFlagImage: live.countryFlagImage || host.countryFlagImage || user.countryFlagImage || "",
      image,
      rCoin: numberValue(live.rCoin ?? host.coin ?? user.rCoin ?? user.coin, 0),
      diamond: numberValue(live.diamond ?? user.diamond ?? user.coin, 0),
      name: baseUser.name,
      username: live.username || user.username || user.email || "hiko_host",
      uniqueId: live.uniqueId || user.uniqueId || host.uniqueId || "",
      isVIP: !!(live.isVIP ?? user.isVip ?? user.isVIP),
      isPublic: live.isPublic !== false,
      audio: true,
      age: numberValue(live.age ?? host.age ?? user.age, 18),
      view: numberValue(live.view, 0),
      roomImage,
      roomName: live.roomName || host.roomName || baseUser.name || "HIKO Live Room",
      roomWelcome: live.roomWelcome || "Welcome to HIKO",
      privateCode: numberValue(live.privateCode, 0),
      roomOwnerUniqueId: live.roomOwnerUniqueId || user.uniqueId || host.uniqueId || "",
      seat: Array.isArray(live.seat) && live.seat.length ? live.seat : liveSeatList(baseUser, liveId, agoraUID),
      background: live.background || "",
      filter: live.filter || "",
      isPkMode: !!live.isPkMode,
      pkView: !!live.pkView,
      disconnect: !!live.disconnect,
      duration: numberValue(live.duration, 0),
      createdAt: live.createdAt || new Date(),
      updatedAt: live.updatedAt || new Date(),
      audioConfig: live.audioConfig || { isHostMute: 0 },
      isFake: !!live.isFake,
    };
  };

  const idsFrom = (items) => [...new Set(items.map((id) => String(id || "")).filter(Boolean))]
    .map((id) => toObjectId(id))
    .filter(Boolean);

  const endLiveSession = async ({ userId, liveStreamingId } = {}) => {
    const userObjectId = toObjectId(userId);
    const liveHistoryObjectId = toObjectId(liveStreamingId);
    const query = {
      ...(liveHistoryObjectId ? { liveHistoryId: liveHistoryObjectId } : {}),
      ...(userObjectId ? { userId: userObjectId } : {}),
    };

    if (!query.liveHistoryId && !query.userId) return null;

    const live = await collection("livebroadcasters").findOne(query);
    const liveHistoryId = live?.liveHistoryId || liveHistoryObjectId;
    const hostId = live?.hostId;

    if (liveHistoryId) {
      const history = await collection("livebroadcasthistories").findOne({ _id: liveHistoryId });
      const endTime = new Date();
      const startTime = history?.startTime ? new Date(history.startTime) : endTime;
      const durationMs = Math.max(0, endTime.getTime() - startTime.getTime());
      const duration = new Date(durationMs).toISOString().slice(11, 19);
      await Promise.all([
        collection("livebroadcasthistories").updateOne({ _id: liveHistoryId }, { $set: { endTime: endTime.toISOString(), duration, updatedAt: endTime } }),
        collection("livebroadcastviews").deleteMany({ liveHistoryId }),
        collection("livebroadcasters").deleteMany({ liveHistoryId }),
      ]);
    }

    if (hostId) {
      await collection("hosts").updateOne({ _id: hostId }, { $set: { isLive: false, isBusy: false, liveHistoryId: null, updatedAt: new Date() } });
    }

    return live;
  };

  app.get("/liveUser", async (req, res) => {
    try {
      const start = Math.max(Number(req.query.start) || 0, 0);
      const limit = Math.max(Number(req.query.limit) || 20, 1);
      const country = String(req.query.country || "global").trim().toLowerCase();
      const currentUserId = toObjectId(req.query.userId);
      const filter = {
        disconnect: { $ne: true },
        ...(currentUserId ? { userId: { $ne: currentUserId } } : {}),
        ...(country && country !== "global" && country !== "all" ? { country } : {}),
      };

      const [total, liveDocs] = await Promise.all([
        collection("livebroadcasters").countDocuments(filter),
        collection("livebroadcasters").find(filter).sort({ createdAt: -1 }).skip(start).limit(limit).toArray(),
      ]);

      const userIds = idsFrom(liveDocs.map((live) => live.userId || live.liveUserId));
      const hostIds = idsFrom(liveDocs.map((live) => live.hostId));
      const [users, hosts] = await Promise.all([
        userIds.length ? collection("users").find({ _id: { $in: userIds } }).toArray() : [],
        hostIds.length ? collection("hosts").find({ _id: { $in: hostIds } }).toArray() : [],
      ]);
      const userMap = new Map(users.map((user) => [String(user._id), user]));
      const hostMap = new Map(hosts.map((host) => [String(host._id), host]));
      const liveUser = liveDocs.map((live) => normalizeLiveUser(live, userMap.get(String(live.userId)) || {}, hostMap.get(String(live.hostId)) || {}));

      return res.status(200).json({ status: true, message: "Live users fetched", liveUser, users: liveUser, data: liveUser, total });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/liveUser/checkLive", async (req, res) => {
    try {
      const userObjectId = toObjectId(req.query.userId);
      if (!userObjectId) return res.status(200).json({ status: true, message: "User is not live", liveUser: null, isLive: false });
      const live = await collection("livebroadcasters").findOne({ userId: userObjectId });
      const user = await collection("users").findOne({ _id: userObjectId });
      return res.status(200).json({
        status: true,
        message: live ? "User is live" : "User is not live",
        liveUser: live ? normalizeLiveUser(live, user || {}) : null,
        isLive: !!live,
      });
    } catch (error) {
      return withCompatError(res, error);
    }
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
      _id: new mongoose.Types.ObjectId().toString(),
      position: index + 1,
      name: "",
      image: "",
      avatarFrameImage: "",
      country: "",
      reserved: false,
      mute: 0,
      lock: false,
      agoraUid: 0,
      userId: "",
      coin: 0,
      invite: false,
      isSpeaking: false,
      isHost: false,
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
      audioConfig: { isHostMute: 0 },
    };
  };

  app.patch("/liveUser/live", compatUpload, async (req, res) => {
    try {
      const userId = req.query.userId || req.body?.userId;
      const userObjectId = toObjectId(userId);
      const rawUser = userObjectId
        ? await collection("users").findOne({ _id: userObjectId })
        : await collection("users").findOne({ uniqueId: "100001" }) || await collection("users").findOne({});

      if (!rawUser) return res.status(200).json({ status: false, message: "User not found.", liveUser: null });

      let host = await collection("hosts").findOne({ userId: rawUser._id });
      if (!host) {
        host = {
          _id: new mongoose.Types.ObjectId(),
          userId: rawUser._id,
          name: rawUser.name || "HIKO Host",
          gender: rawUser.gender || "",
          age: rawUser.age || 18,
          email: rawUser.email || "",
          countryFlagImage: rawUser.countryFlagImage || "",
          country: String(rawUser.country || "global").toLowerCase(),
          image: rawUser.image || "",
          uniqueId: rawUser.uniqueId ? `H${rawUser.uniqueId}` : `H${String(rawUser._id).slice(-8)}`,
          status: 2,
          isBlock: false,
          isFake: false,
          isOnline: true,
          isBusy: true,
          isLive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        await collection("hosts").insertOne(host);
        await collection("users").updateOne({ _id: rawUser._id }, { $set: { isHost: true, hostId: host._id, updatedAt: new Date() } });
      }

      const oldLives = await collection("livebroadcasters").find({
        $or: [{ userId: rawUser._id }, { hostId: host._id }],
      }).toArray();
      const oldHistoryIds = oldLives.map((live) => live.liveHistoryId).filter(Boolean);
      if (oldHistoryIds.length) {
        await Promise.all([
          collection("livebroadcastviews").deleteMany({ liveHistoryId: { $in: oldHistoryIds } }),
          collection("livebroadcasters").deleteMany({ liveHistoryId: { $in: oldHistoryIds } }),
        ]);
      }

      const now = new Date();
      const liveHistoryId = new mongoose.Types.ObjectId();
      const liveId = new mongoose.Types.ObjectId();
      const uploadedRoomImage = filePath(req.files?.roomImage?.[0]);
      const roomImage = uploadedRoomImage ? absoluteUrl(uploadedRoomImage, req) : req.body?.roomImage || rawUser.image || host.image || "";
      const liveUser = normalizeLiveUser({
        _id: liveId,
        liveHistoryId,
        hostId: host._id,
        userId: rawUser._id,
        name: rawUser.name || host.name,
        username: rawUser.username || rawUser.email || "",
        uniqueId: rawUser.uniqueId || host.uniqueId,
        image: rawUser.image || host.image || "",
        country: String(rawUser.country || host.country || "global").toLowerCase(),
        countryFlagImage: rawUser.countryFlagImage || host.countryFlagImage || "",
        agoraUid: numberValue(req.body?.agoraUID, 1),
        channel: req.body?.channel || String(rawUser._id),
        token: "",
        view: 0,
        rCoin: rawUser.rCoin || host.coin || rawUser.coin || 0,
        diamond: rawUser.diamond || rawUser.coin || 0,
        isVIP: !!rawUser.isVip,
        isPublic: String(req.body?.isPublic || "true") !== "false",
        audio: true,
        age: rawUser.age || host.age || 18,
        roomImage,
        roomName: req.body?.roomName || `${rawUser.name || host.name || "HIKO"} Room`,
        roomWelcome: req.body?.roomWelcome || "Welcome to HIKO",
        privateCode: req.body?.privateCode || 0,
        roomOwnerUniqueId: rawUser.uniqueId || host.uniqueId || "",
        background: req.body?.background || "",
        seat: liveSeatList(rawUser, liveId, numberValue(req.body?.agoraUID, 1)),
        createdAt: now,
        updatedAt: now,
        audioConfig: { isHostMute: 0 },
      }, rawUser, host);

      await Promise.all([
        collection("livebroadcasthistories").insertOne({
          _id: liveHistoryId,
          hostId: host._id,
          coins: 0,
          gifts: 0,
          audienceCount: 0,
          liveComments: 0,
          startTime: now.toISOString(),
          endTime: "",
          duration: "00:00:00",
          createdAt: now,
          updatedAt: now,
        }),
        collection("livebroadcasters").insertOne({
          ...liveUser,
          _id: liveId,
          liveHistoryId,
          hostId: host._id,
          userId: rawUser._id,
          agoraUid: liveUser.agoraUID,
        }),
        collection("hosts").updateOne({ _id: host._id }, {
          $set: {
            isOnline: true,
            isBusy: true,
            isLive: true,
            liveHistoryId,
            agoraUid: liveUser.agoraUID,
            channel: liveUser.channel,
            token: liveUser.token,
            updatedAt: now,
          },
        }),
        collection("users").updateOne({ _id: rawUser._id }, { $set: { isOnline: true, isBusy: true, updatedAt: now } }),
      ]);

      return res.status(200).json({ status: true, message: "Live stream started", liveUser });
    } catch (error) {
      return res.status(200).json({ status: false, message: error.message || "Failed to start live stream", liveUser: null });
    }
  });

  app.delete("/liveUser/terminateAudioSession", async (req, res) => {
    try {
      await endLiveSession({ userId: req.query.userId, liveStreamingId: req.query.liveStreamingId });
      return res.status(200).json({ status: true, message: "Audio session terminated." });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/liveUser/updateRoomImage", compatUpload, async (req, res) => {
    try {
      const liveUserId = toObjectId(req.body?.liveUserId || req.query.liveUserId);
      const roomImagePath = filePath(req.files?.roomImage?.[0]);
      const roomImage = absoluteUrl(roomImagePath, req);
      if (!liveUserId || !roomImage) return res.status(200).json({ status: false, message: "Invalid room image update." });
      const live = await collection("livebroadcasters").findOne({ userId: liveUserId });
      await collection("livebroadcasters").updateOne({ userId: liveUserId }, { $set: { roomImage, updatedAt: new Date() } });
      if (live?.liveHistoryId && global.io) {
        global.io.in(String(live.liveHistoryId)).emit("roomImage", roomImage);
      }
      return res.status(200).json({ status: true, message: "Room image updated.", roomImage });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/liveUser/updatePrivateCode", async (req, res) => {
    try {
      const liveUserId = toObjectId(req.query.liveUserId);
      const privateCode = numberValue(req.query.privateCode, 0);
      if (!liveUserId) return res.status(200).json({ status: false, message: "liveUserId is required." });
      await collection("livebroadcasters").updateOne({ userId: liveUserId }, { $set: { privateCode, isPublic: privateCode === 0, updatedAt: new Date() } });
      return res.status(200).json({ status: true, message: "Private code updated.", privateCode });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/getStreamingSummary", async (req, res) => {
    try {
      const liveHistoryId = toObjectId(req.query.liveStreamingId);
      const history = liveHistoryId ? await collection("livebroadcasthistories").findOne({ _id: liveHistoryId }) : null;
      return res.status(200).json({
        status: true,
        message: "Live summary fetched",
        liveStreamingHistory: history || { _id: req.query.liveStreamingId || "", coins: 0, gifts: 0, audienceCount: 0, liveComments: 0, duration: "00:00:00" },
      });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/block/getUsersWhoBlockedMe", async (req, res) => {
    return res.status(200).json({ status: true, message: "Blocked users fetched", users: [], data: [], total: 0 });
  });

  app.get("/liveUser/checkUserLiveOrNot", async (req, res) => {
    try {
      const userObjectId = toObjectId(req.query.userId);
      const live = userObjectId ? await collection("livebroadcasters").findOne({ userId: userObjectId }) : null;
      return res.status(200).json({ status: true, message: live ? "User is live" : "User is not live", liveUser: live ? normalizeLiveUser(live) : null, isLive: !!live });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/dashboard", async (req, res) => {
    try {
      const [totalUser, activeUser, vipUser, liveUser, post, video, report, histories] = await Promise.all([
        collection("users").countDocuments({}),
        collection("users").countDocuments({ isBlock: { $ne: true } }),
        collection("users").countDocuments({ isVip: true }),
        collection("hosts").countDocuments({ isLive: true }),
        collection("posts").countDocuments({}),
        collection("videos").countDocuments({}),
        collection("reports").countDocuments({}),
        collection("histories").find({}).limit(500).toArray(),
      ]);
      const revenue = histories.reduce((total, item) => ({
        dollar: total.dollar + numberValue(item.dollar || item.amount, 0),
        rCoin: total.rCoin + numberValue(item.rCoin || item.coin, 0),
        diamond: total.diamond + numberValue(item.userCoin || item.coin, 0),
      }), { dollar: 0, rCoin: 0, diamond: 0 });

      return res.status(200).json({
        status: true,
        message: "Dashboard fetched",
        dashboard: { totalUser, liveUser, activeUser, vipUser, revenue, post, video, report },
      });
    } catch (error) {
      return withCompatError(res, error);
    }
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

  app.get("/setting/getGameSetting", async (req, res) => {
    try {
      const setting = await getSettingDocument();
      return res.status(200).json({ status: true, message: "Game setting fetched", game: setting.game || [], setting });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/setting/addGame/:settingId", compatUpload, async (req, res) => {
    try {
      const setting = await getSettingDocument();
      const image = filePath(req.files?.image?.[0]);
      const game = {
        _id: new mongoose.Types.ObjectId(),
        name: req.body.name || "Game",
        link: req.body.link || req.body.gameLink || "",
        image,
        minWinPercent: numberValue(req.body.minWinPercent, 0),
        maxWinPercent: numberValue(req.body.maxWinPercent, 100),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await collection("settings").updateOne({ _id: setting._id }, { $push: { game }, $set: { updatedAt: new Date() } });
      const updated = await getSettingDocument();
      return res.status(200).json({ status: true, message: "Game created", setting: updated, game: updated.game });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/setting/updateGame/:settingId", compatUpload, async (req, res) => {
    try {
      const gameId = toObjectId(req.body.gameId);
      if (!gameId) return res.status(200).json({ status: false, message: "gameId is required." });
      const setting = await getSettingDocument();
      const games = (setting.game || []).map((game) => {
        if (String(game._id) !== String(gameId)) return game;
        const image = req.files?.image?.[0] ? filePath(req.files.image[0]) : game.image;
        return {
          ...game,
          name: req.body.name || game.name,
          link: req.body.link || game.link,
          image,
          minWinPercent: req.body.minWinPercent !== undefined ? numberValue(req.body.minWinPercent, game.minWinPercent) : game.minWinPercent,
          maxWinPercent: req.body.maxWinPercent !== undefined ? numberValue(req.body.maxWinPercent, game.maxWinPercent) : game.maxWinPercent,
          updatedAt: new Date(),
        };
      });
      await collection("settings").updateOne({ _id: setting._id }, { $set: { game: games, updatedAt: new Date() } });
      const updated = await getSettingDocument();
      return res.status(200).json({ status: true, message: "Game updated", setting: updated, game: updated.game });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/setting/updateGameStatus/:gameId", async (req, res) => {
    try {
      const gameId = toObjectId(req.params.gameId);
      if (!gameId) return res.status(200).json({ status: false, message: "gameId is required." });
      const setting = await getSettingDocument();
      const games = (setting.game || []).map((game) => String(game._id) === String(gameId) ? { ...game, isActive: !game.isActive, updatedAt: new Date() } : game);
      await collection("settings").updateOne({ _id: setting._id }, { $set: { game: games, updatedAt: new Date() } });
      const updated = await getSettingDocument();
      return res.status(200).json({ status: true, message: "Game status updated", setting: updated, game: updated.game });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.delete("/setting/deleteGame/:settingId", async (req, res) => {
    try {
      const gameId = toObjectId(req.query.gameId);
      if (!gameId) return res.status(200).json({ status: false, message: "gameId is required." });
      const setting = await getSettingDocument();
      const games = (setting.game || []).filter((game) => String(game._id) !== String(gameId));
      await collection("settings").updateOne({ _id: setting._id }, { $set: { game: games, updatedAt: new Date() } });
      const updated = await getSettingDocument();
      return res.status(200).json({ status: true, message: "Game deleted", setting: updated, game: updated.game });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/complain", async (req, res) => {
    try {
      const type = String(req.query.type || "pending").toLowerCase();
      const solved = type === "solved";
      let complain = await collection("complains").find({ solved }).sort({ createdAt: -1 }).toArray();

      if (complain.length === 0) {
        const user = await collection("users").findOne({}) || {};
        complain = [{
          _id: new mongoose.Types.ObjectId(),
          userId: cleanPerson(user),
          image: "",
          message: solved ? "Demo solved complain request" : "Demo pending complain request",
          contact: user.email || user.mobileNumber || "demo@vola.local",
          solved,
          createdAt: new Date(),
        }];
      } else {
        const userIds = complain.map((item) => item.userId).filter(Boolean).map((id) => toObjectId(id) || id);
        const users = await collection("users").find({ _id: { $in: userIds.filter((id) => id instanceof mongoose.Types.ObjectId) } }).toArray();
        const userMap = new Map(users.map((user) => [String(user._id), cleanPerson(user)]));
        complain = complain.map((item) => ({
          ...item,
          userId: typeof item.userId === "object" && item.userId?.name ? item.userId : (userMap.get(String(item.userId)) || cleanPerson({ _id: item.userId })),
        }));
      }

      return res.status(200).json({ status: true, message: "Complains fetched", complain, data: complain, total: complain.length });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.patch("/complain/:complainId", async (req, res) => {
    try {
      const id = toObjectId(req.params.complainId);
      if (!id) return res.status(200).json({ status: false, message: "complainId is required." });
      await collection("complains").updateOne({ _id: id }, { $set: { solved: true, updatedAt: new Date() } });
      const complain = await collection("complains").findOne({ _id: id }) || { _id: id, solved: true };
      return res.status(200).json({ status: true, message: "Complain solved", complain });
    } catch (error) {
      return withCompatError(res, error);
    }
  });

  app.get("/setting", async (req, res) => {
    try {
      const stored = await getSettingDocument();
      const setting = {
        ...stored,
        projectName: "HIKO",
        agoraKey: stored.agoraAppId || "d47410e2848749f4b8b0bfb727a27453",
        agoraCertificate: stored.agoraAppCertificate || "ce9a2a19fcc14ed9be64c839f3641833",
        agoraAppId: stored.agoraAppId || "d47410e2848749f4b8b0bfb727a27453",
        agoraAppCertificate: stored.agoraAppCertificate || "ce9a2a19fcc14ed9be64c839f3641833",
        privacyPolicyLink: stored.privacyPolicyLink || "https://vola.alkmal.com/privacy-policy",
        termsOfUsePolicyLink: stored.termsOfUsePolicyLink || "https://vola.alkmal.com/terms-of-use",
        currency: stored.currency || { symbol: "$", currencyCode: "USD", countryCode: "US", name: "US Dollar", isDefault: true },
        isAppActive: stored.isAppEnabled !== false,
        isFake: false,
      };
      return res.status(200).json({ status: true, message: "Setting fetched", setting, data: setting });
    } catch (error) {
      return withCompatError(res, error);
    }
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
