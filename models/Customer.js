const mongoose = require('mongoose');

const s = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  phone: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
  due: { type: Number, required: false, index: true }
});

module.exports = mongoose.model('Customer', s);
