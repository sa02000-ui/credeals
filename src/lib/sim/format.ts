/** Display formatters. */

export function usd(n: number, opts: { compact?: boolean; decimals?: boolean } = {}): string {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    // Compact always carries up to 2 decimals so large figures read precisely — $23.5M / $24.55M /
    // $25M (trailing zeros dropped). Standard (full) stays whole-dollar with commas. (`decimals` is
    // accepted for back-compat but no longer needed.)
    maximumFractionDigits: opts.compact ? 2 : 0,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(n);
}

export function usd2(n: number): string {
  if (!isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

export function pct(n: number, digits = 1): string {
  if (!isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

export function num(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}
