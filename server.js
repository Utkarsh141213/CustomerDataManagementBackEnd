const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const limiter = rateLimit({ windowMs: 60*1000, max: 100 });
app.use(limiter);

// Connect DB
mongoose.connect(process.env.MONGO_URI, { dbName: 'milkdairy' })
  .then(()=> console.log('Mongo connected'))
  .catch(err => { console.error(err); process.exit(1); });

// Models
const Customer = require('./models/Customer');
const Entry = require('./models/Entry');
const Payment = require('./models/Payment');

// Routes (simple in-file for MVP)
const authRouter = require('./routes/auth');
const customersRouter = require('./routes/customers');
const adminRouter = require('./routes/admin');

app.use('/api/auth', authRouter);
app.use('/api/customers', customersRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=> console.log(`Server listening ${PORT}`));
