const express = require('express');
const {
  getOwnAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  markCheckIn,
  markCheckOut,
} = require('../controllers/attendanceController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { Roles } = require('../utils/roles');

const router = express.Router();

router.get('/mine', protect, getOwnAttendance);
router.get('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), getAllAttendance);
router.post('/checkin', protect, markCheckIn);
router.post('/checkout', protect, markCheckOut);
router.get('/:employeeId', protect, getAttendanceByEmployee);

module.exports = router;
