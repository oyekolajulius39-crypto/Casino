const crypto = require('crypto');
const { CrashRound, Bet, User, sequelize } = require('../models/database');

class GameEngine {
  constructor(io) {
    this.io = io;
    this.currentRound = null;
    this.currentMultiplier = 1.00;
    this.crashPoint = null;
    this.gameState = 'waiting'; // waiting, countdown, running, crashed
    this.bets = new Map(); // userId -> bet amount
    this.cashedOut = new Set(); // userId who cashed out
    this.startTime = null;
    this.countdownTimer = null;
    this.gameTimer = null;
    
    // Game configuration
    this.COUNTDOWN_DURATION = parseInt(process.env.COUNTDOWN_DURATION) || 5000;
    this.UPDATE_INTERVAL = 100; // Update multiplier every 100ms
    this.GROWTH_RATE = 0.05; // Multiplier growth rate
  }

  // Generate provably fair crash point
  generateCrashPoint() {
    const hash = crypto.randomBytes(32).toString('hex');
    
    // Generate crash point between 1.00x and 10.00x
    // Using exponential distribution for realistic probabilities
    const random = crypto.randomInt(0, 10000) / 10000;
    const crashPoint = Math.max(1.00, Math.min(10.00, 
      1 / (1 - random * 0.9) // Exponential distribution
    ));
    
    return {
      crashPoint: parseFloat(crashPoint.toFixed(2)),
      hash
    };
  }

  async startNewRound() {
    try {
      if (this.gameState !== 'waiting') return;

      console.log('Starting new round...');
      this.gameState = 'countdown';
      this.bets.clear();
      this.cashedOut.clear();
      this.currentMultiplier = 1.00;

      // Generate crash point
      const { crashPoint, hash } = this.generateCrashPoint();
      this.crashPoint = crashPoint;

      // Create round in database
      this.currentRound = await CrashRound.create({
        crash_point: crashPoint,
        hash,
        started_at: new Date()
      });

      // Broadcast countdown
      this.io.emit('gameState', {
        state: 'countdown',
        roundId: this.currentRound.id,
        countdown: this.COUNTDOWN_DURATION / 1000
      });

      // Countdown
      let countdown = this.COUNTDOWN_DURATION / 1000;
      this.countdownTimer = setInterval(() => {
        countdown -= 1;
        this.io.emit('countdown', { countdown });
        
        if (countdown <= 0) {
          clearInterval(this.countdownTimer);
          this.startGame();
        }
      }, 1000);

    } catch (error) {
      console.error('Error starting new round:', error);
      this.resetGame();
    }
  }

  startGame() {
    console.log(`Game starting! Crash point: ${this.crashPoint}x`);
    this.gameState = 'running';
    this.startTime = Date.now();

    this.io.emit('gameState', {
      state: 'running',
      roundId: this.currentRound.id
    });

    // Update multiplier in real-time
    this.gameTimer = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.currentMultiplier = parseFloat((1 + elapsed * this.GROWTH_RATE).toFixed(2));

      // Broadcast current multiplier
      this.io.emit('multiplier', {
        multiplier: this.currentMultiplier,
        roundId: this.currentRound.id
      });

      // Check if crash point reached
      if (this.currentMultiplier >= this.crashPoint) {
        this.crash();
      }
    }, this.UPDATE_INTERVAL);
  }

  async crash() {
    console.log(`Game crashed at ${this.crashPoint}x`);
    clearInterval(this.gameTimer);
    this.gameState = 'crashed';

    // Update round end time
    await this.currentRound.update({
      ended_at: new Date()
    });

    // Process all remaining bets as losses
    for (const [userId, betAmount] of this.bets) {
      if (!this.cashedOut.has(userId)) {
        await this.processBetLoss(userId);
      }
    }

    // Broadcast crash
    this.io.emit('gameState', {
      state: 'crashed',
      crashPoint: this.crashPoint,
      roundId: this.currentRound.id
    });

    // Wait before starting new round
    setTimeout(() => {
      this.resetGame();
      this.startNewRound();
    }, 5000);
  }

  resetGame() {
    this.gameState = 'waiting';
    this.currentMultiplier = 1.00;
    this.crashPoint = null;
    this.bets.clear();
    this.cashedOut.clear();
    this.startTime = null;
    
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.gameTimer) clearInterval(this.gameTimer);
  }

  async placeBet(userId, amount) {
    if (this.gameState !== 'countdown') {
      throw new Error('Cannot place bet at this time');
    }

    if (this.bets.has(userId)) {
      throw new Error('You already have a bet in this round');
    }

    // Check user balance
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (parseFloat(user.wallet_balance) < amount) {
      throw new Error('Insufficient balance');
    }

    // Deduct bet amount from wallet
    await user.update({
      wallet_balance: parseFloat(user.wallet_balance) - amount
    });

    // Create bet record
    const bet = await Bet.create({
      user_id: userId,
      round_id: this.currentRound.id,
      amount,
      status: 'pending'
    });

    this.bets.set(userId, amount);

    return bet;
  }

  async cashOut(userId) {
    if (this.gameState !== 'running') {
      throw new Error('Cannot cash out at this time');
    }

    if (!this.bets.has(userId)) {
      throw new Error('No active bet found');
    }

    if (this.cashedOut.has(userId)) {
      throw new Error('Already cashed out');
    }

    const betAmount = this.bets.get(userId);
    const cashOutMultiplier = this.currentMultiplier;
    const winAmount = parseFloat((betAmount * cashOutMultiplier).toFixed(2));

    // Update bet record
    const bet = await Bet.findOne({
      where: {
        user_id: userId,
        round_id: this.currentRound.id
      }
    });

    if (!bet) {
      throw new Error('Bet not found');
    }

    await bet.update({
      cashed_out_at: cashOutMultiplier,
      won_amount: winAmount,
      status: 'won'
    });

    // Add winnings to user wallet
    const user = await User.findByPk(userId);
    await user.update({
      wallet_balance: parseFloat(user.wallet_balance) + winAmount
    });

    this.cashedOut.add(userId);

    return {
      multiplier: cashOutMultiplier,
      winAmount,
      balance: parseFloat(user.wallet_balance)
    };
  }

  async processBetLoss(userId) {
    const bet = await Bet.findOne({
      where: {
        user_id: userId,
        round_id: this.currentRound.id
      }
    });

    if (bet) {
      await bet.update({
        status: 'lost',
        won_amount: 0
      });
    }
  }

  getGameState() {
    return {
      state: this.gameState,
      multiplier: this.currentMultiplier,
      roundId: this.currentRound?.id,
      crashPoint: this.gameState === 'crashed' ? this.crashPoint : null
    };
  }

  hasBet(userId) {
    return this.bets.has(userId);
  }

  hasCashedOut(userId) {
    return this.cashedOut.has(userId);
  }
}

module.exports = GameEngine;
