const { validationResult, check } = require('express-validator');

exports.validateRegistration = [
  check('username', 'Username is required').not().isEmpty(),
  check('username', 'Username must be at least 3 characters long').isLength({ min: 3 }),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
  check('mobile', 'Mobile number is required').not().isEmpty(),
  check('mobile', 'Please include a valid mobile number').isMobilePhone(),
];

exports.validateLogin = [
  check('username', 'Username is required').not().isEmpty(),
  check('password', 'Password is required').not().isEmpty(),
];

exports.validateAddStudent = [
  check('username', 'Username is required').not().isEmpty(),
  check('username', 'Username must be at least 3 characters long').isLength({ min: 3 }),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be at least 6 characters long').isLength({ min: 6 }),
  check('mobile', 'Mobile number is required').not().isEmpty(),
  check('mobile', 'Please include a valid mobile number').isMobilePhone(),
  check('first_name', 'First name is required').not().isEmpty(),
  check('last_name', 'Last name is required').not().isEmpty(),
  check('date_of_birth', 'Invalid date of birth').optional({ checkFalsy: true }).isISO8601().toDate(),
];

exports.validateResult = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

exports.validateEditStudent = [
  check('username', 'Username must be at least 3 characters long').optional({ checkFalsy: true }).isLength({ min: 3 }),
  check('email', 'Please include a valid email').optional({ checkFalsy: true }).isEmail(),
  check('mobile', 'Please include a valid mobile number').optional({ checkFalsy: true }).isMobilePhone(),
  check('first_name', 'First name must not be empty').optional({ checkFalsy: true }).not().isEmpty(),
  check('last_name', 'Last name must not be empty').optional({ checkFalsy: true }).not().isEmpty(),
  check('date_of_birth', 'Invalid date of birth').optional({ checkFalsy: true }).isISO8601().toDate(),
  check('is_active', 'is_active must be a boolean').optional({ checkFalsy: true }).isBoolean().toBoolean(),
];
