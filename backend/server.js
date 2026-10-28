const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Models
require('./models/User');
require('./models/SOSRequest');
require('./models/Message');

// Middleware
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth');
const sosRoutes = require('./routes/sos');
const userRoutes = require('./routes/users');
const volunteerRoutes = require('./routes/volunteers');
const messageRoutes = require('./routes/messages');

// Socket
const { initializeSocket } = require('./socket/socketHandler');

// App setup
const app = express();
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== 'production';

const corsOptions = {
  origin: isDev ? true : (process.env.CLIENT_URL || 'http://localhost:5173'),
  credentials: true
};

const io = new Server(server, {
  cors: corsOptions
});

// Rate limiting
const isLocal = (req) => {
  const ip = req.ip || req.connection?.remoteAddress || '';
  return !ip || ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
};

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000,
  skip: (req) => isLocal(req) || req.method === 'GET',
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const sosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  skip: (req) => isLocal(req) || req.method === 'GET',
  message: 'Too many SOS requests. Please wait before trying again.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  skip: (req) => isLocal(req),
  message: 'Too many authentication attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors(corsOptions));
app.set('etag', false);
app.use(limiter);
app.use(express.json());
app.use(morgan('dev'));

app.set('io', io);

// Initialize Socket.io
initializeSocket(io);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'SOS Platform backend is running' });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/sos', sosLimiter, sosRoutes);
app.use('/api/users', userRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/messages', messageRoutes);

// Error handler — always last
app.use(errorHandler);

// Connect MongoDB + Start server
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Atlas connected');
    const PORT = process.env.PORT || 5000;

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use by a background Node process.`);
        console.error(`👉 Solution: Stop existing node server terminal or run command to kill process on port ${PORT}.`);
      } else {
        console.error('❌ Server Listen Error:', err);
      }
    });

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ FULL ERROR:');
    console.error(err);
    process.exit(1);
  });