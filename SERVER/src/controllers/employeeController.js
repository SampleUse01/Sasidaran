const Employee = require('../models/Employee');
const User = require('../models/User');
const Shift = require('../models/Shift');
const bcrypt = require('bcryptjs');
const Attendance = require('../models/Attendance');
const { Roles } = require('../utils/roles');

const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find()
      .populate('userId', 'name email role isActive')
      .populate('shiftId', 'name startTime endTime');

    return res.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createEmployee = async (req, res) => {
  let createdUserId;
  try {
    const {
      name,
      email,
      password,
      employeeCode,
      department,
      designation,
      joiningDate,
      shiftId,
    } = req.body;

    if (
      [name, email, password, employeeCode, department, designation, joiningDate]
        .some((value) => typeof value !== 'string' || !value.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, employee code, department, designation and joining date are required',
      });
    }

    if (name.length > 120 || employeeCode.length > 40 || department.length > 100 || designation.length > 100) {
      return res.status(400).json({ success: false, message: 'One or more employee fields exceed the allowed length' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = employeeCode.trim();
    const validDate = new Date(joiningDate);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }

    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ success: false, message: 'Password must be between 6 and 128 characters' });
    }

    if (Number.isNaN(validDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Enter a valid joining date' });
    }

    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'An account with that email already exists' });
    }

    if (await Employee.exists({ employeeCode: normalizedCode })) {
      return res.status(409).json({ success: false, message: 'Employee code already exists' });
    }

    if (shiftId) {
      if (!isValidObjectId(shiftId) || !(await Shift.exists({ _id: shiftId }))) {
        return res.status(400).json({ success: false, message: 'Select a valid shift' });
      }
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role: Roles.USER,
    });
    createdUserId = user._id;

    const employee = await Employee.create({
      userId: user._id,
      employeeCode: normalizedCode,
      department: department.trim(),
      designation: designation.trim(),
      joiningDate: validDate,
      shiftId: shiftId || null,
    });

    return res.status(201).json({
      success: true,
      data: await Employee.findById(employee._id)
        .populate('userId', 'name email role isActive')
        .populate('shiftId', 'name startTime endTime'),
    });
  } catch (error) {
    if (createdUserId) {
      await User.findByIdAndDelete(createdUserId);
    }
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email or employee code already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getEmployeeById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const employee = await Employee.findById(req.params.id)
      .populate('userId', 'name email role isActive')
      .populate('shiftId', 'name startTime endTime');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    if (req.user.role === Roles.USER && employee.userId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You may only access your own employee profile' });
    }

    return res.status(200).json({ success: true, data: employee });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, employeeCode, department, designation, joiningDate, shiftId, status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const employee = await Employee.findById(id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const user = await User.findById(employee.userId);
    if (!user || user.role !== Roles.USER) {
      return res.status(409).json({ success: false, message: 'Employee account is not eligible for editing' });
    }

    const allowedStatuses = ['active', 'inactive', 'on_leave'];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid employee status' });
    }
    if (
      status === 'inactive' &&
      await Attendance.exists({ employeeId: employee._id, checkIn: { $ne: null }, checkOut: null })
    ) {
      return res.status(409).json({
        success: false,
        message: 'This employee has an active attendance session; have them check out before deactivating the account',
      });
    }

    if (name !== undefined) {
      if (typeof name !== 'string') return res.status(400).json({ success: false, message: 'Name must be text' });
      if (!name.trim()) return res.status(400).json({ success: false, message: 'Name is required' });
      if (name.length > 120) return res.status(400).json({ success: false, message: 'Name is too long' });
      user.name = name.trim();
    }

    if (email !== undefined) {
      if (typeof email !== 'string') return res.status(400).json({ success: false, message: 'Email must be text' });
      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Enter a valid email address' });
      }
      if (await User.exists({ email: normalizedEmail, _id: { $ne: user._id } })) {
        return res.status(409).json({ success: false, message: 'An account with that email already exists' });
      }
      user.email = normalizedEmail;
    }

    if (employeeCode !== undefined) {
      if (typeof employeeCode !== 'string') {
        return res.status(400).json({ success: false, message: 'Employee code must be text' });
      }
      const normalizedCode = employeeCode.trim();
      if (!normalizedCode) return res.status(400).json({ success: false, message: 'Employee code is required' });
      if (await Employee.exists({ employeeCode: normalizedCode, _id: { $ne: employee._id } })) {
        return res.status(409).json({ success: false, message: 'Employee code already exists' });
      }
      employee.employeeCode = normalizedCode;
    }

    if (department !== undefined) {
      if (typeof department !== 'string' || !department.trim() || department.length > 100) {
        return res.status(400).json({ success: false, message: 'Enter a valid department (up to 100 characters)' });
      }
      employee.department = department.trim();
    }
    if (designation !== undefined) {
      if (typeof designation !== 'string' || !designation.trim() || designation.length > 100) {
        return res.status(400).json({ success: false, message: 'Enter a valid designation (up to 100 characters)' });
      }
      employee.designation = designation.trim();
    }
    if (joiningDate !== undefined) {
      const parsedDate = new Date(joiningDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Enter a valid joining date' });
      }
      employee.joiningDate = parsedDate;
    }

    if (shiftId !== undefined) {
      if (shiftId && (!isValidObjectId(shiftId) || !(await Shift.exists({ _id: shiftId })))) {
        return res.status(400).json({ success: false, message: 'Select a valid shift' });
      }
      employee.shiftId = shiftId || null;
    }

    if (status !== undefined) {
      employee.status = status;
      user.isActive = status !== 'inactive';
    }

    await user.save();
    await employee.save();

    return res.status(200).json({
      success: true,
      data: await Employee.findById(employee._id)
        .populate('userId', 'name email role isActive')
        .populate('shiftId', 'name startTime endTime'),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email or employee code already exists' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deactivateEmployee = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid employee ID' });
    }

    const employee = await Employee.findById(req.params.id);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    if (await Attendance.exists({ employeeId: employee._id, checkIn: { $ne: null }, checkOut: null })) {
      return res.status(409).json({
        success: false,
        message: 'This employee has an active attendance session; have them check out before deactivating the account',
      });
    }

    employee.status = 'inactive';
    await employee.save();
    await User.findByIdAndUpdate(employee.userId, { isActive: false });

    return res.status(200).json({ success: true, message: 'Employee deactivated' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getEmployees,
  createEmployee,
  getEmployeeById,
  updateEmployee,
  deactivateEmployee,
};
