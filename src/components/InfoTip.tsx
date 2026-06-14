'use client';

import { useState } from 'react';
import { learn } from '@/lib/learn/glossary';

/**
 * A small "ⓘ" affordance that teaches as you go (owner item 3). Hover OR click/tap to reveal a
 * popover explaining the concept (CRE-industry "what") and, when present, how it works in this app.
 * Pass either a glossary key `k` or an explicit title/what/app.
 */
export function InfoTip({
  k,
  title,
  what,
  app,
  className = '',
}: {
  k?: string;
  title?: string;
  what?: string;
  app?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const entry = k ? learn(k) : undefined;
  const t = title ?? entry?.title ?? 'About';
  const w = what ?? entry?.what;
  const a = app ?? entry?.app;
  if (!w && !a) return null;

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${t}?`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="grid h-4 w-4 place-items-center rounded-full border border-sky-600 bg-sky-600 text-[10px] font-bold leading-none text-white hover:bg-sky-700"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-5 z-50 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="block text-xs font-semibold text-slate-900">{t}</span>
          {w && <span className="mt-1 block text-[11px] leading-relaxed text-slate-600">{w}</span>}
          {a && (
            <span className="mt-1.5 block rounded bg-sky-50 px-2 py-1 text-[11px] leading-relaxed text-sky-800">
              <b>In this app:</b> {a}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
