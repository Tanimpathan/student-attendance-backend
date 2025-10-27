const express = require('express');
const { 
  getStudentProfile, 
  updateStudentProfile, 
  getStudentAttendance, 
  getStudentAttendanceStats,
  getStudentLoginActivity 
} = require('../controllers/studentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { validateUpdateStudentProfile } = require('../middleware/validationMiddleware');
const { constatnts } = require('../utils/constants');

const router = express.Router();

// All student routes require authentication
router.use(authenticateToken);

// Student profile routes
router.get('/profile', asyncHandler(getStudentProfile));
router.put('/profile', validateUpdateStudentProfile, asyncHandler(updateStudentProfile));

// Student attendance routes
router.get('/attendance', asyncHandler(getStudentAttendance));
router.get('/attendance/stats', asyncHandler(getStudentAttendanceStats));

// Student activity routes
router.get('/login-activity', asyncHandler(getStudentLoginActivity));

module.exports = router;