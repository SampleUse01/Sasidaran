const Leave = require('../models/Leave');
const LeaveType = require('../models/LeaveType');

const getLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find().populate('employeeId').populate('approvedBy', 'name email');
    return res.status(200).json({ success: true, count: leaves.length, data: leaves });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createLeave = async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, reason } = req.body;

    if (!employeeId || !leaveType || !startDate || !endDate || !reason) {
      return res.status(400).json({
        success: false,
        message: 'Employee, leave type, dates and reason are required',
      });
    }

    if (typeof leaveType !== 'string' || !(await LeaveType.exists({ name: leaveType.trim(), isActive: true }))) {
      return res.status(400).json({
        success: false,
        message: 'Select an active leave type',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ success: false, message: 'Enter a valid leave date range' });
    }
    const days = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await Leave.create({
      employeeId,
      leaveType,
      startDate: start,
      endDate: end,
      days,
      reason,
    });

    return res.status(201).json({ success: true, data: leave });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateLeaveStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave request not found' });
    }

    leave.status = status || leave.status;
    leave.approvedBy = req.user._id;
    await leave.save();

    return res.status(200).json({ success: true, data: leave });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getLeaves,
  createLeave,
  updateLeaveStatus,
};
