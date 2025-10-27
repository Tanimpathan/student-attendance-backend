const db = require('../db/db');
const logger = require('../utils/logger');
const { 
  createNotFoundError, 
  createDatabaseError, 
  createAuthenticationError,
  createValidationError,
  RecordNotFoundError,
  DatabaseError
} = require('../utils/errors');

/**
 * Get student profile information
 */
exports.getStudentProfile = async (req, res, next) => {
  try {
    const studentId = req.user.student_id;
    
    if (!studentId) {
      const authError = createAuthenticationError('Student profile not found');
      return next(authError);
    }

    const studentResult = await db.query(`
      SELECT 
        s.id as student_id,
        s.first_name,
        s.last_name,
        s.date_of_birth,
        s.address,
        u.username,
        u.email,
        u.mobile,
        u.is_active,
        u.created_at,
        u.updated_at
      FROM students s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = $1
    `, [studentId]);

    if (studentResult.rows.length === 0) {
      const notFoundError = createNotFoundError('Student profile', studentId);
      return next(notFoundError);
    }

    res.status(200).json({
      success: true,
      data: {
        student: studentResult.rows[0]
      }
    });

  } catch (error) {
    logger.error('Error fetching student profile:', error);
    const dbError = createDatabaseError('student profile retrieval', error);
    next(dbError);
  }
};

/**
 * Update student profile information
 */
exports.updateStudentProfile = async (req, res, next) => {
  try {
    const studentId = req.user.student_id;
    const { first_name, last_name, date_of_birth, address, mobile } = req.body;
    
    if (!studentId) {
      const authError = createAuthenticationError('Student profile not found');
      return next(authError);
    }

    // Check if student exists
    const studentResult = await db.query(
      'SELECT user_id FROM students WHERE id = $1',
      [studentId]
    );

    if (studentResult.rows.length === 0) {
      const notFoundError = createNotFoundError('Student', studentId);
      return next(notFoundError);
    }

    const userId = studentResult.rows[0].user_id;

    // Check for duplicate mobile if being updated
    if (mobile) {
      const existingMobile = await db.query(
        'SELECT id FROM users WHERE mobile = $1 AND id != $2',
        [mobile, userId]
      );

      if (existingMobile.rows.length > 0) {
        const duplicateError = createValidationError('Mobile number already exists', 'VAL_002');
        return next(duplicateError);
      }
    }

    // Update user details
    let userUpdateQuery = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
    const userUpdateParams = [];
    let userParamIndex = 1;

    if (mobile !== undefined) { 
      userUpdateQuery += `, mobile = $${userParamIndex++}`; 
      userUpdateParams.push(mobile); 
    }

    userUpdateQuery += ` WHERE id = $${userParamIndex++} RETURNING mobile`;
    userUpdateParams.push(userId);

    const updatedUser = await db.query(userUpdateQuery, userUpdateParams);

    // Update student details
    let studentUpdateQuery = 'UPDATE students SET updated_at = CURRENT_TIMESTAMP';
    const studentUpdateParams = [];
    let studentParamIndex = 1;

    if (first_name !== undefined) { 
      studentUpdateQuery += `, first_name = $${studentParamIndex++}`; 
      studentUpdateParams.push(first_name); 
    }
    if (last_name !== undefined) { 
      studentUpdateQuery += `, last_name = $${studentParamIndex++}`; 
      studentUpdateParams.push(last_name); 
    }
    if (date_of_birth !== undefined) { 
      studentUpdateQuery += `, date_of_birth = $${studentParamIndex++}`; 
      studentUpdateParams.push(date_of_birth); 
    }
    if (address !== undefined) { 
      studentUpdateQuery += `, address = $${studentParamIndex++}`; 
      studentUpdateParams.push(address); 
    }

    studentUpdateQuery += ` WHERE id = $${studentParamIndex++} RETURNING first_name, last_name, date_of_birth, address`;
    studentUpdateParams.push(studentId);

    const updatedStudent = await db.query(studentUpdateQuery, studentUpdateParams);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: updatedUser.rows[0],
        student: updatedStudent.rows[0]
      }
    });

  } catch (error) {
    logger.error('Error updating student profile:', error);
    
    // Check if it's a database constraint error
    if (error.code === '23505') {
      const duplicateError = createValidationError('Mobile number already exists', 'VAL_002');
      return next(duplicateError);
    }
    
    const dbError = createDatabaseError('student profile update', error);
    next(dbError);
  }
};

/**
 * Get student attendance records
 */
exports.getStudentAttendance = async (req, res, next) => {
  try {
    const studentId = req.user.student_id;
    const { page = 1, limit = 10, startDate, endDate, isPresent } = req.query;
    const offset = (page - 1) * limit;
    
    if (!studentId) {
      const authError = createAuthenticationError('Student profile not found');
      return next(authError);
    }

    let query = `SELECT
        a.id AS attendance_id,
        a.date,
        a.is_present,
        a.recorded_at
      FROM attendance a
      WHERE a.student_id = $1`;
    
    let countQuery = `SELECT COUNT(*) FROM attendance WHERE student_id = $1`;
    const queryParams = [studentId];
    const countQueryParams = [studentId];
    let paramIndex = 2;

    if (startDate) {
      query += ` AND a.date >= $${paramIndex}`;
      countQuery += ` AND date >= $${paramIndex}`;
      queryParams.push(startDate);
      countQueryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND a.date <= $${paramIndex}`;
      countQuery += ` AND date <= $${paramIndex}`;
      queryParams.push(endDate);
      countQueryParams.push(endDate);
      paramIndex++;
    }

    if (isPresent !== undefined) {
      query += ` AND a.is_present = $${paramIndex}`;
      countQuery += ` AND is_present = $${paramIndex}`;
      queryParams.push(isPresent.toLowerCase() === 'true');
      countQueryParams.push(isPresent.toLowerCase() === 'true');
      paramIndex++;
    }

    query += ` ORDER BY a.date DESC, a.recorded_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit);
    queryParams.push(offset);

    const attendanceResult = await db.query(query, queryParams);
    const totalCountResult = await db.query(countQuery, countQueryParams);

    const totalRecords = parseInt(totalCountResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    res.status(200).json({
      success: true,
      data: {
        attendanceRecords: attendanceResult.rows,
        pagination: {
          totalRecords,
          currentPage: parseInt(page),
          perPage: parseInt(limit),
          totalPages,
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching student attendance:', error);
    const dbError = createDatabaseError('student attendance retrieval', error);
    next(dbError);
  }
};

/**
 * Get student attendance statistics
 */
exports.getStudentAttendanceStats = async (req, res, next) => {
  try {
    const studentId = req.user.student_id;
    
    if (!studentId) {
      const authError = createAuthenticationError('Student profile not found');
      return next(authError);
    }

    // Get total attendance records
    const totalAttendanceResult = await db.query(
      'SELECT COUNT(*) FROM attendance WHERE student_id = $1',
      [studentId]
    );
    const totalAttendance = parseInt(totalAttendanceResult.rows[0].count);

    // Get present days
    const presentDaysResult = await db.query(
      'SELECT COUNT(*) FROM attendance WHERE student_id = $1 AND is_present = TRUE',
      [studentId]
    );
    const presentDays = parseInt(presentDaysResult.rows[0].count);

    // Get absent days
    const absentDaysResult = await db.query(
      'SELECT COUNT(*) FROM attendance WHERE student_id = $1 AND is_present = FALSE',
      [studentId]
    );
    const absentDays = parseInt(absentDaysResult.rows[0].count);

    // Calculate attendance percentage
    const attendancePercentage = totalAttendance > 0 ? 
      Math.round((presentDays / totalAttendance) * 100) : 0;

    // Get current month attendance
    const currentMonthResult = await db.query(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN is_present = TRUE THEN 1 END) as present
      FROM attendance 
      WHERE student_id = $1 
      AND date >= DATE_TRUNC('month', CURRENT_DATE)
      AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `, [studentId]);

    const currentMonth = currentMonthResult.rows[0];
    const currentMonthAttendance = parseInt(currentMonth.total);
    const currentMonthPresent = parseInt(currentMonth.present);
    const currentMonthPercentage = currentMonthAttendance > 0 ? 
      Math.round((currentMonthPresent / currentMonthAttendance) * 100) : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAttendance,
        presentDays,
        absentDays,
        attendancePercentage,
        currentMonth: {
          totalDays: currentMonthAttendance,
          presentDays: currentMonthPresent,
          percentage: currentMonthPercentage
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching student attendance stats:', error);
    const dbError = createDatabaseError('student attendance statistics', error);
    next(dbError);
  }
};

/**
 * Get student login activity
 */
exports.getStudentLoginActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const loginLogs = await db.query(`
      SELECT 
        login_time,
        ip_address,
        user_agent,
        status,
        TO_CHAR(login_time, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
      FROM login_logs 
      WHERE user_id = $1 
      ORDER BY login_time DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const totalCountResult = await db.query(
      'SELECT COUNT(*) FROM login_logs WHERE user_id = $1',
      [userId]
    );
    const totalRecords = parseInt(totalCountResult.rows[0].count);
    const totalPages = Math.ceil(totalRecords / limit);

    res.status(200).json({
      success: true,
      data: {
        loginActivity: loginLogs.rows,
        pagination: {
          totalRecords,
          currentPage: parseInt(page),
          perPage: parseInt(limit),
          totalPages,
        }
      }
    });

  } catch (error) {
    logger.error('Error getting student login activity:', error);
    const dbError = createDatabaseError('student login activity retrieval', error);
    next(dbError);
  }
};