const express = require('express');
const { getDashboardSummary, getMonthlyReport } = require('../controllers/reportController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { Roles } = require('../utils/roles');

const router = express.Router();

router.get('/dashboard', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), getDashboardSummary);
router.get('/monthly/:employeeId/:month', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN, Roles.USER), getMonthlyReport);

module.exports = router;
