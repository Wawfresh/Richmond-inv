import { useCallback, useEffect, useState } from 'react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { ADMIN_NAV } from './AdminDashboardPage';
import { apiRequest } from '../../lib/api';
import { formatDateTime } from '../../lib/format';

export function AdminKycPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsById, setCommentsById] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadKyc = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ submissions: any[] }>('/api/admin/kyc');
      setSubmissions(res.submissions || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load KYC submissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKyc();
    const onRefresh = () => loadKyc();
    window.addEventListener('richmond:admin-refresh', onRefresh);
    return () => window.removeEventListener('richmond:admin-refresh', onRefresh);
  }, [loadKyc]);

  const submitDecision = async (id: number, status: 'under_review' | 'additional_info_required' | 'approved' | 'rejected') => {
    const comments =
      commentsById[id]?.trim() ||
      (status === 'approved'
        ? 'Identity and residential documents verified.'
        : status === 'under_review'
        ? 'Assigned to compliance review.'
        : 'Compliance review completed.');
    setError('');
    setFeedback('');
    try {
      await apiRequest(`/api/admin/kyc/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ status, comments }),
      });
      setFeedback(`KYC submission updated to ${status.replace(/_/g, ' ')}.`);
      await loadKyc();
    } catch (err: any) {
      setError(err?.message || 'Failed to update KYC decision.');
    }
  };

  return (
    <PortalShell portalTitle="Administrator Portal" breadcrumbLabel="KYC Compliance" navItems={ADMIN_NAV} variant="admin">
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">KYC Compliance Review Queue</h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Inspect private identity & address documents and record compliance verification decisions.
          </p>
        </div>

        {error && <div className="p-3 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">{error}</div>}
        {feedback && <div className="p-3 border border-[#146348]/30 bg-[#146348]/5 text-xs text-[#146348]">{feedback}</div>}

        {loading ? (
          <div className="h-40 bg-[#EFECE3]" />
        ) : submissions.length === 0 ? (
          <div className="bg-white border border-[#E5E8EE] p-8 text-sm text-[#4A5260]">No KYC packages submitted yet.</div>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => (
              <div key={sub.id} className="bg-white border border-[#E5E8EE] p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8EE] pb-3">
                  <div>
                    <div className="font-mono text-xs text-[#997837] font-semibold">
                      {sub.submission_reference} · {sub.account_number}
                    </div>
                    <div className="font-serif text-xl font-semibold text-[#0B172A]">
                      {sub.first_name} {sub.last_name} ({sub.email})
                    </div>
                  </div>
                  <StatusBadge status={sub.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <strong>Document Type:</strong> {sub.document_type.replace(/_/g, ' ')}
                  </div>
                  <div>
                    <strong>Doc Number:</strong> <span className="font-mono">{sub.document_number}</span>
                  </div>
                  <div>
                    <strong>Issuing Country:</strong> {sub.issuing_country}
                  </div>
                  <div>
                    <strong>Submitted:</strong> {formatDateTime(sub.created_at)}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs">
                  {(sub.documents || []).map((doc: any) => (
                    <a
                      key={doc.id}
                      href={`/api/admin/kyc/documents/${doc.id}`}
                      className="px-3 py-1.5 border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A] font-medium hover:border-[#0B172A]"
                    >
                      Download {doc.category}: {doc.original_filename}
                    </a>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <input
                    type="text"
                    placeholder="Enter compliance review comments..."
                    value={commentsById[sub.id] ?? sub.admin_comments ?? ''}
                    onChange={(e) => setCommentsById((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 text-xs border border-[#D6DAE2] bg-[#FCFBF8]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => submitDecision(sub.id, 'under_review')}
                      className="px-3 py-2 text-xs border border-[#D6DAE2] font-semibold"
                    >
                      Under Review
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDecision(sub.id, 'additional_info_required')}
                      className="px-3 py-2 text-xs border border-[#9A3412]/40 text-[#9A3412] font-semibold"
                    >
                      Request Info
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDecision(sub.id, 'approved')}
                      className="px-4 py-2 text-xs bg-[#146348] text-white font-semibold"
                    >
                      Approve KYC
                    </button>
                    <button
                      type="button"
                      onClick={() => submitDecision(sub.id, 'rejected')}
                      className="px-4 py-2 text-xs bg-[#991B1B] text-white font-semibold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
