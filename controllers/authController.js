const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const logger = require('../utils/logger');
const { constatnts } = require('../utils/constants');

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

    // Get teacher role from roles table
    const roleResult = await db.query(
      'SELECT id FROM roles WHERE name = $1',
      [constatnts.TEACHER]
    );

    if (roleResult.rows.length === 0) {
      logger.error('Teacher role not found in roles table', {
        action: 'role_not_found',
        role: 'teacher'
      });
      return res.status(500).json({ message: 'Teacher role not configured in system' });
    }

    const teacherRoleId = roleResult.rows[0].id;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Start transaction for atomic operations
    await db.query('BEGIN');

    // Save user to database
    const newUser = await db.query(
      'INSERT INTO users (username, email, password, mobile, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, email, mobile, role',
      [username, email, hashedPassword, mobile, 'teacher']
    );

    const userId = newUser.rows[0].id;

    // Save user role to user_roles table
    await db.query(
      'INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)',
      [userId, teacherRoleId]
    );

    // Commit transaction
    await db.query('COMMIT');

    res.status(201).json({ 
      message: 'Teacher registered successfully', 
      user: newUser.rows[0] 
    });

  } catch (error) {
    // Rollback transaction in case of error
    await db.query('ROLLBACK').catch(rollbackError => {
      logger.error('Transaction rollback failed', {
        action: 'rollback_error',
        error: rollbackError.message
      });
    });

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
    // Check if user exists with role and permission information
    const userResult = await db.query(
      `SELECT 
         u.id, u.username, u.email, u.mobile, u.password, u.role, u.is_active,
         r.id as role_id, r.name as role_name,
         p.id as permission_id, p.name as permission_name
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       LEFT JOIN role_permissions rp ON r.id = rp.role_id
       LEFT JOIN permissions p ON rp.permission_id = p.id
       WHERE u.username = $1`,
      [username]
    );

    // Get client info for logging
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');

    if (userResult.rows.length === 0) {
      await logLoginAttempt(null, ipAddress, userAgent, 'failure');
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

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

    // Process all roles and permissions from the joined result
    const rolesMap = new Map();
    const allPermissions = new Set();

    userResult.rows.forEach(row => {
      // Collect roles
      if (row.role_id) {
        if (!rolesMap.has(row.role_id)) {
          rolesMap.set(row.role_id, {
            id: row.role_id,
            name: row.role_name,
            permissions: []
          });
        }
        
        // Collect permissions for this role
        if (row.permission_id) {
          const role = rolesMap.get(row.role_id);
          role.permissions.push({
            id: row.permission_id,
            name: row.permission_name
          });
          
          // Add to overall permissions set
          allPermissions.add(row.permission_name);
        }
      }
    });

    const userRoles = Array.from(rolesMap.values());
    const permissionsArray = Array.from(allPermissions);

    const userData = { 
      id: user.id, 
      username: user.username, 
      email: user.email, 
      mobile: user.mobile,
      role: user.role,
      roles: userRoles,
      permissions: permissionsArray
    };

    // If user is a student, fetch student ID from student table
    if (user.role === 'student') {
      const studentResult = await db.query(
        'SELECT id, first_name, last_name FROM students WHERE user_id = $1',
        [user.id]
      );
      
      if (studentResult.rows[0]) {
        userData.student_id = studentResult.rows[0].id;
        userData.first_name = studentResult.rows[0].first_name;
        userData.last_name = studentResult.rows[0].last_name;
      }
    }

    // Generate JWT token with roles and permissions
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username,
        role: user.role,
        roles: userRoles.map(role => role.name),
        permissions: permissionsArray
      },
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
      ipAddress: req.ip || req.connection.remoteAddress,
      error: error.message,
      errorCode: 'LOGIN_001',
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
      errorType: error.name,
      logType: 'error'
    });
    res.status(500).json({ message: 'Server error' });
  }
};

// exports.loginUser = async (req, res) => {
//   const { username, password } = req.body;

//   try {
//     // Check if user exists
//     const userResult = await db.query(
//       'SELECT id, username, email, mobile, password, role, is_active FROM users WHERE username = $1',
//       [username]
//     );

//     const user = userResult.rows[0];

//     // Get client info for logging
//     const ipAddress = req.ip || req.connection.remoteAddress;
//     const userAgent = req.get('User-Agent');

//     if (!user) {
//       await logLoginAttempt(null, ipAddress, userAgent, 'failure');
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     if (!user.is_active) {
//       await logLoginAttempt(user.id, ipAddress, userAgent, 'failure');
//       return res.status(401).json({ message: 'Account is deactivated. Please contact support.' });
//     }

//     // Compare password
//     const isMatch = await bcrypt.compare(password, user.password);

//     if (!isMatch) {
//       await logLoginAttempt(user.id, ipAddress, userAgent, 'failure');
//       return res.status(401).json({ message: 'Invalid credentials' });
//     }

//     // Log successful login
//     await logLoginAttempt(user.id, ipAddress, userAgent, 'success');

//     const userData = { 
//       id: user.id, 
//       username: user.username, 
//       email: user.email, 
//       role: user.role 
//     };

//     // If user is a student, fetch student ID from student table
//     if (user.role === 'student') {
//       const studentResult = await db.query(
//         'SELECT id FROM students WHERE user_id = $1',
//         [user.id]
//       );
      
//       if (studentResult.rows[0]) {
//         userData.student_id = studentResult.rows[0].id;
//       }
//     }

//     // Generate JWT token
//     const token = jwt.sign(
//       { id: user.id, role: user.role },
//       process.env.JWT_SECRET,
//       { expiresIn: process.env.JWT_EXPIRES_IN }
//     );

//     res.status(200).json({ 
//       token, 
//       user: userData
//     });
    
//   } catch (error) {
//     logger.error('Login process failed with unexpected error', {
//       action: 'login_process_error',
//       username,
//       ipAddress,
//       error: error.message,
//       errorCode: 'LOGIN_001',
//       stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
//       errorType: error.name,
//       logType: 'error'
//     });
//     res.status(500).json({ message: 'Server error' });
//   }
// };
