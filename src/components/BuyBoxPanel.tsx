'use client';

import { useApp } from '@/lib/store';
import { InfoTip } from '@/components/InfoTip';
import { ASSET_CLASSES, pct, usd, type AssetClass } from '@/lib/sim';

const ALL_STATES = ['TX', 'AZ', 'FL', 'GA', 'NC', 'TN'];

export function BuyBoxPanel() {
  const { buyBox, updateBuyBox, buyBoxApproved, approveBuyBox, editBuyBox } = useApp();
  const locked = buyBoxApproved;

  function toggleState(s: string) {
    if (locked) return;
    const has = buyBox.states.includes(s);
    updateBuyBox({ states: has ? buyBox.states.filter((x) => x !== s) : [...buyBox.states, s] });
  }

  function toggleAsset(a: AssetClass) {
    if (locked) return;
    const has = buyBox.assetClasses.includes(a);
    updateBuyBox({
      assetClasses: has ? buyBox.assetClasses.filter((x) => x !== a) : [...buyBox.assetClasses, a],
    });
  }

  return (
    <section className={`rounded-xl border bg-white p-4 ${buyBoxApproved ? 'border-emerald-300' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1 text-sm font-semibold text-slate-900">
          Step 1 · Your Buy Box <InfoTip k="step.buybox" /> {buyBoxApproved && <span className="text-emerald-600">✓</span>}
        </h2>
        {buyBoxApproved && (
          <button onClick={editBuyBox} className="text-xs text-slate-500 underline hover:text-slate-900">
            Edit
          </button>
        )}
      </div>
      <p className="mt-0.5 text-xs text-slate-500">
        Define your acquisition criteria. Deals outside it are flagged — discipline is part of the game.
      </p>

      <fieldset disabled={locked} className={`mt-3 space-y-3 ${locked ? 'opacity-70' : ''}`}>
        {/* Asset class */}
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600">Asset class <InfoTip k="bb.assetClass" /></label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ASSET_CLASSES.map((a) => {
              const on = buyBox.assetClasses.includes(a.id);
              return (
                <button
                  key={a.id}
                  onClick={() => a.active && toggleAsset(a.id)}
                  disabled={!a.active}
                  title={a.active ? '' : 'Coming soon'}
                  className={`rounded-md border px-2 py-1 text-xs font-medium ${
                    !a.active
                      ? 'cursor-not-allowed border-dashed border-slate-200 text-slate-300'
                      : on
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {a.label}
                  {!a.active && ' ·soon'}
                </button>
              );
            })}
          </div>
        </div>

        {/* States */}
        <div>
          <label className="flex items-center gap-1 text-xs font-medium text-slate-600">Target states <InfoTip k="bb.states" /></label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ALL_STATES.map((s) => (
              <button
                key={s}
                onClick={() => toggleState(s)}
                className={`rounded-md border px-2 py-1 text-xs font-medium ${
                  buyBox.states.includes(s)
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <Row label="Units" info="bb.units" value={`${buyBox.minUnits}–${buyBox.maxUnits}`}>
          <RangePair
            min={buyBox.minUnits}
            max={buyBox.maxUnits}
            onMin={(v) => updateBuyBox({ minUnits: v })}
            onMax={(v) => updateBuyBox({ maxUnits: v })}
          />
        </Row>

        <Row label="Year built" info="bb.vintage" value={`${buyBox.minVintage}–${buyBox.maxVintage}`}>
          <RangePair
            min={buyBox.minVintage}
            max={buyBox.maxVintage}
            onMin={(v) => updateBuyBox({ minVintage: v })}
            onMax={(v) => updateBuyBox({ maxVintage: v })}
          />
        </Row>

        <Row label="Price" info="bb.price" value={`${usd(buyBox.minPrice, { compact: true })}–${usd(buyBox.maxPrice, { compact: true })}`}>
          <RangePair
            min={buyBox.minPrice}
            max={buyBox.maxPrice}
            step={1_000_000}
            onMin={(v) => updateBuyBox({ minPrice: v })}
            onMax={(v) => updateBuyBox({ maxPrice: v })}
          />
        </Row>

        <Row label="Min stabilized cap" info="bb.cap" value={pct(buyBox.minStabilizedCapRate)}>
          <input
            type="range"
            min={0.04}
            max={0.09}
            step={0.0025}
            value={buyBox.minStabilizedCapRate}
            onChange={(e) => updateBuyBox({ minStabilizedCapRate: Number(e.target.value) })}
            className="w-full"
          />
        </Row>
      </fieldset>

      {!buyBoxApproved && (
        <button
          onClick={approveBuyBox}
          className="mt-4 w-full rounded-lg bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Approve buy box → start sourcing
        </button>
      )}
    </section>
  );
}

function Row({ label, value, children, info }: { label: string; value: string; children: React.ReactNode; info?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1 text-xs font-medium text-slate-600">{label}{info && <InfoTip k={info} />}</label>
        <span className="text-xs font-semibold text-slate-900">{value}</span>
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function RangePair({
  min,
  max,
  step = 1,
  onMin,
  onMax,
}: {
  min: number;
  max: number;
  step?: number;
  onMin: (v: number) => void;
  onMax: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Num value={min} step={step} onChange={onMin} />
      <span className="text-xs text-slate-400">to</span>
      <Num value={max} step={step} onChange={onMax} />
    </div>
  );
}

function Num({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
    />
  );
}
