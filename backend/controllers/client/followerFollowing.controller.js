const FollowerFollowing = require("../../models/followerFollowing.model");
const User = require("../../models/user.model");
const Host = require("../../models/host.model");
const Block = require("../../models/block.model");
const mongoose = require("mongoose");
const admin = require("../../util/privateKey");

const sendFollowNotification = async (token, fromUser) => {
  if (!token) return;
  const firebaseAdmin = await admin;
  if (!firebaseAdmin?.apps?.length) {
    console.warn("Follow notification skipped: Firebase Admin is not configured.");
    return;
  }

  const followerId = String(fromUser?._id || "");
  const followerName = String(fromUser?.name || fromUser?.uniqueId || "مستخدم").trim();
  const title = "متابع جديد";
  const body = `${followerName} قام بمتابعتك`;

  await firebaseAdmin.messaging().send({
    token,
    notification: { title, body },
    data: {
      type: "USER",
      data: followerId,
      userId: followerId,
      title,
      body,
      image: String(fromUser?.image || ""),
    },
    android: {
      priority: "high",
      notification: { channelId: "01", sound: "default" },
    },
  });
};

exports.handleFollowUnfollow = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    if (!req.query.followingId) {
      return res.status(200).json({ status: false, message: "Invalid request. followingId is required." });
    }

    const followerId = new mongoose.Types.ObjectId(req.user.userId);
    const followingId = new mongoose.Types.ObjectId(req.query.followingId);
    const [fromUser, toUser, existingFollow, isBlocked] = await Promise.all([
      User.findById(followerId).select("_id name uniqueId image").lean(),
      Host.findById(followingId).select("_id userId isBlock fcmToken").lean(),
      FollowerFollowing.findOne({ followerId, followingId }).select("_id").lean(),
      Block.findOne({ userId: followerId, hostId: followingId }).select("_id").lean(),
    ]);

    if (!fromUser) return res.status(200).json({ status: false, message: "User not found." });
    if (!toUser) return res.status(200).json({ status: false, message: "Host not found." });
    if (toUser.isBlock) return res.status(403).json({ status: false, message: "Host is blocked." });
    if (fromUser._id.equals(toUser._id) || (toUser.userId && fromUser._id.equals(toUser.userId))) {
      return res.status(200).json({ status: false, message: "You can't follow your own account." });
    }
    if (isBlocked) {
      return res.status(403).json({ status: false, message: "You have blocked this host. Unblock to follow." });
    }

    if (existingFollow) {
      await FollowerFollowing.deleteOne({ followerId, followingId });
      return res.status(200).json({ status: true, message: "Unfollowed successfully.", isFollow: false });
    }

    await new FollowerFollowing({ followerId, followingId }).save();
    const targetAccount = toUser.userId
      ? await User.findById(toUser.userId).select("fcmToken").lean()
      : null;

    res.status(200).json({ status: true, message: "Followed successfully.", isFollow: true });
    sendFollowNotification(toUser.fcmToken || targetAccount?.fcmToken, fromUser).catch((error) => {
      console.error("Follow notification failed:", error.message || error);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

exports.getFollowingList = async (req, res) => {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ status: false, message: "Unauthorized access. Invalid token." });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);
    const [user, followingList] = await Promise.all([
      User.findById(userId).select("_id").lean(),
      FollowerFollowing.find({ followerId: userId }).populate("followingId", "_id name image").sort({ createdAt: -1 }).lean(),
    ]);

    if (!user) return res.status(200).json({ status: false, message: "User not found." });
    if (user.isBlock) return res.status(403).json({ status: false, message: "User is blocked." });

    res.status(200).json({
      status: true,
      message: "Retrieved following users successfully.",
      followingList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};

exports.getFollowerList = async (req, res) => {
  try {
    if (!req.query.hostId) {
      return res.status(200).json({ status: false, message: "hostId is required." });
    }

    const hostId = new mongoose.Types.ObjectId(req.query.hostId);
    const [host, followerList] = await Promise.all([
      Host.findById(hostId).select("_id isBlock").lean(),
      FollowerFollowing.find({ followingId: hostId }).populate("followerId", "_id name image").sort({ createdAt: -1 }).lean(),
    ]);

    if (!host) return res.status(200).json({ status: false, message: "Host not found." });
    if (host.isBlock) return res.status(403).json({ status: false, message: "Host is blocked." });

    res.status(200).json({
      status: true,
      message: "Retrieved followers successfully.",
      followerList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
