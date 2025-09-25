const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// For MVP: single admin user stored in env (or create user flow later)
const ADMIN_USER = process.env.ADMIN_USER || 'admin';

router.post('/login', async (req, res) => {
  console.log('ssasasasas')
  const {email, password} = req.body;
  console.log(email + '>>>>>>> ' + password)
  if(email !== ADMIN_USER) return res.status(401).json({message:'Invalid'});
  // If ADMIN_PASS_HASH set, compare, else compare to ADMIN_PASS env (only for quick dev)
  const ok = process.env.ADMIN_PASS_HASH
    ? await bcrypt.compare(password, process.env.ADMIN_PASS_HASH)
    : (password === process.env.ADMIN_PASS || password === 'admin');
  if(!ok) return res.status(401).json({message:'Invalid credentials'});
  const token = jwt.sign({email}, process.env.JWT_SECRET, {expiresIn:'12h'});
  res.json({token});
});

module.exports = router;
