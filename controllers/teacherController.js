const db = require('../db/db');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const { parseCsv } = require('../utils/csvParser');
const { stringify } = require('csv-stringify');
const fs = require('fs');

exports.getDashboardStats = async (req, res) => {
  try {
    // Total Students
    const totalStudentsResult = await db.query(
      'SELECT COUNT(*) FROM users WHERE role = $1 AND is_active = TRUE',
      ['student']
    );
    const totalStudents = parseInt(totalStudentsResult.rows[0].count);

    // Present Today
    const presentTodayResult = await db.query(
      'SELECT COUNT(DISTINCT s.id) FROM students s JOIN attendance a ON s.id = a.student_id WHERE a.date = CURRENT_DATE AND a.is_present = TRUE',
    );
    const presentToday = parseInt(presentTodayResult.rows[0].count);

    // Absent Today
    const absentTodayResult = await db.query(
      `SELECT COUNT(DISTINCT s.id)
       FROM students s
       WHERE s.user_id IN (SELECT id FROM users WHERE role = 'student' AND is_active = TRUE)
       AND s.id NOT IN (
           SELECT student_id FROM attendance WHERE date = CURRENT_DATE AND is_present = TRUE
       )`
    );
    const absentToday = parseInt(absentTodayResult.rows[0].count);

    res.status(200).json({
      totalStudents,
      presentToday,
      absentToday,
    });
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.uploadStudents = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No CSV file uploaded.' });
    }

    const studentsData = await parseCsv(req.file.path);
    const newStudents = [];
    const duplicateUsers = [];

    for (const student of studentsData) {
      const { username, email, password, mobile, first_name, last_name, date_of_birth, address } = student;

      // validation
      if (!username || !email || !password || !mobile || !first_name || !last_name) {
        duplicateUsers.push({ student, reason: 'Missing required fields' });
        continue;
      }

      // Check for existing user (username, email, or mobile)
      const existingUser = await db.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2 OR mobile = $3',
        [username, email, mobile]
      );

      if (existingUser.rows.length > 0) {
        duplicateUsers.push({ student, reason: 'Duplicate username, email, or mobile' });
        continue;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = await db.query(
        'INSERT INTO users (username, email, password, mobile, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [username, email, hashedPassword, mobile, 'student']
      );

      const newStudent = await db.query(
        'INSERT INTO students (user_id, first_name, last_name, date_of_birth, address) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [newUser.rows[0].id, first_name, last_name, date_of_birth || null, address || null]
      );

      newStudents.push({ userId: newUser.rows[0].id, studentId: newStudent.rows[0].id, username, email });
    }
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      message: 'Students uploaded successfully',
      newStudentsCount: newStudents.length,
      duplicateUsersCount: duplicateUsers.length,
      newStudents,
      duplicateUsers,
    });
  } catch (error) {
    logger.error('Error uploading students:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.downloadStudents = async (req, res) => {
  try {
    const { filterBy, filterValue } = req.query;
    let query = `SELECT
        u.username,
        u.email,
        u.mobile,
        s.first_name,
        s.last_name,
        s.date_of_birth,
        s.address
      FROM users u
      JOIN students s ON u.id = s.user_id
      WHERE u.role = 'student'`;
    const queryParams = [];

    if (filterBy && filterValue) {
      if (filterBy === 'username') {
        query += ` AND u.username ILIKE $1`;
        queryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'email') {
        query += ` AND u.email ILIKE $1`;
        queryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'mobile') {
        query += ` AND u.mobile ILIKE $1`;
        queryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'first_name') {
        query += ` AND s.first_name ILIKE $1`;
        queryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'last_name') {
        query += ` AND s.last_name ILIKE $1`;
        queryParams.push(`%${filterValue}%`);
      }
    }

    const studentsResult = await db.query(query, queryParams);
    const students = studentsResult.rows;

    if (students.length === 0) {
      return res.status(404).json({ message: 'No students found matching the criteria.' });
    }

    stringify(students, { header: true }, (err, output) => {
      if (err) {
        logger.error('Error stringifying CSV:', err);
        return res.status(500).json({ message: 'Error generating CSV' });
      }
      res.header('Content-Type', 'text/csv');
      res.attachment('students.csv');
      res.send(output);
    });

  } catch (error) {
    logger.error('Error downloading students:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, filterBy, filterValue, sortBy, sortOrder = 'asc' } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT
        u.id as user_id,
        u.username,
        u.email,
        u.mobile,
        u.is_active,
        s.id as student_id,
        s.first_name,
        s.last_name,
        s.date_of_birth,
        s.address
      FROM users u
      JOIN students s ON u.id = s.user_id
      WHERE u.role = 'student'`;
    const countQuery = `SELECT COUNT(*) FROM users WHERE role = 'student'`;
    const queryParams = [];
    const countQueryParams = [];

    if (filterBy && filterValue) {
      if (filterBy === 'username') {
        query += ` AND u.username ILIKE $1`;
        countQuery += ` AND username ILIKE $1`;
        queryParams.push(`%${filterValue}%`);
        countQueryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'email') {
        query += ` AND u.email ILIKE $1`;
        countQuery += ` AND email ILIKE $1`;
        queryParams.push(`%${filterValue}%`);
        countQueryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'mobile') {
        query += ` AND u.mobile ILIKE $1`;
        countQuery += ` AND mobile ILIKE $1`;
        queryParams.push(`%${filterValue}%`);
        countQueryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'first_name') {
        query += ` AND s.first_name ILIKE $1`;
        countQuery += ` AND id IN (SELECT user_id FROM students WHERE first_name ILIKE $1)`;
        queryParams.push(`%${filterValue}%`);
        countQueryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'last_name') {
        query += ` AND s.last_name ILIKE $1`;
        countQuery += ` AND id IN (SELECT user_id FROM students WHERE last_name ILIKE $1)`;
        queryParams.push(`%${filterValue}%`);
        countQueryParams.push(`%${filterValue}%`);
      } else if (filterBy === 'is_active') {
        query += ` AND u.is_active = $1`;
        countQuery += ` AND is_active = $1`;
        queryParams.push(filterValue.toLowerCase() === 'true');
        countQueryParams.push(filterValue.toLowerCase() === 'true');
      }
    }

    if (sortBy) {
      let sortColumn = '';
      if (sortBy === 'username') sortColumn = 'u.username';
      else if (sortBy === 'email') sortColumn = 'u.email';
      else if (sortBy === 'mobile') sortColumn = 'u.mobile';
      else if (sortBy === 'first_name') sortColumn = 's.first_name';
      else if (sortBy === 'last_name') sortColumn = 's.last_name';
      else if (sortBy === 'is_active') sortColumn = 'u.is_active';

      if (sortColumn) {
        query += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;
      }
    }

    query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit);
    queryParams.push(offset);

    const studentsResult = await db.query(query, queryParams);
    const totalCountResult = await db.query(countQuery, countQueryParams);

    const totalStudents = parseInt(totalCountResult.rows[0].count);
    const totalPages = Math.ceil(totalStudents / limit);

    res.status(200).json({
      students: studentsResult.rows,
      pagination: {
        totalStudents,
        currentPage: parseInt(page),
        perPage: parseInt(limit),
        totalPages,
      },
    });

  } catch (error) {
    logger.error('Error fetching students:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.addStudent = async (req, res) => {
  const { username, email, password, mobile, first_name, last_name, date_of_birth, address } = req.body;

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
      'INSERT INTO users (username, email, password, mobile, role) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [username, email, hashedPassword, mobile, 'student']
    );

    // Save student details
    const newStudent = await db.query(
      'INSERT INTO students (user_id, first_name, last_name, date_of_birth, address) VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, last_name',
      [newUser.rows[0].id, first_name, last_name, date_of_birth || null, address || null]
    );

    res.status(201).json({ 
      message: 'Student added successfully',
      student: { 
        user_id: newUser.rows[0].id,
        student_id: newStudent.rows[0].id,
        username, email, mobile, first_name: newStudent.rows[0].first_name, last_name: newStudent.rows[0].last_name 
      }
    });
  } catch (error) {
    logger.error('Error adding student:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.editStudent = async (req, res) => {
  const { id } = req.params;
  const { username, email, mobile, first_name, last_name, date_of_birth, address, is_active } = req.body;

  try {
    const studentResult = await db.query(
      'SELECT user_id FROM students WHERE id = $1',
      [id]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const userId = studentResult.rows[0].user_id;

    // Check for duplicate username, email, or mobile if they are being updated
    const existingUserQuery = 'SELECT id FROM users WHERE (username = $1 OR email = $2 OR mobile = $3) AND id != $4';
    const existingUserParams = [username, email, mobile, userId];
    const existingUserResult = await db.query(existingUserQuery, existingUserParams);

    if (existingUserResult.rows.length > 0) {
      return res.status(400).json({ message: 'Another user with this username, email, or mobile already exists.' });
    }

    // Update user details
    let userUpdateQuery = 'UPDATE users SET updated_at = CURRENT_TIMESTAMP';
    const userUpdateParams = [];
    let userParamIndex = 1;

    if (username !== undefined) { userUpdateQuery += `, username = $${userParamIndex++}`; userUpdateParams.push(username); }
    if (email !== undefined) { userUpdateQuery += `, email = $${userParamIndex++}`; userUpdateParams.push(email); }
    if (mobile !== undefined) { userUpdateQuery += `, mobile = $${userParamIndex++}`; userUpdateParams.push(mobile); }
    if (is_active !== undefined) { userUpdateQuery += `, is_active = $${userParamIndex++}`; userUpdateParams.push(is_active); }

    userUpdateQuery += ` WHERE id = $${userParamIndex++} RETURNING username, email, mobile, is_active`;
    userUpdateParams.push(userId);

    const updatedUser = await db.query(userUpdateQuery, userUpdateParams);

    // Update student details
    let studentUpdateQuery = 'UPDATE students SET updated_at = CURRENT_TIMESTAMP';
    const studentUpdateParams = [];
    let studentParamIndex = 1;

    if (first_name !== undefined) { studentUpdateQuery += `, first_name = $${studentParamIndex++}`; studentUpdateParams.push(first_name); }
    if (last_name !== undefined) { studentUpdateQuery += `, last_name = $${studentParamIndex++}`; studentUpdateParams.push(last_name); }
    if (date_of_birth !== undefined) { studentUpdateQuery += `, date_of_birth = $${studentParamIndex++}`; studentUpdateParams.push(date_of_birth); }
    if (address !== undefined) { studentUpdateQuery += `, address = $${studentParamIndex++}`; studentUpdateParams.push(address); }

    studentUpdateQuery += ` WHERE id = $${studentParamIndex++} RETURNING first_name, last_name, date_of_birth, address`;
    studentUpdateParams.push(id);

    const updatedStudent = await db.query(studentUpdateQuery, studentUpdateParams);

    res.status(200).json({
      message: 'Student updated successfully',
      user: updatedUser.rows[0],
      student: updatedStudent.rows[0],
    });

  } catch (error) {
    logger.error('Error editing student:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.deactivateStudent = async (req, res) => {
  const { id } = req.params;

  try {
    const studentResult = await db.query(
      'SELECT user_id FROM students WHERE id = $1',
      [id]
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    const userId = studentResult.rows[0].user_id;

    // Deactivate the user
    const updatedUser = await db.query(
      'UPDATE users SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, username, email, is_active',
      [userId]
    );

    res.status(200).json({
      message: 'Student deactivated successfully',
      user: updatedUser.rows[0],
    });
  } catch (error) {
    logger.error('Error deactivating student:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAttendanceRecords = async (req, res) => {
  try {
    const { page = 1, limit = 10, studentId, startDate, endDate, isPresent } = req.query;
    const offset = (page - 1) * limit;

    let query = `SELECT
        a.id AS attendance_id,
        a.date,
        a.is_present,
        a.recorded_at,
        s.id AS student_id,
        s.first_name,
        s.last_name,
        u.username AS student_username
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE 1=1`;
    let countQuery = `SELECT COUNT(*) FROM attendance a JOIN students s ON a.student_id = s.id JOIN users u ON s.user_id = u.id WHERE 1=1`;
    const queryParams = [];
    const countQueryParams = [];
    let paramIndex = 1;

    if (studentId) {
      query += ` AND s.id = $${paramIndex}`; 
      countQuery += ` AND s.id = $${paramIndex}`; 
      queryParams.push(studentId);
      countQueryParams.push(studentId);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND a.date >= $${paramIndex}`;
      countQuery += ` AND a.date >= $${paramIndex}`;
      queryParams.push(startDate);
      countQueryParams.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND a.date <= $${paramIndex}`;
      countQuery += ` AND a.date <= $${paramIndex}`;
      queryParams.push(endDate);
      countQueryParams.push(endDate);
      paramIndex++;
    }

    if (isPresent !== undefined) {
      query += ` AND a.is_present = $${paramIndex}`;
      countQuery += ` AND a.is_present = $${paramIndex}`;
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
      attendanceRecords: attendanceResult.rows,
      pagination: {
        totalRecords,
        currentPage: parseInt(page),
        perPage: parseInt(limit),
        totalPages,
      },
    });
  } catch (error) {
    logger.error('Error fetching attendance records:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getTeacherLoginActivity = async (req, res) => {
  try {
      const teacherId = req.user.id;

      const loginLogs = await db.query(`
          SELECT 
              login_time,
              ip_address,
              user_agent,
              status,
              TO_CHAR(login_time, 'YYYY-MM-DD HH24:MI:SS') as formatted_time
          FROM login_logs 
          WHERE user_id = $1 
          AND login_time >= CURRENT_DATE - INTERVAL '3 days'
          ORDER BY login_time DESC
      `, [teacherId]);

      res.status(200).json({
          login_activity: loginLogs.rows,
      });

  } catch (error) {
      logger.error('Error getting teacher login activity:', error);
      res.status(500).json({ message: 'Server error' });
  }
}