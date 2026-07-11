// BiometricPanel.js
// Routes the Live Attendance tab by role:
//   - Full access (admin or pardhasaradhi): toggle between the company-wide
//     "today" view and their own day-wise team report.
//   - Everyone else: BiometricMyTeam decides team (manager) vs self (employee).
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BiometricLiveLogs from './BiometricLiveLogs';
import BiometricMyTeam from './BiometricMyTeam';

export default function BiometricPanel() {
  const { user, isAdmin } = useAuth();
  const fullAccess = isAdmin ||
    (user?.email || '').toLowerCase() === 'pardhasaradhi@showtimeconsulting.in';
  const [view, setView] = useState('company');

  if (!fullAccess) return <BiometricMyTeam />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, padding: '16px 24px 0', flexWrap: 'wrap' }}>
        <button onClick={() => setView('company')}
          style={view === 'company' ? tabOn : tabOff}>Company (today)</button>
        <button onClick={() => setView('company_range')}
          style={view === 'company_range' ? tabOn : tabOff}>Company (day-wise)</button>
        <button onClick={() => setView('team')}
          style={view === 'team' ? tabOn : tabOff}>My Team (day-wise)</button>
      </div>
      {view === 'company' && <BiometricLiveLogs />}
      {view === 'company_range' && <BiometricMyTeam endpoint="company" />}
      {view === 'team' && <BiometricMyTeam endpoint="team" />}
    </div>
  );
}

const tabBase = { padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 14,
                  border: '1px solid #d7dce1' };
const tabOn = { ...tabBase, background: '#1565c0', color: '#fff', borderColor: '#1565c0' };
const tabOff = { ...tabBase, background: '#fff', color: '#445' };
