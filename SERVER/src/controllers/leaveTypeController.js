const LeaveType = require('../models/LeaveType');
const Leave = require('../models/Leave');

const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

const getLeaveTypes = async (req, res) => {
  try {
    const leaveTypes = await LeaveType.find().sort({ name: 1 });
    return res.status(200).json({ success: true, count: leaveTypes.length, data: leaveTypes });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createLeaveType = async (req, res) => {
  try {
    const { name, daysAllowed, isPaid, description } = req.body;
    const allowedDays = Number(daysAllowed);

    if (typeof name !== 'string' || !name.trim() || daysAllowed === undefined || !Number.isFinite(allowedDays) || allowedDays < 0) {
      return res.status(400).json({
        success: false,
        message: 'Leave type name and a valid non-negative days allowance are required',
      });
    }
    if (isPaid !== undefined && typeof isPaid !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isPaid must be a boolean' });
    }
    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ success: false, message: 'Description must be text' });
    }

    if (await LeaveType.exists({ name: name.trim() })) {
      return res.status(409).json({ success: false, message: 'Leave type already exists' });
    }

    const leaveType = await LeaveType.create({
      name: name.trim(),
      daysAllowed: allowedDays,
      isPaid: isPaid ?? true,
      description: description?.trim() || '',
    });

    return res.status(201).json({ success: true, data: leaveType });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Leave type already exists' });
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateLeaveType = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid leave type ID' });
    }

    const leaveType = await LeaveType.findById(req.params.id);
    if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });

    const { name, daysAllowed, isPaid, description, isActive } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string') return res.status(400).json({ success: false, message: 'Leave type name must be text' });
      const normalizedName = name.trim();
      if (!normalizedName) return res.status(400).json({ success: false, message: 'Leave type name is required' });
      if (normalizedName !== leaveType.name && await Leave.exists({ leaveType: leaveType.name })) {
        return res.status(409).json({
          success: false,
          message: 'This leave type is used by existing requests; keep its name and deactivate it instead',
        });
      }
      if (await LeaveType.exists({ name: normalizedName, _id: { $ne: leaveType._id } })) {
        return res.status(409).json({ success: false, message: 'Leave type already exists' });
      }
      leaveType.name = normalizedName;
    }
    if (daysAllowed !== undefined) {
      const allowance = Number(daysAllowed);
      if (!Number.isFinite(allowance) || allowance < 0) {
        return res.status(400).json({ success: false, message: 'Days allowance must be a non-negative number' });
      }
      leaveType.daysAllowed = allowance;
    }
    if (isPaid !== undefined) {
      if (typeof isPaid !== 'boolean') return res.status(400).json({ success: false, message: 'isPaid must be a boolean' });
      leaveType.isPaid = isPaid;
    }
    if (description !== undefined) {
      if (typeof description !== 'string') return res.status(400).json({ success: false, message: 'Description must be text' });
      leaveType.description = description.trim();
    }
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') return res.status(400).json({ success: false, message: 'isActive must be a boolean' });
      leaveType.isActive = isActive;
    }

    await leaveType.save();
    return res.status(200).json({ success: true, data: leaveType });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: 'Leave type already exists' });
    if (error.name === 'ValidationError') return res.status(400).json({ success: false, message: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deactivateLeaveType = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid leave type ID' });
    }

    const leaveType = await LeaveType.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true, runValidators: true }
    );
    if (!leaveType) return res.status(404).json({ success: false, message: 'Leave type not found' });
    return res.status(200).json({ success: true, data: leaveType });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getLeaveTypes,
  createLeaveType,
  updateLeaveType,
  deactivateLeaveType,
};
