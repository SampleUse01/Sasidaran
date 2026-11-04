import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const sections = [
  { id: 'employees', label: 'Employees', path: '/employees' },
  { id: 'shifts', label: 'Shifts', path: '/shifts' },
  { id: 'leave-types', label: 'Leave types', path: '/leave-types' },
  { id: 'holidays', label: 'Holidays', path: '/holidays' },
];

const blankForms = {
  employees: {
    name: '', email: '', password: '', employeeCode: '', department: '', designation: '',
    joiningDate: '', shiftId: '', status: 'active',
  },
  shifts: {
    name: '', startTime: '09:00', endTime: '17:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', breakMinutes: '60',
    gracePeriodMinutes: '10', workingHours: '8',
  },
  'leave-types': { name: '', daysAllowed: '0', isPaid: true, description: '', isActive: true },
  holidays: { name: '', date: '', type: 'company', description: '' },
};

const errorMessage = (error) => error?.message || 'Something went wrong. Please try again.';
const toDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

function Field({ label, children, className = '' }) {
  return (
    <label className={`management-field ${className}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function AdminManagementPage() {
  const { user, logout } = useAuth();
  const [section, setSection] = useState('employees');
  const [items, setItems] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [draft, setDraft] = useState(blankForms.employees);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const currentSection = sections.find((item) => item.id === section);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest(currentSection.path);
      setItems(result.data || []);
      if (section === 'employees') {
        const shiftResult = await apiRequest('/shifts');
        setShifts(shiftResult.data || []);
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [currentSection.path, section]);

  useEffect(() => {
    setDraft(blankForms[section]);
    setEditingId(null);
    setNotice('');
    loadItems();
  }, [section, loadItems]);

  const updateDraft = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const startEditing = (item) => {
    setError('');
    setNotice('');
    setEditingId(item._id);
    if (section === 'employees') {
      setDraft({
        name: item.userId?.name || '',
        email: item.userId?.email || '',
        password: '',
        employeeCode: item.employeeCode || '',
        department: item.department || '',
        designation: item.designation || '',
        joiningDate: toDateInput(item.joiningDate),
        shiftId: item.shiftId?._id || '',
        status: item.status || 'active',
      });
    } else if (section === 'shifts') {
      setDraft({
        name: item.name,
        startTime: item.startTime,
        endTime: item.endTime,
        timezone: item.timezone || 'UTC',
        breakMinutes: String(item.breakMinutes),
        gracePeriodMinutes: String(item.gracePeriodMinutes),
        workingHours: String(item.workingHours),
      });
    } else if (section === 'leave-types') {
      setDraft({
        name: item.name,
        daysAllowed: String(item.daysAllowed),
        isPaid: item.isPaid,
        description: item.description || '',
        isActive: item.isActive,
      });
    } else {
      setDraft({
        name: item.name,
        date: toDateInput(item.date),
        type: item.type,
        description: item.description || '',
      });
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraft(blankForms[section]);
    setError('');
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');

    const payload = { ...draft };
    if (section === 'employees' && editingId) delete payload.password;
    if (section === 'shifts') {
      payload.breakMinutes = Number(payload.breakMinutes);
      payload.gracePeriodMinutes = Number(payload.gracePeriodMinutes);
      payload.workingHours = Number(payload.workingHours);
    }
    if (section === 'leave-types') payload.daysAllowed = Number(payload.daysAllowed);

    try {
      await apiRequest(editingId ? `${currentSection.path}/${editingId}` : currentSection.path, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      setNotice(editingId ? `${currentSection.label.slice(0, -1)} updated.` : `${currentSection.label.slice(0, -1)} created.`);
      setEditingId(null);
      setDraft(blankForms[section]);
      await loadItems();
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (item) => {
    const message = section === 'employees'
      ? `Deactivate ${item.userId?.name || 'this employee'}? They will no longer be able to sign in.`
      : section === 'leave-types'
        ? `Deactivate the ${item.name} leave type? Existing requests will be retained.`
        : `Delete ${item.name}?`;
    if (!window.confirm(message)) return;

    setError('');
    setNotice('');
    try {
      await apiRequest(`${currentSection.path}/${item._id}`, { method: 'DELETE' });
      setNotice(section === 'employees' || section === 'leave-types' ? 'Item deactivated.' : 'Item deleted.');
      if (editingId === item._id) cancelEditing();
      await loadItems();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  const toggleLeaveType = async (item) => {
    try {
      await apiRequest(`${currentSection.path}/${item._id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      setNotice(item.isActive ? 'Leave type deactivated.' : 'Leave type activated.');
      await loadItems();
    } catch (requestError) {
      setError(errorMessage(requestError));
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="sidebar-brand" to="/" aria-label="Workforce Attendance home">
          <span className="brand-mark small" aria-hidden="true">W</span>
          <span>Workforce<span className="brand-subtitle">ATTENDANCE</span></span>
        </Link>
        <div className="sidebar-section-label">WORKSPACE</div>
        <Link className="sidebar-link" to="/"><span aria-hidden="true">◫</span> Overview</Link>
        <div className="sidebar-link active"><span aria-hidden="true">⚙</span> Management</div>
        <div className="sidebar-section-label account-label">ACCOUNT</div>
        <div className="sidebar-user">
          <div className="avatar" aria-hidden="true">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div className="sidebar-user-info">
            <strong>{user?.name}</strong>
            <span>{user?.role === 'superadmin' ? 'Superadmin' : 'Administrator'}</span>
          </div>
        </div>
      </aside>

      <main className="main-content management-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">WORKSPACE / MANAGEMENT</p>
            <h1>Manage workforce</h1>
          </div>
          <button className="secondary-button" onClick={logout}>Sign out</button>
        </header>

        <nav className="management-tabs" aria-label="Management sections">
          {sections.map((item) => (
            <button
              key={item.id}
              className={`management-tab ${section === item.id ? 'selected' : ''}`}
              onClick={() => setSection(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="management-layout">
          <section className="management-list">
            <div className="management-list-header">
              <div>
                <h2>{currentSection.label}</h2>
                <p>View and maintain organization {currentSection.label.toLowerCase()}.</p>
              </div>
              <button className="secondary-button" type="button" onClick={loadItems} disabled={loading}>
                Refresh
              </button>
            </div>
            {error && <div className="management-message error-message" role="alert">{error}</div>}
            {notice && <div className="management-message success-message" role="status">{notice}</div>}

            {loading ? (
              <p className="empty-state">Loading {currentSection.label.toLowerCase()}…</p>
            ) : items.length === 0 ? (
              <p className="empty-state">No {currentSection.label.toLowerCase()} yet. Add one using the form.</p>
            ) : (
              <div className="management-table-wrap">
                <table className="management-table">
                  <thead>
                    {section === 'employees' && <tr><th>EMPLOYEE</th><th>DEPARTMENT</th><th>SHIFT</th><th>STATUS</th><th>ACTIONS</th></tr>}
                    {section === 'shifts' && <tr><th>SHIFT</th><th>HOURS</th><th>BREAK</th><th>ACTIONS</th></tr>}
                    {section === 'leave-types' && <tr><th>LEAVE TYPE</th><th>ALLOWANCE</th><th>PAID</th><th>STATUS</th><th>ACTIONS</th></tr>}
                    {section === 'holidays' && <tr><th>HOLIDAY</th><th>DATE</th><th>TYPE</th><th>ACTIONS</th></tr>}
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item._id}>
                        {section === 'employees' && <>
                          <td><strong>{item.userId?.name}</strong><span className="table-subtext">{item.employeeCode} · {item.userId?.email}</span></td>
                          <td>{item.department}<span className="table-subtext">{item.designation}</span></td>
                          <td>{item.shiftId?.name || 'Unassigned'}</td>
                          <td><span className={`status-pill ${item.status}`}>{item.status.replace('_', ' ')}</span></td>
                        </>}
                        {section === 'shifts' && <>
                          <td><strong>{item.name}</strong><span className="table-subtext">{item.startTime} – {item.endTime}</span></td>
                          <td>{item.workingHours} hrs</td>
                          <td>{item.breakMinutes} min</td>
                        </>}
                        {section === 'leave-types' && <>
                          <td><strong>{item.name}</strong><span className="table-subtext">{item.description || 'No description'}</span></td>
                          <td>{item.daysAllowed} days</td>
                          <td>{item.isPaid ? 'Paid' : 'Unpaid'}</td>
                          <td><span className={`status-pill ${item.isActive ? 'active' : 'inactive'}`}>{item.isActive ? 'active' : 'inactive'}</span></td>
                        </>}
                        {section === 'holidays' && <>
                          <td><strong>{item.name}</strong><span className="table-subtext">{item.description || '—'}</span></td>
                          <td>{new Date(item.date).toLocaleDateString()}</td>
                          <td>{item.type}</td>
                        </>}
                        <td>
                          <div className="table-actions">
                            <button className="text-button" type="button" onClick={() => startEditing(item)}>Edit</button>
                            {section === 'leave-types' && (
                              <button className="text-button" type="button" onClick={() => toggleLeaveType(item)}>
                                {item.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                            {section !== 'leave-types' && (
                              <button className="text-button danger-text" type="button" onClick={() => removeItem(item)}>
                                {section === 'employees' ? 'Deactivate' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="management-form-panel">
            <div className="management-list-header">
              <div>
                <h2>{editingId ? 'Edit' : 'Add'} {currentSection.label.slice(0, -1)}</h2>
                <p>{editingId ? 'Update the selected record.' : 'Enter details to create a record.'}</p>
              </div>
            </div>
            <form className="management-form" onSubmit={submitForm}>
              {section === 'employees' && <>
                <Field label="Full name"><input required maxLength={120} value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} /></Field>
                <Field label="Email"><input required type="email" maxLength={254} value={draft.email} onChange={(e) => updateDraft('email', e.target.value)} /></Field>
                {!editingId && <Field label="Initial password"><input required type="password" autoComplete="new-password" minLength={6} maxLength={128} value={draft.password} onChange={(e) => updateDraft('password', e.target.value)} /><small>Share this privately with the employee; they can use it to sign in.</small></Field>}
                <Field label="Employee code"><input required maxLength={40} value={draft.employeeCode} onChange={(e) => updateDraft('employeeCode', e.target.value)} /></Field>
                <Field label="Department"><input required maxLength={100} value={draft.department} onChange={(e) => updateDraft('department', e.target.value)} /></Field>
                <Field label="Designation"><input required maxLength={100} value={draft.designation} onChange={(e) => updateDraft('designation', e.target.value)} /></Field>
                <Field label="Joining date"><input required type="date" value={draft.joiningDate} onChange={(e) => updateDraft('joiningDate', e.target.value)} /></Field>
                <Field label="Assigned shift">
                  <select value={draft.shiftId} onChange={(e) => updateDraft('shiftId', e.target.value)}>
                    <option value="">Unassigned</option>
                    {shifts.map((shift) => <option value={shift._id} key={shift._id}>{shift.name} ({shift.startTime}–{shift.endTime})</option>)}
                  </select>
                </Field>
                {editingId && <Field label="Status"><select value={draft.status} onChange={(e) => updateDraft('status', e.target.value)}><option value="active">Active</option><option value="on_leave">On leave</option><option value="inactive">Inactive</option></select></Field>}
              </>}

              {section === 'shifts' && <>
                <Field label="Shift name"><input required maxLength={80} value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} /></Field>
                <div className="field-pair">
                  <Field label="Start time"><input required type="time" value={draft.startTime} onChange={(e) => updateDraft('startTime', e.target.value)} /></Field>
                  <Field label="End time"><input required type="time" value={draft.endTime} onChange={(e) => updateDraft('endTime', e.target.value)} /></Field>
                </div>
                <Field label="Shift timezone"><input required maxLength={80} placeholder="e.g. Asia/Kolkata" value={draft.timezone} onChange={(e) => updateDraft('timezone', e.target.value)} /><small>Use an IANA timezone name. This defines the shift date and late/early calculations.</small></Field>
                <Field label="Break (minutes)"><input required type="number" min="0" max="720" step="1" value={draft.breakMinutes} onChange={(e) => updateDraft('breakMinutes', e.target.value)} /></Field>
                <Field label="Late grace period (minutes)"><input required type="number" min="0" max="240" step="1" value={draft.gracePeriodMinutes} onChange={(e) => updateDraft('gracePeriodMinutes', e.target.value)} /></Field>
                <Field label="Expected work hours"><input required type="number" min="0.25" max="24" step="0.25" value={draft.workingHours} onChange={(e) => updateDraft('workingHours', e.target.value)} /></Field>
              </>}

              {section === 'leave-types' && <>
                <Field label="Leave type name"><input required maxLength={80} value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} /></Field>
                <Field label="Annual allowance (days)"><input required type="number" min="0" step="0.5" value={draft.daysAllowed} onChange={(e) => updateDraft('daysAllowed', e.target.value)} /></Field>
                <Field label="Description"><textarea rows="3" maxLength={500} value={draft.description} onChange={(e) => updateDraft('description', e.target.value)} /></Field>
                <label className="checkbox-field"><input type="checkbox" checked={draft.isPaid} onChange={(e) => updateDraft('isPaid', e.target.checked)} /> Paid leave</label>
                {editingId && <label className="checkbox-field"><input type="checkbox" checked={draft.isActive} onChange={(e) => updateDraft('isActive', e.target.checked)} /> Available for use</label>}
              </>}

              {section === 'holidays' && <>
                <Field label="Holiday name"><input required maxLength={120} value={draft.name} onChange={(e) => updateDraft('name', e.target.value)} /></Field>
                <Field label="Date"><input required type="date" value={draft.date} onChange={(e) => updateDraft('date', e.target.value)} /></Field>
                <Field label="Category"><select value={draft.type} onChange={(e) => updateDraft('type', e.target.value)}><option value="company">Company</option><option value="national">National</option><option value="special">Special</option></select></Field>
                <Field label="Description"><textarea rows="3" maxLength={500} value={draft.description} onChange={(e) => updateDraft('description', e.target.value)} /></Field>
              </>}

              <div className="form-actions">
                <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : `Create ${currentSection.label.slice(0, -1)}`}</button>
                {editingId && <button className="secondary-button" type="button" onClick={cancelEditing}>Cancel</button>}
              </div>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
