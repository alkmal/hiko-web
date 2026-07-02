const Setting = require("../../models/setting.model");

//import model
const Admin = require("../../models/admin.model");
const Host = require("../../models/host.model");

//scheduleChatJob
const scheduleChatJob = require("../../worker/bullRandomChatJob");

const Joi = require("joi");
const axios = require("axios");

const sha256Regex = /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/;
const androidAssetLinksSchema = Joi.array()
  .min(1)
  .max(5)
  .items(
    Joi.object({
      relation: Joi.array().items(Joi.string().valid("delegate_permission/common.handle_all_urls")).min(1).required(),

      target: Joi.object({
        namespace: Joi.string().valid("android_app").required(),

        package_name: Joi.string()
          .pattern(/^[a-zA-Z0-9_.]+$/)
          .required(),

        sha256_cert_fingerprints: Joi.array().min(1).max(10).items(Joi.string().uppercase().pattern(sha256Regex).required()).required(),
      })
        .required()
        .unknown(false),
    })
      .required()
      .unknown(false),
  )
  .required();

const appleAppSiteAssociationSchema = Joi.object({
  applinks: Joi.object({
    apps: Joi.array().items(Joi.string()).required(),
    details: Joi.array()
      .items(
        Joi.object({
          appID: Joi.string().required(),
          paths: Joi.array().items(Joi.string()).required(),
        }),
      )
      .min(1)
      .required(),
  }).required(),
}).unknown(true);

//update setting
exports.updateSetting = async (req, res) => {
  try {
    if (!req.query.settingId) {
      return res.status(200).json({ status: false, message: "SettingId must be required." });
    }

    const setting = await Setting.findById(req.query.settingId);
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting not found." });
    }

    let shouldRescheduleChatJob = false;

    // ====== PAYSTACK ======
    setting.paystackPublicKey = req.body.paystackPublicKey?.trim() ?? setting.paystackPublicKey;
    setting.paystackSecretKey = req.body.paystackSecretKey?.trim() ?? setting.paystackSecretKey;

    // ====== PAYPAL ======
    setting.paypalClientId = req.body.paypalClientId?.trim() ?? setting.paypalClientId;
    setting.paypalSecretKey = req.body.paypalSecretKey?.trim() ?? setting.paypalSecretKey;

    // ====== PAYMENT ======
    setting.apiKey = req.body.apiKey?.trim() ?? setting?.apiKey;
    setting.sandboxKey = req.body.sandboxKey?.trim() ?? setting?.sandboxKey;
    setting.payCurrency = req.body.payCurrency?.trim() ?? setting?.payCurrency;

    // ====== CASHFREE ======
    setting.cashfreeClientId = req.body.cashfreeClientId?.trim() ?? setting.cashfreeClientId;
    setting.cashfreeClientSecret = req.body.cashfreeClientSecret?.trim() ?? setting.cashfreeClientSecret;

    setting.agoraAppId = req.body.agoraAppId?.trim() ?? setting.agoraAppId;
    setting.agoraAppCertificate = req.body.agoraAppCertificate?.trim() ?? setting.agoraAppCertificate;
    setting.privacyPolicyLink = req.body.privacyPolicyLink?.trim() ?? setting.privacyPolicyLink;
    setting.termsOfUsePolicyLink = req.body.termsOfUsePolicyLink?.trim() ?? setting.termsOfUsePolicyLink;
    setting.stripePublishableKey = req.body.stripePublishableKey?.trim() ?? setting.stripePublishableKey;
    setting.stripeSecretKey = req.body.stripeSecretKey?.trim() ?? setting.stripeSecretKey;
    setting.resendApiKey = req.body.resendApiKey?.trim() ?? setting.resendApiKey;
    setting.razorpayId = req.body.razorpayId?.trim() ?? setting.razorpayId;
    setting.razorpaySecretKey = req.body.razorpaySecretKey?.trim() ?? setting.razorpaySecretKey;
    setting.flutterwaveId = req.body.flutterwaveId?.trim() ?? setting.flutterwaveId;
    setting.loginBonus = req.body.loginBonus ? Number(req.body.loginBonus) : setting.loginBonus;
    setting.adminCommissionRate = req.body.adminCommissionRate ? Number(req.body.adminCommissionRate) : setting.adminCommissionRate;
    setting.minCoinsToConvert = req.body.minCoinsToConvert ? Number(req.body.minCoinsToConvert) : setting.minCoinsToConvert;
    setting.minCoinsForHostPayout = req.body.minCoinsForHostPayout ? Number(req.body.minCoinsForHostPayout) : setting.minCoinsForHostPayout;
    setting.minCoinsForAgencyPayout = req.body.minCoinsForAgencyPayout ? Number(req.body.minCoinsForAgencyPayout) : setting.minCoinsForAgencyPayout;
    setting.maxFreeChatMessages = req.body.maxFreeChatMessages ? Number(req.body.maxFreeChatMessages) : setting.maxFreeChatMessages;

    if ("androidAppVersion" in req.body) {
      setting.androidAppVersion = req.body.androidAppVersion.trim();
    }
    if ("iosAppVersion" in req.body) {
      setting.iosAppVersion = req.body.iosAppVersion.trim();
    }
    if ("androidAppLink" in req.body) {
      setting.androidAppLink = req.body.androidAppLink.trim();
    }
    if ("iosAppLink" in req.body) {
      setting.iosAppLink = req.body.iosAppLink.trim();
    }

    if (req.body.androidAssetLinks !== undefined) {
      let parsedAndroidAssetLinks = req.body.androidAssetLinks;

      if (typeof parsedAndroidAssetLinks === "string") {
        try {
          parsedAndroidAssetLinks = JSON.parse(parsedAndroidAssetLinks.trim());
        } catch (err) {
          return res.status(200).json({
            status: false,
            message: "androidAssetLinks must be valid JSON",
          });
        }
      }

      const { error, value } = androidAssetLinksSchema.validate(parsedAndroidAssetLinks, {
        abortEarly: true,
      });

      if (error) {
        return res.status(200).json({
          status: false,
          message: error.details[0].message,
        });
      }

      setting.androidAssetLinks = Object.freeze(value);
    }

    if (req.body.appleAppSiteAssociation !== undefined) {
      let parsedAppleAASA = req.body.appleAppSiteAssociation;

      if (typeof parsedAppleAASA === "string") {
        try {
          parsedAppleAASA = JSON.parse(parsedAppleAASA.trim());
        } catch (err) {
          return res.status(200).json({
            status: false,
            message: "appleAppSiteAssociation must be valid JSON",
          });
        }
      }

      const { error, value } = appleAppSiteAssociationSchema.validate(parsedAppleAASA, {
        abortEarly: true,
      });

      if (error) {
        return res.status(200).json({
          status: false,
          message: error.details[0].message,
        });
      }

      setting.appleAppSiteAssociation = Object.freeze(value);
    }

    if (req.body.messageInitiatedAt !== undefined) {
      const newVal = Number(req.body.messageInitiatedAt);
      if (newVal !== setting.messageInitiatedAt) {
        shouldRescheduleChatJob = true;
        setting.messageInitiatedAt = newVal;
      }
    }

    if (req.body.callInitiatedAt !== undefined) {
      setting.callInitiatedAt = Number(req.body.callInitiatedAt);
    }

    if (req.body.supportPhoneNumber !== undefined) {
      setting.supportPhoneNumber = req.body.supportPhoneNumber;
    }

    if (req.body.privateKey) {
      setting.privateKey = typeof req.body.privateKey === "string" ? JSON.parse(req.body.privateKey.trim()) : req.body.privateKey;
    }

    const updatedHostfield = {};

    if (req.body.generalRandomCallRate) {
      if (isNaN(req.body.generalRandomCallRate)) {
        return res.status(200).json({
          status: false,
          message: "generalRandomCallRate must be a number",
        });
      }
      setting.generalRandomCallRate = Number(req.body.generalRandomCallRate);
      updatedHostfield.randomCallRate = Number(req.body.generalRandomCallRate);
    }

    if (req.body.femaleRandomCallRate) {
      if (isNaN(req.body.femaleRandomCallRate)) {
        return res.status(200).json({
          status: false,
          message: "femaleRandomCallRate must be a number",
        });
      }
      setting.femaleRandomCallRate = Number(req.body.femaleRandomCallRate);
      updatedHostfield.randomCallFemaleRate = Number(req.body.femaleRandomCallRate);
    }

    if (req.body.maleRandomCallRate) {
      if (isNaN(req.body.maleRandomCallRate)) {
        return res.status(200).json({
          status: false,
          message: "maleRandomCallRate must be a number",
        });
      }
      setting.maleRandomCallRate = Number(req.body.maleRandomCallRate);
      updatedHostfield.randomCallMaleRate = Number(req.body.maleRandomCallRate);
    }

    if (req.body.videoPrivateCallRate) {
      if (isNaN(req.body.videoPrivateCallRate)) {
        return res.status(200).json({
          status: false,
          message: "videoPrivateCallRate must be a number",
        });
      }
      setting.videoPrivateCallRate = Number(req.body.videoPrivateCallRate);
      updatedHostfield.privateCallRate = Number(req.body.videoPrivateCallRate);
    }

    if (req.body.audioPrivateCallRate) {
      if (isNaN(req.body.audioPrivateCallRate)) {
        return res.status(200).json({
          status: false,
          message: "audioPrivateCallRate must be a number",
        });
      }
      setting.audioPrivateCallRate = Number(req.body.audioPrivateCallRate);
      updatedHostfield.audioCallRate = Number(req.body.audioPrivateCallRate);
    }

    if (req.body.chatInteractionRate) {
      if (isNaN(req.body.chatInteractionRate)) {
        return res.status(200).json({
          status: false,
          message: "chatInteractionRate must be a number",
        });
      }
      setting.chatInteractionRate = Number(req.body.chatInteractionRate);
      updatedHostfield.chatRate = Number(req.body.chatInteractionRate);
    }

    await setting.save();

    res.status(200).json({
      status: true,
      message: "Setting has been updated.",
      data: setting,
    });

    if (Object.keys(updatedHostfield).length > 0) {
      const updatePromises = [];

      if (updatedHostfield.randomCallRate !== undefined) {
        updatePromises.push(Host.updateMany({ randomCallRate: { $lt: updatedHostfield.randomCallRate } }, { $set: { randomCallRate: updatedHostfield.randomCallRate } }));
      }

      if (updatedHostfield.randomCallFemaleRate !== undefined) {
        updatePromises.push(Host.updateMany({ randomCallFemaleRate: { $lt: updatedHostfield.randomCallFemaleRate } }, { $set: { randomCallFemaleRate: updatedHostfield.randomCallFemaleRate } }));
      }

      if (updatedHostfield.randomCallMaleRate !== undefined) {
        updatePromises.push(Host.updateMany({ randomCallMaleRate: { $lt: updatedHostfield.randomCallMaleRate } }, { $set: { randomCallMaleRate: updatedHostfield.randomCallMaleRate } }));
      }

      if (updatedHostfield.privateCallRate !== undefined) {
        updatePromises.push(Host.updateMany({ privateCallRate: { $lt: updatedHostfield.privateCallRate } }, { $set: { privateCallRate: updatedHostfield.privateCallRate } }));
      }

      if (updatedHostfield.audioCallRate !== undefined) {
        updatePromises.push(Host.updateMany({ audioCallRate: { $lt: updatedHostfield.audioCallRate } }, { $set: { audioCallRate: updatedHostfield.audioCallRate } }));
      }

      if (updatedHostfield.chatRate !== undefined) {
        updatePromises.push(Host.updateMany({ chatRate: { $lt: updatedHostfield.chatRate } }, { $set: { chatRate: updatedHostfield.chatRate } }));
      }

      await Promise.all(updatePromises);
    }

    global.settingJSON = setting;
    if (shouldRescheduleChatJob) {
      console.log("🔁 Rescheduling chat job...", global?.settingJSON?.messageInitiatedAt);
      await scheduleChatJob();
    }
    updateSettingFile(setting);

    if (req.body.privateKey) {
      try {
        setTimeout(() => {
          console.log("🔐 Private key updated, restarting server...");
          process.exit(0);
        }, 500); // 0.5s delay
        return;
      } catch (err) {
        console.error("Failed to update privateKey:", err);
      }
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

//update setting switch
const _0x18d31d = _0x3702;
function _0x5b6a() {
  const _0x5d1690 = [
    "RgMzzKmpQP",
    "oidEnabled",
    "eIosEnable",
    "hGAOU",
    "toLowerCas",
    "6ZEaFrY",
    "valid.",
    "tqMTO",
    "IvWJu",
    "updateSett",
    "gxWCY",
    "ifopc",
    "Invalid\x20pu",
    "googlePayI",
    "\x20settings\x20",
    "Regular\x20li",
    "qTmPZ",
    "isDemoData",
    "erificatio",
    "QrfOV",
    "OfoYS",
    "Internal\x20S",
    "osEnabled",
    "wJwHr",
    "y\x20license\x20",
    "cashfreeIo",
    "crEuE",
    "response",
    "settingId",
    "136730xasutf",
    "QfauJ",
    "nd.",
    "flutterwav",
    "jRwRG",
    "razorpayIo",
    "20yvYNgQ",
    "ajQGQ",
    "regular",
    "Setting\x20do",
    "HEBlv",
    "VDTAT",
    "\x20for\x20payme",
    "ULFcB",
    "pKTdi",
    "AThzd",
    "328440pceOXE",
    "oshIB",
    "eshEnabled",
    "rqdbg",
    "cashfreeAn",
    "sale?code=",
    "748245kdOcuQ",
    "MCPni",
    "qQPEw",
    "cense\x20is\x20n",
    "query",
    "isTest",
    "abled",
    "status",
    "TliLQ",
    "nabled",
    "9kOVbapnP",
    "AndroidEna",
    "Ilork",
    "alid\x20detai",
    "hRrDE",
    "trim",
    "rchase\x20cod",
    "om/v3/mark",
    "Bearer\x20G9o",
    "log",
    "_id",
    "Oops\x20!\x20Inv",
    "2160370tTqtRe",
    "get",
    "erver\x20Erro",
    "llDfy",
    "1R8snTfNCp",
    "purchaseCo",
    "Gkgzx",
    "data",
    "type",
    "279120rsIrZU",
    "isAppEnabl",
    "locked.",
    "AXmAO",
    "vVzdO",
    "includes",
    "bled",
    "et/author/",
    "nowPayment",
    "xmKWE",
    "paystackAn",
    "LRePL",
    "paypalAndr",
    "UFEda",
    "LaqDT",
    "IosEnabled",
    "findById",
    "732LaPtBm",
    "Purchase\x20c",
    "d\x20must\x20be\x20",
    "xXMSc",
    "Enabled",
    "eEnabled",
    "googlePlay",
    "nt\x20setting",
    "license",
    "ls!",
    "RMKBv",
    "select",
    "es\x20not\x20fou",
    "razorpayEn",
    "n\x20failed",
    "wKdIU",
    "or:",
    "ot\x20allowed",
    "WIajX",
    "item",
    "type\x20passe",
    "paystackIo",
    "ingToggle",
    "stripeIosE",
    "27PpZKgd",
    "893921bqbPTb",
    "admin",
    "ode\x20not\x20fo",
    "jnwnd",
    "isAutoMess",
    "i.envato.c",
    "Snudz",
    "sEnabled",
    "led",
    "jdJnA",
    "message",
    "isAutoCall",
    "fHLVl",
    "https://ap",
    "und.\x20Verif",
    "first.",
    "Success",
    "stripeEnab",
    "e.\x20Payment",
    "AMgTj",
    "paypalIosE",
    "droidEnabl",
    "116512EGauUb",
    "Bnoes",
    "isAutoRefr",
    "lean",
    "save",
    "jffmD",
    "IwRRx",
    "Purchase\x20v",
    "Envato\x20Err",
    "ageEnabled",
    "96CzuBVn",
    "json",
  ];
  _0x5b6a = function () {
    return _0x5d1690;
  };
  return _0x5b6a();
}
function _0x3702(_0x107866, _0x5d6145) {
  _0x107866 = _0x107866 - (0x1 * -0x131 + 0x1845 + 0x1 * -0x1597);
  const _0x3b018f = _0x5b6a();
  let _0x4b6928 = _0x3b018f[_0x107866];
  return _0x4b6928;
}
((function (_0x59eeb3, _0x4ba5b5) {
  const _0xd43198 = _0x3702,
    _0x390b62 = _0x59eeb3();
  while (!![]) {
    try {
      const _0x3a15a2 =
        parseInt(_0xd43198(0x20f)) / (-0x103b + 0xb * 0x38d + 0x1 * -0x16d3) +
        (parseInt(_0xd43198(0x1ff)) / (-0x331 * -0x4 + 0xd2a + -0x19ec)) * (parseInt(_0xd43198(0x209)) / (0x3fb * 0x2 + 0x403 * 0x1 + 0xbf6 * -0x1)) +
        (-parseInt(_0xd43198(0x1da)) / (-0x1200 + 0x745 + 0xabf)) * (parseInt(_0xd43198(0x1f9)) / (-0xe60 + -0x1 * -0xc2f + 0x236)) +
        (-parseInt(_0xd43198(0x1e1)) / (0x2 * 0xba2 + -0x9 * 0x2fb + -0x83 * -0x7)) * (-parseInt(_0xd43198(0x1ba)) / (-0x19c6 + -0x111f + 0x2aec)) +
        (parseInt(_0xd43198(0x190)) / (-0xd08 + -0x2025 + 0x2d35)) * (-parseInt(_0xd43198(0x1b9)) / (-0x1056 + 0x1f * 0xa9 + 0x8 * -0x83)) +
        parseInt(_0xd43198(0x187)) / (-0xbd4 + 0x16ab + 0x23 * -0x4f) +
        (-parseInt(_0xd43198(0x1d0)) / (-0x22d1 + -0x1a3d + -0x3d19 * -0x1)) * (parseInt(_0xd43198(0x1a1)) / (-0x13e7 + -0x27b + 0x6 * 0x3bd));
      if (_0x3a15a2 === _0x4ba5b5) break;
      else _0x390b62["push"](_0x390b62["shift"]());
    } catch (_0xb1bb7d) {
      _0x390b62["push"](_0x390b62["shift"]());
    }
  }
})(_0x5b6a, 0x262cf * 0x1 + -0x55e35 * 0x1 + 0xee119),
  (exports[_0x18d31d(0x1e5) + _0x18d31d(0x1b7)] = async (_0x53feef, _0x40b995) => {
    const _0x274f9e = _0x18d31d,
      _0x30592a = {
        ULFcB: _0x274f9e(0x186) + _0x274f9e(0x17e) + _0x274f9e(0x1aa),
        AThzd: _0x274f9e(0x202) + _0x274f9e(0x1ad) + _0x274f9e(0x1fb),
        HEBlv: _0x274f9e(0x1a7) + _0x274f9e(0x1a5),
        IvWJu: _0x274f9e(0x1cb) + _0x274f9e(0x1c2),
        ifopc: _0x274f9e(0x1ae) + _0x274f9e(0x215),
        WIajX: _0x274f9e(0x1fc) + _0x274f9e(0x1a6),
        Ilork: _0x274f9e(0x19a) + _0x274f9e(0x1cf) + "ed",
        jdJnA: _0x274f9e(0x1b6) + _0x274f9e(0x1c1),
        oshIB: _0x274f9e(0x19c) + _0x274f9e(0x1dd),
        wJwHr: _0x274f9e(0x1ce) + _0x274f9e(0x218),
        UFEda: _0x274f9e(0x20d) + _0x274f9e(0x1cf) + "ed",
        wKdIU: _0x274f9e(0x1f5) + _0x274f9e(0x1c1),
        AXmAO: _0x274f9e(0x1e9) + _0x274f9e(0x1f2),
        Gkgzx: _0x274f9e(0x1b8) + _0x274f9e(0x218),
        QfauJ: _0x274f9e(0x1fe) + _0x274f9e(0x1c1),
        jRwRG: _0x274f9e(0x1fc) + _0x274f9e(0x1de) + "d",
        OfoYS: _0x274f9e(0x198) + _0x274f9e(0x21a) + _0x274f9e(0x196),
        LaqDT: _0x274f9e(0x198) + _0x274f9e(0x19f),
        qTmPZ: _0x274f9e(0x214),
        LRePL: _0x274f9e(0x18c) + "de",
        tqMTO: _0x274f9e(0x1a2) + _0x274f9e(0x1bc) + _0x274f9e(0x1c8) + _0x274f9e(0x1f4) + _0x274f9e(0x1c9),
        xXMSc: _0x274f9e(0x1e8) + _0x274f9e(0x181) + _0x274f9e(0x1cc) + _0x274f9e(0x1ea) + _0x274f9e(0x192),
        xmKWE: _0x274f9e(0x201),
        VDTAT: _0x274f9e(0x1eb) + _0x274f9e(0x212) + _0x274f9e(0x1b2) + _0x274f9e(0x205) + _0x274f9e(0x1a8) + "s",
        AMgTj: _0x274f9e(0x1d8) + _0x274f9e(0x1b1),
        gxWCY: _0x274f9e(0x1d7) + _0x274f9e(0x1ee) + _0x274f9e(0x1af),
        RMKBv: function (_0x3e2916, _0x3bd9fc) {
          return _0x3e2916 === _0x3bd9fc;
        },
        pKTdi: function (_0x24513f, _0x42be56) {
          return _0x24513f === _0x42be56;
        },
        hRrDE: function (_0x238c65, _0x2acd4e) {
          return _0x238c65 === _0x2acd4e;
        },
        rqdbg: _0x274f9e(0x1ed),
        llDfy: _0x274f9e(0x191) + "ed",
        hGAOU: _0x274f9e(0x1d2) + _0x274f9e(0x20b),
        crEuE: function (_0x208955, _0x212619) {
          return _0x208955 === _0x212619;
        },
        vVzdO: function (_0x208665, _0x4b0763) {
          return _0x208665 === _0x4b0763;
        },
        ajQGQ: function (_0x5d01e3, _0x45086f) {
          return _0x5d01e3 === _0x45086f;
        },
        jffmD: function (_0x14cd1e, _0x1b29df) {
          return _0x14cd1e === _0x1b29df;
        },
        Snudz: function (_0xdafae6, _0x3c3008) {
          return _0xdafae6 === _0x3c3008;
        },
        IwRRx: function (_0x12d497, _0x2221ab) {
          return _0x12d497 === _0x2221ab;
        },
        qQPEw: _0x274f9e(0x1be) + _0x274f9e(0x1d9),
        TliLQ: _0x274f9e(0x1c5) + _0x274f9e(0x1a5),
        fHLVl: function (_0x414901, _0x1fb841) {
          return _0x414901 === _0x1fb841;
        },
        QrfOV: _0x274f9e(0x1b5) + _0x274f9e(0x1a3) + _0x274f9e(0x1e2),
        jnwnd: _0x274f9e(0x1ca),
        MCPni: function (_0x2189a8, _0x2d6312) {
          return _0x2189a8(_0x2d6312);
        },
        Bnoes: _0x274f9e(0x1f1) + _0x274f9e(0x189) + "r",
      };
    try {
      if (!_0x53feef[_0x274f9e(0x213)][_0x274f9e(0x1f8)] || !_0x53feef[_0x274f9e(0x213)][_0x274f9e(0x18f)])
        return _0x40b995[_0x274f9e(0x216)](-0x2 * -0x11ff + -0x7 * -0x425 + -0x191 * 0x29)[_0x274f9e(0x1db)]({ status: ![], message: _0x30592a[_0x274f9e(0x206)] });
      const _0x572e9b = await Setting[_0x274f9e(0x1a0)](_0x53feef[_0x274f9e(0x213)][_0x274f9e(0x1f8)]);
      if (!_0x572e9b) return _0x40b995[_0x274f9e(0x216)](0x1 * 0x1efd + 0x1fc6 + -0x81 * 0x7b)[_0x274f9e(0x1db)]({ status: ![], message: _0x30592a[_0x274f9e(0x208)] });
      const _0x4cf6b5 = _0x53feef[_0x274f9e(0x213)][_0x274f9e(0x18f)][_0x274f9e(0x180)](),
        _0x24a691 = [
          _0x30592a[_0x274f9e(0x203)],
          _0x30592a[_0x274f9e(0x1e4)],
          _0x30592a[_0x274f9e(0x1e7)],
          _0x30592a[_0x274f9e(0x1b3)],
          _0x30592a[_0x274f9e(0x17d)],
          _0x30592a[_0x274f9e(0x1c3)],
          _0x30592a[_0x274f9e(0x20a)],
          _0x30592a[_0x274f9e(0x1f3)],
          _0x30592a[_0x274f9e(0x19d)],
          _0x30592a[_0x274f9e(0x1b0)],
          _0x30592a[_0x274f9e(0x193)],
          _0x30592a[_0x274f9e(0x18d)],
          _0x30592a[_0x274f9e(0x1fa)],
          _0x30592a[_0x274f9e(0x1fd)],
          _0x30592a[_0x274f9e(0x1f0)],
          _0x30592a[_0x274f9e(0x19e)],
          _0x30592a[_0x274f9e(0x1ec)],
        ];
      if (_0x24a691[_0x274f9e(0x195)](_0x4cf6b5)) {
        const _0x1506b0 = await Admin[_0x274f9e(0x1a0)](_0x53feef[_0x274f9e(0x1bb)][_0x274f9e(0x185)])[_0x274f9e(0x1ac)](_0x30592a[_0x274f9e(0x19b)])[_0x274f9e(0x1d3)]();
        if (!_0x1506b0 || !_0x1506b0[_0x274f9e(0x18c) + "de"])
          return _0x40b995[_0x274f9e(0x216)](-0x966 + 0x73 * 0x40 + -0x1292)[_0x274f9e(0x1db)]({ status: ![], message: _0x30592a[_0x274f9e(0x1e3)] });
        try {
          const _0xa25bb1 = await axios[_0x274f9e(0x188)](_0x274f9e(0x1c7) + _0x274f9e(0x1bf) + _0x274f9e(0x182) + _0x274f9e(0x197) + _0x274f9e(0x20e) + _0x1506b0[_0x274f9e(0x18c) + "de"], {
              headers: { Authorization: _0x274f9e(0x183) + _0x274f9e(0x18b) + _0x274f9e(0x1dc) + _0x274f9e(0x219) },
            }),
            _0x5e3362 = _0xa25bb1?.[_0x274f9e(0x18e)];
          if (!_0x5e3362 || !_0x5e3362[_0x274f9e(0x1b4)])
            return _0x40b995[_0x274f9e(0x216)](-0x1 * 0x15a3 + -0x16dc + -0x1 * -0x2d47)[_0x274f9e(0x1db)]({ status: ![], message: _0x30592a[_0x274f9e(0x1a4)] });
          const _0x1d40f2 = _0x5e3362?.[_0x274f9e(0x1a9)]?.[_0x274f9e(0x1e0) + "e"]();
          if (_0x1d40f2?.[_0x274f9e(0x195)](_0x30592a[_0x274f9e(0x199)]))
            return _0x40b995[_0x274f9e(0x216)](0x2f * 0x92 + 0x152c + -0x2f32 * 0x1)[_0x274f9e(0x1db)]({ status: ![], message: _0x30592a[_0x274f9e(0x204)], allowPaymentSettings: ![] });
        } catch (_0x4d9c78) {
          return (
            console[_0x274f9e(0x184)](_0x30592a[_0x274f9e(0x1cd)], _0x4d9c78?.[_0x274f9e(0x1f7)]?.[_0x274f9e(0x18e)] || _0x4d9c78[_0x274f9e(0x1c4)]),
            _0x40b995[_0x274f9e(0x216)](-0x1147 + 0x1245 + -0x36)[_0x274f9e(0x1db)]({ status: ![], message: _0x30592a[_0x274f9e(0x1e6)] })
          );
        }
      }
      if (_0x30592a[_0x274f9e(0x1ab)](_0x4cf6b5, _0x30592a[_0x274f9e(0x203)])) _0x572e9b[_0x274f9e(0x1a7) + _0x274f9e(0x1a5)] = !_0x572e9b[_0x274f9e(0x1a7) + _0x274f9e(0x1a5)];
      else {
        if (_0x30592a[_0x274f9e(0x207)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1e4)])) _0x572e9b[_0x274f9e(0x1cb) + _0x274f9e(0x1c2)] = !_0x572e9b[_0x274f9e(0x1cb) + _0x274f9e(0x1c2)];
        else {
          if (_0x30592a[_0x274f9e(0x207)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1e7)])) _0x572e9b[_0x274f9e(0x1ae) + _0x274f9e(0x215)] = !_0x572e9b[_0x274f9e(0x1ae) + _0x274f9e(0x215)];
          else {
            if (_0x30592a[_0x274f9e(0x17f)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1b3)])) _0x572e9b[_0x274f9e(0x1fc) + _0x274f9e(0x1a6)] = !_0x572e9b[_0x274f9e(0x1fc) + _0x274f9e(0x1a6)];
            else {
              if (_0x30592a[_0x274f9e(0x207)](_0x4cf6b5, _0x30592a[_0x274f9e(0x20c)])) _0x572e9b[_0x274f9e(0x1ed)] = !_0x572e9b[_0x274f9e(0x1ed)];
              else {
                if (_0x30592a[_0x274f9e(0x207)](_0x4cf6b5, _0x30592a[_0x274f9e(0x18a)])) _0x572e9b[_0x274f9e(0x191) + "ed"] = !_0x572e9b[_0x274f9e(0x191) + "ed"];
                else {
                  if (_0x30592a[_0x274f9e(0x17f)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1df)])) _0x572e9b[_0x274f9e(0x1d2) + _0x274f9e(0x20b)] = !_0x572e9b[_0x274f9e(0x1d2) + _0x274f9e(0x20b)];
                  else {
                    if (_0x30592a[_0x274f9e(0x207)](_0x4cf6b5, _0x30592a[_0x274f9e(0x17d)]))
                      _0x572e9b[_0x274f9e(0x19a) + _0x274f9e(0x1cf) + "ed"] = !_0x572e9b[_0x274f9e(0x19a) + _0x274f9e(0x1cf) + "ed"];
                    else {
                      if (_0x30592a[_0x274f9e(0x17f)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1c3)])) _0x572e9b[_0x274f9e(0x1b6) + _0x274f9e(0x1c1)] = !_0x572e9b[_0x274f9e(0x1b6) + _0x274f9e(0x1c1)];
                      else {
                        if (_0x30592a[_0x274f9e(0x17f)](_0x4cf6b5, _0x30592a[_0x274f9e(0x20a)])) _0x572e9b[_0x274f9e(0x19c) + _0x274f9e(0x1dd)] = !_0x572e9b[_0x274f9e(0x19c) + _0x274f9e(0x1dd)];
                        else {
                          if (_0x30592a[_0x274f9e(0x1ab)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1f3)])) _0x572e9b[_0x274f9e(0x1ce) + _0x274f9e(0x218)] = !_0x572e9b[_0x274f9e(0x1ce) + _0x274f9e(0x218)];
                          else {
                            if (_0x30592a[_0x274f9e(0x1f6)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1f0)]))
                              _0x572e9b[_0x274f9e(0x198) + _0x274f9e(0x21a) + _0x274f9e(0x196)] = !_0x572e9b[_0x274f9e(0x198) + _0x274f9e(0x21a) + _0x274f9e(0x196)];
                            else {
                              if (_0x30592a[_0x274f9e(0x1f6)](_0x4cf6b5, _0x30592a[_0x274f9e(0x19e)])) _0x572e9b[_0x274f9e(0x198) + _0x274f9e(0x19f)] = !_0x572e9b[_0x274f9e(0x198) + _0x274f9e(0x19f)];
                              else {
                                if (_0x30592a[_0x274f9e(0x207)](_0x4cf6b5, _0x30592a[_0x274f9e(0x19d)]))
                                  _0x572e9b[_0x274f9e(0x20d) + _0x274f9e(0x1cf) + "ed"] = !_0x572e9b[_0x274f9e(0x20d) + _0x274f9e(0x1cf) + "ed"];
                                else {
                                  if (_0x30592a[_0x274f9e(0x1f6)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1b0)]))
                                    _0x572e9b[_0x274f9e(0x1f5) + _0x274f9e(0x1c1)] = !_0x572e9b[_0x274f9e(0x1f5) + _0x274f9e(0x1c1)];
                                  else {
                                    if (_0x30592a[_0x274f9e(0x194)](_0x4cf6b5, _0x30592a[_0x274f9e(0x193)]))
                                      _0x572e9b[_0x274f9e(0x1e9) + _0x274f9e(0x1f2)] = !_0x572e9b[_0x274f9e(0x1e9) + _0x274f9e(0x1f2)];
                                    else {
                                      if (_0x30592a[_0x274f9e(0x200)](_0x4cf6b5, _0x30592a[_0x274f9e(0x18d)]))
                                        _0x572e9b[_0x274f9e(0x1b8) + _0x274f9e(0x218)] = !_0x572e9b[_0x274f9e(0x1b8) + _0x274f9e(0x218)];
                                      else {
                                        if (_0x30592a[_0x274f9e(0x1d5)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1fa)]))
                                          _0x572e9b[_0x274f9e(0x1fe) + _0x274f9e(0x1c1)] = !_0x572e9b[_0x274f9e(0x1fe) + _0x274f9e(0x1c1)];
                                        else {
                                          if (_0x30592a[_0x274f9e(0x1c0)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1fd)]))
                                            _0x572e9b[_0x274f9e(0x1fc) + _0x274f9e(0x1de) + "d"] = !_0x572e9b[_0x274f9e(0x1fc) + _0x274f9e(0x1de) + "d"];
                                          else {
                                            if (_0x30592a[_0x274f9e(0x1d6)](_0x4cf6b5, _0x30592a[_0x274f9e(0x211)]))
                                              _0x572e9b[_0x274f9e(0x1be) + _0x274f9e(0x1d9)] = !_0x572e9b[_0x274f9e(0x1be) + _0x274f9e(0x1d9)];
                                            else {
                                              if (_0x30592a[_0x274f9e(0x1f6)](_0x4cf6b5, _0x30592a[_0x274f9e(0x217)]))
                                                _0x572e9b[_0x274f9e(0x1c5) + _0x274f9e(0x1a5)] = !_0x572e9b[_0x274f9e(0x1c5) + _0x274f9e(0x1a5)];
                                              else {
                                                if (_0x30592a[_0x274f9e(0x1c6)](_0x4cf6b5, _0x30592a[_0x274f9e(0x1ec)])) _0x572e9b[_0x274f9e(0x214)] = !_0x572e9b[_0x274f9e(0x214)];
                                                else return _0x40b995[_0x274f9e(0x216)](0xaec * -0x1 + 0x1e2b + 0xa3 * -0x1d)[_0x274f9e(0x1db)]({ status: ![], message: _0x30592a[_0x274f9e(0x1ef)] });
                                              }
                                            }
                                          }
                                        }
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      (await _0x572e9b[_0x274f9e(0x1d4)](),
        _0x40b995[_0x274f9e(0x216)](0x865 + -0x2 * -0x9f1 + -0x1b7f)[_0x274f9e(0x1db)]({ status: !![], message: _0x30592a[_0x274f9e(0x1bd)], data: _0x572e9b }),
        _0x30592a[_0x274f9e(0x210)](updateSettingFile, _0x572e9b));
    } catch (_0x2753e5) {
      return (
        console[_0x274f9e(0x184)](_0x2753e5),
        _0x40b995[_0x274f9e(0x216)](0x1 * 0x1087 + 0x1721 + -0x25b4)[_0x274f9e(0x1db)]({ status: ![], error: _0x2753e5[_0x274f9e(0x1c4)] || _0x30592a[_0x274f9e(0x1d1)] })
      );
    }
  }));

//get setting
exports.fetchSettings = async (req, res) => {
  try {
    const setting = settingJSON ? settingJSON : null;
    if (!setting) {
      return res.status(200).json({ status: false, message: "Setting does not found." });
    }

    return res.status(200).json({ status: true, message: "Success", data: setting });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ status: false, error: error.message || "Internal Server Error" });
  }
};

function _0x58b0(_0x3f6dda, _0x3e3456) {
  _0x3f6dda = _0x3f6dda - (0x703 * 0x3 + 0x3 * 0x99a + -0x3 * 0x104e);
  const _0x1d9163 = _0x573e();
  let _0x53e51e = _0x1d9163[_0x3f6dda];
  return _0x53e51e;
}
const _0x1c7925 = _0x58b0;
((function (_0x2644fc, _0x1ef0e2) {
  const _0x5edc89 = _0x58b0,
    _0x2411a2 = _0x2644fc();
  while (!![]) {
    try {
      const _0x544b8d =
        (-parseInt(_0x5edc89(0x104)) / (0x1 * -0x10be + -0x13e3 + -0xc36 * -0x3)) * (parseInt(_0x5edc89(0x135)) / (-0x94e + -0x890 + 0x11e0)) +
        parseInt(_0x5edc89(0x12d)) / (0x126 + -0x19a3 + 0x38 * 0x70) +
        -parseInt(_0x5edc89(0x13a)) / (0x1bf * -0x13 + 0x100b + 0x1b7 * 0xa) +
        (parseInt(_0x5edc89(0x10e)) / (0x23 * -0xd3 + 0x1c1 * 0x2 + 0xcae * 0x2)) * (parseInt(_0x5edc89(0x128)) / (-0x1e83 + 0x59f * -0x5 + 0x4 * 0xea9)) +
        parseInt(_0x5edc89(0x109)) / (0x607 * 0x5 + -0x952 * 0x2 + 0x5bc * -0x2) +
        (parseInt(_0x5edc89(0xfa)) / (-0x176b + -0xce7 + 0x245a)) * (-parseInt(_0x5edc89(0x127)) / (0xd4d + 0x171 * -0x3 + 0x6d * -0x15)) +
        parseInt(_0x5edc89(0x11f)) / (0x1479 * 0x1 + 0x8e9 * -0x4 + 0xe5 * 0x11);
      if (_0x544b8d === _0x1ef0e2) break;
      else _0x2411a2["push"](_0x2411a2["shift"]());
    } catch (_0x5f22b8) {
      _0x2411a2["push"](_0x2411a2["shift"]());
    }
  }
})(_0x573e, 0x86ae2 + 0x62e55 + -0x9c69c),
  (exports[_0x1c7925(0x138) + _0x1c7925(0xf8) + "e"] = async (_0x14d6f0, _0x289c48) => {
    const _0x12668d = _0x1c7925,
      _0x7ec094 = {
        dsiLO: _0x12668d(0x131) + "de",
        JzELR: _0x12668d(0x110) + _0x12668d(0x12e) + _0x12668d(0x12f),
        AApNE: _0x12668d(0xef) + _0x12668d(0xff),
        gPhti: _0x12668d(0x126) + _0x12668d(0xf7) + "e",
        ZFTiA: _0x12668d(0x117) + _0x12668d(0xf3) + "nd",
        Jldld: _0x12668d(0x105),
        nbKzu: _0x12668d(0x10c) + _0x12668d(0x103) + _0x12668d(0x120) + _0x12668d(0xf1) + _0x12668d(0x139) + "s",
        lPOtf: _0x12668d(0x102),
        MLvZt: _0x12668d(0x130) + _0x12668d(0x121) + _0x12668d(0x125) + _0x12668d(0xfc),
        FbyFY: _0x12668d(0x12b) + _0x12668d(0x11c) + _0x12668d(0xfe),
        awtGm: _0x12668d(0xf2) + _0x12668d(0x133),
        cMWsa: _0x12668d(0xfd) + _0x12668d(0x12a) + _0x12668d(0xfb) + "de",
      };
    try {
      const _0x29eed5 = await Admin[_0x12668d(0x119)](_0x14d6f0[_0x12668d(0x10a)][_0x12668d(0x10b)])[_0x12668d(0xf5)](_0x7ec094[_0x12668d(0x11b)])[_0x12668d(0x118)]();
      if (!_0x29eed5 || !_0x29eed5[_0x12668d(0x131) + "de"]) return _0x289c48[_0x12668d(0x124)](-0x1a83 + -0x1a8e + 0x35d9)[_0x12668d(0x116)]({ status: ![], message: _0x7ec094[_0x12668d(0x12c)] });
      const _0x5eff3f = _0x29eed5[_0x12668d(0x131) + "de"],
        _0xa3cf2f = await axios[_0x12668d(0x100)](_0x12668d(0x11d) + _0x12668d(0x111) + _0x12668d(0x113) + _0x12668d(0xf6) + _0x12668d(0x112) + _0x5eff3f, {
          headers: { Authorization: _0x12668d(0x137) + _0x12668d(0x123) + _0x12668d(0x115) + _0x12668d(0x132) },
        }),
        _0x224200 = _0xa3cf2f?.[_0x12668d(0x11a)];
      console[_0x12668d(0x134)](_0x7ec094[_0x12668d(0x129)], _0x224200[_0x12668d(0x10f)]);
      if (!_0x224200 || !_0x224200[_0x12668d(0x136)]) return _0x289c48[_0x12668d(0x124)](-0x1 * -0x1f6a + 0x1eeb * -0x1 + 0x49)[_0x12668d(0x116)]({ status: ![], message: _0x7ec094[_0x12668d(0xee)] });
      const _0x3b8d6d = _0x224200?.[_0x12668d(0x10f)];
      if (!_0x3b8d6d) return _0x289c48[_0x12668d(0x124)](0x167a + 0x3a1 * -0x3 + -0xacf)[_0x12668d(0x116)]({ status: ![], message: _0x7ec094[_0x12668d(0x10d)] });
      if (_0x3b8d6d[_0x12668d(0x101) + "e"]()[_0x12668d(0x122)](_0x7ec094[_0x12668d(0x108)]))
        return _0x289c48[_0x12668d(0x124)](-0x1a * -0x11b + -0x16d8 + -0x51e * 0x1)[_0x12668d(0x116)]({ status: ![], message: _0x7ec094[_0x12668d(0x106)], allowPaymentSettings: ![] });
      if (_0x3b8d6d[_0x12668d(0x101) + "e"]()[_0x12668d(0x122)](_0x7ec094[_0x12668d(0x107)]))
        return _0x289c48[_0x12668d(0x124)](0x241f + 0xd9f * 0x1 + 0x6 * -0x829)[_0x12668d(0x116)]({ status: !![], message: _0x7ec094[_0x12668d(0x114)], allowPaymentSettings: !![] });
      return _0x289c48[_0x12668d(0x124)](0x850 + 0x2 * -0xb0e + -0x137 * -0xc)[_0x12668d(0x116)]({ status: ![], message: _0x7ec094[_0x12668d(0xf0)], allowPaymentSettings: ![] });
    } catch (_0x4d952c) {
      return (
        console[_0x12668d(0x134)](_0x7ec094[_0x12668d(0xed)], _0x4d952c?.[_0x12668d(0xf4)]?.[_0x12668d(0x11a)] || _0x4d952c[_0x12668d(0xf9)]),
        _0x289c48[_0x12668d(0x124)](-0x71f + -0x1863 + 0x204a)[_0x12668d(0x116)]({ status: ![], message: _0x7ec094[_0x12668d(0x11e)], allowPaymentSettings: ![] })
      );
    }
  }));
function _0x573e() {
  const _0x2fcb10 = [
    "Purchase\x20c",
    "i.envato.c",
    "sale?code=",
    "om/v3/mark",
    "MLvZt",
    "RgMzzKmpQP",
    "json",
    "License\x20in",
    "lean",
    "findById",
    "data",
    "dsiLO",
    "d\x20license\x20",
    "https://ap",
    "cMWsa",
    "5304500HwYCQL",
    "ot\x20allowed",
    "icense\x20ver",
    "includes",
    "1R8snTfNCp",
    "status",
    "ified\x20succ",
    "Invalid\x20pu",
    "117jWiDVo",
    "189498erQFeP",
    "AApNE",
    "\x20expired\x20p",
    "Unsupporte",
    "JzELR",
    "113331yVmamu",
    "ode\x20not\x20fo",
    "und",
    "Extended\x20l",
    "purchaseCo",
    "9kOVbapnP",
    "or:",
    "log",
    "6piiVmT",
    "item",
    "Bearer\x20G9o",
    "authorizeP",
    "nt\x20setting",
    "88340ZMRHST",
    "awtGm",
    "gPhti",
    "Envato\x20Res",
    "FbyFY",
    "\x20for\x20payme",
    "Envato\x20Err",
    "fo\x20not\x20fou",
    "response",
    "select",
    "et/author/",
    "rchase\x20cod",
    "urchaseCod",
    "message",
    "210424VTDrrd",
    "urchase\x20co",
    "essfully",
    "Invalid\x20or",
    "type",
    "ponse:",
    "get",
    "toLowerCas",
    "extended",
    "cense\x20is\x20n",
    "6211hqDhRb",
    "regular",
    "nbKzu",
    "lPOtf",
    "Jldld",
    "29099cTcUey",
    "admin",
    "_id",
    "Regular\x20li",
    "ZFTiA",
    "20oOzxzf",
    "license",
  ];
  _0x573e = function () {
    return _0x2fcb10;
  };
  return _0x573e();
}
