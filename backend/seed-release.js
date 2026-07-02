require("dotenv").config({ path: ".env" });

const mongoose = require("mongoose");
const Admin = require("./models/admin.model");
const Login = require("./models/login.model");
const Setting = require("./models/setting.model");

const mongoUrl = process.env.MongoDb_Connection_String || "mongodb://127.0.0.1:27017/hiko_vola";

async function main() {
  await mongoose.connect(mongoUrl);

  await Admin.updateOne(
    { email: "admin@vola.local" },
    {
      $set: {
        uid: "admin",
        name: "Admin",
        email: "admin@vola.local",
        password: "Iwesy@2020",
        image: "",
        purchaseCode: "demo-release",
      },
    },
    { upsert: true },
  );

  await Login.updateOne({}, { $set: { login: true } }, { upsert: true });

  await Setting.updateOne(
    {},
    {
      $set: {
        privacyPolicyLink: "https://vola.alkmal.com/privacy-policy",
        termsOfUsePolicyLink: "https://vola.alkmal.com/terms",
        androidAppVersion: "1.0.0",
        iosAppVersion: "1.0.0",
        androidAppLink: "https://vola.alkmal.com/",
        iosAppLink: "https://vola.alkmal.com/",
        agoraAppId: process.env.AGORA_APP_ID || "",
        agoraAppCertificate: process.env.AGORA_APP_CERTIFICATE || "",
        isDemoData: true,
        isAppEnabled: true,
        loginBonus: 0,
        privateKey: {},
        googlePlayEnabled: false,
        googlePayIosEnabled: false,
        stripeEnabled: false,
        stripeIosEnabled: false,
        razorpayEnabled: false,
        razorpayIosEnabled: false,
        flutterwaveEnabled: false,
        flutterwaveIosEnabled: false,
        paystackAndroidEnabled: false,
        paystackIosEnabled: false,
        cashfreeAndroidEnabled: false,
        cashfreeIosEnabled: false,
        paypalAndroidEnabled: false,
        paypalIosEnabled: false,
        currency: {
          name: "USD",
          symbol: "$",
          countryCode: "US",
          currencyCode: "USD",
          isDefault: true,
        },
      },
    },
    { upsert: true },
  );

  console.log("Release seed complete: admin@vola.local / admin / settings / login flag");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
