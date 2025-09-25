const mongoose = require('mongoose');
const s = new mongoose.Schema({
  customerId: {type: mongoose.Schema.Types.ObjectId, ref:'Customer', required:true, index:true},
  date: {type: Date, required:true, index:true},
  milk: [ { type: {type:String, enum:['cow','buffalo']}, qty: Number, ratePerLitre: Number } ],
  extras: [ { name: String, qty: Number, rate: Number } ],
  total: Number,
  createdAt: {type: Date, default: Date.now}
});
module.exports = mongoose.model('Entry', s);
