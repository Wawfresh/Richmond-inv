export function formatCurrency(amount: number | string | null | undefined, currency = 'USD'): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const num = Number(amount);
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function formatNumber(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatDate(val: string | Date | null | undefined): string {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(d);
}

export function formatDateTime(val: string | Date | null | undefined): string {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return 'Unknown';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPlanDuration(
  months?: number | string | null,
  days?: number | string | null,
  hours?: number | string | null,
  durationUnit?: string | null,
  durationValue?: number | string | null
): string {
  const val = Math.max(0, Math.floor(Number(durationValue || 0)));
  if (durationUnit === 'daily') {
    return val > 0 ? `Daily (${val} ${val === 1 ? 'Day' : 'Days'})` : 'Daily';
  }
  if (durationUnit === 'month' && val > 0) {
    return `${val} ${val === 1 ? 'Month' : 'Months'}`;
  }
  if (durationUnit === 'days' && val > 0) {
    return `${val} ${val === 1 ? 'Day' : 'Days'}`;
  }
  if (durationUnit === 'hours' && val > 0) {
    return `${val} ${val === 1 ? 'Hour' : 'Hours'}`;
  }

  const m = Math.max(0, Math.floor(Number(months || 0)));
  const d = Math.max(0, Math.floor(Number(days || 0)));
  const h = Math.max(0, Math.floor(Number(hours || 0)));
  const parts: string[] = [];
  if (m > 0) parts.push(`${m} ${m === 1 ? 'Month' : 'Months'}`);
  if (d > 0) parts.push(`${d} ${d === 1 ? 'Day' : 'Days'}`);
  if (h > 0) parts.push(`${h} ${h === 1 ? 'Hour' : 'Hours'}`);
  return parts.length > 0 ? parts.join(' · ') : 'Flexible';
}

export function formatRoi(roi?: number | string | null): string {
  if (roi === null || roi === undefined || roi === '') return '—';
  const num = Number(roi);
  if (Number.isNaN(num)) return '—';
  return `${num.toFixed(2)}%`;
}
