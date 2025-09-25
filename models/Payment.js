const mongoose = require('mongoose');
const s = new mongoose.Schema({
  customerId: {type: mongoose.Schema.Types.ObjectId, ref:'Customer', required:true, index:true},
  date: {type: Date, default: Date.now},
  amount: {type: Number, required:true},
  method: String,
  ref: String
});
module.exports = mongoose.model('Payment', s);
