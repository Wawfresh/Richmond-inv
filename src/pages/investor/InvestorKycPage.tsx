import React, { useEffect, useState } from 'react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { INVESTOR_NAV } from './InvestorDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

export function InvestorKycPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [documentType, setDocumentType] = useState<'passport' | 'national_id' | 'drivers_licence'>('passport');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issuingCountry, setIssuingCountry] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [addressProofType, setAddressProofType] = useState('Utility Bill');
  const [investorNotes, setInvestorNotes] = useState('');
  const [idFile, setIdFile] = useState<File | null>(null);
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [supportFile, setSupportFile] = useState<File | null>(null);

  const loadKyc = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/investor/kyc');
      setData(res);
    } catch (err: any) {
      setError(err?.message || 'Unable to load KYC records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKyc();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!idFile || !addressFile) {
      setError('Please upload both your identity document and proof of address.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('documentType', documentType);
      formData.append('documentNumber', documentNumber);
      formData.append('issuingCountry', issuingCountry);
      formData.append('expiryDate', expiryDate);
      formData.append('addressProofType', addressProofType);
      formData.append('investorNotes', investorNotes);
      formData.append('identityDocument', idFile);
      formData.append('addressProofDocument', addressFile);
      if (supportFile) formData.append('supportingDocument', supportFile);

      const res = await apiRequest<{ submissionReference: string }>('/api/investor/kyc', {
        method: 'POST',
        body: formData,
      });
      setSuccess(`KYC package ${res.submissionReference} submitted securely for compliance review.`);
      setDocumentNumber('');
      setInvestorNotes('');
      setIdFile(null);
      setAddressFile(null);
      setSupportFile(null);
      await loadKyc();
    } catch (err: any) {
      setError(err?.message || 'KYC submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalShell portalTitle="Investor Portal" breadcrumbLabel="KYC Verification" navItems={INVESTOR_NAV} variant="investor">
      <div className="space-y-8">
        <div className="bg-white border border-[#E5E8EE] p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">Investor Identity Verification (KYC)</h1>
            <p className="text-sm text-[#4A5260] mt-1">
              Documents are stored outside public directories and restricted to compliance personnel.
            </p>
          </div>
          <div className="space-y-1 text-right">
            <div className="text-[11px] uppercase tracking-wider text-[#4A5260]">Current Status</div>
            <StatusBadge status={data?.kycStatus || 'not_submitted'} />
          </div>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {success && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Submission Form */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 bg-white border border-[#E5E8EE] p-7 space-y-5">
            <h2 className="font-serif text-2xl font-semibold text-[#0B172A]">Submit Verification Package</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Identity Document Type *</label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                >
                  <option value="passport">Passport</option>
                  <option value="national_id">National Identity Document</option>
                  <option value="drivers_licence">Driver's Licence</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Document Number *</label>
                <input
                  type="text"
                  required
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm font-mono border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Issuing Country *</label>
                <input
                  type="text"
                  required
                  value={issuingCountry}
                  onChange={(e) => setIssuingCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Expiry Date *</label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Address Proof Type *</label>
                <select
                  value={addressProofType}
                  onChange={(e) => setAddressProofType(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-[#D6DAE2] bg-[#FCFBF8]"
                >
                  <option value="Utility Bill">Utility Bill</option>
                  <option value="Bank Statement">Bank Statement</option>
                  <option value="Government Residency Letter">Government Residency Letter</option>
                </select>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1">
                  Identity Document File (PDF / JPG / PNG) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setIdFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#4A5260] file:mr-4 file:py-2 file:px-4 file:border file:border-[#D6DAE2] file:bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1">
                  Proof of Address File (PDF / JPG / PNG) *
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setAddressFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#4A5260] file:mr-4 file:py-2 file:px-4 file:border file:border-[#D6DAE2] file:bg-[#FCFBF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1C2026] mb-1">
                  Supporting Document (Optional)
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => setSupportFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-[#4A5260] file:mr-4 file:py-2 file:px-4 file:border file:border-[#D6DAE2] file:bg-[#FCFBF8]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#1C2026] mb-1.5">Notes for Compliance</label>
              <textarea
                rows={2}
                value={investorNotes}
                onChange={(e) => setInvestorNotes(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542] disabled:opacity-60"
            >
              {submitting ? 'Uploading Documents...' : 'Submit KYC Verification'}
            </button>
          </form>

          {/* Submissions & History */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-[#E5E8EE] p-6 space-y-4">
              <h2 className="font-serif text-xl font-semibold text-[#0B172A]">Submission History</h2>
              {loading ? (
                <div className="h-24 bg-[#EFECE3]" />
              ) : (data?.submissions || []).length === 0 ? (
                <p className="text-xs text-[#4A5260]">No KYC packages submitted yet.</p>
              ) : (
                <div className="divide-y divide-[#E5E8EE]">
                  {data.submissions.map((sub: any) => (
                    <div key={sub.id} className="py-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-[#0B172A]">{sub.submission_reference}</span>
                        <StatusBadge status={sub.status} />
                      </div>
                      <div className="text-[#4A5260]">
                        {sub.document_type.replace(/_/g, ' ')} · {sub.issuing_country} · {formatDateTime(sub.created_at)}
                      </div>
                      {sub.admin_comments && (
                        <div className="p-2 bg-[#FCFBF8] border border-[#E5E8EE] text-[#1C2026]">
                          Compliance Comment: {sub.admin_comments}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(data.documents || [])
                          .filter((d: any) => d.kyc_submission_id === sub.id)
                          .map((d: any) => (
                            <a
                              key={d.id}
                              href={`/api/investor/kyc/documents/${d.id}`}
                              className="underline text-[#0B172A]"
                            >
                              {d.category}: {d.original_filename}
                            </a>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}
