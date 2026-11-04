const express = require('express');
const {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
} = require('../controllers/holidayController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { Roles } = require('../utils/roles');

const router = express.Router();

router.get('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), getHolidays);
router.post('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), createHoliday);
router.put('/:id', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), updateHoliday);
router.delete('/:id', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), deleteHoliday);

module.exports = router;
