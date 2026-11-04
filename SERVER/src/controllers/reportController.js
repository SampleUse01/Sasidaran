const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const Leave = require('../models/Leave');

const getDashboardSummary = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments();
    const totalPresent = await Attendance.countDocuments({ attendanceStatus: 'present' });
    const totalAbsence = await Attendance.countDocuments({ attendanceStatus: 'absent' });

    return res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        totalPresent,
        totalAbsence,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getMonthlyReport = async (req, res) => {
  try {
    const { employeeId, month } = req.params;
    const targetMonth = month ? new Date(month) : new Date();
    const start = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1);
    const end = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0, 23, 59, 59, 999);

    const records = await Attendance.find({
      employeeId,
      date: { $gte: start, $lte: end },
    }).populate('shiftId', 'name');

    const leaves = await Leave.find({
      employeeId,
      status: 'approved',
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    const summary = {
      month: start.toISOString(),
      totalDays: records.length,
      presentDays: records.filter((record) => record.attendanceStatus === 'present').length,
      lateDays: records.filter((record) => record.attendanceStatus === 'late').length,
      leaveDays: leaves.reduce((total, item) => total + item.days, 0),
      totalOvertimeMinutes: records.reduce((total, item) => total + (item.overtimeMinutes || 0), 0),
      totalEarlyExitMinutes: records.reduce((total, item) => total + (item.earlyExitMinutes || 0), 0),
    };

    return res.status(200).json({
      success: true,
      data: {
        summary,
        records,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDashboardSummary,
  getMonthlyReport,
};
