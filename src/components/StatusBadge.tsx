import { humanizeStatus } from '../lib/format';

const TONE_MAP: Record<string, string> = {
  approved: 'text-[#146348] border-[#146348]/30 bg-[#146348]/5',
  completed: 'text-[#146348] border-[#146348]/30 bg-[#146348]/5',
  distributed: 'text-[#146348] border-[#146348]/30 bg-[#146348]/5',
  active: 'text-[#146348] border-[#146348]/30 bg-[#146348]/5',
  published: 'text-[#146348] border-[#146348]/30 bg-[#146348]/5',
  submitted: 'text-[#0B172A] border-[#0B172A]/25 bg-[#0B172A]/5',
  under_review: 'text-[#0B172A] border-[#0B172A]/25 bg-[#0B172A]/5',
  awaiting_payment: 'text-[#8B651D] border-[#B5924C]/40 bg-[#B5924C]/10',
  payment_submitted: 'text-[#8B651D] border-[#B5924C]/40 bg-[#B5924C]/10',
  payment_verification_pending: 'text-[#8B651D] border-[#B5924C]/40 bg-[#B5924C]/10',
  verification_pending: 'text-[#8B651D] border-[#B5924C]/40 bg-[#B5924C]/10',
  additional_info_required: 'text-[#9A3412] border-[#9A3412]/30 bg-[#9A3412]/5',
  additional_evidence_required: 'text-[#9A3412] border-[#9A3412]/30 bg-[#9A3412]/5',
  pending: 'text-[#8B651D] border-[#B5924C]/40 bg-[#B5924C]/10',
  declared: 'text-[#8B651D] border-[#B5924C]/40 bg-[#B5924C]/10',
  rejected: 'text-[#991B1B] border-[#991B1B]/30 bg-[#991B1B]/5',
  suspended: 'text-[#991B1B] border-[#991B1B]/30 bg-[#991B1B]/5',
  cancelled: 'text-[#4A5260] border-[#D6DAE2] bg-[#F3F4F6]',
  closed: 'text-[#4A5260] border-[#D6DAE2] bg-[#F3F4F6]',
  draft: 'text-[#4A5260] border-[#D6DAE2] bg-[#F3F4F6]',
  not_submitted: 'text-[#4A5260] border-[#D6DAE2] bg-[#F3F4F6]',
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status || '').toLowerCase();
  const classes = TONE_MAP[key] || 'text-[#4A5260] border-[#D6DAE2] bg-[#F3F4F6]';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium border whitespace-nowrap ${classes}`}>
      {humanizeStatus(status)}
    </span>
  );
}
