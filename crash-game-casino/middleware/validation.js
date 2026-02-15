const { body, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .isAlphanumeric()
    .withMessage('Username must contain only letters and numbers'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  validate
];

const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  validate
];

const betValidation = [
  body('amount')
    .isFloat({ min: parseFloat(process.env.MIN_BET) || 10, max: parseFloat(process.env.MAX_BET) || 10000 })
    .withMessage(`Bet amount must be between ${process.env.MIN_BET || 10} and ${process.env.MAX_BET || 10000}`),
  validate
];

const depositValidation = [
  body('amount')
    .isFloat({ min: 100 })
    .withMessage('Minimum deposit amount is 100'),
  body('email')
    .trim()
    .isEmail()
    .withMessage('Must be a valid email address'),
  validate
];

module.exports = {
  registerValidation,
  loginValidation,
  betValidation,
  depositValidation
};
