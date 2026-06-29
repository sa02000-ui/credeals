'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { SimDisclaimer } from '@/components/SimDisclaimer';
import { PROFILE_CONFIGS, getCoachIntro, getCoachMessage, usd, type ExperienceProfile } from '@/lib/sim';

const PACES: { min: number; label: string; note: string }[] = [
  { min: 2, label: 'Faster', note: 'days fly by — more pressure' },
  { min: 5, label: 'Medium pace', note: 'a balanced clock' },
  { min: 10, label: 'Slower pace', note: 'more time to think each day' },
];
const PROFILE_ORDER: ExperienceProfile[] = ['brand-new', 'studied', 'some-experience', 'mixed', 'expert'];

/**
 * Day-0 onboarding: experience profile → clock pace + a few narrative questions → coach intro + the
 * process map + ground rules. Sets the profile (cash/carry/coaching/difficulty), seeds the session +
 * coach chat, and finishes by dropping the player into their BUY BOX (broker outreach now lives in the
 * deal-hunting step, after the buy box is defined). Shown when game mode is on and onboarding isn't done.
 */
export function OnboardingFlow() {
  const { setExperienceProfile, completeOnboarding, addCoachMessage, setMode } = useApp();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ExperienceProfile | null>(null);
  const [speed, setSpeed] = useState(2);
  const [market, setMarket] = useState('');
  const [why, setWhy] = useState('');
  const [vision, setVision] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);

  function finish() {
    if (!profile) return;
    setExperienceProfile(profile, speed);
    addCoachMessage({ from: 'coach', text: getCoachIntro(profile), trigger: 'intro' });
    addCoachMessage({ from: 'coach', text: getCoachMessage('buybox-prompt') ?? '', trigger: 'buybox-prompt' });
    completeOnboarding();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* progress */}
        <div className="flex gap-1 px-5 pt-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <>
              <div className="text-center">
                <div className="text-5xl">🏗️</div>
                <h2 className="mt-2 text-3xl font-bold text-slate-900">Become a real-estate sponsor</h2>
                <p className="mt-2 text-base text-slate-600">Buy, improve, and exit deals to grow your net worth — learning real underwriting as you play.</p>
              </div>
              <h3 className="mt-6 text-lg font-semibold text-slate-900">What is your experience level?</h3>
              <p className="mt-1 text-sm text-slate-600">This sets your starting cash, daily carry cost, how much coaching you are given at each step and how tough counterparties are.</p>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {PROFILE_ORDER.map((p) => {
                  const cfg = PROFILE_CONFIGS[p];
                  return (
                    <button key={p} onClick={() => { setProfile(p); setStep(1); }} className={`rounded-xl border-2 p-4 text-left transition hover:border-slate-900 hover:bg-slate-50 ${profile === p ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-bold text-slate-900">{cfg.label}</span>
                        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{usd(cfg.startingCash, { compact: true })} · ${cfg.carryPerDay}/day</span>
                      </div>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{cfg.blurb}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 text-center">
                <button onClick={() => setMode('real')} className="text-sm text-slate-500 underline hover:text-slate-800">or switch to Real mode (work an actual deal — no game layer)</button>
              </div>
              <SimDisclaimer variant="box" className="mt-4" />
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-2xl font-bold text-slate-900">Set the pace, then tell me about you</h2>
              <h3 className="mt-5 text-lg font-semibold text-slate-900">How fast should the clock run?</h3>
              <p className="mt-1 text-sm text-slate-600">This is how much real time passes per simulated day. The clock and your daily carrying costs run the whole time you play.</p>
              <div className="mt-3 grid grid-cols-3 gap-2.5">
                {PACES.map((p) => (
                  <button key={p.min} onClick={() => setSpeed(p.min)} className={`rounded-xl border-2 px-3 py-3 text-center transition ${speed === p.min ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                    <div className="text-base font-bold">{p.label}</div>
                    <div className={`text-xs font-semibold ${speed === p.min ? 'text-slate-200' : 'text-slate-500'}`}>{p.min} real min = 1 sim day</div>
                    <div className={`mt-1 text-[11px] leading-tight ${speed === p.min ? 'text-slate-300' : 'text-slate-400'}`}>{p.note}</div>
                  </button>
                ))}
              </div>
              <h3 className="mt-6 text-lg font-semibold text-slate-900">A few questions <span className="text-sm font-normal text-slate-500">(optional — sets the tone)</span></h3>
              <div className="mt-2.5 space-y-2.5">
                <Q label="What market are you based in?" value={market} onChange={setMarket} placeholder="e.g. Dallas–Fort Worth" />
                <Q label="What drew you to commercial real estate?" value={why} onChange={setWhy} placeholder="e.g. cash flow + building something real" />
                <Q label="What does success look like in 5 years?" value={vision} onChange={setVision} placeholder="e.g. 1,000 units, replace my W-2 income" />
              </div>
              <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} />
            </>
          )}

          {step === 2 && profile && (
            <>
              <div className="flex items-center gap-2.5">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-indigo-600 text-xl font-bold text-white">R</span>
                <div>
                  <div className="text-base font-bold text-slate-900">Ray Mendez</div>
                  <div className="text-sm text-slate-500">Your coach</div>
                </div>
              </div>
              <p className="mt-4 rounded-xl bg-indigo-50 p-4 text-base leading-relaxed text-slate-800">{getCoachIntro(profile)}</p>
              <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-medium leading-relaxed text-amber-800">
                💬 You can open <b>Ray</b> anytime from the “Ask Ray” button (bottom-right) to ask about any term, number, or what to do next — don’t hesitate to use him.
              </p>

              <div className="mt-4 rounded-xl border border-slate-200 p-4">
                <div className="text-sm font-bold text-slate-900">The journey ahead</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-700">
                  You’ll <b>define your buy box</b> → <b>hunt for deals</b> → <b>underwrite</b> them (a quick Napkin pass, then detailed) and decide whether to offer → <b>negotiate the LOI</b> (Letter of Intent) → <b>negotiate the PSA</b> (Purchase &amp; Sale Agreement) → work through <b>C2C</b> (Contract-to-Close) → <b>close</b> the deal → and <b>operate it (Asset Management)</b> all the way to exit.
                </p>
              </div>

              <button onClick={() => setRulesOpen((v) => !v)} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-slate-100">
                📋 Rules of Engagement <span className="ml-auto text-slate-400">{rulesOpen ? '▾' : '▸'}</span>
              </button>
              {rulesOpen && (
                <ul className="mt-2 space-y-1.5 rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-700">
                  <li>• <b>The goal is to learn.</b> There’s a lot of detail here — take your time, and <b>hover the ⓘ icons</b> (and other spots with hidden info). The more you read and learn, the more <b>🪙 Gold</b> you earn.</li>
                  <li>• We simulate <b>1 real-life day in the minutes you chose</b> — you picked <b>{speed} minutes / day</b>.</li>
                  <li>• With each passing day, a <b>carry cost</b> lowers your cash, whether or not you’re working a deal.</li>
                  <li>• The <b>type of deals you get</b> depends on how you choose to hunt for them.</li>
                  <li>• Your <b>underwriting and negotiation</b> (LOI, PSA, C2C) determine whether you actually win the deal.</li>
                  <li>• Your <b>Asset Management results</b> depend mostly on <b>how well you operate it and on market conditions</b> — but are also influenced by the deal you pick, how well you underwrote it, your due diligence, and how well you negotiated.</li>
                </ul>
              )}

              <div className="mt-5 flex justify-between">
                <button onClick={() => setStep(1)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">← Back</button>
                <button onClick={finish} className="rounded-lg bg-indigo-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-indigo-700">Start — define your buy box →</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Q({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-0.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" />
    </label>
  );
}

function NavRow({ onBack, onNext }: { onBack: () => void; onNext?: () => void }) {
  return (
    <div className="mt-6 flex justify-between">
      <button onClick={onBack} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">← Back</button>
      {onNext && <button onClick={onNext} className="rounded-lg bg-slate-900 px-5 py-2 text-base font-semibold text-white hover:bg-slate-800">Continue →</button>}
    </div>
  );
}
