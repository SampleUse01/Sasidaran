const Roles = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  USER: 'user',
};

const Permissions = {
  MANAGE_SYSTEM: 'manage_system',
  MANAGE_EMPLOYEES: 'manage_employees',
  MANAGE_SHIFTS: 'manage_shifts',
  MANAGE_LEAVES: 'manage_leaves',
  MANAGE_HOLIDAYS: 'manage_holidays',
  VIEW_REPORTS: 'view_reports',
  VIEW_OWN_ATTENDANCE: 'view_own_attendance',
  SUBMIT_CORRECTION_REQUEST: 'submit_correction_request',
};

const RolePermissions = {
  [Roles.SUPERADMIN]: Object.values(Permissions),
  [Roles.ADMIN]: [
    Permissions.MANAGE_EMPLOYEES,
    Permissions.MANAGE_SHIFTS,
    Permissions.MANAGE_LEAVES,
    Permissions.MANAGE_HOLIDAYS,
    Permissions.VIEW_REPORTS,
  ],
  [Roles.USER]: [
    Permissions.VIEW_OWN_ATTENDANCE,
    Permissions.SUBMIT_CORRECTION_REQUEST,
  ],
};

module.exports = {
  Roles,
  Permissions,
  RolePermissions,
};
