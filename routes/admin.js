const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const Payment = require('../models/Payment');
const puppeteer = require('puppeteer');

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

    // Extras aggregation (direct rate)
  (en.extras || []).forEach(ex => {
    if (!extrasSummary[ex.name]) extrasSummary[ex.name] = { amount: 0 };
    extrasSummary[ex.name].amount += ex.rate;
  });
});


  // ---- CONVERT TO TABLE ROWS ----
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

  // ---- TOTALS ----
  const totalCharges = entries.reduce((s, e) => s + (e.total || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const due = totalCharges - totalPaid;

  const numberToWords = require("number-to-words");
  const totalInWords =
    numberToWords.toWords(totalCharges).replace(/\b\w/g, l => l.toUpperCase()) + " Rupees Only";

  // ---- HTML TEMPLATE ----
    const html = `
  <html>
  <head>
    <style>
      body { font-family: "Helvetica Neue", Arial, sans-serif; padding: 30px; color: #333; }
      .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
      .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
      .header p { margin: 2px 0; font-size: 14px; }
      .invoice-title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 15px; text-decoration: underline; }

      .info { margin-bottom: 20px; font-size: 14px; }
      .info b { display: inline-block; width: 120px; }

      table { width: 100%; border-collapse: collapse; margin-top: 15px; }
      th { background: #f5f5f5; }
      th, td { border: 1px solid #000; padding: 8px; text-align: center; font-size: 14px; }
      td.item-col { text-align: left; }

      .summary { margin-top: 25px; font-size: 15px; }
      .summary p { margin: 5px 0; }
      .summary b { width: 180px; display: inline-block; }

      .footer { margin-top: 40px; text-align: right; font-size: 14px; }
      .signature { margin-top: 60px; text-align: right; font-size: 14px; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>PT KISHANNI MAHARAJ DAIRY PRODUCTS</h1>
      <p>Bareilly - 243001 | Phone: +91-8267000606 | GST:</p>
    </div>

    <div class="invoice-title">INVOICE</div>

    <div class="info">
      <p><b>Invoice For:</b> ${customer.name}</p>
      <p><b>Phone:</b> ${customer.phone}</p>
      <p><b>Month:</b> ${month}</p>
      <p><b>Date:</b> ${new Date().toLocaleDateString()}</p>
    </div>

    <table>
      <tr>
        <th>S.No</th>
        <th>Item</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Amount</th>
      </tr>
      ${rows.map(r => `
        <tr>
          <td>${r.sno}</td>
          <td class="item-col">${r.item}${r.remarks ? "<br><small>" + r.remarks + "</small>" : ""}</td>
          <td>${r.qty}</td>
          <td>${r.rate}</td>
          <td>${r.amount}</td>
        </tr>`).join("")}
    </table>

    <div class="summary">
      <p><b>Subtotal:</b> ₹${totalCharges.toFixed(2)}</p>
      <p><b>Total:</b> ₹${totalCharges.toFixed(2)}</p>
      <p><b>Received Amount:</b> ₹${totalPaid.toFixed(2)}</p>
      <p><b>Invoice Balance:</b> ₹${due.toFixed(2)}</p>
      <p><b>Total Amount in Words:</b> ${totalInWords}</p>
    </div>

    <div class="footer">
      <p>Thank you for your business!</p>
    </div>

    <div class="signature">
      <p><b>Authorized Signatory</b></p>
    </div>
  </body>
  </html>
  `;


  const browser = await require("puppeteer").launch({
  headless: "new",  // ✅ fixes warning
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  res.set({ "Content-Type": "application/pdf", "Content-Length": pdfBuffer.length });
  res.send(pdfBuffer);
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
