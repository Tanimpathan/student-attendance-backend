const express = require('express');
const { registerTeacher, loginUser } = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validationMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');

const router = express.Router();

router.post('/register', validateRegistration, asyncHandler(registerTeacher));
router.post('/login', validateLogin, asyncHandler(loginUser));

module.exports = router;
