const express = require('express');
const {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deactivateLeaveType,
} = require('../controllers/leaveTypeController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { Roles } = require('../utils/roles');

const router = express.Router();
const adminOnly = [protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN)];

router.get('/', ...adminOnly, getLeaveTypes);
router.post('/', ...adminOnly, createLeaveType);
router.put('/:id', ...adminOnly, updateLeaveType);
router.delete('/:id', ...adminOnly, deactivateLeaveType);

module.exports = router;
