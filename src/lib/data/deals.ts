'use client';

import { dataClient } from '@/lib/supabase/dataClient';
import { readCookieSession } from '@/lib/supabase/token';
import type { AssetClass, DealStage, MarketDeal, SimMode } from '@/lib/sim';

/** DB row shape (subset we read). */
interface DealRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  msa: string | null;
  asset_class: AssetClass;
  vintage: number | null;
  unit_count: number | null;
  rentable_sqft: number | null;
  ask_price: number | string | null;
  economics: Record<string, number> | null;
  lookups: MarketDeal['lookups'] | null;
  stage: DealStage;
  sim_mode: SimMode;
  broker: string | null;
  source: string | null;
  blurb: string | null;
}

export function rowToDeal(row: DealRow): MarketDeal {
  const e = row.economics ?? {};
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    msa: row.msa ?? '',
    assetClass: row.asset_class,
    vintage: row.vintage ?? 0,
    unitCount: row.unit_count ?? 0,
    rentableSqft: row.rentable_sqft ?? 0,
    askPrice: Number(row.ask_price ?? 0),
    avgInPlaceRent: e.avgInPlaceRent ?? 0,
    avgMarketRent: e.avgMarketRent ?? 0,
    otherIncomePerUnitPerYr: e.otherIncomePerUnitPerYr ?? 0,
    expensePerUnit: e.expensePerUnit ?? 0,
    currentVacancy: e.currentVacancy ?? 0,
    stabilizedVacancy: e.stabilizedVacancy ?? 0,
    walkInCapRate: e.walkInCapRate ?? 0,
    stabilizedCapRate: e.stabilizedCapRate ?? 0,
    propertyRating: e.propertyRating ?? 3,
    locationRating: e.locationRating ?? 3,
    lookups: row.lookups ?? { medianHouseholdIncome: 0, floodZone: '', crimeIndex: 0, populationTrendPct: 0, rentGrowthYoYPct: 0 },
    broker: row.broker ?? '',
    source: row.source ?? '',
    blurb: row.blurb ?? '',
    custom: row.source === 'Added by you',
    simMode: row.sim_mode,
  };
}

function dealToInsert(d: MarketDeal, ownerId: string) {
  return {
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
    stage: 'new' as DealStage,
    sim_mode: (d.simMode ?? 'game') as SimMode,
    owner_id: ownerId,
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
  };
}

const SELECT = 'id,name,address,city,state,msa,asset_class,vintage,unit_count,rentable_sqft,ask_price,economics,lookups,stage,sim_mode,broker,source,blurb';

/** All deals visible to the user (RLS = view-all org). */
export async function listDeals(): Promise<{ deals: MarketDeal[]; stages: Record<string, DealStage> }> {
  const supabase = dataClient();
  const { data, error } = await supabase.from('deals').select(SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as DealRow[];
  const stages: Record<string, DealStage> = {};
  rows.forEach((r) => (stages[r.id] = r.stage));
  return { deals: rows.map(rowToDeal), stages };
}

export async function insertDeal(d: MarketDeal): Promise<MarketDeal> {
  const sess = readCookieSession();
  if (!sess) throw new Error('Not signed in');
  const supabase = dataClient();
  const { data, error } = await supabase.from('deals').insert(dealToInsert(d, sess.userId) as never).select(SELECT).single();
  if (error) throw error;
  return rowToDeal(data as unknown as DealRow);
}

export async function updateDealStage(id: string, stage: DealStage): Promise<void> {
  const supabase = dataClient();
  const { error } = await supabase.from('deals').update({ stage } as never).eq('id', id);
  if (error) throw error;
}
