const express = require('express');
const { registerTeacher, loginUser } = require('../controllers/authController');
const { validateRegistration, validateLogin, validateResult } = require('../middleware/validationMiddleware');

const router = express.Router();

router.post('/register', validateRegistration, validateResult, registerTeacher);
router.post('/login', validateLogin, validateResult, loginUser);

module.exports = router;
