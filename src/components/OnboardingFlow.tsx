'use client';

import { useState } from 'react';
import { useApp } from '@/lib/store';
import { PROFILE_CONFIGS, getCoachIntro, getCoachMessage, usd, type ExperienceProfile } from '@/lib/sim';

const SPEEDS = [2, 5, 10];
const PROFILE_ORDER: ExperienceProfile[] = ['brand-new', 'studied', 'some-experience', 'mixed', 'expert'];
type Outreach = 'call' | 'email' | 'skip';

/**
 * Day-0 onboarding (design doc Part 3): experience profile → clock pace + narrative → coach intro →
 * broker outreach. Sets the profile (cash/carry/coaching/difficulty), seeds the session, and starts
 * the clock only when finished. Shown when game mode is on and onboarding isn't complete.
 */
export function OnboardingFlow() {
  const { setExperienceProfile, completeOnboarding, addCoachMessage, applyGameOutcome, setMode } = useApp();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ExperienceProfile | null>(null);
  const [speed, setSpeed] = useState(2);
  const [market, setMarket] = useState('');
  const [why, setWhy] = useState('');
  const [vision, setVision] = useState('');

  function finish(outreach: Outreach) {
    if (!profile) return;
    setExperienceProfile(profile, speed);
    // broker outreach seeds your standing (design doc Days 1-5)
    if (outreach === 'call') applyGameOutcome({ repDelta: { broker: 10 }, event: { title: 'Reached out to brokers', detail: 'You called Marcus Chen, shared your buy box, and sent proof of funds.', lesson: 'The operators who consistently close are in conversations with brokers BEFORE deals hit market.' } });
    else if (outreach === 'email') applyGameOutcome({ repDelta: { broker: 5 }, event: { title: 'Emailed brokers', detail: 'You sent a brief intro to the brokers in your market.' } });
    else applyGameOutcome({ event: { title: 'Skipped broker outreach', detail: 'You went straight to the deal feed.', lesson: 'The feed is where everyone shops. Relationships are where deals happen — reach out to brokers early next time.' } });
    // seed the coach chat
    addCoachMessage({ from: 'coach', text: getCoachIntro(profile), trigger: 'intro' });
    addCoachMessage({ from: 'coach', text: getCoachMessage('buybox-prompt') ?? '', trigger: 'buybox-prompt' });
    completeOnboarding();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* progress */}
        <div className="flex gap-1 px-5 pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 0 && (
            <>
              <div className="text-center">
                <div className="text-4xl">🏗️</div>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">Become a real-estate sponsor</h2>
                <p className="mt-1 text-sm text-slate-600">Buy, improve, and exit deals to grow your net worth — learning real underwriting as you play.</p>
              </div>
              <h3 className="mt-5 text-sm font-semibold text-slate-800">How experienced are you?</h3>
              <p className="text-[11px] text-slate-500">Sets your starting cash, daily carry, how much your coach speaks up, and how tough counterparties are.</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PROFILE_ORDER.map((p) => {
                  const cfg = PROFILE_CONFIGS[p];
                  return (
                    <button key={p} onClick={() => { setProfile(p); setStep(1); }} className={`rounded-xl border-2 p-3 text-left transition hover:border-slate-900 hover:bg-slate-50 ${profile === p ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-slate-900">{cfg.label}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">{usd(cfg.startingCash, { compact: true })} · ${cfg.carryPerDay}/day</span>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{cfg.blurb}</p>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 text-center">
                <button onClick={() => setMode('real')} className="text-xs text-slate-400 underline hover:text-slate-700">or switch to Real mode (work an actual deal — no game layer)</button>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-xl font-bold text-slate-900">Set the pace, then tell me about you</h2>
              <h3 className="mt-4 text-sm font-semibold text-slate-800">Clock pace</h3>
              <p className="text-[11px] text-slate-500">Real minutes per simulated day. Slower = more time to think; the clock and carrying costs run while you play.</p>
              <div className="mt-1.5 flex gap-2">
                {SPEEDS.map((s) => (
                  <button key={s} onClick={() => setSpeed(s)} className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold ${speed === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{s} min / day</button>
                ))}
              </div>
              <h3 className="mt-5 text-sm font-semibold text-slate-800">A few questions (optional — sets the tone)</h3>
              <div className="mt-2 space-y-2">
                <Q label="What market are you based in?" value={market} onChange={setMarket} placeholder="e.g. Dallas–Fort Worth" />
                <Q label="What drew you to commercial real estate?" value={why} onChange={setWhy} placeholder="e.g. cash flow + building something real" />
                <Q label="What does success look like in 5 years?" value={vision} onChange={setVision} placeholder="e.g. 1,000 units, replace my W-2 income" />
              </div>
              <NavRow onBack={() => setStep(0)} onNext={() => setStep(2)} />
            </>
          )}

          {step === 2 && profile && (
            <>
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-600 text-lg font-bold text-white">R</span>
                <div>
                  <div className="text-sm font-bold text-slate-900">Ray Mendez</div>
                  <div className="text-[11px] text-slate-500">Your coach</div>
                </div>
              </div>
              <p className="mt-4 rounded-xl bg-indigo-50 p-4 text-sm leading-relaxed text-slate-800">{getCoachIntro(profile)}</p>
              <p className="mt-3 text-[11px] text-slate-500">You can open Ray anytime from the “Ask Ray” button to ask about any term, number, or what to do next.</p>
              <NavRow onBack={() => setStep(1)} onNext={() => setStep(3)} />
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold text-slate-900">Before you shop the feed — reach out to brokers?</h2>
              <p className="mt-1 text-sm text-slate-600">Deals happen in relationships, not listings. How you start with brokers shapes the deal flow you'll see.</p>
              <div className="mt-3 space-y-2">
                <OutreachOpt title="Call Marcus Chen + send proof of funds" detail="Broker starts warm (+rep). You'll get a heads-up on deals before they hit market." tone="good" onClick={() => finish('call')} />
                <OutreachOpt title="Send a brief intro email" detail="Broker knows your name (small +rep). No early access." tone="warn" onClick={() => finish('email')} />
                <OutreachOpt title="Skip it — go straight to the feed" detail="You'll see only what's already on the open market." tone="bad" onClick={() => finish('skip')} />
              </div>
              <NavRow onBack={() => setStep(2)} />
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
      <span className="text-[11px] text-slate-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
    </label>
  );
}

function NavRow({ onBack, onNext }: { onBack: () => void; onNext?: () => void }) {
  return (
    <div className="mt-5 flex justify-between">
      <button onClick={onBack} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">← Back</button>
      {onNext && <button onClick={onNext} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">Continue →</button>}
    </div>
  );
}

function OutreachOpt({ title, detail, tone, onClick }: { title: string; detail: string; tone: 'good' | 'warn' | 'bad'; onClick: () => void }) {
  const ring = tone === 'good' ? 'hover:border-emerald-500' : tone === 'warn' ? 'hover:border-amber-500' : 'hover:border-slate-400';
  return (
    <button onClick={onClick} className={`block w-full rounded-xl border-2 border-slate-200 p-3 text-left transition hover:bg-slate-50 ${ring}`}>
      <div className="text-sm font-semibold text-slate-800">{title}</div>
      <div className="mt-0.5 text-xs text-slate-500">{detail}</div>
    </button>
  );
}
