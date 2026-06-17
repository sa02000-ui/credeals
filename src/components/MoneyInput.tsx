'use client';

import { useState } from 'react';

/**
 * A numeric input that shows large $ amounts grouped with commas (owner item 8). Focus-aware so
 * editing stays simple: while focused it shows the plain number (easy to type), and when you click
 * away it renders comma-grouped (e.g. 10,750,000). Parses any stray separators on input.
 */
export function MoneyInput({
  value,
  onChange,
  className = '',
  placeholder,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  const display = focused
    ? String(value)
    : isFinite(value)
      ? value.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : '';
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9.-]/g, '');
        onChange(cleaned === '' || cleaned === '-' ? 0 : Number(cleaned));
      }}
      className={className}
    />
  );
}
