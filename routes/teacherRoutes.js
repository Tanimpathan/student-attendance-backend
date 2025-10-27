const express = require('express');
const { getDashboardStats, uploadStudents, downloadStudents, getStudents, addStudent, editStudent, deactivateStudent, getAttendanceRecords, getTeacherLoginActivity } = require('../controllers/teacherController');
const { authenticateToken, authorizeRoles, authorize } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const multer = require('multer');
const path = require('path');
const { validateAddStudent, validateEditStudent } = require('../middleware/validationMiddleware');
const { constatnts } = require('../utils/constants');

const router = express.Router();

// Set up multer for file uploads
const upload = multer({
  dest: path.join(__dirname, '../uploads/'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
});

// Apply auth to all subsequent routes
router.use(authenticateToken);
router.use(authorize(constatnts.MANAGE_USERS));

router.get('/dashboard', asyncHandler(getDashboardStats));
router.post('/students/upload', upload.single('csvFile'), asyncHandler(uploadStudents));
router.get('/students/download', asyncHandler(downloadStudents));
router.get('/students', validateAddStudent, asyncHandler(addStudent));
router.put('/students/:id', validateEditStudent, asyncHandler(editStudent));
router.put('/students/:id/deactivate', asyncHandler(deactivateStudent));
router.get('/attendance', asyncHandler(getAttendanceRecords));
router.get('/login-activity', asyncHandler(getTeacherLoginActivity));


module.exports = router;
