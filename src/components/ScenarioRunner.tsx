'use client';

import { useState } from 'react';
import { usd, type Scenario, type ScenarioEffects, type ScenarioOption } from '@/lib/sim';

interface Entry { speaker?: string; text: string; tone?: 'good' | 'warn' | 'bad' }

/**
 * Plays one branching Scenario (scenarios.ts). Applies each chosen option's effects via onEffects,
 * narrates results, follows `next`/weighted `branches`, and calls onComplete with accumulated flags
 * when the tree ends. The transcript stays visible so the player sees the back-and-forth.
 */
export function ScenarioRunner({
  scenario,
  onEffects,
  onComplete,
}: {
  scenario: Scenario;
  onEffects: (e: ScenarioEffects) => void;
  onComplete: (flags: Record<string, boolean>) => void;
}) {
  const [stepId, setStepId] = useState(scenario.entry);
  const [log, setLog] = useState<Entry[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState(false);

  const step = scenario.steps[stepId];

  function applyAndMerge(e: ScenarioEffects | undefined, acc: Record<string, boolean>): Record<string, boolean> {
    if (!e) return acc;
    onEffects(e);
    if (e.set) return { ...acc, ...e.set };
    return acc;
  }

  function choose(opt: ScenarioOption) {
    let acc = { ...flags };
    const lines: Entry[] = [{ speaker: step.speaker, text: optionEcho(opt), tone: opt.tone }];
    acc = applyAndMerge(opt.effects, acc);

    let nextId = opt.next;
    if (opt.branches && opt.branches.length) {
      const b = pickBranch(opt.branches);
      acc = applyAndMerge(b.effects, acc);
      if (b.result) lines.push({ text: b.result });
      nextId = b.next;
    } else if (opt.result) {
      lines.push({ text: opt.result });
    }

    setFlags(acc);
    setLog((l) => [...l, ...lines]);

    if (nextId && scenario.steps[nextId]) {
      setStepId(nextId);
    } else {
      setDone(true);
      onComplete(acc);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      {/* transcript */}
      {log.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {log.map((e, i) => (
            <div key={i} className="text-xs">
              {e.speaker && <span className="font-semibold text-slate-500">{e.speaker}: </span>}
              <span className={e.tone === 'bad' ? 'text-red-700' : e.tone === 'warn' ? 'text-amber-700' : 'text-slate-600'}>{e.text}</span>
            </div>
          ))}
        </div>
      )}

      {!done && step && (
        <>
          {step.speaker && <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">{step.speaker}</div>}
          <p className="mt-0.5 text-sm font-medium text-slate-800">{step.prompt}</p>
          <div className="mt-3 space-y-2">
            {step.options.filter((o) => !o.requires || flags[o.requires]).map((opt) => (
              <button key={opt.id} onClick={() => choose(opt)} className="block w-full rounded-lg border border-slate-200 p-3 text-left transition hover:border-slate-900 hover:bg-slate-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
                  <span className="flex items-center gap-2 text-[11px]">
                    {opt.effects?.cash ? <span className={opt.effects.cash < 0 ? 'text-red-600 tabular-nums' : 'text-emerald-600 tabular-nums'}>{usd(opt.effects.cash, { compact: true })}</span> : null}
                    {opt.effects?.days ? <span className="text-slate-400">+{opt.effects.days}d</span> : null}
                    {opt.tone && <span className={`rounded px-1.5 py-0.5 ${opt.tone === 'good' ? 'bg-emerald-100 text-emerald-700' : opt.tone === 'warn' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{opt.tone}</span>}
                  </span>
                </div>
                {opt.detail && <p className="mt-0.5 text-xs text-slate-500">{opt.detail}</p>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function optionEcho(opt: ScenarioOption): string {
  return `You chose: ${opt.label}.`;
}

function pickBranch<T extends { weight: number }>(branches: T[]): T {
  const total = branches.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const b of branches) {
    r -= b.weight;
    if (r <= 0) return b;
  }
  return branches[branches.length - 1];
}
