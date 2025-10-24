const express = require('express');
const { getStudentProfile, markAttendance, getTodayAttendance, editProfile, getLoginActivity } = require('../controllers/studentController');
const { authenticateToken, authorizeRoles, authorize } = require('../middleware/authMiddleware');
const { validateEditStudent, validateMarkAttendance } = require('../middleware/validationMiddleware');

const router = express.Router();

router.get('/profile/:id', authenticateToken, authorize('manage_students'), getStudentProfile);
// router.get('/profile/:id', authenticateToken, authorizeRoles(['student']), getStudentProfile);
router.post('/mark-attendance/:id', authenticateToken, authorizeRoles(['student']), validateMarkAttendance, markAttendance);
router.get('/today-attendance/:id', authenticateToken, authorizeRoles(['student']), getTodayAttendance);
router.put('/edit-profile/:id', authenticateToken, authorizeRoles(['student']), validateEditStudent, editProfile);
router.get('/login-activity/:id', authenticateToken, authorizeRoles(['student']), getLoginActivity);

module.exports = router;