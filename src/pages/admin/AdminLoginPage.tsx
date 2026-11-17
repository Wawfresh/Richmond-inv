import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';

export function AdminLoginPage() {
  const { applyAuthSession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      applyAuthSession(res);
      navigate('/admin', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Administrator sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#060E1C] text-[#FCFBF8] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#0B172A] border border-[#1E365C] p-8 sm:p-10 space-y-6">
        <div className="space-y-2 border-b border-[#1E365C] pb-5">
          <div className="text-xs uppercase tracking-[0.2em] text-[#C9A968]">Restricted Governance Console</div>
          <h1 className="font-serif text-3xl font-semibold text-[#FCFBF8]">RICHMOND-INV Administration</h1>
          <p className="text-xs text-[#A8B2C1]">
            Dedicated authentication for authorized Compliance, Treasury, and Operations administrators.
          </p>
        </div>

        {error && (
          <div className="p-3 border border-[#DC2626]/40 bg-[#DC2626]/10 text-xs text-[#FCA5A5]">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#D6DAE2] mb-1.5">Administrator Email</label>
            <input
              type="email"
              required
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#D6DAE2] mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-[#1E365C] bg-[#060E1C] text-[#FCFBF8] focus:outline-none focus:border-[#C9A968]"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 text-xs font-semibold bg-[#B5924C] text-[#060E1C] hover:bg-[#C9A968] disabled:opacity-60"
          >
            {submitting ? 'Authenticating...' : 'Sign In to Administrator Portal'}
          </button>
        </form>

        <div className="pt-4 border-t border-[#1E365C] flex items-center justify-between text-xs text-[#A8B2C1]">
          <Link to="/" className="hover:text-white">
            Return to Corporate Website
          </Link>
          <Link to="/login" className="hover:text-white">
            Investor Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
