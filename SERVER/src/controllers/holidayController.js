const Holiday = require('../models/Holiday');

const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

const getDayRange = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    return res.status(200).json({ success: true, count: holidays.length, data: holidays });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createHoliday = async (req, res) => {
  try {
    const { name, date, type, description } = req.body;

    if (typeof name !== 'string' || !name.trim() || !date) {
      return res.status(400).json({
        success: false,
        message: 'Holiday name and date are required',
      });
    }

    const range = getDayRange(date);
    if (!range) return res.status(400).json({ success: false, message: 'Enter a valid holiday date' });
    if (type !== undefined && !['national', 'company', 'special'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid holiday type' });
    }
    if (description !== undefined && typeof description !== 'string') {
      return res.status(400).json({ success: false, message: 'Description must be text' });
    }

    if (await Holiday.exists({ date: { $gte: range.start, $lt: range.end } })) {
      return res.status(409).json({ success: false, message: 'A holiday already exists on this date' });
    }

    const holiday = await Holiday.create({
      name: name.trim(),
      date: range.start,
      type: type || 'company',
      description: description?.trim() || '',
    });

    return res.status(201).json({ success: true, data: holiday });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateHoliday = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid holiday ID' });
    }

    const holiday = await Holiday.findById(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });

    const { name, date, type, description } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string') return res.status(400).json({ success: false, message: 'Holiday name must be text' });
      if (!name.trim()) return res.status(400).json({ success: false, message: 'Holiday name is required' });
      holiday.name = name.trim();
    }
    if (type !== undefined) {
      if (!['national', 'company', 'special'].includes(type)) {
        return res.status(400).json({ success: false, message: 'Invalid holiday type' });
      }
      holiday.type = type;
    }
    if (description !== undefined) {
      if (typeof description !== 'string') return res.status(400).json({ success: false, message: 'Description must be text' });
      holiday.description = description.trim();
    }
    if (date !== undefined) {
      const range = getDayRange(date);
      if (!range) return res.status(400).json({ success: false, message: 'Enter a valid holiday date' });
      if (await Holiday.exists({
        _id: { $ne: holiday._id },
        date: { $gte: range.start, $lt: range.end },
      })) {
        return res.status(409).json({ success: false, message: 'A holiday already exists on this date' });
      }
      holiday.date = range.start;
    }

    await holiday.save();
    return res.status(200).json({ success: true, data: holiday });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid holiday ID' });
    }

    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) return res.status(404).json({ success: false, message: 'Holiday not found' });
    return res.status(200).json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
};
