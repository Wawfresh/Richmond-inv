import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CorporateLayout } from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../lib/api';

export function LoginPage() {
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
      const res = await apiRequest<{ user?: { accountType?: string }; csrfToken?: string; sessionToken?: string }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }
      );
      applyAuthSession(res as any);
      navigate(res?.user?.accountType === 'admin' ? '/admin' : '/portal', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Sign in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CorporateLayout>
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white border border-[#E5E8EE] p-8 space-y-6">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">Account Access</div>
            <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Sign In</h1>
            <p className="text-xs text-[#4A5260]">Access your RICHMOND-INV portal.</p>
          </div>

          {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Email Address</label>
              <input
                type="email"
                required
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8] focus:outline-none focus:border-[#0B172A]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8] focus:outline-none focus:border-[#0B172A]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] disabled:opacity-60"
            >
              {submitting ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="pt-4 border-t border-[#E5E8EE] flex flex-col gap-2 text-xs text-[#4A5260]">
            <Link to="/forgot-password" className="text-[#0B172A] font-medium hover:underline">
              Forgot password? Reset credentials
            </Link>
            <div>
              New investor?{' '}
              <Link to="/register" className="text-[#0B172A] font-semibold hover:underline">
                Complete investor registration
              </Link>
            </div>
          </div>
        </div>
      </div>
    </CorporateLayout>
  );
}

export function RegisterPage() {
  const { applyAuthSession, refreshSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: '',
    middleName: '',
    lastName: '',
    email: '',
    telephone: '',
    dateOfBirth: '',
    countryOfResidence: '',
    residentialAddress: '',
    city: '',
    stateRegion: '',
    postalCode: '',
    password: '',
    passwordConfirmation: '',
    acceptTerms: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      applyAuthSession(res);
      await refreshSession();
      navigate('/portal');
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CorporateLayout>
      <div className="max-w-3xl mx-auto px-6 py-14">
        <div className="bg-white border border-[#E5E8EE] p-8 sm:p-10 space-y-6">
          <div className="space-y-1 border-b border-[#E5E8EE] pb-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">Investor Onboarding</div>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#0B172A]">Investor Account Registration</h1>
            <p className="text-sm text-[#4A5260]">
              Enter accurate legal and residential information. Your account number is issued immediately upon registration.
            </p>
          </div>

          {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">First Name *</label>
                <input
                  type="text"
                  required
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Middle Name</label>
                <input
                  type="text"
                  value={form.middleName}
                  onChange={(e) => setForm({ ...form, middleName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Last Name *</label>
                <input
                  type="text"
                  required
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Email Address *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Telephone Number *</label>
                <input
                  type="tel"
                  required
                  value={form.telephone}
                  onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={form.dateOfBirth}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Country of Residence *</label>
                <input
                  type="text"
                  required
                  value={form.countryOfResidence}
                  onChange={(e) => setForm({ ...form, countryOfResidence: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Residential Address *</label>
                <input
                  type="text"
                  required
                  value={form.residentialAddress}
                  onChange={(e) => setForm({ ...form, residentialAddress: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">City *</label>
                <input
                  type="text"
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">State or Region *</label>
                <input
                  type="text"
                  required
                  value={form.stateRegion}
                  onChange={(e) => setForm({ ...form, stateRegion: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Postal Code *</label>
                <input
                  type="text"
                  required
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Password (min 10 chars) *</label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Confirm Password *</label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={form.passwordConfirmation}
                  onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 text-xs text-[#4A5260] pt-2">
              <input
                type="checkbox"
                checked={form.acceptTerms}
                onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                I confirm that the above details are accurate and I accept the RICHMOND-INV{' '}
                <Link to="/terms-conditions" className="text-[#0B172A] underline">
                  Terms & Conditions
                </Link>
                ,{' '}
                <Link to="/privacy-policy" className="text-[#0B172A] underline">
                  Privacy Policy
                </Link>
                , and{' '}
                <Link to="/investment-risk-disclosures" className="text-[#0B172A] underline">
                  Investment Risk Disclosures
                </Link>
                .
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] disabled:opacity-60"
            >
              {submitting ? 'Creating Investor Account...' : 'Complete Investor Registration'}
            </button>
          </form>

          <div className="text-xs text-[#4A5260] pt-3 border-t border-[#E5E8EE]">
            Already registered?{' '}
            <Link to="/login" className="text-[#0B172A] font-semibold hover:underline">
              Sign in to Investor Portal
            </Link>
          </div>
        </div>
      </div>
    </CorporateLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [previewToken, setPreviewToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setPreviewToken('');
    setSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; previewResetToken?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
      if (res.previewResetToken) setPreviewToken(res.previewResetToken);
    } catch (err: any) {
      setError(err?.message || 'Unable to process password reset request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CorporateLayout>
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white border border-[#E5E8EE] p-8 space-y-6">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">Credential Recovery</div>
            <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Forgot Password</h1>
            <p className="text-xs text-[#4A5260]">
              Enter your registered email address to issue a time-limited password reset token.
            </p>
          </div>

          {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
          {message && (
            <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348] space-y-2">
              <p>{message}</p>
              {previewToken && (
                <div className="pt-2 border-t border-[#146348]/20">
                  <div className="font-semibold">Development Preview Reset Token:</div>
                  <div className="font-mono break-all mt-1">{previewToken}</div>
                  <Link
                    to={`/reset-password?token=${encodeURIComponent(previewToken)}`}
                    className="inline-block mt-2 underline font-semibold"
                  >
                    Proceed to Reset Password
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Registered Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542]"
            >
              {submitting ? 'Issuing Reset Token...' : 'Request Password Reset'}
            </button>
          </form>

          <div className="pt-4 border-t border-[#E5E8EE] flex justify-between text-xs">
            <Link to="/login" className="text-[#0B172A] hover:underline">
              Back to Sign In
            </Link>
            <Link to="/reset-password" className="text-[#0B172A] hover:underline">
              Have a reset token?
            </Link>
          </div>
        </div>
      </div>
    </CorporateLayout>
  );
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password, passwordConfirmation }),
      });
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err?.message || 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CorporateLayout>
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white border border-[#E5E8EE] p-8 space-y-6">
          <div className="space-y-1">
            <div className="text-xs uppercase tracking-[0.18em] text-[#997837] font-semibold">Security</div>
            <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Reset Password</h1>
          </div>

          {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
          {done && (
            <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">
              Password updated successfully. Redirecting to sign in...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Reset Token</label>
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">New Password (min 10 chars)</label>
              <input
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Confirm New Password</label>
              <input
                type="password"
                required
                minLength={10}
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542]"
            >
              {submitting ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </CorporateLayout>
  );
}
