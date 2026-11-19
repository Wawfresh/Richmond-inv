import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Download, Eye, FileText, Lock, X } from 'lucide-react';
import { PortalShell } from '../../components/PortalShell';
import { StatusBadge } from '../../components/StatusBadge';
import { ADMIN_NAV } from './AdminDashboardPage';
import { apiDownload, apiFetchBlob, apiRequest } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/format';

function isImageDoc(doc: any): boolean {
  const mime = String(doc?.mime_type || '').toLowerCase();
  const name = String(doc?.original_filename || '').toLowerCase();
  return mime.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|jfif)$/i.test(name);
}

function isPdfDoc(doc: any): boolean {
  const mime = String(doc?.mime_type || '').toLowerCase();
  const name = String(doc?.original_filename || '').toLowerCase();
  return mime.includes('pdf') || name.endsWith('.pdf');
}

function formatCategory(category: string): string {
  if (category === 'identity') return 'Identity Document';
  if (category === 'proof_of_address') return 'Proof of Address';
  if (category === 'supporting') return 'Supporting Document';
  return String(category || 'Document').replace(/_/g, ' ');
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function AdminKycDocCard({
  doc,
  onPreview,
  onDownload,
}: {
  doc: any;
  onPreview: (doc: any) => void;
  onDownload: (doc: any) => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);
  const canShowImageThumb = isImageDoc(doc);

  useEffect(() => {
    if (!canShowImageThumb) return;
    let active = true;
    let createdUrl: string | null = null;
    apiFetchBlob(`/api/admin/kyc/documents/${doc.id}?inline=1`)
      .then(({ blob }) => {
        if (!active) return;
        createdUrl = URL.createObjectURL(blob);
        setThumbUrl(createdUrl);
      })
      .catch(() => {
        if (active) setThumbError(true);
      });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [doc.id, canShowImageThumb]);

  return (
    <div className="border border-[#D6DAE2] bg-[#FCFBF8] p-3 flex flex-col justify-between gap-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#997837]">
            {formatCategory(doc.category)}
          </span>
          <span className="text-[11px] font-mono text-[#4A5260]">{formatFileSize(doc.file_size)}</span>
        </div>

        <button
          type="button"
          onClick={() => onPreview(doc)}
          className="w-full h-36 bg-[#EFECE3] border border-[#E5E8EE] flex items-center justify-center overflow-hidden hover:border-[#0B172A] transition-colors"
        >
          {canShowImageThumb && thumbUrl && !thumbError ? (
            <img
              src={thumbUrl}
              alt={doc.original_filename}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-1.5 px-3 text-center text-[#4A5260]">
              <FileText className="w-7 h-7 text-[#0B172A]" />
              <span className="text-[11px] font-medium">
                {isPdfDoc(doc) ? 'PDF Document — Click to View' : 'Click to Inspect Document'}
              </span>
            </div>
          )}
        </button>

        <div className="text-xs font-medium text-[#0B172A] truncate" title={doc.original_filename}>
          {doc.original_filename}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPreview(doc)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8] hover:bg-[#132542]"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>View</span>
        </button>
        <button
          type="button"
          onClick={() => onDownload(doc)}
          className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold border border-[#D6DAE2] bg-white text-[#0B172A] hover:border-[#0B172A]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download</span>
        </button>
      </div>
    </div>
  );
}

export function AdminKycPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsById, setCommentsById] = useState<Record<number, string>>({});
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const [previewDoc, setPreviewDoc] = useState<{
    doc: any;
    objectUrl: string | null;
    contentType: string;
    loading: boolean;
    error: string;
  } | null>(null);

  const closePreview = () => {
    if (previewDoc?.objectUrl) {
      URL.revokeObjectURL(previewDoc.objectUrl);
    }
    setPreviewDoc(null);
  };

  useEffect(() => {
    return () => {
      if (previewDoc?.objectUrl) {
        URL.revokeObjectURL(previewDoc.objectUrl);
      }
    };
  }, [previewDoc]);

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

  const openDocumentPreview = async (doc: any) => {
    if (previewDoc?.objectUrl) {
      URL.revokeObjectURL(previewDoc.objectUrl);
    }
    setPreviewDoc({ doc, objectUrl: null, contentType: doc.mime_type || '', loading: true, error: '' });
    try {
      const { blob, contentType } = await apiFetchBlob(`/api/admin/kyc/documents/${doc.id}?inline=1`);
      const objectUrl = URL.createObjectURL(blob);
      setPreviewDoc({ doc, objectUrl, contentType, loading: false, error: '' });
    } catch (err: any) {
      setPreviewDoc({
        doc,
        objectUrl: null,
        contentType: doc.mime_type || '',
        loading: false,
        error: err?.message || 'Unable to load document preview.',
      });
    }
  };

  const handleDownloadDocument = async (doc: any) => {
    setError('');
    try {
      await apiDownload(`/api/admin/kyc/documents/${doc.id}`, doc.original_filename || 'kyc-document');
    } catch (err: any) {
      setError(err?.message || 'Failed to download KYC document.');
    }
  };

  const submitDecision = async (
    id: number,
    status: 'under_review' | 'additional_info_required' | 'approved' | 'rejected'
  ) => {
    const comments =
      commentsById[id]?.trim() ||
      (status === 'approved'
        ? 'Identity and residential documents verified. Account permanently approved.'
        : status === 'under_review'
        ? 'Assigned to compliance review.'
        : status === 'rejected'
        ? 'Submitted documents could not be verified.'
        : 'Additional verification details required.');
    setError('');
    setFeedback('');
    setProcessingId(id);
    try {
      await apiRequest(`/api/admin/kyc/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ status, comments }),
      });
      setFeedback(
        status === 'approved'
          ? 'KYC approved. Investor account is now permanently verified.'
          : `KYC submission updated to ${status.replace(/_/g, ' ')}.`
      );
      await loadKyc();
    } catch (err: any) {
      setError(err?.message || 'Failed to update KYC decision.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <PortalShell portalTitle="Administrator Portal" breadcrumbLabel="KYC Compliance" navItems={ADMIN_NAV} variant="admin">
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-[#0B172A]">KYC Compliance Review Queue</h1>
          <p className="text-sm text-[#4A5260] mt-1">
            Inspect uploaded identity & address documents directly and record compliance verification decisions.
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
            {submissions.map((sub) => {
              const isPermanentlyApproved =
                sub.status === 'approved' || sub.profile_kyc_status === 'approved';
              return (
                <div key={sub.id} className="bg-white border border-[#E5E8EE] p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E5E8EE] pb-3">
                    <div>
                      <div className="font-mono text-xs text-[#997837] font-semibold">
                        {sub.submission_reference} · {sub.account_number}
                      </div>
                      <div className="font-serif text-xl font-semibold text-[#0B172A]">
                        {sub.first_name} {sub.last_name} ({sub.email})
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPermanentlyApproved && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold border border-[#146348]/30 bg-[#146348]/10 text-[#146348]">
                          <Lock className="w-3 h-3" />
                          Permanently Approved
                        </span>
                      )}
                      <StatusBadge status={sub.status} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs bg-[#FCFBF8] border border-[#E5E8EE] p-3.5">
                    <div>
                      <div className="text-[11px] text-[#4A5260]">Document Type</div>
                      <div className="font-semibold text-[#0B172A] capitalize">
                        {String(sub.document_type || '').replace(/_/g, ' ')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#4A5260]">Document Number</div>
                      <div className="font-mono font-semibold text-[#0B172A]">{sub.document_number}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#4A5260]">Issuing Country</div>
                      <div className="font-semibold text-[#0B172A]">{sub.issuing_country}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#4A5260]">Expiry / Address Proof</div>
                      <div className="font-semibold text-[#0B172A]">
                        {formatDate(sub.expiry_date)} · {sub.address_proof_type}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#4A5260]">Submitted</div>
                      <div className="font-semibold text-[#0B172A]">{formatDateTime(sub.created_at)}</div>
                    </div>
                  </div>

                  {sub.investor_notes && (
                    <div className="p-3 bg-[#FCFBF8] border border-[#E5E8EE] text-xs text-[#1C2026]">
                      <strong>Investor Notes:</strong> {sub.investor_notes}
                    </div>
                  )}

                  {/* Uploaded Documents Preview Grid */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#4A5260]">
                      Uploaded Verification Documents ({(sub.documents || []).length})
                    </div>
                    {(sub.documents || []).length === 0 ? (
                      <div className="text-xs text-[#4A5260] italic">No files attached to this submission.</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(sub.documents || []).map((doc: any) => (
                          <AdminKycDocCard
                            key={doc.id}
                            doc={doc}
                            onPreview={openDocumentPreview}
                            onDownload={handleDownloadDocument}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Decision Controls or Permanent Approved Lock */}
                  {isPermanentlyApproved ? (
                    <div className="p-4 border border-[#146348]/30 bg-[#146348]/5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#146348]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>
                          <strong>Permanently Approved:</strong> This investor account is permanently verified and
                          locked against status changes.
                          {sub.admin_comments ? ` — "${sub.admin_comments}"` : ''}
                        </span>
                      </div>
                      {sub.reviewed_at && (
                        <span className="font-mono text-[11px]">Verified: {formatDateTime(sub.reviewed_at)}</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-[#E5E8EE]">
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
                          disabled={processingId === sub.id}
                          onClick={() => submitDecision(sub.id, 'under_review')}
                          className="px-3 py-2 text-xs border border-[#D6DAE2] font-semibold disabled:opacity-60"
                        >
                          Under Review
                        </button>
                        <button
                          type="button"
                          disabled={processingId === sub.id}
                          onClick={() => submitDecision(sub.id, 'additional_info_required')}
                          className="px-3 py-2 text-xs border border-[#9A3412]/40 text-[#9A3412] font-semibold disabled:opacity-60"
                        >
                          Request Info
                        </button>
                        <button
                          type="button"
                          disabled={processingId === sub.id}
                          onClick={() => submitDecision(sub.id, 'approved')}
                          className="px-4 py-2 text-xs bg-[#146348] text-white font-semibold hover:bg-[#104f3a] disabled:opacity-60"
                        >
                          {processingId === sub.id ? 'Saving...' : 'Approve KYC'}
                        </button>
                        <button
                          type="button"
                          disabled={processingId === sub.id}
                          onClick={() => submitDecision(sub.id, 'rejected')}
                          className="px-4 py-2 text-xs bg-[#991B1B] text-white font-semibold hover:bg-[#7f1d1d] disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Document Inspection Modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-[#0B172A]/80 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white border border-[#D6DAE2] w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#E5E8EE] flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-[#997837] font-semibold">
                  {formatCategory(previewDoc.doc.category)}
                </div>
                <div className="text-sm font-semibold text-[#0B172A] truncate">
                  {previewDoc.doc.original_filename}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownloadDocument(previewDoc.doc)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-[#D6DAE2] bg-[#FCFBF8] text-[#0B172A] hover:border-[#0B172A]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  aria-label="Close document preview"
                  className="p-1.5 border border-[#D6DAE2] text-[#0B172A] hover:bg-[#FCFBF8]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto bg-[#F5F2EA] p-4 flex items-center justify-center min-h-[60vh]">
              {previewDoc.loading ? (
                <div className="text-sm text-[#4A5260]">Loading uploaded document...</div>
              ) : previewDoc.error ? (
                <div className="p-4 border border-[#991B1B]/30 bg-white text-xs text-[#991B1B]">
                  {previewDoc.error}
                </div>
              ) : previewDoc.objectUrl && isImageDoc(previewDoc.doc) ? (
                <img
                  src={previewDoc.objectUrl}
                  alt={previewDoc.doc.original_filename}
                  className="max-w-full max-h-[72vh] object-contain border border-[#D6DAE2] bg-white"
                />
              ) : previewDoc.objectUrl && isPdfDoc(previewDoc.doc) ? (
                <iframe
                  src={previewDoc.objectUrl}
                  title={previewDoc.doc.original_filename}
                  className="w-full h-[72vh] border border-[#D6DAE2] bg-white"
                />
              ) : (
                <div className="bg-white border border-[#D6DAE2] p-6 text-center space-y-3">
                  <p className="text-sm text-[#1C2026]">
                    Inline preview is not supported by the browser for this file format ({previewDoc.contentType}).
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownloadDocument(previewDoc.doc)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-[#0B172A] text-[#FCFBF8]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
