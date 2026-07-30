// BiometricMyTeam.js
// Non-admin biometric attendance:
//  - Managers get their team's totals + today's status (tries /team first)
//  - Employees get their own daily records + totals (falls back to /me)
// Uses the same auth header pattern as the rest of the portal.
//
// Adds: Department column, and day-wise Excel/PDF export over the selected
// date range, grouped by department. Export is visible only to EXPORT_EMAILS
// and is ALSO enforced server-side on /api/biometric/export_range.

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';
import { fetchWithRetry } from '../utils/fetchRetry';
import { humanBreak, breakMinutes } from './BiometricLiveLogs';

const EXPORT_EMAILS = [
  'pardhasaradhi@showtimeconsulting.in',
  'admin@showtimeconsulting.in',
];

function canExport(user) {
  const email = String((user && user.email) || '').trim().toLowerCase();
  return EXPORT_EMAILS.indexOf(email) !== -1;
}

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function BiometricMyTeam({ endpoint = 'team' }) {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today);
  const [mode, setMode] = useState('loading');   // 'loading' | 'team' | 'self'
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState({});
  const [opts, setOpts] = useState({ departments: [], states: [] });
  const [fDept, setFDept] = useState('');
  const [fState, setFState] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState('');

  const showExport = canExport(user);

  const authHeader = useCallback(() => ({
    'Authorization': `Bearer ${btoa(JSON.stringify(user))}`,
  }), [user]);

  const loadMeta = useCallback(async (payload) => {
    const emps = (payload && payload.employees) || [];
    const codes = emps.map((e) => e.emp_code).filter(Boolean);
    if (!codes.length) return;
    try {
      const res = await fetchWithRetry(
        `${API_BASE_URL}/api/biometric/employee_meta?codes=${encodeURIComponent(codes.join(','))}`,
        { headers: authHeader() }
      );
      if (res.ok) setMeta(await res.json());
    } catch (e) {
      /* non-fatal: the columns just show a dash */
    }
  }, [authHeader]);

  // Dropdown options, loaded once.
  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetchWithRetry(
          `${API_BASE_URL}/api/biometric/filter_options`,
          { headers: authHeader() }
        );
        if (res.ok && alive) {
          const j = await res.json();
          setOpts({ departments: j.departments || [], states: j.states || [] });
        }
      } catch (e) { /* filters just stay empty */ }
    })();
    return () => { alive = false; };
  }, [user, authHeader]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError('');
    const qs = `from_date=${from}&to_date=${to}`;
    try {
      // Full company day-wise view (admin / pardhasaradhi)
      if (endpoint === 'company') {
        const res = await fetchWithRetry(`${API_BASE_URL}/api/biometric/company?${qs}`, { headers: authHeader() });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.detail || `Request failed (${res.status})`);
        }
        const payload = await res.json();
        setData(payload); setMode('team'); loadMeta(payload); return;
      }
      // Try manager view first
      let res = await fetchWithRetry(`${API_BASE_URL}/api/biometric/team?${qs}`, { headers: authHeader() });
      if (res.ok) {
        const payload = await res.json();
        setData(payload); setMode('team'); loadMeta(payload); return;
      }
      if (res.status !== 403) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Request failed (${res.status})`);
      }
      // Not a manager -> own records
      res = await fetchWithRetry(`${API_BASE_URL}/api/biometric/me?${qs}`, { headers: authHeader() });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Request failed (${res.status})`);
      }
      setData(await res.json()); setMode('self');
    } catch (e) {
      setError(e.message); setMode('self'); setData(null);
    } finally {
      setLoading(false);
    }
  }, [user, from, to, authHeader, endpoint, loadMeta]);

  useEffect(() => { load(); }, [load]);

  const download = useCallback(async (fmt) => {
    setExporting(fmt); setError('');
    const scope = endpoint === 'company' ? 'company' : 'team';
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/biometric/export_range?format=${fmt}&scope=${scope}`
        + `&from_date=${from}&to_date=${to}`
        + (fDept ? `&department=${encodeURIComponent(fDept)}` : '')
        + (fState ? `&state=${encodeURIComponent(fState)}` : ''),
        { headers: authHeader() }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.detail || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const tag = [fState, fDept].filter(Boolean).join('_').replace(/\s+/g, '_');
      a.download = `attendance_${scope}${tag ? '_' + tag : ''}_daywise_${from}_to_${to}.${fmt}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) {
      setError(e.message);
    } finally {
      setExporting('');
    }
  }, [endpoint, from, to, authHeader, fDept, fState]);

  const heading = endpoint === 'company'
    ? 'Company Attendance — day-wise'
    : (mode === 'team' ? 'Team Attendance' : 'My Attendance');

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 4px' }}>{heading} (eSSL)</h2>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '14px 0', flexWrap: 'wrap' }}>
        <label style={lbl}>From <input type="date" value={from} max={to}
          onChange={(e) => setFrom(e.target.value)} style={inp} /></label>
        <label style={lbl}>To <input type="date" value={to} max={today}
          onChange={(e) => setTo(e.target.value)} style={inp} /></label>
        <button onClick={load} disabled={loading} style={btn}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        {mode === 'team' && (
          <>
            <label style={lbl}>State
              <select value={fState} onChange={(e) => setFState(e.target.value)} style={inp}>
                <option value="">All states</option>
                {opts.states.map((s2) => <option key={s2} value={s2}>{s2}</option>)}
              </select>
            </label>
            <label style={lbl}>Department
              <select value={fDept} onChange={(e) => setFDept(e.target.value)} style={inp}>
                <option value="">All departments</option>
                {opts.departments.map((d2) => <option key={d2} value={d2}>{d2}</option>)}
              </select>
            </label>
            {(fState || fDept) && (
              <button onClick={() => { setFState(''); setFDept(''); }} style={clearBtn}>
                Clear
              </button>
            )}
          </>
        )}

        {showExport && mode === 'team' && (
          <span style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button onClick={() => download('xlsx')}
                    disabled={!!exporting || loading}
                    title="Day-wise Excel for this range, one sheet per department"
                    style={xlsBtn}>
              {exporting === 'xlsx' ? 'Preparing…' : '⭳ Excel (day-wise)'}
            </button>
            <button onClick={() => download('pdf')}
                    disabled={!!exporting || loading}
                    title="Day-wise PDF, a section per department"
                    style={pdfBtn}>
              {exporting === 'pdf' ? 'Preparing…' : '⭳ PDF'}
            </button>
          </span>
        )}
      </div>

      {exporting && (
        <div style={infoBox}>
          Building the {exporting === 'xlsx' ? 'Excel workbook' : 'PDF'} for
          {' '}{from} to {to}. A full month across every department can take
          {' '}up to a minute — please keep this tab open.
        </div>
      )}

      {error && <div style={errBox}>{error}</div>}

      {mode === 'team' && data && (
        <TeamView data={data} meta={meta} fDept={fDept} fState={fState} />
      )}
      {mode === 'self' && data && <SelfView data={data} />}
    </div>
  );
}

/* ---------------- Employee's own records ---------------- */
function DayTable({ days }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tbl}>
        <thead><tr>
          <th style={th}>Date</th><th style={th}>Status</th><th style={th}>1st Punch-in</th>
          <th style={th}>Last Punch-out</th><th style={th}>Breaks (other punches)</th>
          <th style={th}>Total Break Time</th><th style={th}>Total Working Hours</th><th style={th}>Late by</th>
        </tr></thead>
        <tbody>
          {days.length === 0 && <tr><td colSpan={8} style={empty}>No records in this range.</td></tr>}
          {days.map((d, i) => (
            <tr key={i} style={{ background: i % 2 ? '#fafbfc' : '#fff' }}>
              <td style={td}>{d.date}<span style={dev}>{d.weekday}</span></td>
              <td style={{ ...td, fontWeight: 600, color: statusColor(d.status) }}>{d.status || '—'}</td>
              <td style={td}>
                {d.first_in || '—'}{d.first_in_device && <span style={dev}>{d.first_in_device}</span>}
                {d.late && <span style={late}>Late</span>}
              </td>
              <td style={td}>{d.last_out || '—'}{d.last_out_device && <span style={dev}>{d.last_out_device}</span>}</td>
              <td style={td}>
                {(!d.breaks || d.breaks.length === 0) ? <span style={{ color: '#bbb' }}>—</span> : (
                  <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {d.breaks.map((b, j) => <span key={j} style={chip}>{b.time}{b.device ? ` (${b.device})` : ''}</span>)}
                  </span>)}
              </td>
              <td style={{ ...td, fontWeight: 600, color: breakMinutes(d.break_time) > 60 ? '#c62828' : '#555' }}>
                {humanBreak(d.break_time)}</td>
              <td style={{ ...td, fontWeight: 600, color: '#1565c0' }}>
                {d.working_hours ? humanBreak(d.working_hours) : '—'}</td>
              <td style={{ ...td, color: d.late_by && d.late_by !== '00:00:00' ? '#c62828' : '#999' }}>
                {d.late_by || '00:00:00'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SelfView({ data }) {
  const emp = data.employee;
  if (!emp) return <div style={{ color: '#888' }}>No attendance found.</div>;
  return (
    <>
      <div style={cardRow}>
        <Stat label="Working Days" value={emp.working_days} color="#1565c0" />
        <Stat label="Present Days" value={emp.present_days} color="#2e7d32" />
        <Stat label="Absent Days" value={emp.absent_days} color="#c62828" />
        <Stat label="Late Days" value={emp.late_days} color="#b26a00" />
      </div>
      <DayTable days={emp.days} />
    </>
  );
}

/* ---------------- Manager's team (expandable, day-wise) ---------------- */
function TeamView({ data, meta, fDept, fState }) {
  const t = data.team_totals || {};
  const [open, setOpen] = useState(null);
  const mmap = meta || {};
  const infoFor = (code) => mmap[code] || {};
  const all = data.employees || [];
  const employees = all.filter((e) => {
    const m = infoFor(e.emp_code);
    if (fDept && String(m.department || '') !== fDept) return false;
    if (fState && String(m.state || '') !== fState) return false;
    return true;
  });
  const filtered = employees.length !== all.length;
  return (
    <>
      <div style={cardRow}>
        <Stat label="Team Members" value={t.members} color="#1565c0" />
        <Stat label="Present Today" value={t.present_today} color="#2e7d32" />
        <Stat label="Absent Today" value={t.absent_today} color="#c62828" />
        <Stat label="Late (range)" value={t.late_days} color="#b26a00" />
      </div>
      {filtered && (
        <div style={{ fontSize: 13, color: '#0d5e5a', marginBottom: 8 }}>
          Showing <strong>{employees.length}</strong> of {all.length} employees
          {fState ? ` · ${fState}` : ''}{fDept ? ` · ${fDept}` : ''}
          {' '}— the download will contain exactly this selection.
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={tbl}>
          <thead><tr>
            <th style={th}></th><th style={th}>Emp Name</th><th style={th}>Emp Code</th>
            <th style={th}>State</th>
            <th style={th}>Department</th>
            <th style={th}>Present</th><th style={th}>Absent</th><th style={th}>Late</th>
          </tr></thead>
          <tbody>
            {employees.length === 0 && (
              <tr><td colSpan={8} style={empty}>
                {all.length ? 'No employees match these filters.' : 'No team records.'}
              </td></tr>
            )}
            {employees.map((e, i) => (
              <React.Fragment key={i}>
                <tr style={{ background: open === i ? '#eef4ff' : (i % 2 ? '#fafbfc' : '#fff'), cursor: 'pointer' }}
                    onClick={() => setOpen(open === i ? null : i)}>
                  <td style={{ ...td, width: 30 }}>{open === i ? '▾' : '▸'}</td>
                  <td style={{ ...td, fontWeight: 600 }}>{e.emp_name}</td>
                  <td style={td}>{e.emp_code}</td>
                  <td style={td}>
                    {infoFor(e.emp_code).state || <span style={{ color: '#bbb' }}>—</span>}
                  </td>
                  <td style={td}>
                    {infoFor(e.emp_code).department || <span style={{ color: '#bbb' }}>—</span>}
                  </td>
                  <td style={{ ...td, color: '#2e7d32', fontWeight: 600 }}>{e.present_days}</td>
                  <td style={{ ...td, color: '#c62828', fontWeight: 600 }}>{e.absent_days}</td>
                  <td style={{ ...td, color: '#b26a00', fontWeight: 600 }}>{e.late_days}</td>
                </tr>
                {open === i && (
                  <tr><td colSpan={8} style={{ padding: 12, background: '#f7f9fc' }}>
                    <div style={{ fontWeight: 600, margin: '2px 0 8px' }}>
                      Detailed report — {e.emp_name} ({e.emp_code})
                      {infoFor(e.emp_code).department ? ` · ${infoFor(e.emp_code).department}` : ''}
                      {infoFor(e.emp_code).state ? ` · ${infoFor(e.emp_code).state}` : ''}
                    </div>
                    <DayTable days={e.days || []} />
                  </td></tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function statusColor(s) {
  if (s === 'Present') return '#2e7d32';
  if (s === 'Absent') return '#c62828';
  if (s === 'Week Off') return '#1565c0';
  return '#888';
}

function Stat({ label, value, color }) {
  return (
    <div style={statCard}>
      <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 4 }}>{value ?? '—'}</div>
    </div>
  );
}

const lbl = { fontSize: 13, color: '#555', display: 'flex', gap: 6, alignItems: 'center' };
const inp = { padding: 8, borderRadius: 6, border: '1px solid #ccc' };
const btn = { padding: '8px 14px', borderRadius: 6, border: 'none', background: '#2e7d32', color: '#fff', cursor: 'pointer' };
const clearBtn = { padding: '8px 12px', borderRadius: 6, border: '1px solid #ccc',
                   background: '#fff', color: '#555', cursor: 'pointer', fontSize: 13 };
const xlsBtn = { padding: '8px 14px', borderRadius: 6, border: '1px solid #1b7a43',
                 background: '#1b7a43', color: '#fff', cursor: 'pointer', fontWeight: 600 };
const pdfBtn = { padding: '8px 14px', borderRadius: 6, border: '1px solid #b3352b',
                 background: '#b3352b', color: '#fff', cursor: 'pointer', fontWeight: 600 };
const errBox = { background: '#fdecea', color: '#b71c1c', padding: 12, borderRadius: 6, marginBottom: 12 };
const infoBox = { background: '#e8f4f3', color: '#0d5e5a', padding: 12, borderRadius: 6, marginBottom: 12, fontSize: 13 };
const cardRow = { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 };
const statCard = { flex: '1 1 160px', minWidth: 150, background: '#fff', border: '1px solid #eef0f2',
                   borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 14, border: '1px solid #d7dce1' };
const th = { textAlign: 'center', verticalAlign: 'middle', padding: '11px 10px', border: '1px solid #d7dce1',
             color: '#444', background: '#f2f4f7', whiteSpace: 'nowrap', fontWeight: 700 };
const td = { padding: '10px', textAlign: 'center', verticalAlign: 'middle', border: '1px solid #e3e7eb' };
const dev = { marginLeft: 6, fontSize: 11, color: '#888' };
const chip = { fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#eef2f7', color: '#445' };
const late = { marginLeft: 6, fontSize: 11, fontWeight: 700, color: '#c62828' };
const empty = { padding: 18, color: '#999', textAlign: 'center' };
