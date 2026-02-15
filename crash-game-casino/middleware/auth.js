const jwt = require('jsonwebtoken');
const { User } = require('../models/database');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid or expired token' });
      }

      // Get user from database
      const user = await User.findByPk(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      req.user = {
        id: user.id,
        username: user.username,
        email: user.email
      };
      next();
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticateToken };
