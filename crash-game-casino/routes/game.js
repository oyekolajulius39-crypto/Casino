const express = require('express');
const { Bet, CrashRound } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { betValidation } = require('../middleware/validation');

const router = express.Router();

// Get current game state
router.get('/state', authenticateToken, (req, res) => {
  try {
    const gameEngine = req.app.get('gameEngine');
    const state = gameEngine.getGameState();
    
    res.json({
      ...state,
      hasBet: gameEngine.hasBet(req.user.id),
      hasCashedOut: gameEngine.hasCashedOut(req.user.id)
    });
  } catch (error) {
    console.error('Get game state error:', error);
    res.status(500).json({ error: 'Failed to get game state' });
  }
});

// Place bet (handled via Socket.io in server.js)
// This endpoint is for REST API compatibility
router.post('/bet', authenticateToken, betValidation, async (req, res) => {
  try {
    const { amount } = req.body;
    const gameEngine = req.app.get('gameEngine');

    const bet = await gameEngine.placeBet(req.user.id, amount);

    res.json({
      success: true,
      bet: {
        id: bet.id,
        amount: parseFloat(bet.amount),
        roundId: bet.round_id
      }
    });
  } catch (error) {
    console.error('Place bet error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Cash out (handled via Socket.io in server.js)
// This endpoint is for REST API compatibility
router.post('/cashout', authenticateToken, async (req, res) => {
  try {
    const gameEngine = req.app.get('gameEngine');
    const result = await gameEngine.cashOut(req.user.id);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Cash out error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get bet history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    
    const bets = await Bet.findAll({
      where: { user_id: req.user.id },
      include: [{
        model: CrashRound,
        attributes: ['crash_point', 'started_at']
      }],
      order: [['created_at', 'DESC']],
      limit
    });

    res.json({
      bets: bets.map(bet => ({
        id: bet.id,
        amount: parseFloat(bet.amount),
        crashPoint: bet.CrashRound ? parseFloat(bet.CrashRound.crash_point) : null,
        cashedOutAt: bet.cashed_out_at ? parseFloat(bet.cashed_out_at) : null,
        wonAmount: parseFloat(bet.won_amount),
        status: bet.status,
        profit: parseFloat(bet.won_amount) - parseFloat(bet.amount),
        createdAt: bet.created_at
      }))
    });
  } catch (error) {
    console.error('Get bet history error:', error);
    res.status(500).json({ error: 'Failed to get bet history' });
  }
});

// Get recent rounds
router.get('/rounds', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const rounds = await CrashRound.findAll({
      order: [['started_at', 'DESC']],
      limit,
      attributes: ['id', 'crash_point', 'started_at', 'ended_at']
    });

    res.json({
      rounds: rounds.map(round => ({
        id: round.id,
        crashPoint: parseFloat(round.crash_point),
        startedAt: round.started_at,
        endedAt: round.ended_at
      }))
    });
  } catch (error) {
    console.error('Get rounds error:', error);
    res.status(500).json({ error: 'Failed to get rounds' });
  }
});

module.exports = router;
