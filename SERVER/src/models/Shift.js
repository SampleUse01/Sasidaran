const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    breakMinutes: {
      type: Number,
      default: 0,
    },
    gracePeriodMinutes: {
      type: Number,
      default: 10,
    },
    workingHours: {
      type: Number,
      default: 8,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Shift', shiftSchema);
