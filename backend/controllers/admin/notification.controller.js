const Notification = require("../../models/notification.model");

//import model
const User = require("../../models/user.model");
const Host = require("../../models/host.model");

//mongoose
const mongoose = require("mongoose");

//private key
const admin = require("../../util/privateKey");

//deletefile
const { deleteFile } = require("../../util/deletefile");

const notificationImage = (req) => (req.file ? `/${req.file.path.replace(/\\/g, "/").replace(/^\/+/, "")}` : "");

const firebasePayload = ({ token, tokens, title, message, image, data = {} }) => {
  const cleanTitle = (title || "Vola").trim();
  const cleanMessage = (message || "").trim();
  const payload = {
    notification: {
      title: cleanTitle,
      body: cleanMessage,
      ...(image ? { imageUrl: image.startsWith("http") ? image : `https://vola.alkmal.com${image}` } : {}),
    },
    data: {
      type: data.type || "ADMIN",
      title: cleanTitle,
      body: cleanMessage,
      message: cleanMessage,
      image,
      data: data.data || "",
      ...data,
    },
  };
  if (token) payload.token = token;
  if (tokens) payload.tokens = tokens;
  return payload;
};

const ensureFirebaseMessaging = async () => {
  const adminInstance = await admin;
  if (!adminInstance.apps?.length) {
    throw new Error("Firebase Admin SDK is not configured. Add a valid Firebase service account privateKey in settings.");
  }
  return adminInstance.messaging();
};

//sending a notification from admin to a specific user
exports.sendNotificationToSingleUserByAdmin = async (req, res) => {
  try {
    const { userId, title, message } = req.body;

    if (!userId) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "User ID is required." });
    }

    if (!title || !message) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Both title and message are required." });
    }

    const user = await User.findById(userId).select("_id isBlock fcmToken").lean();
    if (!user) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "User not found." });
    }

    if (user.isBlock) {
      if (req.file) deleteFile(req.file);
      return res.status(403).json({ status: false, message: "This user has been blocked by the admin." });
    }

    if (!user.fcmToken) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "User does not have a valid FCM token." });
    }

    try {
      const image = notificationImage(req);
      const notificationPayload = firebasePayload({ token: user.fcmToken, title, message, image });
      const messaging = await ensureFirebaseMessaging();
      const response = await messaging.send(notificationPayload);
      console.log("Successfully sent with response: ", response);

      await new Notification({
        user: user._id,
        notificationPersonType: 1, // 1 = User
        title: title.trim(),
        message: message.trim(),
        image,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }).save();

      return res.status(200).json({ status: true, message: "Notification sent successfully." });
    } catch (error) {
      if (req.file) deleteFile(req.file);
      console.error("Error sending notification:", error);
      return res.status(200).json({ status: false, message: error.message || "Failed to send notification." });
    }
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error("Error in sendNotificationToSingleUserByAdmin:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//sending a notification from admin to a specific host
exports.sendNotificationToSingleHostByAdmin = async (req, res) => {
  try {
    const { hostId, title, message } = req.body;

    if (!hostId) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Host ID is required." });
    }

    if (!title || !message) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Both title and message are required." });
    }

    const host = await Host.findById(hostId).select("_id isBlock fcmToken").lean();
    if (!host) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Host not found." });
    }

    if (host.isBlock) {
      if (req.file) deleteFile(req.file);
      return res.status(403).json({ status: false, message: "This host has been blocked by the admin." });
    }

    if (!host.fcmToken) {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Host does not have a valid FCM token." });
    }

    try {
      const image = notificationImage(req);
      const notificationPayload = firebasePayload({ token: host.fcmToken, title, message, image });
      const messaging = await ensureFirebaseMessaging();
      const response = await messaging.send(notificationPayload);
      console.log("Successfully sent with response: ", response);

      await new Notification({
        host: host._id,
        notificationPersonType: 2, // 2 = Host
        title: title.trim(),
        message: message.trim(),
        image,
        date: new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
      }).save();

      return res.status(200).json({ status: true, message: "Notification sent successfully." });
    } catch (error) {
      if (req.file) deleteFile(req.file);
      console.error("Error sending notification:", error);
      return res.status(200).json({ status: false, message: error.message || "Failed to send notification." });
    }
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error("Error in sendNotificationToSingleHostByAdmin:", error);
    return res.status(500).json({ status: false, message: "Internal server error." });
  }
};

//sending a notification from admin to user/host/both
exports.sendNotifications = async (req, res) => {
  try {
    const { notificationType, title, message } = req.body;
    const image = notificationImage(req);
    const date = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

    let targets = [];

    if (notificationType?.trim().toLowerCase() === "user") {
      targets = await User.find({ isBlock: false }, "_id fcmToken");
    } else if (notificationType?.trim().toLowerCase() === "host") {
      targets = await Host.find({ isBlock: false }, "_id fcmToken");
    } else if (notificationType?.trim().toLowerCase() === "both") {
      const [users, hosts] = await Promise.all([User.find({ isBlock: false }, "_id fcmToken"), Host.find({ isBlock: false }, "_id fcmToken")]);
      targets = [...users.map((u) => ({ ...u.toObject(), isUser: true })), ...hosts.map((h) => ({ ...h.toObject(), isHost: true }))];
    } else {
      if (req.file) deleteFile(req.file);
      return res.status(200).json({ status: false, message: "Please pass a valid notificationType!" });
    }

    const notifications = [];
    const tokens = [];

    targets.forEach((item) => {
      const isUser = item.isUser || (!item.isHost && notificationType?.trim().toLowerCase() === "user");
      const isHost = item.isHost || (!item.isUser && notificationType?.trim().toLowerCase() === "host");

      notifications.push({
        ...(isUser ? { user: item._id, notificationPersonType: 1 } : {}),
        ...(isHost ? { host: item._id, notificationPersonType: 2 } : {}),
        title,
        message,
        image,
        date,
      });

      if (item.fcmToken?.trim()) tokens.push(item.fcmToken);
    });

    if (!tokens.length) {
      if (notifications.length) {
        await Notification.insertMany(notifications);
      }
      return res.status(200).json({ status: false, message: "No valid FCM tokens to send." });
    }

    const messaging = await ensureFirebaseMessaging();
    const chunkSize = 500;
    const batches = [];

    for (let i = 0; i < tokens.length; i += chunkSize) {
      batches.push(
        messaging.sendEachForMulticast(firebasePayload({
          tokens: tokens.slice(i, i + chunkSize),
          title: title || "Default Title",
          message: message || "Default Message",
          image,
        })),
      );
    }

    const results = await Promise.all(batches);

    let totalSuccess = 0;
    let totalFailure = 0;

    results.forEach((batchResult, batchIndex) => {
      totalSuccess += batchResult.successCount;
      totalFailure += batchResult.failureCount;

      batchResult.responses.forEach((resp) => {
        if (!resp.success) {
          console.error(`FCM TOKEN FAILED (batch ${batchIndex}):`, resp.error?.message);
        }
      });
    });

    console.log("BULK FCM SUMMARY:", {
      totalTokens: tokens.length,
      totalSuccess,
      totalFailure,
    });

    if (totalSuccess > 0 && notifications.length) {
      await Notification.insertMany(notifications);
    }

    return res.status(200).json({ status: totalSuccess > 0, message: `Notification sent. success=${totalSuccess}, failure=${totalFailure}` });
  } catch (error) {
    if (req.file) deleteFile(req.file);
    console.error("sendNotifications error:", error);
    return res.status(500).json({ status: false, message: error.message || "Internal Server Error" });
  }
};
