const express = require('express');
const { getShifts, createShift, updateShift, deleteShift } = require('../controllers/shiftController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { Roles } = require('../utils/roles');

const router = express.Router();

router.get('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), getShifts);
router.post('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), createShift);
router.put('/:id', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), updateShift);
router.delete('/:id', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), deleteShift);

module.exports = router;
