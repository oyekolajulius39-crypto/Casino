const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { sequelize } = require('./models/database');
const GameEngine = require('./game/engine');

// Import routes
const authRoutes = require('./routes/auth');
const paymentRoutes = require('./routes/payment');
const gameRoutes = require('./routes/game');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') 
    : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('public'));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/game', gameRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP/HTTPS server
let server;
if (process.env.USE_HTTPS === 'true' && process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
  const privateKey = fs.readFileSync(process.env.SSL_KEY_PATH, 'utf8');
  const certificate = fs.readFileSync(process.env.SSL_CERT_PATH, 'utf8');
  const credentials = { key: privateKey, cert: certificate };
  server = https.createServer(credentials, app);
  console.log('HTTPS enabled');
} else {
  server = http.createServer(app);
}

// Initialize Socket.io
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket.io authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.userId = decoded.userId;
    socket.username = decoded.username;
    next();
  });
});

// Initialize game engine
const gameEngine = new GameEngine(io);
app.set('gameEngine', gameEngine);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.username} (${socket.userId})`);

  // Send current game state to new connection
  socket.emit('gameState', gameEngine.getGameState());

  // Handle bet placement
  socket.on('placeBet', async (data) => {
    try {
      const { amount } = data;
      
      if (!amount || amount < parseFloat(process.env.MIN_BET) || amount > parseFloat(process.env.MAX_BET)) {
        return socket.emit('error', { message: 'Invalid bet amount' });
      }

      const bet = await gameEngine.placeBet(socket.userId, amount);
      
      socket.emit('betPlaced', {
        success: true,
        bet: {
          id: bet.id,
          amount: parseFloat(bet.amount),
          roundId: bet.round_id
        }
      });

      // Broadcast to all users that a bet was placed
      io.emit('playerBet', {
        username: socket.username,
        amount: parseFloat(bet.amount)
      });

    } catch (error) {
      console.error('Bet error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Handle cash out
  socket.on('cashOut', async () => {
    try {
      const result = await gameEngine.cashOut(socket.userId);
      
      socket.emit('cashedOut', {
        success: true,
        multiplier: result.multiplier,
        winAmount: result.winAmount,
        balance: result.balance
      });

      // Broadcast to all users
      io.emit('playerCashedOut', {
        username: socket.username,
        multiplier: result.multiplier,
        winAmount: result.winAmount
      });

    } catch (error) {
      console.error('Cash out error:', error);
      socket.emit('error', { message: error.message });
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.username}`);
  });
});

// Database connection and server startup
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    // Sync models (in development only)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      console.log('Database models synchronized.');
    }

    // Start server
    server.listen(PORT, () => {
      console.log(`Server running on ${process.env.USE_HTTPS === 'true' ? 'https' : 'http'}://${HOST}:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start first game round
      setTimeout(() => {
        gameEngine.startNewRound();
      }, 2000);
    });

  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await sequelize.close();
    console.log('Database connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(async () => {
    console.log('HTTP server closed');
    await sequelize.close();
    console.log('Database connection closed');
    process.exit(0);
  });
});

startServer();

module.exports = { app, server, io };
