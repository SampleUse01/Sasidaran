const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateAttendance, getShiftSchedule } = require('../src/utils/attendanceCalculations');

test('calculates schedule dates in the configured timezone', () => {
  const now = new Date('2026-11-04T04:30:00.000Z');
  const schedule = getShiftSchedule(now, {
    startTime: '09:00',
    endTime: '17:00',
    timezone: 'Asia/Kolkata',
  });

  assert.equal(schedule.workDate.toISOString(), '2026-11-04T00:00:00.000Z');
  assert.equal(schedule.startAt.toISOString(), '2026-11-04T03:30:00.000Z');
  assert.equal(schedule.endAt.toISOString(), '2026-11-04T11:30:00.000Z');
});

test('attributes after-midnight clock-ins to the previous overnight-shift date', () => {
  const now = new Date('2026-11-04T00:30:00.000Z');
  const schedule = getShiftSchedule(now, {
    startTime: '22:00',
    endTime: '06:00',
    timezone: 'Asia/Kolkata',
  });

  assert.equal(schedule.workDate.toISOString(), '2026-11-03T00:00:00.000Z');
  assert.equal(schedule.startAt.toISOString(), '2026-11-03T16:30:00.000Z');
  assert.equal(schedule.endAt.toISOString(), '2026-11-04T00:30:00.000Z');
});

test('calculates work, late arrival, early exit and overtime in elapsed minutes', () => {
  const shift = { breakMinutes: 60, workingHours: 8, gracePeriodMinutes: 10 };
  const scheduledStartAt = new Date('2026-11-04T03:30:00.000Z');
  const scheduledEndAt = new Date('2026-11-04T11:30:00.000Z');

  const lateAndOvertime = calculateAttendance({
    checkIn: new Date('2026-11-04T03:45:00.000Z'),
    checkOut: new Date('2026-11-04T12:00:00.000Z'),
    shift,
    scheduledStartAt,
    scheduledEndAt,
  });
  assert.deepEqual(lateAndOvertime, {
    workingMinutes: 435,
    earlyExitMinutes: 0,
    overtimeMinutes: 30,
    attendanceStatus: 'late',
  });

  const earlyExit = calculateAttendance({
    checkIn: scheduledStartAt,
    checkOut: new Date('2026-11-04T07:00:00.000Z'),
    shift,
    scheduledStartAt,
    scheduledEndAt,
  });
  assert.equal(earlyExit.workingMinutes, 150);
  assert.equal(earlyExit.earlyExitMinutes, 270);
  assert.equal(earlyExit.attendanceStatus, 'half_day');
});
