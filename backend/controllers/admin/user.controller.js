const User = require("../../models/user.model");
const History = require("../../models/history.model");
const FollowerFollowing = require("../../models/followerFollowing.model");

const mongoose = require("mongoose");

const generateHistoryUniqueId = require("../../util/generateHistoryUniqueId");
const generateUniqueId = require("../../util/generateUniqueId");
const { deleteFile } = require("../../util/deletefile");

const parsePageNumber = (value, fallback = 1) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseLimit = (value, fallback = 20, max = 100) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const textValue = (value) => (value === undefined || value === null ? "" : String(value).trim());

const optionalBoolean = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return undefined;
};

const optionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const userProjection =
  "name selfIntro gender bio age image email countryFlagImage country loginType uniqueId coin spentCoins rechargedCoins isOnline isBlock isVip isHost identity mobileNumber countryCode fcmToken createdAt lastlogin";

const uploadedImage = (req) => req.file?.path || textValue(req.body?.image);

const removeUploadedFile = (req) => {
  if (req.file) deleteFile(req.file);
};

const deleteLocalImage = (imagePath) => {
  if (!imagePath || /^https?:\/\//i.test(imagePath)) return;
  deleteFile(imagePath);
};

const buildEditableUserPayload = (body = {}, req = null) => {
  const payload = {};
  const stringFields = ["name", "selfIntro", "gender", "bio", "email", "countryFlagImage", "country", "identity", "mobileNumber", "countryCode", "fcmToken"];

  stringFields.forEach((field) => {
    const value = textValue(body[field]);
    if (value) payload[field] = field === "country" || field === "gender" ? value.toLowerCase() : value;
  });

  const image = req ? uploadedImage(req) : textValue(body.image);
  if (image) payload.image = image;

  ["age", "coin", "spentCoins", "rechargedCoins", "loginType"].forEach((field) => {
    const value = optionalNumber(body[field]);
    if (value !== undefined) payload[field] = value;
  });

  ["isVip", "isBlock", "isOnline", "isHost"].forEach((field) => {
    const value = optionalBoolean(body[field]);
    if (value !== undefined) payload[field] = value;
  });

  return payload;
};

//get users
exports.retrieveUserList = async (req, res) => {
  try {
    const start = parsePageNumber(req.query.start, 1);
    const limit = parseLimit(req.query.limit, 20, 100);
    const skip = (start - 1) * limit;

    const searchString = req.query.search || "";
    const startDate = req.query.startDate || "All";
    const endDate = req.query.endDate || "All";

    const genderFilter = req.query.gender || "";
    const isVipFilter = req.query.isVip || false;
    const isBlockFilter = req.query.isBlock || false;
    const isOnlineFilter = req.query.isOnline || false;
    const isBusyFilter = req.query.isBusy || false;
    const isHostFilter = req.query.isHost || false;
    const countryFilter = req?.query?.country?.trim().toLowerCase() || "";

    let dateFilterQuery = {};
    if (startDate !== "All" && endDate !== "All") {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999);

      dateFilterQuery = {
        createdAt: {
          $gte: startDateObj,
          $lte: endDateObj,
        },
      };
    }

    let searchQuery = {};
    if (searchString !== "All" && searchString !== "") {
      const safeSearch = escapeRegex(searchString.trim());
      searchQuery = {
        $or: [{ name: { $regex: safeSearch, $options: "i" } }, { email: { $regex: safeSearch, $options: "i" } }, { uniqueId: { $regex: safeSearch, $options: "i" } }],
      };
    }

    let filter = {
      ...dateFilterQuery,
      ...searchQuery,
    };

    if (genderFilter) {
      filter.gender = genderFilter;
    }

    if (isVipFilter) {
      filter.isVip = isVipFilter === "true";
    }

    if (isBlockFilter) {
      filter.isBlock = isBlockFilter === "true";
    }

    if (isOnlineFilter) {
      filter.isOnline = isOnlineFilter === "true";
    }

    if (isBusyFilter) {
      filter.isBusy = isBusyFilter === "true";
    }

    if (isHostFilter) {
      filter.isHost = isHostFilter === "true";
    }

    if (countryFilter) {
      filter.country = countryFilter;
    }

    const projection = "_id uniqueId name email image countryFlagImage country gender coin rechargedCoins isHost isVip isBlock isOnline loginType createdAt lastlogin";
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select(projection).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    ]);

    const userIds = users.map((user) => user._id);
    const followingCounts = userIds.length
      ? await FollowerFollowing.aggregate([
          { $match: { followerId: { $in: userIds } } },
          { $group: { _id: "$followerId", count: { $sum: 1 } } },
        ])
      : [];
    const followingCountMap = new Map(followingCounts.map((item) => [String(item._id), item.count]));
    const data = users.map((user) => ({ ...user, totalFollowings: followingCountMap.get(String(user._id)) || 0 }));

    return res.status(200).json({
      status: true,
      message: "Retrieved real users!",
      total,
      data,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//toggle user's block status
exports.modifyUserBlockStatus = async (req, res, next) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    const user = await User.findById(userId).select("uniqueId name image countryFlagImage country gender coin rechargedCoins isHost isVip isBlock isFake loginType createdAt");
    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    user.isBlock = !user.isBlock;
    await user.save();

    return res.status(200).json({
      status: true,
      message: `User has been ${user.isBlock ? "blocked" : "unblocked"} successfully.`,
      data: user,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "An error occurred while updating user block status." });
  }
};

//get user's profile
exports.fetchUserProfile = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    const [user] = await Promise.all([
      User.findOne({ _id: userId }).select("name selfIntro gender bio age image email countryFlagImage country loginType uniqueId coin spentCoins rechargedCoins isOnline").lean(),
    ]);

    if (!user) {
      return res.status(200).json({ status: false, message: "User not found." });
    }

    return res.status(200).json({ status: true, message: "The user has retrieved their profile.", user: user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//create user from admin panel
exports.createUser = async (req, res) => {
  try {
    const name = textValue(req.body?.name);
    const email = textValue(req.body?.email);
    const requestedUniqueId = textValue(req.body?.uniqueId);

    if (!name) {
      removeUploadedFile(req);
      return res.status(200).json({ status: false, message: "Name is required." });
    }

    const duplicateChecks = [];
    if (email) duplicateChecks.push({ email });
    if (requestedUniqueId) duplicateChecks.push({ uniqueId: requestedUniqueId });

    if (duplicateChecks.length) {
      const existingUser = await User.findOne({ $or: duplicateChecks }).select("_id email uniqueId").lean();
      if (existingUser) {
        removeUploadedFile(req);
        return res.status(200).json({
          status: false,
          message: existingUser.email === email ? "Email already exists." : "Unique ID already exists.",
        });
      }
    }

    const uniqueId = requestedUniqueId || (await generateUniqueId());
    const payload = buildEditableUserPayload(req.body, req);

    const user = await User.create({
      ...payload,
      name,
      email,
      uniqueId,
      loginType: payload.loginType || 3,
      identity: payload.identity || `admin-${uniqueId}`,
      firebaseUid: textValue(req.body?.firebaseUid) || `admin-${uniqueId}`,
      provider: textValue(req.body?.provider) || "admin",
      date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
    });

    const data = await User.findById(user._id).select(userProjection).lean();

    return res.status(200).json({
      status: true,
      message: "User created successfully.",
      data,
      user: data,
    });
  } catch (error) {
    removeUploadedFile(req);

    if (error.code === 11000) {
      return res.status(200).json({ status: false, message: "User already exists with the same unique field." });
    }

    console.error("Create User Error:", error);
    return res.status(500).json({ status: false, message: error.message || "Failed to create user." });
  }
};

//update user from admin panel
exports.updateUser = async (req, res) => {
  try {
    const userId = req.body?.userId || req.query?.userId;

    if (!userId) {
      removeUploadedFile(req);
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      removeUploadedFile(req);
      return res.status(200).json({ status: false, message: "Invalid userId." });
    }

    const user = await User.findById(userId).select(userProjection).lean();
    if (!user) {
      removeUploadedFile(req);
      return res.status(200).json({ status: false, message: "User not found." });
    }

    const requestedEmail = textValue(req.body?.email);
    const requestedUniqueId = textValue(req.body?.uniqueId);
    const duplicateChecks = [];
    if (requestedEmail && requestedEmail !== user.email) duplicateChecks.push({ email: requestedEmail });
    if (requestedUniqueId && requestedUniqueId !== user.uniqueId) duplicateChecks.push({ uniqueId: requestedUniqueId });

    if (duplicateChecks.length) {
      const existingUser = await User.findOne({ _id: { $ne: userId }, $or: duplicateChecks }).select("_id email uniqueId").lean();
      if (existingUser) {
        removeUploadedFile(req);
        return res.status(200).json({
          status: false,
          message: existingUser.email === requestedEmail ? "Email already exists." : "Unique ID already exists.",
        });
      }
    }

    const payload = buildEditableUserPayload(req.body, req);
    if (requestedUniqueId) payload.uniqueId = requestedUniqueId;
    if (textValue(req.body?.firebaseUid)) payload.firebaseUid = textValue(req.body.firebaseUid);
    if (textValue(req.body?.provider)) payload.provider = textValue(req.body.provider);

    const updatedUser = await User.findByIdAndUpdate(userId, payload, { new: true }).select(userProjection).lean();

    if (req.file && user.image && user.image !== updatedUser.image) {
      deleteLocalImage(user.image);
    }

    return res.status(200).json({
      status: true,
      message: "User updated successfully.",
      data: updatedUser,
      user: updatedUser,
    });
  } catch (error) {
    removeUploadedFile(req);

    if (error.code === 11000) {
      return res.status(200).json({ status: false, message: "User already exists with the same unique field." });
    }

    console.error("Update User Error:", error);
    return res.status(500).json({ status: false, message: error.message || "Failed to update user." });
  }
};

//admin can add or deduct coins from a user's wallet
exports.updateUserCoin = async (req, res, next) => {
  try {
    const { userId, coin, action } = req.body;

    if (!userId || !coin || !action) {
      return res.status(200).json({
        status: false,
        message: "userId, coin, and action are required fields.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(200).json({ status: false, message: "Invalid userId." });
    }

    if (!["add", "deduct"].includes(action)) {
      return res.status(200).json({
        status: false,
        message: "Invalid action. Must be 'add' or 'deduct'.",
      });
    }

    if (isNaN(coin) || coin <= 0) {
      return res.status(200).json({
        status: false,
        message: "Coin must be a positive number.",
      });
    }

    const [uniqueId, user] = await Promise.all([generateHistoryUniqueId(), User.findById(userId).lean()]);

    if (!user) {
      return res.status(404).json({
        status: false,
        message: "User not found.",
      });
    }

    let newCoinBalance = user.coin;
    let updatedFields = {};

    if (action === "add") {
      newCoinBalance += coin;
      updatedFields = {
        coin: newCoinBalance,
        rechargedCoins: (user.rechargedCoins || 0) + coin,
      };
    } else {
      if (user.coin < coin) {
        return res.status(200).json({
          status: false,
          message: "Insufficient balance to deduct coins.",
        });
      }
      newCoinBalance -= coin;
      updatedFields = {
        coin: newCoinBalance,
      };
    }

    await Promise.all([
      User.findByIdAndUpdate(userId, updatedFields, { new: true }).lean(),
      History.create({
        uniqueId: uniqueId,
        type: action === "add" ? 14 : 15,
        userId,
        userCoin: coin,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }),
    ]);

    return res.status(200).json({
      status: true,
      message: `Successfully ${action === "add" ? "added" : "deducted"} ${coin} coins.`,
    });
  } catch (error) {
    console.error("Admin Coin Update Error:", error);
    return res.status(500).json({
      status: false,
      message: "Internal server error.",
      error: error.message,
    });
  }
};
