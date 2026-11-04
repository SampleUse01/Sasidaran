const express = require('express');
const {
  getCorrectionRequests,
  getOwnCorrectionRequests,
  createCorrectionRequest,
  updateCorrectionRequestStatus,
} = require('../controllers/correctionRequestController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { Roles } = require('../utils/roles');

const router = express.Router();

router.get('/', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), getCorrectionRequests);
router.get('/mine', protect, getOwnCorrectionRequests);
router.post('/', protect, createCorrectionRequest);
router.put('/:id/status', protect, authorizeRoles(Roles.ADMIN, Roles.SUPERADMIN), updateCorrectionRequestStatus);

module.exports = router;
