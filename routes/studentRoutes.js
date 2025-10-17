const express = require('express');
const { getStudentProfile, markAttendance, getTodayAttendance, editProfile, getLoginActivity } = require('../controllers/studentController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/profile/:id', authenticateToken, authorizeRoles(['student']), getStudentProfile);
router.post('/mark-attendance/:id', authenticateToken, authorizeRoles(['student']), markAttendance);
router.get('/today-attendance/:id', authenticateToken, authorizeRoles(['student']), getTodayAttendance);
router.put('/edit-profile/:id', authenticateToken, authorizeRoles(['student']), editProfile);
router.get('/login-activity/:id', authenticateToken, authorizeRoles(['student']), getLoginActivity);

module.exports = router;