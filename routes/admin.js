const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const Payment = require('../models/Payment');
const PDFDocument = require('pdfkit'); 
// const puppeteer = require('puppeteer');

// generate single-customer invoice PDF for a month
router.get('/invoice/:customerId', async (req, res) => {
  const { customerId } = req.params;
  const month = req.query.month; // YYYY-MM
  const start = new Date(month + "-01");
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  const customer = await Customer.findById(customerId);
  const entries = await Entry.find({ customerId, date: { $gte: start, $lt: end } }).sort({ date: 1 });
  const payments = await Payment.find({ customerId, date: { $gte: start, $lt: end } }).sort({ date: 1 });

  // ---- AGGREGATION ----
  let milkSummary = {};
  let extrasSummary = {};

  entries.forEach(en => {
    (en.milk || []).forEach(m => {
      if (!milkSummary[m.type]) milkSummary[m.type] = { qty: 0, amount: 0, rate: m.ratePerLitre };
      milkSummary[m.type].qty += m.qty;
      milkSummary[m.type].amount += m.qty * m.ratePerLitre;
    });

    (en.extras || []).forEach(ex => {
      if (!extrasSummary[ex.name]) extrasSummary[ex.name] = { amount: 0 };
      extrasSummary[ex.name].amount += ex.rate;
    });
  });

  const rows = [];
  let idx = 1;
  for (const type in milkSummary) {
    rows.push({
      sno: idx++,
      item: `Milk ${type}`,
      qty: milkSummary[type].qty.toFixed(2) + " LTR",
      rate: milkSummary[type].rate.toFixed(2),
      amount: milkSummary[type].amount.toFixed(2),
    });
  }

  if (Object.keys(extrasSummary).length > 0) {
    let remarks = Object.keys(extrasSummary)
      .map(k => `${k} (₹${extrasSummary[k].amount})`)
      .join(", ");
    let totalExtra = Object.values(extrasSummary).reduce((s, ex) => s + ex.amount, 0);

    rows.push({
      sno: idx++,
      item: "Extras",
      qty: "-",
      rate: "-",
      amount: totalExtra.toFixed(2),
      remarks,
    });
  }

  const totalCharges = entries.reduce((s, e) => s + (e.total || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const due = totalCharges - totalPaid;

  const numberToWords = require("number-to-words");
  const totalInWords =
    numberToWords.toWords(totalCharges).replace(/\b\w/g, l => l.toUpperCase()) + " Rupees Only";

  // ---- PDFKit generation ----
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  
  let buffers = [];
  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(buffers);
    res.set({ "Content-Type": "application/pdf", "Content-Length": pdfBuffer.length });
    res.send(pdfBuffer);
  });

  // Header
  doc.fontSize(20).text("PT KISHANNI MAHARAJ DAIRY PRODUCTS", { align: 'center' });
  doc.fontSize(12).text("Bareilly - 243001 | Phone: +91-8267000606 | GST:", { align: 'center' });
  doc.moveDown();

  doc.fontSize(16).text("INVOICE", { align: 'center', underline: true });
  doc.moveDown();

  // Customer Info
  doc.fontSize(12)
    .text(`Invoice For: ${customer.name}`)
    .text(`Phone: ${customer.phone}`)
    .text(`Month: ${month}`)
    .text(`Date: ${new Date().toLocaleDateString()}`);
  doc.moveDown();

  // Table Header
  doc.font('Helvetica-Bold');
  doc.text("S.No", 50, doc.y, { continued: true, width: 50 });
  doc.text("Item", 100, doc.y, { continued: true, width: 200 });
  doc.text("Qty", 300, doc.y, { continued: true, width: 70, align: 'center' });
  doc.text("Rate", 370, doc.y, { continued: true, width: 70, align: 'center' });
  doc.text("Amount", 440, doc.y, { width: 70, align: 'center' });
  doc.moveDown();

  doc.font('Helvetica');
  rows.forEach(r => {
    doc.text(r.sno.toString(), 50, doc.y, { continued: true, width: 50 });
    let itemText = r.item + (r.remarks ? ` (${r.remarks})` : '');
    doc.text(itemText, 100, doc.y, { continued: true, width: 200 });
    doc.text(r.qty, 300, doc.y, { continued: true, width: 70, align: 'center' });
    doc.text(r.rate, 370, doc.y, { continued: true, width: 70, align: 'center' });
    doc.text(r.amount, 440, doc.y, { width: 70, align: 'center' });
    doc.moveDown();
  });

  // Summary
  doc.moveDown();
  doc.text(`Subtotal: ₹${totalCharges.toFixed(2)}`);
  doc.text(`Total: ₹${totalCharges.toFixed(2)}`);
  doc.text(`Received Amount: ₹${totalPaid.toFixed(2)}`);
  doc.text(`Invoice Balance: ₹${due.toFixed(2)}`);
  doc.text(`Total Amount in Words: ${totalInWords}`);
  doc.moveDown();

  doc.text("Thank you for your business!", { align: 'right' });
  doc.moveDown(4);
  doc.text("Authorized Signatory", { align: 'right' });

  doc.end();
});

// manual notifications trigger (same as your original code)
router.post('/notify/manual', async (req,res)=>{
  const {month} = req.body; // YYYY-MM
  const start = new Date(month + '-01');
  const end = new Date(start); end.setMonth(end.getMonth()+1);
  const customers = await Customer.find();
  const rows = [];
  for(const c of customers){
    const entries = await Entry.find({customerId:c._id, date:{$gte:start, $lt:end}});
    const payments = await Payment.find({customerId:c._id, date:{$gte:start, $lt:end}});
    const totalCharges = entries.reduce((s,e)=> s + (e.total||0), 0);
    const totalPaid = payments.reduce((s,p)=> s + p.amount, 0);
    const due = totalCharges - totalPaid;
    const message = `Namaste ${c.name}, aapka ${month} bill ${totalCharges} Rs. Due: ${due}. Invoice: ${process.env.BASE_URL}/api/admin/invoice/${c._id}?month=${month}`;
    rows.push({phone:c.phone, message});
  }
  const csv = rows.map(r=> `${r.phone},"${r.message}"`).join('\n');
  res.set('Content-Type','text/plain').send(csv);
});



// manual notifications trigger (stub) -> returns CSV body so admin can copy
router.post('/notify/manual', async (req,res)=>{
  const {month} = req.body; // YYYY-MM
  const start = new Date(month + '-01');
  const end = new Date(start); end.setMonth(end.getMonth()+1);
  const customers = await Customer.find();
  const rows = [];
  for(const c of customers){
    const entries = await Entry.find({customerId:c._id, date:{$gte:start, $lt:end}});
    const payments = await Payment.find({customerId:c._id, date:{$gte:start, $lt:end}});
    const totalCharges = entries.reduce((s,e)=> s + (e.total||0), 0);
    const totalPaid = payments.reduce((s,p)=> s + p.amount, 0);
    const due = totalCharges - totalPaid;
    const message = `Namaste ${c.name}, aapka ${month} bill ${totalCharges} Rs. Due: ${due}. Invoice: ${process.env.BASE_URL}/api/admin/invoice/${c._id}?month=${month}`;
    rows.push({phone:c.phone, message});
  }
  // return CSV-like text
  const csv = rows.map(r=> `${r.phone},"${r.message}"`).join('\n');
  res.set('Content-Type','text/plain').send(csv);
});

module.exports = router;
