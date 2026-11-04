const timeStringToMinutes = (value) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new Error('Shift times must use HH:mm format');
  }
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const getLocalParts = (date, timeZone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

const addCalendarDays = ({ year, month, day }, amount) => {
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

const localDateTimeToUtc = (dateParts, time, timeZone) => {
  const [hours, minutes] = time.split(':').map(Number);
  const targetUtc = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, hours, minutes);
  let timestamp = targetUtc;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = getLocalParts(new Date(timestamp), timeZone);
    const observedTime = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(timestamp));
    const [observedHour, observedMinute] = observedTime.split(':').map(Number);
    const observedUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observedHour,
      observedMinute
    );
    const difference = targetUtc - observedUtc;
    timestamp += difference;
    if (difference === 0) break;
  }

  return new Date(timestamp);
};

const getShiftSchedule = (now, shift) => {
  const timeZone = shift.timezone || 'UTC';
  const startMinutes = timeStringToMinutes(shift.startTime);
  const endMinutes = timeStringToMinutes(shift.endTime);
  const endDayOffset = endMinutes <= startMinutes ? 1 : 0;
  const localToday = getLocalParts(now, timeZone);
  const localTime = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now);
  const currentMinutes = timeStringToMinutes(localTime);
  const workDate = endDayOffset && currentMinutes <= endMinutes
    ? addCalendarDays(localToday, -1)
    : localToday;
  const startAt = localDateTimeToUtc(workDate, shift.startTime, timeZone);
  const endAt = localDateTimeToUtc(addCalendarDays(workDate, endDayOffset), shift.endTime, timeZone);

  return {
    workDate: new Date(Date.UTC(workDate.year, workDate.month - 1, workDate.day)),
    startAt,
    endAt,
  };
};

const calculateAttendance = ({ checkIn, checkOut, shift, scheduledStartAt, scheduledEndAt }) => {
  const breakMinutes = Number(shift.breakMinutes || 0);
  const expectedMinutes = Number(shift.workingHours || 8) * 60;
  const scheduledStart = scheduledStartAt || new Date(checkIn);
  const scheduledEnd = scheduledEndAt || new Date(checkIn.getTime() + expectedMinutes * 60 * 1000);
  const checkInDate = new Date(checkIn);
  const checkOutDate = checkOut ? new Date(checkOut) : null;
  const late = checkInDate.getTime() > scheduledStart.getTime() + Number(shift.gracePeriodMinutes || 0) * 60000;
  const durationMinutes = checkOutDate
    ? Math.max(0, Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000))
    : 0;
  const workingMinutes = checkOutDate ? Math.max(0, durationMinutes - breakMinutes) : 0;
  const earlyExitMinutes = checkOutDate
    ? Math.max(0, Math.floor((scheduledEnd.getTime() - checkOutDate.getTime()) / 60000))
    : 0;
  const overtimeMinutes = checkOutDate
    ? Math.max(0, Math.floor((checkOutDate.getTime() - scheduledEnd.getTime()) / 60000))
    : 0;
  const attendanceStatus = checkOutDate && workingMinutes < expectedMinutes * 0.5
    ? 'half_day'
    : late
      ? 'late'
      : 'present';

  return {
    workingMinutes,
    earlyExitMinutes,
    overtimeMinutes,
    attendanceStatus,
  };
};

module.exports = {
  getShiftSchedule,
  calculateAttendance,
};
