/**
 * Shared simulation disclaimer. Game mode shows illustrative / randomized / estimated data and is a
 * training tool — not real offers, data, or advice. One source of wording so it stays consistent.
 *
 * variant="box"  — full callout for onboarding / first-run screens
 * variant="line" — one-line version for footers / dense areas
 */
export function SimDisclaimer({ variant = 'line', className = '' }: { variant?: 'box' | 'line'; className?: string }) {
  if (variant === 'box') {
    return (
      <div className={`rounded-xl border border-amber-300 bg-amber-50 p-3 text-left ${className}`}>
        <div className="text-xs font-bold text-amber-800">⚠️ This is a training simulation</div>
        <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
          Deals, counterparties, market data, financials, and outcomes are illustrative and may be randomized or
          estimated — they are not real offers, real property data, or guarantees of any result. Nothing here is
          investment, legal, tax, or financial advice. <strong>Always verify any information independently and consult
          licensed professionals before making real decisions.</strong>
        </p>
      </div>
    );
  }
  return (
    <p className={`text-[10px] leading-relaxed text-slate-400 ${className}`}>
      ⚠️ Training simulation — deals, data, and outcomes are illustrative and may be randomized or estimated. Not
      investment, legal, or tax advice. Verify all information independently.
    </p>
  );
}
