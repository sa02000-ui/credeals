/**
 * Coach (Ray Mendez) message library + Q&A (design doc Part 3/5).
 *
 * In GAME mode this surfaces as a chat panel (proactive nudges + answers to questions). In REAL mode
 * the SAME underlying knowledge surfaces as hover/pop-up info via the glossary — one knowledge base,
 * two presentations (owner's fundamental change #2). Pure: no React, no side effects.
 */

import { GLOSSARY, type LearnEntry } from '@/lib/learn/glossary';
import type { ExperienceProfile } from './gameTypes';

export interface CoachLine {
  trigger: string;
  text: string;
}

/** Pre-authored proactive lines, keyed by a trigger string. */
export const COACH_MESSAGES: CoachLine[] = [
  { trigger: 'buybox-prompt', text: "Start with your buy box. It's not a cage — it's a filter that keeps you from chasing deals that don't fit. You can widen it later, but discipline early is what separates operators from tire-kickers." },
  { trigger: 'buybox-too-broad', text: "That's a wide net. What's the ONE thing that must be true for you to seriously look at a deal? Narrow to that and the noise disappears." },
  { trigger: 'first-deal', text: "Pick a deal and run the napkin. Five minutes of math tells you whether it's worth a week of diligence. Most deals you'll pass on — that's the job." },
  { trigger: 'napkin-aggressive', text: "Your proforma rent is running well above in-place. That assumption is doing the heavy lifting in your returns. Is that rent achievable today, or is it aspirational? Underwrite to what's real and model the upside separately." },
  { trigger: 'napkin-conservative', text: "Conservative assumptions — I like it. You'll lose some competitive deals to aggressive buyers, but the ones you win will beat projections, and that's how you earn LP trust." },
  { trigger: 'detailed-enter', text: "Now we go deep. The napkin tells you whether to keep looking; the detailed model tells you whether to buy. Tie every line to the actual T-12 and rent roll — this is where you find out if the OM was telling the truth." },
  { trigger: 'loi-submit', text: "The LOI is where terms become leverage. Price gets the headline, but earnest money, DD window, and a clean financing contingency are what actually win — or lose — you the deal." },
  { trigger: 'c2c-enter', text: "Under contract — the clock is real now. Lender, appraisal, insurance, the raise, and diligence all run at once. Protect your earnest money: keep it refundable until you've cleared your contingencies." },
  { trigger: 'am-enter', text: "You own it. The deal you underwrote only happens if you execute the business plan — occupancy, NOI, and distributions are the scoreboard now. Watch the cards each quarter and don't let small problems compound." },
  { trigger: 'psa-missed', text: "You missed a clause in the PSA. The sneaky ones live in the boilerplate — EMD going hard at signing, capped repair credits, a survey exception. A 30-minute read saves a six-figure mistake." },
  { trigger: 'light-dd', text: "Light DD saves you cash now. Whatever's hiding in there, you'll find it post-close — at full price, with no seller left to recover from. A bindable insurance quote during DD is worth ten times its cost." },
  { trigger: 'lost-deal', text: "You lost it. Discipline in losing matters as much as discipline in winning — you didn't overpay for someone else's upside. Better deals are coming." },
  { trigger: 'closed-clean', text: "Clean close. That's how you build a reputation: brokers send their best deals to the buyer who closes without drama. Do this a few more times and you'll see off-market flow." },
  { trigger: 'market-shift', text: "The market just turned. Cap rates, rents, and equity availability all move with it. The financing call that was right last cycle can be wrong now — re-check your exit assumptions." },
  { trigger: 'retrade-warning', text: "A justified retrade is still a retrade — the market remembers. Surgical asks backed by evidence get more than aggressive asks without it." },
];

const INTROS: Record<ExperienceProfile, string> = {
  'brand-new': "Welcome. I'm Ray — I've closed a few hundred deals and lost enough to know where the bodies are buried. We'll go slow, I'll explain everything, and I'll stop you before you make the expensive mistakes. Let's build your buy box.",
  studied: "Good to meet you. You've done the reading — now let's turn theory into reps. I'll be here when you want a second opinion. Start with your buy box.",
  'some-experience': "You've got some deals behind you, so I'll stay out of your way and speak up when I see a mistake forming. Let's get to work — set your buy box.",
  mixed: "Some wins, some scars — that's most of us. I'll flag the patterns I see you repeating. Tighter capital this time, so be selective. Buy box first.",
  expert: "You know the game. I'll keep quiet unless you ask. Lean capital, tough counterparties — let's see what you've got. Define your box.",
};

export function getCoachIntro(profile: ExperienceProfile): string {
  return INTROS[profile] ?? INTROS['brand-new'];
}

export function getCoachMessage(trigger: string): string | null {
  return COACH_MESSAGES.find((m) => m.trigger === trigger)?.text ?? null;
}

/**
 * Answer a free-text player question. Reuses the GLOSSARY (the same knowledge that powers real-mode
 * hover tooltips) so the coach and the hovers never drift apart. Keyword match → glossary entry.
 */
export function answerCoachQuestion(question: string): string {
  const q = question.toLowerCase().trim();
  if (!q) return "Ask me anything — cap rates, DSCR, the waterfall, due diligence, how the LOI negotiation works…";
  if (/^(hi|hey|hello|yo|sup)\b/.test(q)) return "Hey. What are you working on? Ask me about any number, term, or step and I'll break it down.";
  if (/help|what can you|how do i play|stuck/.test(q)) return "Tell me where you are — buy box, napkin, detailed UW, LOI, contract-to-close, or asset management — and I'll walk you through the next move. Or ask about any term (cap rate, DSCR, promote, retrade…).";

  // score each glossary entry by keyword overlap with the question
  let best: { entry: LearnEntry; score: number } | null = null;
  for (const entry of Object.values(GLOSSARY)) {
    const hay = `${entry.title} ${entry.what}`.toLowerCase();
    const words = entry.title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    let score = 0;
    for (const w of words) if (q.includes(w)) score += 2;
    // a couple of high-value synonyms
    if (/cap rate|caprate/.test(q) && /cap rate/.test(hay)) score += 3;
    if (/irr|return/.test(q) && entry.title.toLowerCase().includes('irr')) score += 3;
    if (/dscr|coverage/.test(q) && entry.title.toLowerCase().includes('dscr')) score += 3;
    if (/waterfall|promote|split/.test(q) && /waterfall|promote/.test(hay)) score += 3;
    if (score > (best?.score ?? 0)) best = { entry, score };
  }
  if (best && best.score >= 2) {
    const e = best.entry;
    return e.app ? `${e.what}\n\nIn the app: ${e.app}` : e.what;
  }
  return "I don't have a clean answer for that one — try naming a specific term (cap rate, NOI, DSCR, promote, EMD, due diligence) or tell me which step you're on.";
}
