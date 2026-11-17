import { useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Clock, TrendingUp } from 'lucide-react';
import { formatCurrency, formatPlanDuration, formatRoi } from '../lib/format';
import type { ShareOffering } from '../types';

interface RoiCalculatorProps {
  offering: ShareOffering;
  amount: number;
  onAmountChange: (nextAmount: number) => void;
  variant?: 'full' | 'compact';
  showPlanHeader?: boolean;
}

interface MilestonePoint {
  index: number;
  label: string;
  fraction: number;
  principal: number;
  earnings: number;
  total: number;
}

export function getPlanAmountBounds(off: ShareOffering) {
  const unitPrice = Math.max(0.01, Number(off.share_price || 1));
  const minAmount =
    Number(off.min_amount) > 0 ? Number(off.min_amount) : Number(off.min_quantity || 1) * unitPrice;
  const rawMax =
    Number(off.max_amount) > 0 ? Number(off.max_amount) : Number(off.max_quantity || 100) * unitPrice;
  return {
    minAmount: Number(minAmount.toFixed(2)),
    maxAmount: Number(Math.max(minAmount, rawMax).toFixed(2)),
  };
}

function formatMilestoneElapsed(fraction: number, totalHours: number, months: number, days: number, hours: number): string {
  if (fraction === 0) return 'Start';
  if (fraction === 1) return 'Maturity';
  if (totalHours <= 0) return `${Math.round(fraction * 100)}%`;

  if (months > 0 && days === 0 && hours === 0) {
    const mVal = months * fraction;
    return Number.isInteger(mVal) ? `Mo ${mVal}` : `Mo ${mVal.toFixed(1)}`;
  }

  const elapsedHours = totalHours * fraction;
  if (elapsedHours < 48) {
    return `${Math.round(elapsedHours)}h`;
  }
  const elapsedDays = elapsedHours / 24;
  if (elapsedDays < 60) {
    return `Day ${Math.round(elapsedDays)}`;
  }
  return `Mo ${(elapsedDays / 30).toFixed(1)}`;
}

export function RoiCalculator({
  offering,
  amount,
  onAmountChange,
  variant = 'full',
  showPlanHeader = true,
}: RoiCalculatorProps) {
  const { minAmount, maxAmount } = useMemo(() => getPlanAmountBounds(offering), [offering]);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [amountText, setAmountText] = useState<string>(() => (Number.isFinite(amount) ? String(amount) : ''));
  const lastSentAmountRef = useRef<number>(amount);

  useEffect(() => {
    if (amount !== lastSentAmountRef.current) {
      lastSentAmountRef.current = amount;
      setAmountText(Number.isFinite(amount) ? String(amount) : '');
    }
  }, [amount]);

  const safeAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  const clampedSliderAmount = Math.min(maxAmount, Math.max(minAmount, safeAmount));
  const sliderStep = useMemo(() => {
    const span = maxAmount - minAmount;
    if (span <= 100) return 1;
    if (span <= 5000) return 10;
    if (span <= 50000) return 50;
    return 100;
  }, [minAmount, maxAmount]);

  const roiPercent = Number(offering.roi_percent || 0);
  const unit = offering.duration_unit;
  const val = Math.max(0, Math.floor(Number(offering.duration_value || 0)));
  const months =
    unit === 'month' && val > 0 ? val : Math.max(0, Math.floor(Number(offering.duration_months || 0)));
  const days =
    (unit === 'days' || unit === 'daily') && val > 0
      ? val
      : Math.max(0, Math.floor(Number(offering.duration_days || 0)));
  const hours =
    unit === 'hours' && val > 0 ? val : Math.max(0, Math.floor(Number(offering.duration_hours || 0)));
  const totalHours =
    unit === 'month'
      ? months * 30 * 24
      : unit === 'days' || unit === 'daily'
      ? days * 24
      : unit === 'hours'
      ? hours
      : months * 30 * 24 + days * 24 + hours;
  const totalDays = totalHours / 24;
  const totalMonthsApprox = totalDays / 30;

  const estimatedEarnings = safeAmount * (roiPercent / 100);
  const projectedTotal = safeAmount + estimatedEarnings;

  const isWithinBounds = safeAmount >= minAmount && safeAmount <= maxAmount;

  const principalSharePct = projectedTotal > 0 ? (safeAmount / projectedTotal) * 100 : 100;
  const earningsSharePct = projectedTotal > 0 ? (estimatedEarnings / projectedTotal) * 100 : 0;

  const presets = useMemo(() => {
    const raw = [
      { label: 'Min', value: minAmount },
      { label: 'Max', value: maxAmount },
    ];
    // Deduplicate if min == max
    return raw.filter((item, idx, arr) => arr.findIndex((x) => x.value === item.value) === idx);
  }, [minAmount, maxAmount]);

  const milestones: MilestonePoint[] = useMemo(() => {
    const fractions = [0, 0.25, 0.5, 0.75, 1];
    return fractions.map((fraction, index) => {
      const earnings = estimatedEarnings * fraction;
      return {
        index,
        label: formatMilestoneElapsed(fraction, totalHours, months, days, hours),
        fraction,
        principal: safeAmount,
        earnings,
        total: safeAmount + earnings,
      };
    });
  }, [estimatedEarnings, safeAmount, totalHours, months, days, hours]);

  const activePoint = hoveredStep !== null ? milestones[hoveredStep] : milestones[milestones.length - 1];
  const chartMaxTotal = Math.max(projectedTotal * 1.08, 1);

  const perMonth = totalMonthsApprox >= 1 ? estimatedEarnings / totalMonthsApprox : null;
  const perDay = totalDays >= 1 ? estimatedEarnings / totalDays : null;
  const perHour = totalHours >= 1 ? estimatedEarnings / totalHours : null;

  return (
    <div className="bg-[#FCFBF8] border border-[#E5E8EE] p-5 sm:p-6 space-y-5">
      {showPlanHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E8EE] pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#997837] font-semibold">
              <Calculator className="w-3.5 h-3.5" />
              <span>Visual ROI Estimator</span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-[#0B172A]">
              Projected Earnings Simulator
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
            <div className="px-3 py-1.5 bg-white border border-[#E5E8EE]">
              <span className="text-[#4A5260] mr-1.5">ROI:</span>
              <span className="font-semibold text-[#146348]">{formatRoi(offering.roi_percent)}</span>
            </div>
            <div className="px-3 py-1.5 bg-white border border-[#E5E8EE] inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[#997837]" />
              <span className="font-semibold text-[#0B172A]">
                {formatPlanDuration(
                  offering.duration_months,
                  offering.duration_days,
                  offering.duration_hours,
                  offering.duration_unit,
                  offering.duration_value
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Amount Control: Numeric Input + Range Slider + Presets */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <label htmlFor={`roi-amount-${offering.id}-${variant}`} className="font-semibold text-[#0B172A]">
            Investment Amount ({offering.currency})
          </label>
          <span className="font-mono text-[#4A5260] tabular-nums">
            {formatCurrency(minAmount, offering.currency)} – {formatCurrency(maxAmount, offering.currency)}
          </span>
        </div>

        <div className={variant === 'full' ? 'grid grid-cols-1 sm:grid-cols-12 gap-3 items-center' : 'space-y-2.5'}>
          <div className={variant === 'full' ? 'sm:col-span-5' : ''}>
            <input
              id={`roi-amount-${offering.id}-${variant}`}
              type="number"
              step="any"
              min={minAmount}
              max={maxAmount}
              placeholder={String(minAmount)}
              value={amountText}
              onChange={(e) => {
                const raw = e.target.value;
                setAmountText(raw);
                if (raw.trim() === '') {
                  lastSentAmountRef.current = 0;
                  onAmountChange(0);
                  return;
                }
                const next = Number(raw);
                const normalized = Number.isFinite(next) && next >= 0 ? next : 0;
                lastSentAmountRef.current = normalized;
                onAmountChange(normalized);
              }}
              className="w-full px-3.5 py-2.5 text-sm font-mono font-semibold tabular-nums border border-[#D6DAE2] bg-white text-[#0B172A] focus:outline-none focus:border-[#0B172A]"
            />
          </div>
          <div className={variant === 'full' ? 'sm:col-span-7 space-y-1.5' : 'space-y-1.5'}>
            <input
              type="range"
              aria-label="Adjust investment amount slider"
              min={minAmount}
              max={maxAmount}
              step={sliderStep}
              value={clampedSliderAmount}
              onChange={(e) => onAmountChange(Number(e.target.value))}
              className="w-full accent-[#0B172A] cursor-pointer h-2 bg-[#E5E8EE]"
            />
            <div className="flex justify-between text-[11px] font-mono text-[#4A5260] tabular-nums">
              <span>{formatCurrency(minAmount, offering.currency)}</span>
              <span>{formatCurrency(maxAmount, offering.currency)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {presets.map((preset) => {
            const active = Math.abs(safeAmount - preset.value) < 0.01;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onAmountChange(preset.value)}
                className={`py-1.5 px-2 text-xs font-mono border transition-colors truncate ${
                  active
                    ? 'bg-[#0B172A] text-[#FCFBF8] border-[#0B172A]'
                    : 'bg-white text-[#4A5260] border-[#D6DAE2] hover:border-[#0B172A] hover:text-[#0B172A]'
                }`}
              >
                {preset.label}: {formatCurrency(preset.value, offering.currency)}
              </button>
            );
          })}
        </div>

        {!isWithinBounds && (
          <div className="p-2.5 border border-[#991B1B]/30 bg-[#991B1B]/5 text-xs text-[#991B1B]">
            Enter an investment amount between {formatCurrency(minAmount, offering.currency)} and{' '}
            {formatCurrency(maxAmount, offering.currency)}.
          </div>
        )}
      </div>

      {/* Key Output KPI Strip */}
      <div className={`grid gap-3 ${variant === 'full' ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
        <div className="bg-white border border-[#E5E8EE] p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-[#4A5260]">Principal Capital</div>
          <div className="font-mono text-lg font-semibold text-[#0B172A] tabular-nums mt-1">
            {formatCurrency(safeAmount, offering.currency)}
          </div>
          <div className="text-[11px] font-mono text-[#4A5260] tabular-nums mt-0.5">
            {offering.currency} capital allocation
          </div>
        </div>

        <div className="bg-white border border-[#146348]/30 p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-[#146348] font-semibold">
            Estimated ROI Profit
          </div>
          <div className="font-mono text-lg font-semibold text-[#146348] tabular-nums mt-1">
            +{formatCurrency(estimatedEarnings, offering.currency)}
          </div>
          <div className="text-[11px] font-mono text-[#4A5260] tabular-nums mt-0.5">
            {formatRoi(roiPercent)} fixed term return
          </div>
        </div>

        <div className="bg-[#0B172A] text-[#FCFBF8] border border-[#0B172A] p-3.5">
          <div className="text-[11px] uppercase tracking-wider text-[#C9A968]">Projected Maturity Value</div>
          <div className="font-mono text-lg font-semibold text-[#FCFBF8] tabular-nums mt-1">
            {formatCurrency(projectedTotal, offering.currency)}
          </div>
          <div className="text-[11px] font-mono text-[#C8D0DC] tabular-nums mt-0.5">
            Principal + Return at maturity
          </div>
        </div>
      </div>

      {/* Capital vs. ROI Profit Proportion Bar */}
      <div className="bg-white border border-[#E5E8EE] p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#0B172A]">Capital &amp; Return Composition</span>
          <span className="font-mono text-[#4A5260] tabular-nums">
            {principalSharePct.toFixed(1)}% Principal · {earningsSharePct.toFixed(1)}% ROI
          </span>
        </div>
        <div className="w-full h-3 bg-[#EFECE3] flex overflow-hidden">
          <div
            className="h-full bg-[#0B172A] transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, principalSharePct))}%` }}
            title={`Principal: ${formatCurrency(safeAmount, offering.currency)}`}
          />
          <div
            className="h-full bg-[#146348] transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, earningsSharePct))}%` }}
            title={`Estimated ROI: ${formatCurrency(estimatedEarnings, offering.currency)}`}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#4A5260]">
          <div className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#0B172A] inline-block" />
            <span>Principal ({formatCurrency(safeAmount, offering.currency)})</span>
          </div>
          <div className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#146348] inline-block" />
            <span>Projected ROI (+{formatCurrency(estimatedEarnings, offering.currency)})</span>
          </div>
        </div>
      </div>

      {/* Visual Maturity Accrual Timeline Chart */}
      <div className="bg-white border border-[#E5E8EE] p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E5E8EE] pb-2.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B172A]">
            <TrendingUp className="w-3.5 h-3.5 text-[#146348]" />
            <span>Accrual Progression Across Plan Duration</span>
          </div>
          {activePoint && (
            <div className="text-[11px] font-mono tabular-nums text-[#0B172A]">
              <span className="text-[#997837] font-semibold mr-1.5">{activePoint.label}:</span>
              <span>{formatCurrency(activePoint.total, offering.currency)}</span>
              <span className="text-[#146348] ml-1.5">
                (+{formatCurrency(activePoint.earnings, offering.currency)})
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-5 gap-2 sm:gap-3 pt-2 items-end h-36">
          {milestones.map((pt) => {
            const totalHeightPct = Math.max(12, Math.round((pt.total / chartMaxTotal) * 100));
            const earningsRatioPct = pt.total > 0 ? Math.round((pt.earnings / pt.total) * 100) : 0;
            const principalRatioPct = 100 - earningsRatioPct;
            const isHighlighted =
              hoveredStep === pt.index || (hoveredStep === null && pt.index === milestones.length - 1);

            return (
              <button
                key={pt.index}
                type="button"
                onMouseEnter={() => setHoveredStep(pt.index)}
                onMouseLeave={() => setHoveredStep(null)}
                onFocus={() => setHoveredStep(pt.index)}
                onClick={() => setHoveredStep(pt.index === hoveredStep ? null : pt.index)}
                className="flex flex-col items-center justify-end h-full group focus:outline-none"
                title={`${pt.label}: ${formatCurrency(pt.total, offering.currency)} (+${formatCurrency(pt.earnings, offering.currency)})`}
              >
                <div className="text-[10px] font-mono tabular-nums text-[#146348] mb-1 truncate max-w-full">
                  {pt.earnings > 0 ? `+${formatCurrency(pt.earnings, offering.currency)}` : '—'}
                </div>
                <div
                  className={`w-full max-w-[44px] flex flex-col justify-end overflow-hidden border transition-all duration-200 ${
                    isHighlighted ? 'border-[#B5924C] ring-1 ring-[#B5924C]' : 'border-transparent'
                  }`}
                  style={{ height: `${totalHeightPct}%` }}
                >
                  {earningsRatioPct > 0 && (
                    <div
                      className="w-full bg-[#146348] transition-all duration-300"
                      style={{ height: `${earningsRatioPct}%` }}
                    />
                  )}
                  <div
                    className="w-full bg-[#0B172A] transition-all duration-300"
                    style={{ height: `${principalRatioPct}%` }}
                  />
                </div>
                <div
                  className={`mt-1.5 text-[11px] font-mono tabular-nums ${
                    isHighlighted ? 'font-semibold text-[#0B172A]' : 'text-[#4A5260]'
                  }`}
                >
                  {pt.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accrual Rate Breakdown Strip */}
      <dl className="grid grid-cols-3 gap-2.5 text-xs border-t border-[#E5E8EE] pt-3">
        <div className="bg-white border border-[#E5E8EE] p-2.5">
          <dt className="text-[11px] text-[#4A5260]">Monthly Est.</dt>
          <dd className="font-mono font-semibold text-[#0B172A] tabular-nums mt-0.5 truncate">
            {perMonth !== null ? formatCurrency(perMonth, offering.currency) : '—'}
          </dd>
        </div>
        <div className="bg-white border border-[#E5E8EE] p-2.5">
          <dt className="text-[11px] text-[#4A5260]">Daily Est.</dt>
          <dd className="font-mono font-semibold text-[#0B172A] tabular-nums mt-0.5 truncate">
            {perDay !== null ? formatCurrency(perDay, offering.currency) : '—'}
          </dd>
        </div>
        <div className="bg-white border border-[#E5E8EE] p-2.5">
          <dt className="text-[11px] text-[#4A5260]">Hourly Est.</dt>
          <dd className="font-mono font-semibold text-[#0B172A] tabular-nums mt-0.5 truncate">
            {perHour !== null ? formatCurrency(perHour, offering.currency) : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}
