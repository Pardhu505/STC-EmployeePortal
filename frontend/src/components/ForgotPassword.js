import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | sent | error
  const [message, setMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus('sent');
        setMessage(data.message || 'If an account with that email exists, a reset link has been sent.');
      } else {
        setStatus('error');
        setMessage(data.detail || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Could not reach the server. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0D5E5A] to-[#0A7871] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-900">Forgot password?</h1>
        <p className="text-gray-500 text-sm mt-2">
          Enter your work email and we'll send you a link to reset your password.
        </p>

        {status === 'sent' ? (
          <div className="mt-6 rounded-lg bg-teal-50 border border-teal-200 p-4 text-teal-800 text-sm">
            {message}
            <div className="mt-4">
              <Link to="/login" className="text-[#0A7871] font-semibold hover:underline">Back to login</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@showtimeconsulting.in"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0A7871]"
                required
              />
            </div>
            {status === 'error' && (
              <div className="text-sm text-red-600">{message}</div>
            )}
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-[#0A7871] text-white font-semibold py-2.5 hover:bg-[#0D5E5A] transition-colors disabled:opacity-60"
            >
              {status === 'loading' ? 'Sending…' : 'Send reset link'}
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

export default ForgotPassword;
