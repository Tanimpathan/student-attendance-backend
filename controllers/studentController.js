const db = require('../db/db');
const logger = require('../utils/logger');

exports.getStudentProfile = async (req, res) => {
    try {
        const { id } = req.params;

        // Get student profile
        const studentProfile = await db.query(`
            SELECT 
                s.*,
                u.username,
                u.email, 
                u.mobile
            FROM students s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = $1
        `, [id]);

        // Get attendance counts
        const attendanceStats = await db.query(`
            SELECT 
                COUNT(*) FILTER (WHERE is_present = true) as present_days,
                COUNT(*) FILTER (WHERE is_present = false) as absent_days
            FROM attendance 
            WHERE student_id = $1
        `, [id]);


        const student = {
            ...studentProfile.rows[0],
            ...attendanceStats.rows[0]
        };

        res.status(200).json(student);

    } catch (error) {
        logger.error('Error getting student profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

exports.markAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_present } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toISOString();

        const attendance = await db.query(`
            INSERT INTO attendance (student_id, date, is_present, recorded_at) 
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (student_id, date) 
            DO UPDATE SET 
                is_present = $3,
                recorded_at = $4
            RETURNING id, student_id, date, is_present, recorded_at
        `, [id, today, is_present, now]);

        res.status(200).json({
            message: 'Attendance marked successfully',
            attendance: attendance.rows[0]
        });
    } catch (error) {
        logger.error('Error marking attendance:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

exports.getTodayAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const today = new Date().toISOString().split('T')[0];

        const attendance = await db.query(`
            SELECT id, is_present, recorded_at 
            FROM attendance 
            WHERE student_id = $1 AND date = $2
        `, [id, today]);

        res.status(200).json({
            today_attendance: attendance.rows[0] || null
        });
    } catch (error) {
        logger.error('Error getting today attendance:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

exports.editProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { first_name, last_name, date_of_birth, address } = req.body;

        // Validate required fields
        if (!first_name || !last_name) {
            return res.status(400).json({ 
                message: 'First name and last name are required' 
            });
        }

        const existingStudent = await db.query(
            'SELECT id FROM students WHERE id = $1', 
            [id]
        );

        if (existingStudent.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const student = await db.query(`
            UPDATE students 
            SET 
                first_name = $1, 
                last_name = $2, 
                date_of_birth = $3, 
                address = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5 
            RETURNING id, first_name, last_name, date_of_birth, address, updated_at
        `, [first_name, last_name, date_of_birth, address, id]);

        res.status(200).json({
            message: 'Profile updated successfully',
            student: student.rows[0]
        });
        
    } catch (error) {
        logger.error('Error editing profile:', error);
        res.status(500).json({ message: 'Server error' });
    }
}

exports.getLoginActivity = async (req, res) => {
    try {
        const { id } = req.params;

        const student = await db.query(
            'SELECT user_id FROM students WHERE id = $1', 
            [id]
        );

        if (student.rows.length === 0) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const userId = student.rows[0].user_id;

        const loginLogs = await db.query(`
            SELECT 
                login_time,
                ip_address,
                user_agent,
                status
            FROM login_logs 
            WHERE user_id = $1 
            AND login_time >= CURRENT_DATE - INTERVAL '3 days'
            ORDER BY login_time DESC
        `, [userId]);

        res.status(200).json({
            login_activity: loginLogs.rows,
            total_count: loginLogs.rows.length,
            period: 'last_3_days',
            id
        });

    } catch (error) {
        logger.error('Error getting login activity:', error);
        res.status(500).json({ message: 'Server error' });
    }
}