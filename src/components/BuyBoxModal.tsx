'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/lib/store';
import { BuyBoxPanel } from '@/components/BuyBoxPanel';

/**
 * Game mode: after onboarding, the buy box is a focused popup ("pick your variables") rather than the
 * small left rail — it's the first real decision and deserves the screen. It reuses BuyBoxPanel, so the
 * same controls live in the sidebar afterward for editing. Auto-closes when the buy box is approved.
 */
export function BuyBoxModal() {
  const { mode, difficulty, onboardingComplete, buyBoxApproved } = useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const show = mode === 'game' && onboardingComplete && !!difficulty && !buyBoxApproved;
  if (!mounted || !show) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid justify-center overflow-y-auto bg-black/60 p-4 py-8">
      <div className="w-full max-w-xl self-start">
        <div className="mb-3 text-center text-white">
          <div className="text-2xl font-bold">Define your buy box</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-white/80">
            Your acquisition criteria — this filters every deal you’ll see, so be deliberate. Hover any asset class to
            learn how it works, or compare them side-by-side. You can edit this later.
          </p>
        </div>
        <BuyBoxPanel />
      </div>
    </div>,
    document.body,
  );
}
