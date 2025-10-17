const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

dotenv.config();
const app = express();

// ✅ Tell Express to trust the proxy (important for Render/Vercel)
app.set('trust proxy', 1); // <-- ADD THIS LINE

// ✅ Dynamic allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://customer-data-management-front-end.vercel.app', // Vercel frontend
  process.env.FRONTEND_URL // dynamic from Render env
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn('❌ Blocked by CORS:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());

// ✅ Basic rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
});
app.use(limiter);

// ✅ MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    dbName: 'milkdairy',
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ✅ Import models
require('./models/Customer');
require('./models/Entry');
require('./models/Payment');

// ✅ Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/invoice', require('./routes/invoice'));

// ✅ Health route (for Render/Vercel ping)
app.get('/', (req, res) => {
  res.status(200).send('Customer Data Management API is running 🚀');
});

// ✅ Start server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
