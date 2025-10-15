const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema({
  vendorName: { type: String, required: true },
  invoices: [
    {
      fileName: String,
      imageData: String,  // Base64 compressed image
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
});

module.exports = mongoose.model("Invoice", invoiceSchema);
