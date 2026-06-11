'use client';

/**
 * Pop-up shell for game encounters (scenario decisions) — same presentation language as the
 * game-start modal so decisions feel like events, not page furniture. Minimize keeps the game
 * honest: the encounter stays pending and an inline "resume" chip brings it back.
 */
export function EncounterModal({
  icon,
  title,
  subtitle,
  onMinimize,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onMinimize: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onMinimize}>
      <div className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="text-2xl">{icon}</span>
          <div className="min-w-0">
            <div className="truncate text-base font-bold text-slate-900">{title}</div>
            {subtitle && <div className="truncate text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onMinimize} className="ml-auto rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100" title="Minimize — the decision stays pending">
            ▁ minimize
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

/** Inline chip shown while an encounter is minimized. */
export function EncounterChip({ icon, label, onOpen }: { icon: string; label: string; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-2 rounded-xl border-2 border-violet-300 bg-violet-50 px-4 py-3 text-left hover:bg-violet-100">
      <span className="animate-bounce text-xl">{icon}</span>
      <span className="text-sm font-bold text-violet-800">{label}</span>
      <span className="ml-auto rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white">Decide →</span>
    </button>
  );
}
