import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const formatDateTime = (value) => value
  ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
  : '—';

const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const minutesToHours = (minutes = 0) => `${(minutes / 60).toFixed(1)} hrs`;
const displayError = (error) => error?.message || 'Something went wrong. Please try again.';

function EmployeeAttendance({ user, logout }) {
  const [attendance, setAttendance] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [requestFor, setRequestFor] = useState(null);
  const [requestDraft, setRequestDraft] = useState({ checkIn: '', checkOut: '', reason: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [attendanceResult, correctionResult] = await Promise.all([
        apiRequest('/attendance/mine'),
        apiRequest('/correction-requests/mine'),
      ]);
      setAttendance(attendanceResult);
      setCorrections(correctionResult.data || []);
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markTime = async (action) => {
    setWorking(true);
    setError('');
    setNotice('');
    try {
      const result = await apiRequest(`/attendance/${action}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setNotice(action === 'checkin' ? 'You are checked in. Have a productive shift!' : 'You are checked out. Your hours have been recorded.');
      setAttendance((current) => current
        ? { ...current, activeAttendance: action === 'checkin' ? result.data : null }
        : current);
      await loadData();
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setWorking(false);
    }
  };

  const openCorrection = (record) => {
    setError('');
    setNotice('');
    setRequestFor(record._id);
    setRequestDraft({
      checkIn: toLocalInput(record.checkIn),
      checkOut: toLocalInput(record.checkOut),
      reason: '',
    });
  };

  const submitCorrection = async (event) => {
    event.preventDefault();
    if (!requestFor) return;
    setWorking(true);
    setError('');
    setNotice('');
    try {
      await apiRequest('/correction-requests', {
        method: 'POST',
        body: JSON.stringify({
          attendanceId: requestFor,
          requestedCheckIn: requestDraft.checkIn ? new Date(requestDraft.checkIn).toISOString() : null,
          requestedCheckOut: requestDraft.checkOut ? new Date(requestDraft.checkOut).toISOString() : null,
          reason: requestDraft.reason,
        }),
      });
      setRequestFor(null);
      setNotice('Correction request submitted for administrator review.');
      await loadData();
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setWorking(false);
    }
  };

  const hasPendingCorrection = (recordId) => corrections.some(
    (request) => request.attendanceId?._id === recordId && request.status === 'pending'
  );
  const active = attendance?.activeAttendance;
  const employee = attendance?.employee;
  const summary = attendance?.summary || {};

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="sidebar-brand" to="/" aria-label="Workforce Attendance home">
          <span className="brand-mark small" aria-hidden="true">W</span>
          <span>Workforce<span className="brand-subtitle">ATTENDANCE</span></span>
        </Link>
        <div className="sidebar-section-label">WORKSPACE</div>
        <Link className="sidebar-link" to="/"><span aria-hidden="true">◫</span> Overview</Link>
        <div className="sidebar-link active"><span aria-hidden="true">◷</span> My attendance</div>
        <div className="sidebar-section-label account-label">ACCOUNT</div>
        <div className="sidebar-user">
          <div className="avatar" aria-hidden="true">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div className="sidebar-user-info"><strong>{user?.name}</strong><span>Employee</span></div>
        </div>
      </aside>

      <main className="main-content attendance-content">
        <header className="topbar">
          <div><p className="eyebrow">WORKSPACE / MY ATTENDANCE</p><h1>My attendance</h1></div>
          <button className="secondary-button" onClick={logout}>Sign out</button>
        </header>

        <section className={`clock-panel ${active ? 'clocked-in' : ''}`}>
          <div className="clock-copy">
            <p className="eyebrow">{active ? 'CURRENT SHIFT' : 'TIME TRACKING'}</p>
            <h2>{active ? 'You’re currently checked in' : 'Ready to start your shift?'}</h2>
            <p>{active
              ? `Checked in at ${formatDateTime(active.checkIn)} · ${minutesToHours(Math.max(0, Math.floor((now - new Date(active.checkIn).getTime()) / 60000)))} elapsed${employee?.shift?.name ? ` · ${employee.shift.name}` : ''}`
              : employee?.shift?.name
                ? `Your assigned shift is ${employee.shift.name} (${employee.shift.startTime}–${employee.shift.endTime}).`
                : 'Ask your administrator to assign your shift before checking in.'}</p>
          </div>
          <button
            className={`clock-button ${active ? 'checkout-button' : ''}`}
            onClick={() => markTime(active ? 'checkout' : 'checkin')}
            disabled={working || loading || !employee?.shift || employee?.status !== 'active'}
          >
            <span aria-hidden="true">{active ? '■' : '▶'}</span>
            {working ? 'Saving…' : active ? 'Check out' : 'Check in'}
          </button>
        </section>

        {error && <div className="management-message error-message attendance-message" role="alert">{error}</div>}
        {notice && <div className="management-message success-message attendance-message" role="status">{notice}</div>}

        <section className="summary-grid attendance-summary" aria-label="Working hours summary">
          <article className="summary-card"><span className="card-icon purple" aria-hidden="true">◷</span><p className="card-label">RECORDED SHIFTS</p><strong>{loading ? '…' : summary.records || 0}</strong><span className="card-detail">Attendance entries</span></article>
          <article className="summary-card"><span className="card-icon green" aria-hidden="true">⌁</span><p className="card-label">WORKING HOURS</p><strong>{loading ? '…' : minutesToHours(summary.workingMinutes)}</strong><span className="card-detail">Across all recorded shifts</span></article>
          <article className="summary-card"><span className="card-icon orange" aria-hidden="true">↗</span><p className="card-label">OVERTIME</p><strong>{loading ? '…' : minutesToHours(summary.overtimeMinutes)}</strong><span className="card-detail">Hours beyond assigned shift</span></article>
          <article className="summary-card"><span className="card-icon purple" aria-hidden="true">⌁</span><p className="card-label">EARLY EXIT</p><strong>{loading ? '…' : minutesToHours(summary.earlyExitMinutes)}</strong><span className="card-detail">Minutes before shift end</span></article>
        </section>

        <section className="management-list attendance-history">
          <div className="management-list-header">
            <div><h2>Attendance history</h2><p>Most recent 90 shifts. Ask an administrator to correct a record if needed.</p></div>
            <button className="secondary-button" type="button" onClick={loadData} disabled={loading}>Refresh</button>
          </div>
          {loading ? <p className="empty-state">Loading your attendance…</p> : (attendance?.data || []).length === 0 ? (
            <p className="empty-state">No attendance yet. Check in when you start your next shift.</p>
          ) : (
            <div className="management-table-wrap">
              <table className="management-table">
                <thead><tr><th>SHIFT DATE</th><th>SHIFT</th><th>CHECK IN</th><th>CHECK OUT</th><th>WORKED</th><th>STATUS</th><th>ACTION</th></tr></thead>
                <tbody>
                  {attendance.data.map((record) => (
                    <tr key={record._id}>
                      <td>{new Date(record.date).toLocaleDateString()}</td>
                      <td>{record.shiftId?.name || 'Shift'}</td>
                      <td>{formatDateTime(record.checkIn)}</td>
                      <td>{formatDateTime(record.checkOut)}</td>
                      <td>{minutesToHours(record.workingMinutes)}</td>
                      <td><span className={`status-pill ${record.attendanceStatus === 'present' || record.attendanceStatus === 'late' ? 'active' : 'inactive'}`}>{record.attendanceStatus.replace('_', ' ')}</span></td>
                      <td>{hasPendingCorrection(record._id)
                        ? <span className="pending-text">Pending review</span>
                        : <button className="text-button" type="button" onClick={() => openCorrection(record)}>Request correction</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {requestFor && (
          <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !working) setRequestFor(null);
          }}>
            <section className="correction-modal" role="dialog" aria-modal="true" aria-labelledby="correction-title">
              <div className="management-list-header"><div><h2 id="correction-title">Request attendance correction</h2><p>An administrator reviews all submitted changes.</p></div><button className="modal-close" type="button" aria-label="Close" onClick={() => setRequestFor(null)}>×</button></div>
              <form className="management-form" onSubmit={submitCorrection}>
                <label className="management-field"><span>Correct check-in time</span><input type="datetime-local" value={requestDraft.checkIn} onChange={(e) => setRequestDraft((current) => ({ ...current, checkIn: e.target.value }))} /></label>
                <label className="management-field"><span>Correct check-out time</span><input type="datetime-local" value={requestDraft.checkOut} onChange={(e) => setRequestDraft((current) => ({ ...current, checkOut: e.target.value }))} /></label>
                <label className="management-field"><span>Reason for correction</span><textarea rows="4" required maxLength={1000} value={requestDraft.reason} onChange={(e) => setRequestDraft((current) => ({ ...current, reason: e.target.value }))} /></label>
                <div className="form-actions"><button className="primary-button" type="submit" disabled={working}>{working ? 'Submitting…' : 'Submit for review'}</button><button className="secondary-button" type="button" onClick={() => setRequestFor(null)} disabled={working}>Cancel</button></div>
              </form>
            </section>
          </div>
        )}

        <section className="management-list correction-history">
          <div className="management-list-header"><div><h2>Correction requests</h2><p>Track the review status of your submitted requests.</p></div></div>
          {corrections.length === 0 ? <p className="empty-state">No correction requests submitted.</p> : (
            <div className="management-table-wrap">
              <table className="management-table">
                <thead><tr><th>SUBMITTED</th><th>REASON</th><th>REQUESTED TIMES</th><th>STATUS</th><th>REVIEWED BY</th></tr></thead>
                <tbody>{corrections.map((request) => (
                  <tr key={request._id}>
                    <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                    <td>{request.reason}</td>
                    <td>{request.requestedCheckIn ? `In: ${formatDateTime(request.requestedCheckIn)}` : ''}{request.requestedCheckIn && request.requestedCheckOut ? ' · ' : ''}{request.requestedCheckOut ? `Out: ${formatDateTime(request.requestedCheckOut)}` : ''}</td>
                    <td><span className={`status-pill ${request.status === 'approved' ? 'active' : request.status === 'rejected' ? 'inactive' : ''}`}>{request.status}</span></td>
                    <td>{request.reviewedBy?.name || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function AdminAttendance({ user, logout }) {
  const [records, setRecords] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [attendanceResult, requestResult] = await Promise.all([
        apiRequest('/attendance'),
        apiRequest('/correction-requests'),
      ]);
      setRecords(attendanceResult.data || []);
      setRequests(requestResult.data || []);
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const review = async (request, status) => {
    setProcessingId(request._id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/correction-requests/${request._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      setNotice(`Correction request ${status}.`);
      await loadData();
    } catch (requestError) {
      setError(displayError(requestError));
    } finally {
      setProcessingId(null);
    }
  };

  const pendingRequests = requests.filter((request) => request.status === 'pending');

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="sidebar-brand" to="/" aria-label="Workforce Attendance home"><span className="brand-mark small" aria-hidden="true">W</span><span>Workforce<span className="brand-subtitle">ATTENDANCE</span></span></Link>
        <div className="sidebar-section-label">WORKSPACE</div>
        <Link className="sidebar-link" to="/"><span aria-hidden="true">◫</span> Overview</Link>
        <Link className="sidebar-link" to="/manage"><span aria-hidden="true">⚙</span> Management</Link>
        <div className="sidebar-link active"><span aria-hidden="true">◷</span> Attendance</div>
        <div className="sidebar-section-label account-label">ACCOUNT</div>
        <div className="sidebar-user"><div className="avatar" aria-hidden="true">{user?.name?.charAt(0)?.toUpperCase() || 'A'}</div><div className="sidebar-user-info"><strong>{user?.name}</strong><span>{user?.role === 'superadmin' ? 'Superadmin' : 'Administrator'}</span></div></div>
      </aside>

      <main className="main-content attendance-content">
        <header className="topbar"><div><p className="eyebrow">WORKSPACE / ATTENDANCE</p><h1>Attendance review</h1></div><button className="secondary-button" onClick={logout}>Sign out</button></header>
        {error && <div className="management-message error-message attendance-message" role="alert">{error}</div>}
        {notice && <div className="management-message success-message attendance-message" role="status">{notice}</div>}
        <section className="management-list correction-history">
          <div className="management-list-header"><div><h2>Correction requests <span className="count-badge">{pendingRequests.length} pending</span></h2><p>Review and approve or reject employee-proposed attendance changes.</p></div><button className="secondary-button" type="button" onClick={loadData} disabled={loading}>Refresh</button></div>
          {loading ? <p className="empty-state">Loading correction requests…</p> : pendingRequests.length === 0 ? <p className="empty-state">No pending correction requests.</p> : (
            <div className="review-grid">
              {pendingRequests.map((request) => (
                <article className="review-card" key={request._id}>
                  <div className="review-card-header"><div><strong>{request.employeeId?.userId?.name || 'Employee'}</strong><span>{request.employeeId?.employeeCode} · {request.employeeId?.department}</span></div><span className="status-pill">pending</span></div>
                  <p className="review-reason">{request.reason}</p>
                  <div className="requested-time-grid">
                    {request.requestedCheckIn && <div><span>REQUESTED CHECK IN</span><strong>{formatDateTime(request.requestedCheckIn)}</strong></div>}
                    {request.requestedCheckOut && <div><span>REQUESTED CHECK OUT</span><strong>{formatDateTime(request.requestedCheckOut)}</strong></div>}
                  </div>
                  <p className="review-current">Recorded: {formatDateTime(request.attendanceId?.checkIn)} – {formatDateTime(request.attendanceId?.checkOut)}</p>
                  <div className="review-actions">
                    <button className="primary-button approve-button" type="button" disabled={processingId === request._id} onClick={() => review(request, 'approved')}>{processingId === request._id ? 'Saving…' : 'Approve'}</button>
                    <button className="secondary-button reject-button" type="button" disabled={processingId === request._id} onClick={() => review(request, 'rejected')}>Reject</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="management-list attendance-history">
          <div className="management-list-header"><div><h2>Recorded attendance</h2><p>Latest 500 attendance records across the organization.</p></div></div>
          {loading ? <p className="empty-state">Loading attendance…</p> : records.length === 0 ? <p className="empty-state">No attendance records yet.</p> : (
            <div className="management-table-wrap"><table className="management-table">
              <thead><tr><th>EMPLOYEE</th><th>DATE</th><th>SHIFT</th><th>CHECK IN</th><th>CHECK OUT</th><th>WORKED</th><th>OVERTIME</th><th>STATUS</th></tr></thead>
              <tbody>{records.map((record) => (
                <tr key={record._id}>
                  <td><strong>{record.employeeId?.userId?.name || 'Employee'}</strong><span className="table-subtext">{record.employeeId?.employeeCode || ''}</span></td>
                  <td>{new Date(record.date).toLocaleDateString()}</td>
                  <td>{record.shiftId?.name || '—'}</td>
                  <td>{formatDateTime(record.checkIn)}</td>
                  <td>{formatDateTime(record.checkOut)}</td>
                  <td>{minutesToHours(record.workingMinutes)}</td>
                  <td>{minutesToHours(record.overtimeMinutes)}</td>
                  <td><span className={`status-pill ${record.attendanceStatus === 'present' || record.attendanceStatus === 'late' ? 'active' : 'inactive'}`}>{record.attendanceStatus.replace('_', ' ')}</span></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      </main>
    </div>
  );
}

export default function AttendancePage() {
  const { user, logout } = useAuth();
  return user?.role === 'admin' || user?.role === 'superadmin'
    ? <AdminAttendance user={user} logout={logout} />
    : <EmployeeAttendance user={user} logout={logout} />;
}
