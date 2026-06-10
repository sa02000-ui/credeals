// Seed admin-authored game scenarios into the cloud `scenarios` table (upsert by id).
// Run: node scripts/seed-scenarios.mjs   (from the app/ directory)
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.NEXT_PUBLIC_SB_URL;
const KEY = env.SB_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) throw new Error('missing SB env');

/** Deep, simple-language scenarios (storylet style). Flags read by closing/exit logic: walk, sell. */
const scenarios = [
  // ----- C2C -----
  {
    id: 'title-surprise', title: 'Title surprise', phase: 'c2c', severity: 50, status: 'active', entry: 'start',
    notes: 'Owner example. Easement found in title search; layers: cure → refusal → holdback → standoff.',
    steps: {
      start: { id: 'start', speaker: 'Title officer', prompt: 'The title search found an old utility easement running across the back parcel. It clouds the title.', options: [
        { id: 'cure', label: 'Ask the seller to cure it', detail: 'They usually handle it — but it takes time, and some refuse.', tone: 'good', branches: [
          { weight: 65, result: 'The seller works with the utility and clears the easement. It costs you about two weeks.', effects: { days: 14 } },
          { weight: 35, next: 'refuse', result: 'The seller refuses — "buy it as it sits or don’t."' } ] },
        { id: 'carveout', label: 'Accept it with a title-policy carve-out', detail: 'Fast — but if the easement ever matters, that’s your problem.', tone: 'warn', result: 'You close on time. The easement is excluded from your title coverage — a latent risk you now own.', effects: { days: 2 } },
        { id: 'walk', label: 'Walk away', detail: 'Title risk is real risk.', tone: 'bad', effects: { set: { walk: true } }, result: 'You walk. Clean title matters more than this deal.' } ] },
      refuse: { id: 'refuse', speaker: 'Your attorney', prompt: 'We can still close safely: demand an escrow holdback so the seller’s money stays at the title company until the easement is resolved.', options: [
        { id: 'holdback', label: 'Demand a $50k escrow holdback', detail: 'Standard move; most sellers accept.', tone: 'good', branches: [
          { weight: 70, result: 'The seller agrees to the holdback. You’re protected and the close stays on track.', effects: { days: 5 } },
          { weight: 30, next: 'standoff', result: 'The seller balks at the holdback. Now it’s a staring contest.' } ] },
        { id: 'asis', label: 'Close as-is', detail: 'Keep the schedule, swallow the risk.', tone: 'bad', result: 'You close with the easement unresolved. If a utility crew ever shows up out back, it’s on you.' } ] },
      standoff: { id: 'standoff', speaker: 'Broker', prompt: 'The broker calls: "Both sides are dug in. What if we split the difference — a price credit instead of a holdback?"', options: [
        { id: 'split', label: 'Take a $25k price credit', detail: 'Half a loaf; deal closes.', tone: 'warn', effects: { cash: 25000, days: 3 }, result: 'Credit taken, deal closes. Not full protection, but you were paid for the risk.' },
        { id: 'walk2', label: 'Walk away', tone: 'bad', effects: { set: { walk: true } }, result: 'You hold the line and walk. The broker respects discipline — usually.' } ] },
    },
  },
  {
    id: 'tenant-estoppel', title: 'Estoppels reveal side deals', phase: 'c2c', severity: 55, status: 'active', entry: 'start',
    notes: 'Lease audit / estoppel surprise; teaches verifying income.',
    steps: {
      start: { id: 'start', speaker: 'DD team', prompt: 'Tenant estoppels came back: six tenants have side deals — free months and discounts that never made the rent roll. Real income is about $40k/yr lower than you underwrote.', options: [
        { id: 'retrade', label: 'Retrade: ask for a price cut', detail: 'The rent roll was wrong — that’s on the seller.', tone: 'good', branches: [
          { weight: 55, result: 'Faced with the estoppels, the seller cuts the price to match real income.', effects: { cash: 30000, days: 6 } },
          { weight: 45, next: 'refuse', result: 'The seller shrugs: "Buyers always find something. Price stands."' } ] },
        { id: 'absorb', label: 'Absorb it and re-underwrite', detail: 'Keep goodwill; your returns take the hit.', tone: 'warn', effects: { cash: -40000 }, result: 'You eat the difference. The broker notes you’re easy to deal with — for better and worse.' },
        { id: 'walk', label: 'Walk away', tone: 'bad', effects: { set: { walk: true } }, result: 'Misstated income is a character signal. You pass.' } ] },
      refuse: { id: 'refuse', speaker: 'Your attorney', prompt: 'There’s leverage left: your lender will cut the loan when they see the real income — the seller knows a re-sized loan can kill the deal entirely.', options: [
        { id: 'lender', label: 'Use the lender angle', detail: '"Work with us or the loan shrinks and we ALL lose the close."', tone: 'good', branches: [
          { weight: 60, result: 'The seller concedes a credit rather than risk the whole closing.', effects: { cash: 25000, days: 4 } },
          { weight: 40, result: 'The seller calls the bluff. You eat the income gap or walk — you eat it.', effects: { cash: -40000 } } ] },
        { id: 'eat', label: 'Drop it and close', tone: 'warn', effects: { cash: -40000 }, result: 'You close at the agreed price, with income you now know is lighter.' } ] },
    },
  },
  {
    id: 'rate-lock', title: 'Rate-lock gamble', phase: 'c2c', severity: 45, status: 'active', entry: 'start',
    notes: 'Lock vs float; teaches interest-rate risk during the close.',
    steps: {
      start: { id: 'start', speaker: 'Mortgage broker', prompt: 'Rates are jumpy this month. We can lock today for a fee, or float and hope rates drift down before closing.', options: [
        { id: 'lock', label: 'Lock the rate now', detail: 'Pay the fee, sleep at night.', tone: 'good', effects: { cash: -15000 }, result: 'Locked. Whatever the market does, your debt service is known.' },
        { id: 'float', label: 'Float it', detail: 'Free — until it isn’t.', tone: 'warn', branches: [
          { weight: 45, result: 'Rates drift DOWN. Floating saved you real money.', effects: { cash: 20000 } },
          { weight: 55, next: 'jump', result: 'Rates jump 40bps. Your DSCR just got squeezed.' } ] } ] },
      jump: { id: 'jump', speaker: 'Mortgage broker', prompt: 'At the new rate the lender’s DSCR test fails. Re-lock now at a worse rate, or shrink the loan and bring more equity?', options: [
        { id: 'relock', label: 'Re-lock at the higher rate', detail: 'Costs more every year of the hold.', tone: 'warn', effects: { cash: -25000 }, result: 'You lock the worse rate. The lesson is priced in now.' },
        { id: 'resize', label: 'Shrink the loan, add equity', detail: 'Protects DSCR; bigger check.', tone: 'warn', effects: { cash: -50000, days: 6 }, result: 'Smaller loan, safer deal, bigger equity check. Your investors notice both.' } ] },
    },
  },

  // ----- LOI (plays when LOI-phase scenarios get wired; authored now) -----
  {
    id: 'broker-pressure', title: 'Three LOIs on the table', phase: 'loi', severity: 50, status: 'active', entry: 'start',
    notes: 'Urgency while drafting the LOI; teaches speed + term quality vs overpaying.',
    steps: {
      start: { id: 'start', speaker: 'Broker', prompt: '"Heads up — we’re holding three LOIs and the seller decides this week. Where are you?"', options: [
        { id: 'sharpen', label: 'Sharpen your terms today', detail: 'Tighter DD, faster close, cleaner contingencies.', tone: 'good', effects: { days: 1 }, branches: [
          { weight: 70, next: 'shortlist', result: 'Your clean terms get you shortlisted.' },
          { weight: 30, next: 'lost', result: 'Someone simply paid more. It happens.' } ] },
        { id: 'stand', label: 'Stand on your current offer', detail: 'Discipline — but you may lose it.', tone: 'warn', branches: [
          { weight: 40, result: 'The seller likes your certainty of close and picks you anyway.', effects: {} },
          { weight: 60, next: 'lost', result: 'The seller went with a sharper offer.' } ] },
        { id: 'walk', label: 'Let it go', tone: 'bad', effects: { set: { walk: true } }, result: 'You pass rather than chase. There’s always another deal.' } ] },
      shortlist: { id: 'shortlist', speaker: 'Broker', prompt: '"You’re one of two. The seller will sign TONIGHT with whoever agrees to a 45-day close."', options: [
        { id: 'fast', label: 'Agree to the 45-day close', detail: 'Win the deal; your close just got tighter.', tone: 'warn', effects: { days: 0 }, result: 'Signed. Every workstream now runs on a compressed clock — slips will hurt.' },
        { id: 'hold', label: 'Hold at 60 days', detail: 'Protect your timeline.', tone: 'warn', branches: [
          { weight: 50, result: 'The seller takes certainty over speed. You win at 60 days.' },
          { weight: 50, next: 'lost', result: 'The other buyer took the 45 days. Deal lost.' } ] } ] },
      lost: { id: 'lost', speaker: 'Broker', prompt: '"Sorry — they went the other way. I’ll send you the next one early."', options: [
        { id: 'gracious', label: 'Thank them and stay close', detail: 'Brokers remember graceful losers.', tone: 'good', effects: { rep: { broker: 3 }, set: { walk: true } }, result: 'You lose the deal but gain the relationship. The next pocket listing comes to you first.' },
        { id: 'sour', label: 'Complain about the process', tone: 'bad', effects: { rep: { broker: -4 }, set: { walk: true } }, result: 'The broker goes quiet. That call-first relationship just cooled.' } ] },
    },
  },
  {
    id: 'deal-gone', title: 'You moved too slow', phase: 'napkin', severity: 40, status: 'active', entry: 'start',
    notes: 'Sourcing time pressure; fires when napkin drags (wiring later).',
    steps: {
      start: { id: 'start', speaker: 'Broker', prompt: '"While you were sharpening your pencil, another group went under contract on this one."', options: [
        { id: 'backup', label: 'Ask for backup position', detail: 'Deals fall out of contract all the time.', tone: 'good', branches: [
          { weight: 35, result: 'Three weeks later their financing cracks — the deal falls back to YOU.', effects: { days: 21 } },
          { weight: 65, result: 'It closes without a hiccup. This one’s gone.', effects: { set: { walk: true } } } ] },
        { id: 'moveon', label: 'Move on', detail: 'Speed is a skill.', tone: 'warn', effects: { set: { walk: true } }, result: 'Gone. Napkin math is supposed to take an afternoon, not a week.' } ] },
    },
  },

  // ----- AM (operating surprises) -----
  {
    id: 'roof-failure', title: 'Hail takes the roofs', phase: 'am', severity: 55, status: 'active', entry: 'start',
    notes: 'Insurance claim vs capex; ties to insurance decisions made at close.',
    steps: {
      start: { id: 'start', speaker: 'Property manager', prompt: 'A hailstorm hammered three buildings. Roofers say ~$120k of damage. File an insurance claim, or pay out of capex?', options: [
        { id: 'claim', label: 'File the claim', detail: 'That’s what insurance is for — but premiums remember.', tone: 'good', branches: [
          { weight: 60, result: 'Covered, minus your deductible. Premiums tick up at renewal.', effects: { cash: -25000 } },
          { weight: 40, next: 'fight', result: 'The carrier calls half of it "pre-existing wear." Partial denial.' } ] },
        { id: 'capex', label: 'Pay from capex, skip the claim', detail: 'Keeps your loss history clean.', tone: 'warn', effects: { cash: -120000 }, result: 'You eat it quietly. Renewal pricing stays friendly.' } ] },
      fight: { id: 'fight', speaker: 'Public adjuster', prompt: '"Carriers lowball first offers. Hire me — I take a cut, but I usually triple the payout."', options: [
        { id: 'adjuster', label: 'Hire the public adjuster', tone: 'good', branches: [
          { weight: 70, result: 'The adjuster re-scopes the loss and the carrier folds — most of it gets covered.', effects: { cash: -15000 } },
          { weight: 30, result: 'Months of fighting, little movement. You cover the gap.', effects: { cash: -60000 } } ] },
        { id: 'accept', label: 'Take the partial payout', tone: 'warn', effects: { cash: -60000 }, result: 'You take what they offer and fix the roofs.' } ] },
    },
  },
  {
    id: 'tax-reassessment', title: 'County reassessment', phase: 'am', severity: 50, status: 'active', entry: 'start',
    notes: 'Post-sale reassessment; teaches the annual tax-protest habit.',
    steps: {
      start: { id: 'start', speaker: 'County notice', prompt: 'The county reassessed the property at your purchase price. Property taxes jump ~$60k/yr — straight out of NOI.', options: [
        { id: 'protest', label: 'Protest with a tax consultant', detail: 'Costs a little; usually claws back a chunk.', tone: 'good', effects: { cash: -5000 }, branches: [
          { weight: 65, result: 'Partial win: assessment knocked down, only ~$20k/yr of the increase sticks.', effects: { cash: -20000 } },
          { weight: 35, result: 'The board holds firm this cycle. Full increase — protest again next year.', effects: { cash: -60000 } } ] },
        { id: 'pay', label: 'Just pay it', detail: 'Skip the fight.', tone: 'bad', effects: { cash: -60000 }, result: 'Full increase hits NOI. At your cap rate that’s real value gone — protest every year.' } ] },
    },
  },
  {
    id: 'big-moveout', title: 'The big employer leaves', phase: 'am', severity: 60, status: 'active', entry: 'start',
    notes: 'Occupancy shock; concessions vs holding rents.',
    steps: {
      start: { id: 'start', speaker: 'Property manager', prompt: 'The area’s biggest employer is relocating. Move-outs are spiking and tour traffic is down by half.', options: [
        { id: 'concessions', label: 'Offer concessions to hold occupancy', detail: 'One month free hurts revenue, vacancy hurts more.', tone: 'good', effects: { cash: -45000 }, result: 'Occupancy holds in the low 90s. Effective rents dip, the asset stays full and financeable.' },
        { id: 'hold', label: 'Hold rents and ride it out', detail: 'Protect the rent roll number.', tone: 'warn', branches: [
          { weight: 40, result: 'The market absorbs it — other employers backfill and occupancy recovers.', effects: {} },
          { weight: 60, next: 'recover', result: 'Occupancy slides to 84%. Cash flow is bleeding.' } ] } ] },
      recover: { id: 'recover', speaker: 'Asset manager', prompt: 'You need heads in beds. Short-term corporate housing leases can fill units fast — at hotel-style churn.', options: [
        { id: 'corporate', label: 'Sign corporate-housing leases', detail: 'Fills units now; high turnover, more management.', tone: 'warn', effects: { cash: -20000 }, result: 'Occupancy recovers on churny leases. Management load goes up — like running an RV park inside an apartment deal.' },
        { id: 'ride', label: 'Keep riding it out', tone: 'bad', effects: { cash: -80000 }, result: 'A long soft year. The market eventually turns, but the distribution checks paused.' } ] },
    },
  },
];

const res = await fetch(`${URL_}/rest/v1/scenarios`, {
  method: 'POST',
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify(scenarios),
});
if (!res.ok) { console.error(await res.text()); process.exit(1); }
const rows = await res.json();
console.log('seeded scenarios:', rows.map((r) => `${r.id} (${r.phase})`).join(', '));
