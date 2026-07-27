import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const ResetPassword = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (pwd.length < 6) { setStatus('error'); setMessage('Password must be at least 6 characters.'); return; }
    if (pwd !== confirm) { setStatus('error'); setMessage('Passwords do not match.'); return; }
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: pwd }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus('done');
        setMessage(data.message || 'Your password has been reset.');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setStatus('error');
        setMessage(data.detail || 'Could not reset password.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Could not reach the server. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0D5E5A] to-[#0A7871] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>

        {!token ? (
          <div className="mt-6 text-sm text-red-600">
            This reset link is invalid or incomplete. Please request a new one from the{' '}
            <Link to="/forgot-password" className="text-[#0A7871] font-semibold hover:underline">forgot password</Link> page.
          </div>
        ) : status === 'done' ? (
          <div className="mt-6 rounded-lg bg-teal-50 border border-teal-200 p-4 text-teal-800 text-sm">
            {message} Redirecting to login…
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A7871]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A7871]"
                required
              />
            </div>
            {status === 'error' && <div className="text-sm text-red-600">{message}</div>}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-[#0A7871] text-white font-semibold py-2.5 hover:bg-[#0D5E5A] transition-colors disabled:opacity-60"
            >
              {status === 'loading' ? 'Resetting…' : 'Reset password'}
            </button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-gray-500 hover:text-[#0A7871]">Back to login</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
