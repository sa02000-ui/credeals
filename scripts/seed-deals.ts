// One-time: seed the demo multifamily deals into Supabase (sim_mode='game'), owned by the owner.
// Run from app/:  node scripts/seed-deals.ts
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { SEED_DEALS } from '../src/lib/sim/seed.ts';

const OWNER_ID = '67c9c90d-f26c-4f12-b1a7-30514c2764d8'; // sa02000@gmail.com

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SB_URL, env.SB_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { count } = await sb.from('deals').select('*', { count: 'exact', head: true }).eq('sim_mode', 'game');
if (count && count > 0) {
  console.log(`already have ${count} game deals — skipping seed.`);
  process.exit(0);
}

const rows = SEED_DEALS.map((d) => ({
  name: d.name,
  address: d.address,
  city: d.city,
  state: d.state,
  msa: d.msa,
  asset_class: d.assetClass,
  vintage: d.vintage,
  unit_count: d.unitCount,
  rentable_sqft: d.rentableSqft,
  ask_price: d.askPrice,
  broker: d.broker,
  source: d.source,
  blurb: d.blurb,
  stage: 'new',
  sim_mode: 'game',
  owner_id: OWNER_ID,
  economics: {
    avgInPlaceRent: d.avgInPlaceRent,
    avgMarketRent: d.avgMarketRent,
    otherIncomePerUnitPerYr: d.otherIncomePerUnitPerYr,
    expensePerUnit: d.expensePerUnit,
    currentVacancy: d.currentVacancy,
    stabilizedVacancy: d.stabilizedVacancy,
    walkInCapRate: d.walkInCapRate,
    stabilizedCapRate: d.stabilizedCapRate,
    propertyRating: d.propertyRating,
    locationRating: d.locationRating,
  },
  lookups: d.lookups,
}));

const { data, error } = await sb.from('deals').insert(rows).select('id,name');
if (error) {
  console.error('seed error:', error);
  process.exit(1);
}
console.log(`seeded ${data.length} deals:`, data.map((d) => d.name).join(', '));
