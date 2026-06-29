/**
 * Simulated broker phone calls (text chat) — scripted, persona-flavored, distilled from the owner's
 * "Deal Finding" deck (scenarios 1-5). A call is just a branching Scenario played by ScenarioRunner:
 * the BROKER is the speaker, the OPTIONS are your lines, and the RESULT is the broker's reply.
 *
 * The broker is testing three things, in order (straight from the deck):
 *   1. Do you know your buy box?        (deck S1: "what's a buy box?" → broker hangs up)
 *   2. Do you have an equity source?    (deck S2: "no money, I'll raise it later" → broker hangs up)
 *   3. Can you talk shop / build rapport? (deck S3-S5: acknowledge the market, ask for struggling
 *      sellers → broker shares an off-market look)
 *
 * Outcome flags drive what happens next: hungUp (rep hit, no deal), warmedUp (on the list),
 * offMarket (a first-look off-market deal — wired to the deal feed once the deal DB exists).
 */

import type { Persona } from './personas';
import type { Scenario } from './scenarios';
import type { MarketCondition } from './gameEngine';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(items: T[], salt: string): T {
  return items[hash(salt) % items.length];
}

/** Build a broker-call conversation flavored by the broker persona. */
export function buildBrokerCall(
  broker: Persona,
  opts?: { salt?: number; market?: MarketCondition },
): Scenario {
  const name = broker.name;
  // Institutional brokers are tougher screeners; relationship/pocket brokers warm faster.
  const tough = broker.traits.competitiveness != null && broker.traits.competitiveness >= 0.8;
  const salt = String(opts?.salt ?? 0);
  const openPrompt = pick(
    [
      `"${name} here. ${tough ? 'I run competitive processes, so be quick —' : 'Thanks for the call —'} what are you looking for?"`,
      `"Hey, ${name}. ${tough ? 'I need concise buyers who can execute.' : 'Happy to talk.'} What product and market are you targeting?"`,
      `"You've got ${name}. ${opts?.market === 'hot' ? 'Phones are blowing up in this market —' : 'Give me your read —'} what's your acquisition box?"`,
    ],
    `${broker.id}:open:${salt}:${opts?.market ?? 'balanced'}`,
  );
  const equityPrompt = pick(
    [
      `"And how do you fund these? What's your equity source?"`,
      `"Great. Talk me through capital certainty — where does your equity come from?"`,
      `"Before I send anything: who are your LPs and how quickly can you fund earnest money?"`,
    ],
    `${broker.id}:equity:${salt}`,
  );
  const askPrompt = pick(
    [
      `"So — what can I do for you?"`,
      `"Alright, you've got my attention. What exactly are you asking for?"`,
      `"Say I trust you can close. What kind of look do you want first?"`,
    ],
    `${broker.id}:ask:${salt}`,
  );

  return {
    id: `broker-call-${broker.id}`,
    title: `📞 Cold call — ${name}`,
    entry: 'open',
    steps: {
      open: {
        id: 'open',
        speaker: name,
        prompt: openPrompt,
        options: [
          {
            id: 'buybox',
            label: 'Give a crisp buy box',
            detail: 'e.g. "Value-add MF, TX Triangle, 50–200 doors; we own 3, growing to 10."',
            tone: 'good',
            effects: { set: { knowsBuyBox: true } },
            result: `"Okay — you actually know what you want. That already puts you ahead of most callers."`,
            next: 'equity',
          },
          {
            id: 'whats',
            label: '"Do you have anything? What kind of deals do you do?"',
            detail: 'You haven\'t led with a buy box.',
            tone: 'warn',
            effects: { set: { vague: true } },
            result: `"...What's your buy box? Market, asset type, size?" (He's giving you one more shot.)`,
            next: 'recover',
          },
          {
            id: 'cashflow',
            label: '"Anything that cash-flows, really."',
            detail: 'Sounds like a tire-kicker.',
            tone: 'bad',
            effects: { rep: { broker: -5 }, set: { hungUp: true } },
            result: `"Everybody wants that. When you can tell me a market and a box, call me back." *click*`,
          },
        ],
      },
      recover: {
        id: 'recover',
        speaker: name,
        prompt: `"Go ahead — give me your box."`,
        options: [
          {
            id: 'buybox2',
            label: 'Name your market, asset, size, and plan',
            detail: 'Recover with specifics.',
            tone: 'good',
            effects: { rep: { broker: 1 }, set: { knowsBuyBox: true } },
            result: `"There we go. Okay."`,
            next: 'equity',
          },
          {
            id: 'whatsbuybox',
            label: '"What\'s a buy box?"',
            detail: 'The deck\'s scenario 1.',
            tone: 'bad',
            effects: { rep: { broker: -6 }, set: { hungUp: true } },
            result: `"...I've got another call. Good luck out there." *click* — He won't remember you fondly.`,
          },
        ],
      },
      equity: {
        id: 'equity',
        speaker: name,
        prompt: equityPrompt,
        options: [
          {
            id: 'proof',
            label: '"LP relationships + proof of funds; we\'ve closed several."',
            detail: 'Show you can actually close.',
            tone: 'good',
            effects: { rep: { broker: 6 }, set: { credible: true } },
            result: `"Good — certainty of close matters to my sellers more than the top number. I can work with that."`,
            next: 'ask',
          },
          {
            id: 'balance',
            label: '"We co-invest, then raise the rest from our investor list."',
            detail: 'Reasonable and honest.',
            tone: 'good',
            effects: { rep: { broker: 3 }, set: { credible: true } },
            result: `"Okay, that's a real structure. Fair enough."`,
            next: 'ask',
          },
          {
            id: 'raiselater',
            label: '"No money of my own — I\'ll raise it once it\'s under contract."',
            detail: 'The deck\'s scenario 2.',
            tone: 'bad',
            effects: { rep: { broker: -4 }, set: { hungUp: true } },
            result: `"Call me when you have committed capital. I can't bring a no-money buyer to my seller." *click*`,
          },
        ],
      },
      ask: {
        id: 'ask',
        speaker: name,
        prompt: askPrompt,
        options: [
          {
            id: 'rapport',
            label: 'Talk shop: acknowledge the tough market, ask where sellers are struggling',
            detail: 'Build rapport; ask for the deals nobody\'s shopping.',
            tone: 'good',
            effects: { rep: { broker: 5 }, set: { warmedUp: true } },
            branches: [
              { weight: tough ? 0.5 : 0.75, result: `"...Between us, I've got one coming that isn't on market yet. Let me send it to you first." 🤝`, effects: { set: { offMarket: true } } },
              { weight: tough ? 0.5 : 0.25, result: `"Nothing off-market right now, but you're on my short list — I'll call you first when something fits."`, effects: { set: { shortlist: true } } },
            ],
          },
          {
            id: 'list',
            label: '"Just add me to your distribution list."',
            detail: 'You\'ll see what everyone sees.',
            tone: 'warn',
            effects: { rep: { broker: 1 }, set: { warmedUp: true, onList: true } },
            result: `"Done. You'll get the blasts like everyone else." (On-market only — the picked-over stuff.)`,
          },
          {
            id: 'pushy',
            label: '"Send me your best deal at a discount."',
            detail: 'Demanding, with no relationship yet.',
            tone: 'bad',
            effects: { rep: { broker: -3 } },
            result: `"That's not how this works. Build a little trust first." (He's cooler now.)`,
          },
        ],
      },
    },
  };
}

export interface BrokerAdlibOutcome {
  headline: string;
  brokerReply: string;
  lesson: string;
  lead: 'off-market' | 'on-market' | 'shortlist' | 'none';
  repBrokerDelta: number;
}

/**
 * Fast free-form broker line evaluator: accepts a typed/voice sentence and turns it into
 * credibility + relationship signals. This keeps broker calls feeling alive beyond static buttons.
 */
export function evaluateBrokerAdlib(
  line: string,
  broker: Persona,
  market: MarketCondition,
  brokerRep: number,
): BrokerAdlibOutcome {
  const txt = line.toLowerCase().trim();
  if (!txt) {
    return {
      headline: 'No line sent.',
      brokerReply: "I can't help if I don't know your criteria.",
      lesson: 'Lead with specifics: buy box, certainty of close, and capital source.',
      lead: 'none',
      repBrokerDelta: -1,
    };
  }

  const hasBuyBox =
    /(multifamily|mf|units|doors|value-add|vintage|cap rate|houston|dallas|austin|san antonio|tx|texas|market)/.test(
      txt,
    );
  const hasCapital =
    /(lp|equity|proof of funds|funded|capital|investors|co-gp|family office|lender)/.test(txt);
  const hasCertainty =
    /(certainty|close|clean close|timeline|hard money|earnest|non-refundable|execute)/.test(txt);
  const asksOffMarket = /(off market|off-market|quiet|pocket|first look|before market)/.test(txt);
  const weakSignal = /(anything|whatever|best deal|cheap|discount|send me everything)/.test(txt);
  const relationshipTone = /(long term|relationship|repeat|trust|transparent|feedback)/.test(txt);

  let score = 0;
  if (hasBuyBox) score += 2;
  if (hasCapital) score += 2;
  if (hasCertainty) score += 2;
  if (asksOffMarket) score += 1;
  if (relationshipTone) score += 1;
  if (weakSignal) score -= 3;
  if (market === 'hot') score -= 1; // in hot markets standards are tougher
  if ((broker.traits.competitiveness ?? 0) >= 0.8) score -= 1;
  if (brokerRep >= 65) score += 1;

  if (score <= 0) {
    return {
      headline: 'Broker stayed cold.',
      brokerReply:
        "That's still too vague for me to put you in front of a seller. Tighten your box and show capital certainty.",
      lesson: 'Specificity beats enthusiasm. A tight acquisition brief opens doors.',
      lead: 'none',
      repBrokerDelta: -3,
    };
  }
  if (score <= 3) {
    return {
      headline: 'You stayed on-market.',
      brokerReply:
        "You're in my blast list. Show me a clean close or better prep and I'll prioritize you.",
      lesson: 'You are credible enough for on-market flow, not yet first-call status.',
      lead: 'on-market',
      repBrokerDelta: 1,
    };
  }
  if (score <= 5) {
    return {
      headline: 'You made the shortlist.',
      brokerReply:
        "Good framing. I'll keep you in the first wave when something fits your box.",
      lesson: 'Shortlist status is the bridge to off-market looks.',
      lead: 'shortlist',
      repBrokerDelta: 3,
    };
  }
  return {
    headline: 'You earned a warmer look.',
    brokerReply:
      "This is what I need to hear. I've got a quiet one that might fit — I'll send it to you first.",
    lesson: 'Clear criteria + capital certainty + execution language unlocks off-market trust.',
    lead: 'off-market',
    repBrokerDelta: 6,
  };
}

/** Summarize a finished call from its flags → headline + whether a deal lead was earned. */
export function brokerCallOutcome(flags: Record<string, boolean>): { headline: string; lesson: string; lead: 'off-market' | 'on-market' | 'shortlist' | 'none' } {
  if (flags.hungUp) {
    return {
      headline: 'The broker hung up.',
      lesson: 'Brokers screen hard. Lead with a crisp buy box and a real equity source — they protect their seller relationships and won\'t waste a look on someone who can\'t close.',
      lead: 'none',
    };
  }
  if (flags.offMarket) {
    return {
      headline: 'You earned an off-market first look. 🤝',
      lesson: 'This is how the best deals move — relationships, not listings. Off-market looks go to buyers who are credible and easy to deal with.',
      lead: 'off-market',
    };
  }
  if (flags.shortlist) {
    return { headline: 'You made the broker\'s short list.', lesson: 'Not a deal yet, but you\'re top of mind — that\'s how off-market flow starts.', lead: 'shortlist' };
  }
  if (flags.onList) {
    return { headline: 'You\'re on the distribution list.', lesson: 'You\'ll see on-market deals like everyone else. Fine for volume, but the edge is in the off-market conversations.', lead: 'on-market' };
  }
  return { headline: 'Call ended.', lesson: 'Keep working brokers — daily effort compounds into deal flow.', lead: 'none' };
}
