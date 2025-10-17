const express = require('express');
const { getDashboardStats, uploadStudents, downloadStudents, getStudents, addStudent, editStudent, deactivateStudent, getAttendanceRecords, getTeacherLoginActivity } = require('../controllers/teacherController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const { validateAddStudent, validateEditStudent } = require('../middleware/validationMiddleware');

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

router.get('/dashboard', authenticateToken, authorizeRoles(['teacher']), getDashboardStats);
router.post('/students/upload', authenticateToken, authorizeRoles(['teacher']), upload.single('csvFile'), uploadStudents);
router.get('/students/download', authenticateToken, authorizeRoles(['teacher']), downloadStudents);
router.get('/students', authenticateToken, authorizeRoles(['teacher']), getStudents);
router.post('/students', authenticateToken, authorizeRoles(['teacher']), validateAddStudent, addStudent);
router.put('/students/:id', authenticateToken, authorizeRoles(['teacher']), validateEditStudent, editStudent);
router.put('/students/:id/deactivate', authenticateToken, authorizeRoles(['teacher']), deactivateStudent);
router.get('/attendance', authenticateToken, authorizeRoles(['teacher']), getAttendanceRecords);
router.get('/login-activity', authenticateToken, authorizeRoles(['teacher']), getTeacherLoginActivity);

module.exports = router;
