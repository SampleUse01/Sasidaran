const express = require('express');
const { getLeaves, createLeave, updateLeaveStatus } = require('../controllers/leaveController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { Roles } = require('../utils/roles');

const router = express.Router();

router.get('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), getLeaves);
router.post('/', protect, createLeave);
router.put('/:id/status', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), updateLeaveStatus);

module.exports = router;
