const express = require('express');
const { registerTeacher, loginUser } = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validationMiddleware');

const router = express.Router();

router.post('/register', validateRegistration, registerTeacher);
router.post('/login', validateLogin, loginUser);

module.exports = router;
