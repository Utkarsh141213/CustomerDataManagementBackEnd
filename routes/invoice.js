// routes/invoice.js
const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const vision = require("@google-cloud/vision");
const Invoice = require("../models/Invoice");

const router = express.Router();

// Google Cloud Vision client
const client = new vision.ImageAnnotatorClient();

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Upload invoice
router.post("/upload", upload.single("invoice"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Compress image
    const compressedBuffer = await sharp(req.file.buffer)
      .resize(800)
      .grayscale()
      .jpeg({ quality: 70 })
      .toBuffer();

    // OCR vendor extraction
    const vendorName = await extractVendorName(compressedBuffer);

    // Find or create vendor
    let vendor = await Invoice.findOne({ vendorName });
    if (!vendor) {
      vendor = new Invoice({ vendorName, invoices: [] });
    }

    // Add invoice
    vendor.invoices.push({
      fileName: req.file.originalname,
      imageData: compressedBuffer.toString("base64"),
      uploadedAt: new Date(),
    });

    await vendor.save();

    res.json({
      message: "Invoice uploaded successfully",
      vendorName,
      totalInvoices: vendor.invoices.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all vendors for dropdown
router.get("/vendors", async (req, res) => {
  try {
    const vendors = await Invoice.find({}, { vendorName: 1, _id: 0 });
    const vendorList = vendors.map(v => v.vendorName);
    res.json(vendorList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET invoices for selected vendor
router.get("/:vendorName", async (req, res) => {
  try {
    const { vendorName } = req.params;
    const vendor = await Invoice.findOne({ vendorName });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    res.json(vendor.invoices); // Base64 images
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ OCR function using Google Cloud Vision
async function extractVendorName(imageBuffer) {
  try {
    const [result] = await client.textDetection({ image: { content: imageBuffer } });
    const text = result.fullTextAnnotation?.text || "";
    const lines = text.split("\n");
    console.log("OCR lines:", lines);

    // Keyword match for vendor
    const vendorLine = lines.find(line =>
      /vendor|company|supplier|ltd|private|pvt|inc|enterprises/i.test(line)
    );

    // Clean unwanted symbols
    return vendorLine ? vendorLine.replace(/[^a-zA-Z0-9 &]/g, "").trim() : "UnknownVendor";
  } catch (err) {
    console.error("Vision OCR error:", err);
    return "UnknownVendor";
  }
}

module.exports = router;
