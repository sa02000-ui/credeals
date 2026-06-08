'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { ASSET_CLASSES, simulateLookups, type AssetClass, type DealFile, type MarketDeal } from '@/lib/sim';

const STATES = ['TX', 'AZ', 'FL', 'GA', 'NC', 'TN'];

export function AddDealModal({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const { addDeal, addFiles } = useApp();
  const [assetClass, setAssetClass] = useState<AssetClass>('multifamily');
  const [t12, setT12] = useState<File | null>(null);
  const [rentRoll, setRentRoll] = useState<File | null>(null);
  const [f, setF] = useState({
    name: '',
    address: '',
    city: '',
    state: 'TX',
    vintage: 2000,
    unitCount: 150,
    askPrice: 18_000_000,
    avgInPlaceRent: 1150,
    avgMarketRent: 1300,
    expensePerUnit: 5200,
    walkInCapRate: 0.062,
    stabilizedCapRate: 0.068,
  });

  const upd = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = `custom-${f.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;
    const deal: MarketDeal = {
      id,
      name: f.name || 'Untitled Deal',
      address: f.address,
      city: f.city,
      state: f.state,
      msa: `${f.city}, ${f.state}`,
      assetClass,
      vintage: f.vintage,
      unitCount: f.unitCount,
      rentableSqft: f.unitCount * 900,
      askPrice: f.askPrice,
      avgInPlaceRent: f.avgInPlaceRent,
      avgMarketRent: f.avgMarketRent,
      otherIncomePerUnitPerYr: 650,
      expensePerUnit: f.expensePerUnit,
      currentVacancy: 0.1,
      stabilizedVacancy: 0.06,
      walkInCapRate: f.walkInCapRate,
      stabilizedCapRate: f.stabilizedCapRate,
      propertyRating: 3,
      locationRating: 3,
      lookups: simulateLookups(`${f.city}-${f.state}-${f.address}`),
      broker: 'Self-sourced',
      source: 'Added by you',
      blurb: 'Deal you sourced directly. Lookups were auto-estimated from the address.',
      custom: true,
    };
    const realId = await addDeal(deal);
    const attached: DealFile[] = [];
    if (t12) attached.push({ id: `${realId}-t12`, name: t12.name, kind: 'T12', sizeBytes: t12.size, ts: Date.now() });
    if (rentRoll) attached.push({ id: `${realId}-rr`, name: rentRoll.name, kind: 'RentRoll', sizeBytes: rentRoll.size, ts: Date.now() });
    if (attached.length) addFiles(realId, attached);
    onAdded(realId);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Add a deal</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Source your own deal. Address-based lookups (income, flood, crime, demographics) are auto-estimated.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <T label="Deal name" className="col-span-2" value={f.name} onChange={(v) => upd({ name: v })} />
          <label className="col-span-2 block">
            <span className="text-[11px] font-medium text-slate-500">Asset class</span>
            <select
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value as AssetClass)}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
            >
              {ASSET_CLASSES.map((a) => (
                <option key={a.id} value={a.id} disabled={!a.active}>
                  {a.label}
                  {a.active ? '' : ' (coming soon)'}
                </option>
              ))}
            </select>
          </label>
          <T label="Address" className="col-span-2" value={f.address} onChange={(v) => upd({ address: v })} />
          <T label="City" value={f.city} onChange={(v) => upd({ city: v })} />
          <label className="block">
            <span className="text-[11px] font-medium text-slate-500">State</span>
            <select
              value={f.state}
              onChange={(e) => upd({ state: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
            >
              {STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <N label="Units" value={f.unitCount} onChange={(v) => upd({ unitCount: v })} />
          <N label="Year built" value={f.vintage} onChange={(v) => upd({ vintage: v })} />
          <N label="Ask price" value={f.askPrice} step={100_000} onChange={(v) => upd({ askPrice: v })} />
          <N label="Expense /unit/yr" value={f.expensePerUnit} step={100} onChange={(v) => upd({ expensePerUnit: v })} />
          <N label="In-place rent /mo" value={f.avgInPlaceRent} onChange={(v) => upd({ avgInPlaceRent: v })} />
          <N label="Market rent /mo" value={f.avgMarketRent} onChange={(v) => upd({ avgMarketRent: v })} />
          <P label="Walk-in cap" value={f.walkInCapRate} onChange={(v) => upd({ walkInCapRate: v })} />
          <P label="Stabilized cap" value={f.stabilizedCapRate} onChange={(v) => upd({ stabilizedCapRate: v })} />
        </div>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="text-xs font-semibold text-slate-700">Financials (optional now, core of detailed UW later)</div>
          <p className="mb-2 text-[11px] text-slate-500">
            Upload the T-12 and rent roll. We&apos;ll do the napkin first; detailed underwriting is created from these when you pass napkin.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <UploadField label="T-12 (trailing 12 P&L)" file={t12} onPick={setT12} />
            <UploadField label="Rent roll" file={rentRoll} onPick={setRentRoll} />
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            Add to feed
          </button>
        </div>
      </form>
    </div>
  );
}

function UploadField({ label, file, onPick }: { label: string; file: File | null; onPick: (f: File | null) => void }) {
  return (
    <div>
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <label className="mt-0.5 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-2 py-1.5 text-xs hover:border-slate-400">
        <span className="rounded bg-slate-900 px-2 py-0.5 text-white">Choose</span>
        <span className="truncate text-slate-600">{file ? file.name : 'No file selected'}</span>
        <input
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv,.pdf"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
      </label>
    </div>
  );
}

function T({ label, value, onChange, className = '' }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-900 focus:outline-none"
      />
    </label>
  );
}

function N({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
      />
    </label>
  );
}

function P({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-medium text-slate-500">{label}</span>
      <div className="relative">
        <input
          type="number"
          value={+(value * 100).toFixed(2)}
          step={0.25}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full rounded-md border border-slate-300 py-1.5 pl-2 pr-5 text-sm tabular-nums focus:border-slate-900 focus:outline-none"
        />
        <span className="pointer-events-none absolute right-2 top-2 text-xs text-slate-400">%</span>
      </div>
    </label>
  );
}
