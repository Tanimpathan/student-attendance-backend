const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/db');

exports.registerTeacher = async (req, res) => {
  const { username, email, password, mobile } = req.body;

  try {
    // Check for existing user
    const existingUser = await db.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2 OR mobile = $3',
      [username, email, mobile]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User with this username, email, or mobile already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user to database
    const newUser = await db.query(
      'INSERT INTO users (username, email, password, mobile, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, mobile, role',
      [username, email, hashedPassword, mobile, 'teacher']
    );

    res.status(201).json({ message: 'Teacher registered successfully', user: newUser.rows[0] });
  } catch (error) {
    logger.error('Teacher registration failed', {
      action: 'teacher_registration_error',
      username,
      email,
      mobile,
      error: error.message,
      stack: error.stack,
      errorCode: 'TEACHER_REG_001'
    });
    res.status(500).json({ message: 'Server error' });
  }
};

const logLoginAttempt = async (userId, ipAddress, userAgent, status) => {
  try {
    await db.query(
      'INSERT INTO login_logs (user_id, ip_address, user_agent, status) VALUES ($1, $2, $3, $4)',
      [userId, ipAddress, userAgent, status]
    );
  } catch (error) {
    logger.error('Failed to log login attempt to database', {
      action: 'login_attempt_log_failed',
      userId,
      ipAddress,
      status,
      error: error.message,
      errorCode: error.code || 'DB_ERROR',
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      logType: 'error'
    });
  }
};

exports.loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if user exists
    const userResult = await db.query(
      'SELECT id, username, email, mobile, password, role, is_active FROM users WHERE username = $1',
      [username]
    );

    const user = userResult.rows[0];

    // Get client info for logging
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (!user) {
      await logLoginAttempt(null, ipAddress, userAgent, 'failure');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.is_active) {
      await logLoginAttempt(user.id, ipAddress, userAgent, 'failure');
      return res.status(401).json({ message: 'Account is deactivated. Please contact support.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await logLoginAttempt(user.id, ipAddress, userAgent, 'failure');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Log successful login
    await logLoginAttempt(user.id, ipAddress, userAgent, 'success');

    const userData = { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      role: user.role 
    };

    // If user is a student, fetch student ID from student table
    if (user.role === 'student') {
      const studentResult = await db.query(
        'SELECT id FROM students WHERE user_id = $1',
        [user.id]
      );
      
      if (studentResult.rows[0]) {
        userData.student_id = studentResult.rows[0].id;
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(200).json({ 
      token, 
      user: userData
    });
    
  } catch (error) {
    logger.error('Login process failed with unexpected error', {
      action: 'login_process_error',
      username,
      ipAddress,
      error: error.message,
      errorCode: 'LOGIN_001',
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      errorType: error.name,
      logType: 'error'
    });
    res.status(500).json({ message: 'Server error' });
  }
};
