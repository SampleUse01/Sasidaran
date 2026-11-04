const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');

const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);
const validTime = (time) => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);

const validateShiftFields = (fields, partial = false) => {
  const { name, startTime, endTime, breakMinutes, gracePeriodMinutes, workingHours } = fields;
  if (!partial && (!name || !startTime || !endTime)) {
    return 'Name, start time and end time are required';
  }
  if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.trim().length > 80)) return 'Shift name must be between 1 and 80 characters';
  if (startTime !== undefined && !validTime(startTime)) return 'Start time must use HH:mm format';
  if (endTime !== undefined && !validTime(endTime)) return 'End time must use HH:mm format';
  if (startTime !== undefined && endTime !== undefined && startTime === endTime) return 'Start and end times must be different';
  if (breakMinutes !== undefined && (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 720)) {
    return 'Break must be a whole number between 0 and 720 minutes';
  }
  if (gracePeriodMinutes !== undefined && (!Number.isInteger(gracePeriodMinutes) || gracePeriodMinutes < 0 || gracePeriodMinutes > 240)) {
    return 'Grace period must be a whole number between 0 and 240 minutes';
  }
  if (workingHours !== undefined && (typeof workingHours !== 'number' || workingHours <= 0 || workingHours > 24)) {
    return 'Working hours must be greater than 0 and no more than 24';
  }
  if (fields.isDefault !== undefined && typeof fields.isDefault !== 'boolean') return 'isDefault must be a boolean';
  if (fields.timezone !== undefined) {
    if (typeof fields.timezone !== 'string' || fields.timezone.length > 80) return 'Enter a valid IANA timezone';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: fields.timezone });
    } catch {
      return 'Enter a valid IANA timezone';
    }
  }
  return null;
};

const getShifts = async (req, res) => {
  try {
    const shifts = await Shift.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: shifts.length, data: shifts });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createShift = async (req, res) => {
  try {
    const { name, startTime, endTime, breakMinutes, gracePeriodMinutes, workingHours } = req.body;

    const validationError = validateShiftFields(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const shift = await Shift.create({
      name,
      startTime,
      endTime,
      timezone: req.body.timezone || 'UTC',
      breakMinutes: breakMinutes ?? 0,
      gracePeriodMinutes: gracePeriodMinutes ?? 10,
      workingHours: workingHours ?? 8,
    });

    return res.status(201).json({ success: true, data: shift });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateShift = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid shift ID' });
    }

    const validationError = validateShiftFields(req.body, true);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    ['name', 'startTime', 'endTime', 'timezone', 'breakMinutes', 'gracePeriodMinutes', 'workingHours', 'isDefault']
      .forEach((field) => {
        if (req.body[field] !== undefined) shift[field] = req.body[field];
      });

    await shift.save();
    return res.status(200).json({ success: true, data: shift });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteShift = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid shift ID' });
    }

    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ success: false, message: 'Shift not found' });

    if (await Employee.exists({ shiftId: shift._id }) || await Attendance.exists({ shiftId: shift._id })) {
      return res.status(409).json({
        success: false,
        message: 'This shift is assigned to employees or referenced by attendance history; it cannot be deleted',
      });
    }

    await shift.deleteOne();
    return res.status(200).json({ success: true, message: 'Shift deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getShifts,
  createShift,
  updateShift,
  deleteShift,
};
