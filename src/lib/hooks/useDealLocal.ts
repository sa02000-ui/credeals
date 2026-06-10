'use client';

import { useEffect, useState } from 'react';

/**
 * Per-deal persisted state, scoped by a feature key + deal id, stored in localStorage. Used by the
 * Contract-to-Close tracker, Asset-Management reminders, and Detailed-UW versions so these features
 * persist without bloating the central app store. (DB-backed persistence comes later.)
 *
 * SSR-safe: initializes to `initial`, then hydrates from localStorage after mount.
 */
export function useDealLocal<T>(feature: string, dealId: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const storageKey = `cre-${feature}-${dealId}`;
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore corrupt/blocked storage */
    }
    setLoaded(true);
    // re-hydrate when the deal changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [storageKey, value, loaded]);

  return [value, setValue];
}
