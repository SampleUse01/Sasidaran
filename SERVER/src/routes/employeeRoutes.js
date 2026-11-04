const express = require('express');
const {
  getEmployees,
  createEmployee,
  getEmployeeById,
  updateEmployee,
  deactivateEmployee,
} = require('../controllers/employeeController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { Roles } = require('../utils/roles');

const router = express.Router();

router.get('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), getEmployees);
router.post('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), createEmployee);
router.get('/:id', protect, getEmployeeById);
router.put('/:id', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), updateEmployee);
router.delete('/:id', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), deactivateEmployee);

module.exports = router;
