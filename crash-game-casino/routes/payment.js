const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { User, Transaction } = require('../models/database');
const { authenticateToken } = require('../middleware/auth');
const { depositValidation } = require('../middleware/validation');

const router = express.Router();

// Initialize payment (Paystack)
router.post('/initialize', authenticateToken, depositValidation, async (req, res) => {
  try {
    const { amount, email } = req.body;
    const userId = req.user.id;

    // Generate unique reference
    const reference = `DEP_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Create transaction record
    await Transaction.create({
      user_id: userId,
      type: 'deposit',
      amount,
      status: 'pending',
      reference,
      metadata: { email }
    });

    // Initialize Paystack payment
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      {
        email,
        amount: amount * 100, // Paystack expects amount in kobo (cents)
        reference,
        callback_url: `${req.protocol}://${req.get('host')}/payment/verify`,
        metadata: {
          user_id: userId,
          username: req.user.username
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.status) {
      res.json({
        success: true,
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
        reference
      });
    } else {
      throw new Error('Paystack initialization failed');
    }
  } catch (error) {
    console.error('Payment initialization error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to initialize payment',
      details: error.response?.data?.message || error.message
    });
  }
});

// Verify payment
router.get('/verify', async (req, res) => {
  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({ error: 'Payment reference is required' });
    }

    // Verify with Paystack
    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (response.data.status && response.data.data.status === 'success') {
      const { amount, metadata } = response.data.data;
      const actualAmount = amount / 100; // Convert from kobo to naira

      // Update transaction status
      const transaction = await Transaction.findOne({ where: { reference } });
      
      if (!transaction) {
        return res.status(404).json({ error: 'Transaction not found' });
      }

      if (transaction.status === 'completed') {
        return res.redirect(`/?status=already_processed`);
      }

      // Update user wallet
      const user = await User.findByPk(transaction.user_id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      await user.update({
        wallet_balance: parseFloat(user.wallet_balance) + actualAmount
      });

      await transaction.update({
        status: 'completed',
        updated_at: new Date()
      });

      // Redirect to success page
      res.redirect(`/?status=success&amount=${actualAmount}`);
    } else {
      // Update transaction as failed
      const transaction = await Transaction.findOne({ where: { reference } });
      if (transaction) {
        await transaction.update({ status: 'failed' });
      }
      res.redirect(`/?status=failed`);
    }
  } catch (error) {
    console.error('Payment verification error:', error.response?.data || error.message);
    res.redirect(`/?status=error`);
  }
});

// Webhook endpoint for Paystack
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body;

    // Handle charge.success event
    if (event.event === 'charge.success') {
      const { reference, amount, metadata } = event.data;
      const actualAmount = amount / 100;

      const transaction = await Transaction.findOne({ where: { reference } });
      
      if (transaction && transaction.status === 'pending') {
        // Update user wallet
        const user = await User.findByPk(transaction.user_id);
        if (user) {
          await user.update({
            wallet_balance: parseFloat(user.wallet_balance) + actualAmount
          });

          await transaction.update({
            status: 'completed',
            updated_at: new Date()
          });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Get transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']],
      limit: 50
    });

    res.json({
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        status: t.status,
        reference: t.reference,
        created_at: t.created_at
      }))
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

module.exports = router;
