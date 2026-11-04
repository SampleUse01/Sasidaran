const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Shift = require('../models/Shift');
const { Roles } = require('../utils/roles');
const { calculateAttendance, getShiftSchedule } = require('../utils/attendanceCalculations');

const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

const getEmployeeForUser = async (userId) => Employee.findOne({ userId }).populate('shiftId');

const getOwnAttendance = async (req, res) => {
  try {
    const employee = await getEmployeeForUser(req.user._id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Your employee profile has not been set up' });
    }

    const [records, totals] = await Promise.all([
      Attendance.find({ employeeId: employee._id })
        .populate('shiftId', 'name startTime endTime timezone')
        .sort({ date: -1 })
        .limit(90),
      Attendance.aggregate([
        { $match: { employeeId: employee._id } },
        {
          $group: {
            _id: null,
            records: { $sum: 1 },
            workingMinutes: { $sum: '$workingMinutes' },
            overtimeMinutes: { $sum: '$overtimeMinutes' },
            earlyExitMinutes: { $sum: '$earlyExitMinutes' },
          },
        },
      ]),
    ]);

    const openRecord = records.find((record) => record.checkIn && !record.checkOut) || null;
    return res.status(200).json({
      success: true,
      employee: {
        id: employee._id,
        employeeCode: employee.employeeCode,
        status: employee.status,
        shift: employee.shiftId,
      },
      activeAttendance: openRecord,
      summary: totals[0] || { records: 0, workingMinutes: 0, overtimeMinutes: 0, earlyExitMinutes: 0 },
      data: records,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAllAttendance = async (req, res) => {
  try {
    const filter = {};
    if (req.query.employeeId) {
      if (!isValidObjectId(req.query.employeeId)) {
        return res.status(400).json({ success: false, message: 'Invalid employee ID' });
      }
      filter.employeeId = req.query.employeeId;
    }
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) {
        const from = new Date(req.query.from);
        if (Number.isNaN(from.getTime())) return res.status(400).json({ success: false, message: 'Invalid from date' });
        filter.date.$gte = from;
      }
      if (req.query.to) {
        const to = new Date(req.query.to);
        if (Number.isNaN(to.getTime())) return res.status(400).json({ success: false, message: 'Invalid to date' });
        to.setUTCHours(23, 59, 59, 999);
        filter.date = { ...filter.date, $lte: to };
      }
    }

    const records = await Attendance.find(filter)
      .populate({ path: 'employeeId', populate: { path: 'userId', select: 'name email' } })
      .populate('shiftId', 'name startTime endTime timezone')
      .sort({ date: -1 })
      .limit(500);
    return res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getAttendanceByEmployee = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.employeeId)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) return res.status(404).json({ success: false, message: 'Employee not found' });
    if (
      req.user.role === Roles.USER &&
      employee.userId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({ success: false, message: 'You may only access your own attendance' });
    }

    const records = await Attendance.find({ employeeId: employee._id })
      .populate('shiftId', 'name startTime endTime timezone')
      .sort({ date: -1 })
      .limit(90);
    return res.status(200).json({ success: true, count: records.length, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const markCheckIn = async (req, res) => {
  try {
    if (req.user.role !== Roles.USER) {
      return res.status(403).json({ success: false, message: 'Check-in is available to employee accounts' });
    }

    const employee = await getEmployeeForUser(req.user._id);
    if (!employee) return res.status(404).json({ success: false, message: 'Your employee profile has not been set up' });
    if (employee.status !== 'active' || !req.user.isActive) {
      return res.status(403).json({ success: false, message: 'Your employee account is inactive' });
    }
    if (!employee.shiftId) {
      return res.status(409).json({ success: false, message: 'Ask an administrator to assign your shift before checking in' });
    }

    const activeRecord = await Attendance.exists({ employeeId: employee._id, checkIn: { $ne: null }, checkOut: null });
    if (activeRecord) {
      return res.status(409).json({ success: false, message: 'You are already checked in' });
    }

    const now = new Date();
    const shift = employee.shiftId;
    const schedule = getShiftSchedule(now, shift);
    const existing = await Attendance.findOne({ employeeId: employee._id, date: schedule.workDate });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Attendance is already recorded for this shift date' });
    }

    const calculated = calculateAttendance({
      checkIn: now,
      shift,
      scheduledStartAt: schedule.startAt,
      scheduledEndAt: schedule.endAt,
    });

    const attendance = await Attendance.create({
      employeeId: employee._id,
      date: schedule.workDate,
      shiftId: shift._id,
      checkIn: now,
      scheduledStart: shift.startTime,
      scheduledEnd: shift.endTime,
      scheduledStartAt: schedule.startAt,
      scheduledEndAt: schedule.endAt,
      ...calculated,
    });

    return res.status(201).json({ success: true, data: attendance });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Attendance is already recorded for this shift date' });
    }
    if (error instanceof RangeError || error.message.startsWith('Shift times')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const markCheckOut = async (req, res) => {
  try {
    if (req.user.role !== Roles.USER) {
      return res.status(403).json({ success: false, message: 'Check-out is available to employee accounts' });
    }

    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) return res.status(404).json({ success: false, message: 'Your employee profile has not been set up' });

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      checkIn: { $ne: null },
      checkOut: null,
    }).sort({ checkIn: -1 });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'No active check-in was found' });
    }

    const now = new Date();
    if (now <= attendance.checkIn) {
      return res.status(400).json({ success: false, message: 'Check-out must be later than check-in' });
    }

    const shift = await Shift.findById(attendance.shiftId);
    if (!shift) return res.status(409).json({ success: false, message: 'The assigned shift no longer exists' });

    attendance.checkOut = now;
    Object.assign(attendance, calculateAttendance({
      checkIn: attendance.checkIn,
      checkOut: now,
      shift,
      scheduledStartAt: attendance.scheduledStartAt,
      scheduledEndAt: attendance.scheduledEndAt,
    }));
    await attendance.save();

    return res.status(200).json({ success: true, data: attendance });
  } catch (error) {
    if (error instanceof RangeError || error.message.startsWith('Shift times')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getOwnAttendance,
  getAllAttendance,
  getAttendanceByEmployee,
  markCheckIn,
  markCheckOut,
};
