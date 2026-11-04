const Attendance = require('../models/Attendance');
const CorrectionRequest = require('../models/CorrectionRequest');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const { Roles } = require('../utils/roles');
const { calculateAttendance } = require('../utils/attendanceCalculations');

const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

const getCorrectionRequests = async (req, res) => {
  try {
    const requests = await CorrectionRequest.find()
      .populate({ path: 'employeeId', populate: { path: 'userId', select: 'name email' } })
      .populate({ path: 'attendanceId', populate: { path: 'shiftId', select: 'name startTime endTime timezone' } })
      .populate('reviewedBy', 'name email')
      .sort({ status: 1, createdAt: -1 })
      .limit(500);

    return res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getOwnCorrectionRequests = async (req, res) => {
  try {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Your employee profile has not been set up' });
    }

    const requests = await CorrectionRequest.find({ employeeId: employee._id })
      .populate('attendanceId')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    return res.status(200).json({ success: true, count: requests.length, data: requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createCorrectionRequest = async (req, res) => {
  try {
    if (req.user.role !== Roles.USER) {
      return res.status(403).json({ success: false, message: 'Correction requests are for employee accounts' });
    }

    const { attendanceId, requestedCheckIn, requestedCheckOut, reason } = req.body;
    if (!isValidObjectId(attendanceId)) {
      return res.status(400).json({ success: false, message: 'A valid attendance record is required' });
    }
    if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Provide a reason of up to 1000 characters' });
    }

    const parseRequestedTime = (value, label) => {
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string') throw new Error(`${label} must be a date/time string`);
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) throw new Error(`Enter a valid ${label}`);
      if (parsed > new Date()) throw new Error(`${label} cannot be in the future`);
      return parsed;
    };

    let checkIn;
    let checkOut;
    try {
      checkIn = parseRequestedTime(requestedCheckIn, 'check-in time');
      checkOut = parseRequestedTime(requestedCheckOut, 'check-out time');
    } catch (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    if (!checkIn && !checkOut) {
      return res.status(400).json({ success: false, message: 'Enter at least one corrected time' });
    }

    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Your employee profile has not been set up' });
    }

    const attendance = await Attendance.findOne({ _id: attendanceId, employeeId: employee._id });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found for your account' });
    }

    const effectiveCheckIn = checkIn || attendance.checkIn;
    const effectiveCheckOut = checkOut || attendance.checkOut;
    if (!effectiveCheckIn) {
      return res.status(400).json({ success: false, message: 'A check-in time is required for a correction' });
    }
    if (effectiveCheckOut && effectiveCheckOut <= effectiveCheckIn) {
      return res.status(400).json({ success: false, message: 'Check-out must be later than check-in' });
    }

    if (await CorrectionRequest.exists({ attendanceId: attendance._id, status: 'pending' })) {
      return res.status(409).json({ success: false, message: 'A correction request is already pending for this attendance' });
    }

    const request = await CorrectionRequest.create({
      employeeId: employee._id,
      attendanceId: attendance._id,
      requestedCheckIn: checkIn,
      requestedCheckOut: checkOut,
      reason: reason.trim(),
    });

    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateCorrectionRequestStatus = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid correction request ID' });
    }
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }

    const request = await CorrectionRequest.findOne({ _id: req.params.id, status: 'pending' });
    if (!request) {
      return res.status(404).json({ success: false, message: 'Pending correction request not found' });
    }

    if (status === 'approved') {
      const attendance = await Attendance.findOne({
        _id: request.attendanceId,
        employeeId: request.employeeId,
      });
      if (!attendance) {
        return res.status(409).json({ success: false, message: 'Attendance record no longer exists' });
      }

      const checkIn = request.requestedCheckIn || attendance.checkIn;
      const checkOut = request.requestedCheckOut || attendance.checkOut;
      if (!checkIn || (checkOut && checkOut <= checkIn)) {
        return res.status(400).json({ success: false, message: 'Correction would create an invalid check-in/check-out range' });
      }

      const shift = await Shift.findById(attendance.shiftId);
      if (!shift) return res.status(409).json({ success: false, message: 'Attendance shift no longer exists' });

      attendance.checkIn = checkIn;
      attendance.checkOut = checkOut;
      Object.assign(attendance, calculateAttendance({
        checkIn,
        checkOut,
        shift,
        scheduledStartAt: attendance.scheduledStartAt,
        scheduledEndAt: attendance.scheduledEndAt,
      }));
      await attendance.save();
    }

    request.status = status;
    request.reviewedBy = req.user._id;
    await request.save();

    return res.status(200).json({
      success: true,
      data: await CorrectionRequest.findById(request._id)
        .populate({ path: 'employeeId', populate: { path: 'userId', select: 'name email' } })
        .populate('attendanceId')
        .populate('reviewedBy', 'name email'),
    });
  } catch (error) {
    if (error instanceof RangeError || error.message.startsWith('Shift times')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getCorrectionRequests,
  getOwnCorrectionRequests,
  createCorrectionRequest,
  updateCorrectionRequestStatus,
};
