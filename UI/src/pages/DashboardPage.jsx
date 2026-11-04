import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const roleLabels = {
  superadmin: 'Superadmin',
  admin: 'Administrator',
  user: 'Employee',
};

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [apiStatus, setApiStatus] = useState('Checking');

  useEffect(() => {
    let active = true;
    apiRequest('/health')
      .then(() => active && setApiStatus('Connected'))
      .catch(() => active && setApiStatus('Unavailable'));

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="sidebar-brand" href="/" aria-label="Workforce Attendance home">
          <span className="brand-mark small" aria-hidden="true">W</span>
          <span>Workforce<span className="brand-subtitle">ATTENDANCE</span></span>
        </a>
        <div className="sidebar-section-label">WORKSPACE</div>
        <div className="sidebar-link active"><span aria-hidden="true">◫</span> Overview</div>
        <Link className="sidebar-link" to="/attendance"><span aria-hidden="true">◷</span> {user?.role === 'user' ? 'My attendance' : 'Attendance'}</Link>
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <Link className="sidebar-link management-sidebar-link" to="/manage"><span aria-hidden="true">⚙</span> Management</Link>
        )}
        <div className="sidebar-section-label account-label">ACCOUNT</div>
        <div className="sidebar-user">
          <div className="avatar" aria-hidden="true">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
          <div className="sidebar-user-info">
            <strong>{user?.name}</strong>
            <span>{roleLabels[user?.role] || 'Account'}</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">WORKSPACE / OVERVIEW</p>
            <h1>Dashboard</h1>
          </div>
          <button className="secondary-button" onClick={logout}>Sign out</button>
        </header>

        <section className="welcome-panel">
          <div>
            <p className="eyebrow light-eyebrow">YOUR WORKSPACE</p>
            <h2>Hello, {user?.name?.split(' ')[0] || 'there'}.</h2>
            <p>Your account is signed in and ready to use.</p>
          </div>
          <div className="welcome-icon" aria-hidden="true">✓</div>
        </section>

        <section className="summary-grid" aria-label="Account and service status">
          <article className="summary-card">
            <span className="card-icon purple" aria-hidden="true">◎</span>
            <p className="card-label">YOUR ROLE</p>
            <strong>{roleLabels[user?.role] || user?.role}</strong>
            <span className="card-detail">Permissions are checked by the server</span>
          </article>
          <article className="summary-card">
            <span className="card-icon green" aria-hidden="true">↗</span>
            <p className="card-label">API STATUS</p>
            <strong>{apiStatus}</strong>
            <span className="card-detail">Backend connection</span>
          </article>
          <article className="summary-card">
            <span className="card-icon orange" aria-hidden="true">◷</span>
            <p className="card-label">SESSION</p>
            <strong>Active</strong>
            <span className="card-detail">Stored for this browser tab</span>
          </article>
        </section>

        <section className="dashboard-next-step">
          <div>
            <p className="card-label">{user?.role === 'user' ? 'YOUR TIME, CLEARLY TRACKED' : 'TEAM ATTENDANCE'}</p>
            <strong>{user?.role === 'user' ? 'Check in, review your hours, and request a correction.' : 'Review attendance records and employee correction requests.'}</strong>
          </div>
          <Link className="primary-button dashboard-action" to="/attendance">
            {user?.role === 'user' ? 'Open my attendance' : 'Open attendance'}
          </Link>
        </section>

        <section className="security-notice">
          <span className="notice-icon" aria-hidden="true">i</span>
          <div>
            <strong>Account security</strong>
            <p>Signing out clears this tab’s session. Access is enforced by the backend on every protected API request.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
