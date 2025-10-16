const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const Invoice = require("../models/Invoice");
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---------------------- Upload Invoice ----------------------
router.post("/upload", upload.single("invoice"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });

    // Compress image
    const compressedBuffer = await sharp(req.file.buffer)
      .resize({ width: 800 })
      .jpeg({ quality: 70 })
      .toBuffer();

    let vendorName = req.body.vendor?.trim();
    if (!vendorName) {
      // generate week-wise vendor name based on current week
      const today = new Date();
      const day = today.getDay(); // 0=Sun ... 6=Sat
      const diffToMonday = (day + 6) % 7;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - diffToMonday);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekStr = `${weekStart.toISOString().split("T")[0]}_to_${weekEnd
        .toISOString()
        .split("T")[0]}`;

      vendorName = `Vendor_${weekStr}`;
    }

    // Save in DB
    let vendor = await Invoice.findOne({ vendorName });
    if (!vendor) vendor = new Invoice({ vendorName, invoices: [] });

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


// ---------------------- Get Vendors ----------------------
router.get("/vendors", async (req, res) => {
  try {
    const vendors = await Invoice.find({}, { vendorName: 1, _id: 0 });
    res.json(vendors.map(v => v.vendorName));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ---------------------- Get invoices week-wise for last 3 months ----------------------
router.get("/:vendorName", async (req, res) => {
  try {
    const { vendorName } = req.params;
    const vendor = await Invoice.findOne({ vendorName });
    if (!vendor) return res.status(404).json({ message: "Vendor not found" });

    // Filter last 3 months
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const recentInvoices = vendor.invoices.filter(
      inv => new Date(inv.uploadedAt) >= threeMonthsAgo
    );

    // Group by week
    const grouped = {};
    recentInvoices.forEach(inv => {
      const d = new Date(inv.uploadedAt);
      const day = d.getDay(); // 0=Sun ... 6=Sat
      const diffToMonday = (day + 6) % 7; // shift so week starts Monday
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - diffToMonday);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const key = `${weekStart.toISOString().split("T")[0]} - ${weekEnd
        .toISOString()
        .split("T")[0]}`;

      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(inv);
    });

    // Convert grouped object to array for FE
    const groupedArray = Object.entries(grouped).map(([week, invoices]) => ({
      week,
      invoices,
    }));

    res.json(groupedArray);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
