// src/components/BiometricLiveLogs.js
// Admin-only live eSSL attendance feed.
// Matches the portal: uses useAuth() for the user, sends the same
// Authorization: Bearer btoa(JSON.stringify(user)) header your other admin
// calls use, and reads API_BASE_URL from ../config/api.

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

const POLL_MS = 30000;

export default function BiometricLiveLogs() {
  const { user, isAdmin } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState([]);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(null);

  const isToday = date === today;

  const authHeader = useCallback(() => ({
    'Authorization': `Bearer ${btoa(JSON.stringify(user))}`,
  }), [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/biometric/summary?date=${date}`,
        { headers: authHeader() }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Request failed (${res.status})`);
      }
      const s = await res.json();
      const emps = s.employees || [];
      setSummary(emps);
      setDevices(s.devices || []);
      setStats(s.stats || null);
      setCount(emps.reduce((n, e) => n + (e.punch_count || 0), 0));
      setUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user, date, authHeader]);

  useEffect(() => {
    load();
    if (!isToday) return;
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load, isToday]);

  const allowedFull = isAdmin || (user?.email || '').toLowerCase() === 'pardhasaradhi@showtimeconsulting.in';
  if (!allowedFull) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#b71c1c' }}>
        This page is for administrators only.
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Biometric Attendance (eSSL)</h2>
        <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 10px',
                       borderRadius: 12, fontSize: 13 }}>{count} punches</span>
        {isToday && <span style={{ fontSize: 12, color: '#888' }}>live · refreshes every 30s</span>}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '16px 0', flexWrap: 'wrap' }}>
        <input type="date" value={date} max={today}
               onChange={(e) => setDate(e.target.value)}
               style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }} />
        <button onClick={load} disabled={loading} style={btn}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        {updated && <span style={{ fontSize: 12, color: '#888' }}>
          updated {updated.toLocaleTimeString('en-IN')}</span>}
      </div>

      {error && <div style={{ background: '#fdecea', color: '#b71c1c', padding: 12,
                              borderRadius: 6, marginBottom: 12 }}>{error}</div>}

      {stats && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          <StatCard label="Total Employees" value={stats.total_employees} color="#1565c0" />
          <StatCard label="Present" value={stats.present} color="#2e7d32" />
          <StatCard label="Absent" value={stats.absent} color="#b71c1c" />
        </div>
      )}

      {devices.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {devices.map((d, i) => (
            <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 999,
              background: d.ok ? '#e8f5e9' : '#fdecea', color: d.ok ? '#2e7d32' : '#b71c1c',
              border: `1px solid ${d.ok ? '#bfe3c4' : '#f3c2bd'}` }}>
              {d.device}{d.ok ? ` · ${d.count}` : ' · offline'}
            </span>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
      <table style={tbl}>
        <thead>
          <tr>
            <th style={th}>Emp ID</th>
            <th style={th}>Emp Name</th>
            <th style={th}>1st Punch-in</th>
            <th style={th}>Last Punch-out</th>
            <th style={th}>Breaks (other punches)</th>
            <th style={th}>Total Break Time</th>
          </tr>
        </thead>
        <tbody>
          {summary.length === 0 && (
            <tr><td colSpan={6} style={empty}>No records for this date.</td></tr>
          )}
          {summary.map((e, i) => (
            <tr key={i} style={{ ...trow, background: i % 2 ? '#fafbfc' : '#fff' }}>
              <td style={td}>{e.user_id}</td>
              <td style={{ ...td, textAlign: 'left' }}>{e.emp_name}</td>
              <td style={td}>
                {e.first_in}
                {e.first_in_device && <span style={devTag}>{e.first_in_device}</span>}
                {e.late && <span style={lateTag}>Late</span>}
              </td>
              <td style={td}>
                {e.last_out || '—'}
                {e.last_out_device && <span style={devTag}>{e.last_out_device}</span>}
              </td>
              <td style={td}>
                {(!e.breaks || e.breaks.length === 0) ? (
                  <span style={{ color: '#aaa' }}>—</span>
                ) : (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {e.breaks.map((b, j) => (
                      <span key={j} style={breakChip}>
                        {b.time}{b.device ? ` (${b.device})` : ''}
                      </span>
                    ))}
                  </span>
                )}
              </td>
              <td style={{ ...td, fontWeight: 600,
                           color: breakMinutes(e.break_time) > 60 ? '#c62828'
                                : breakMinutes(e.break_time) > 0 ? '#b26a00' : '#999' }}>
                {humanBreak(e.break_time)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ flex: '1 1 160px', minWidth: 150, background: '#fff',
      border: '1px solid #eef0f2', borderRadius: 10, padding: '14px 18px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase',
                    letterSpacing: '.4px' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>
        {value ?? '—'}
      </div>
    </div>
  );
}

const devTag = { marginLeft: 6, fontSize: 11, color: '#888' };
const lateTag = { marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#c62828' };
const breakChip = { fontSize: 12, padding: '2px 8px', borderRadius: 999,
                    background: '#eef2f7', color: '#445' };

export function breakMinutes(hhmm) {
  if (!hhmm || hhmm.indexOf(':') < 0) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}
export function humanBreak(hhmm) {
  const mins = breakMinutes(hhmm);
  if (!mins) return '0 m';
  const h = Math.floor(mins / 60), m = mins % 60;
  const parts = [];
  if (h) parts.push(`${h} hr`);
  if (m || !h) parts.push(`${m} m`);
  return parts.join(' ');
}

const btn = { padding: '8px 14px', borderRadius: 6, border: 'none',
              background: '#2e7d32', color: '#fff', cursor: 'pointer' };
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 14,
              border: '1px solid #d7dce1' };
const th = { textAlign: 'center', verticalAlign: 'middle', padding: '11px 10px',
             border: '1px solid #d7dce1', color: '#444', background: '#f2f4f7',
             whiteSpace: 'nowrap', fontWeight: 700 };
const td = { padding: '10px', textAlign: 'center', verticalAlign: 'middle',
             border: '1px solid #e3e7eb' };
const trow = {};
const empty = { padding: 18, color: '#999', textAlign: 'center' };
