const Gift = require("../../models/gift.model");
const GiftCategory = require("../../models/giftCategory.model");

//get gifts grouped by category
exports.fetchGiftList = async (req, res, next) => {
  try {
    let { giftCategoryId } = req.query;
    giftCategoryId = giftCategoryId || req.params.giftCategoryId;

    if (!giftCategoryId) {
      return res.status(200).json({ status: false, message: "giftCategoryId query param is required." });
    }

    const [giftCategory, gifts] = await Promise.all([
      GiftCategory.findById(giftCategoryId),
      Gift.find({ giftCategoryId: giftCategoryId, isDelete: false }).select("title type image svgaImage coin giftCategoryId createdAt updatedAt").sort({ createdAt: -1 }).lean(),
    ]);

    if (!giftCategory) {
      return res.status(200).json({ status: false, message: "Gift category not found." });
    }

    const normalizedGifts = gifts.map((gift) => ({
      ...gift,
      category: String(gift.giftCategoryId || giftCategoryId),
      giftCategoryId: String(gift.giftCategoryId || giftCategoryId),
    }));

    return res.status(200).json({
      status: true,
      message: "Gifts retrieved successfully.",
      gift: normalizedGifts,
      data: normalizedGifts,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
};
