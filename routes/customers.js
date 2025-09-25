const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Entry = require('../models/Entry');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');

// Add customer
router.post('/', async (req,res)=>{
  const {name, phone, due} = req.body;
  try{
    const c = await Customer.create({name, phone, due});
    console.log(c)
    res.json(c);
  }catch(e){ res.status(400).json({error:e.message}); }
});

// Search / list
router.get('/', async (req,res)=>{
  const q = req.query.search || '';
  const regex = new RegExp(q, 'i');
  const list = await Customer.find({ $or: [{name:regex}, {phone:regex}] }).limit(50);
  res.json(list);
});

// Get customer summary (month)
router.get('/:id/summary', async (req,res)=>{
  const {id} = req.params;
  const month = req.query.month; // format YYYY-MM
  let start, end;
  if(month){ start = new Date(month + '-01'); end = new Date(start); end.setMonth(end.getMonth()+1); }
  else { start = new Date(); start.setDate(1); start.setHours(0,0,0,0); end = new Date(start); end.setMonth(end.getMonth()+1); }

  const entries = await Entry.find({ customerId: id, date: {$gte:start, $lt:end} }).sort({date:1});
  const payments = await Payment.find({ customerId: id, date: {$gte:start, $lt:end} }).sort({date:1});
  const totalCharges = entries.reduce((s,e)=> s + (e.total||0), 0);
  const totalPaid = payments.reduce((s,p)=> s + p.amount, 0);
  res.json({entries, payments, totalCharges, totalPaid, due: totalCharges - totalPaid});
});

// Add daily entry
router.post('/:id/entries', async (req, res) => {
  const { id } = req.params;
  const payload = req.body;
  console.log(payload);
  payload.customerId = id;
  payload.total = computeEntryTotal(payload);

  try {
    const e = await Entry.create(payload);  // Create the entry
    var customer = await Customer.findById(id); // Find the customer

    if (customer) {
      customer.due += e.total; // Use `e.total` instead of `entry.total`
      await customer.save(); // Save the updated customer
    }

    res.json({ entry: e, customer: customer });  // Return the created entry and updated customer
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});


// Record payment
router.post('/:id/payments', async (req, res) => {
  const { id } = req.params;
  const { amount, method, ref } = req.body;

  try {
    // 1. Create the payment entry
    const p = await Payment.create({
      customerId: id,
      amount,
      method,
      ref,
    });

    // 2. Find the customer
    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // 3. Subtract the payment amount from the due
    customer.due = Math.max((customer.due || 0) - amount, 0); // Prevent negative due

    // 4. Save updated customer
    await customer.save();

    res.json(p);
  } catch (e) {
    console.error("Payment error:", e);
    res.status(400).json({ error: e.message });
  }
});


function computeEntryTotal(entry){
  const milkTotal = (entry.milk||[]).reduce((s,m)=> s + ((m.qty||0) * (m.ratePerLitre||0)), 0);
  const extrasTotal = (entry.extras||[]).reduce((s,x)=> s + ((x.rate||0)), 0);
  return Math.round((milkTotal + extrasTotal) * 100)/100;
}

module.exports = router;
