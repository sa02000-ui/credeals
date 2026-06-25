// Server-only: real property/location intelligence from free government APIs.
//  - U.S. Census Geocoder (no key): address -> lat/lon + census tract
//  - U.S. Census ACS (needs free CENSUS_API_KEY): median household income + population
//  - FEMA NFHL (no key): flood zone at the point
// Anything unavailable degrades gracefully to null (UI shows "estimate"/"add key").

export interface LookupSource {
  label: string;
  value: string;
  source: string;
  real: boolean;
}

/** Census-tract housing/market profile (area-level, not the specific parcel). */
export interface AreaProfile {
  medianRent: number | null;
  medianHomeValue: number | null;
  medianYearBuilt: number | null;
  pctRenter: number | null; // 0..1
  pctMultifamily: number | null; // share of 5+ unit structures, 0..1
  predominantStructure: string | null; // 'Single-family' | '2–4 units' | '5+ units (multifamily)'
}

/** Best-effort building facts for the specific parcel from OpenStreetMap (often sparse in the US). */
export interface BuildingInfo {
  type: string | null; // OSM building tag (apartments, house, commercial, retail…)
  levels: number | null;
  units: number | null;
  name: string | null;
}

export interface PropertyLookup {
  ok: boolean;
  query: string;
  matchedAddress?: string;
  city?: string;
  state?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  tract?: { state: string; county: string; tract: string };
  medianHouseholdIncome: number | null;
  population: number | null;
  floodZone: string | null;
  area?: AreaProfile;
  building?: BuildingInfo | null;
  sources: LookupSource[];
  note?: string;
}

interface Geo {
  matchedAddress: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lon: number;
  tract: { state: string; county: string; tract: string };
}

async function geocode(address: string): Promise<Geo | null> {
  const url =
    `https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress?address=${encodeURIComponent(address)}` +
    `&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const j = await res.json();
  const m = j?.result?.addressMatches?.[0];
  if (!m) return null;
  const t = m.geographies?.['Census Tracts']?.[0];
  // matchedAddress: "4400 WESTERN CENTER BLVD, FORT WORTH, TX, 76137"
  const parts = String(m.matchedAddress).split(',').map((s: string) => s.trim());
  return {
    matchedAddress: m.matchedAddress,
    city: parts[1] ?? '',
    state: parts[2] ?? '',
    zip: parts[3] ?? '',
    lat: m.coordinates.y,
    lon: m.coordinates.x,
    tract: { state: t?.STATE ?? '', county: t?.COUNTY ?? '', tract: t?.TRACT ?? '' },
  };
}

// ACS sentinel values for "not available" are large negatives (e.g. -666666666); treat as null.
const acsNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Variable order must match the parsing below.
const ACS_VARS = [
  'B19013_001E', // 0 median household income
  'B01003_001E', // 1 tract population
  'B25064_001E', // 2 median gross rent
  'B25077_001E', // 3 median home value
  'B25035_001E', // 4 median year structure built
  'B25003_001E', // 5 occupied units (total)
  'B25003_003E', // 6 renter-occupied units
  'B25024_001E', // 7 structures (total)
  'B25024_002E', // 8 1-unit detached
  'B25024_003E', // 9 1-unit attached
  'B25024_004E', // 10 2 units
  'B25024_005E', // 11 3-4 units
  'B25024_006E', // 12 5-9 units
  'B25024_007E', // 13 10-19 units
  'B25024_008E', // 14 20-49 units
  'B25024_009E', // 15 50+ units
] as const;

async function acs(t: Geo['tract']): Promise<{ income: number | null; population: number | null; area: AreaProfile | null }> {
  const key = process.env.CENSUS_API_KEY;
  if (!key || !t.tract) return { income: null, population: null, area: null };
  try {
    const url =
      `https://api.census.gov/data/2022/acs/acs5?get=${ACS_VARS.join(',')}` +
      `&for=tract:${t.tract}&in=state:${t.state}+county:${t.county}&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const j = await res.json();
    const row: unknown[] | undefined = j?.[1];
    if (!row) return { income: null, population: null, area: null };

    const income = acsNum(row[0]);
    const population = acsNum(row[1]);
    const occupied = acsNum(row[5]);
    const renter = acsNum(row[6]);
    const total = acsNum(row[7]) ?? 0;
    const singleFamily = (acsNum(row[8]) ?? 0) + (acsNum(row[9]) ?? 0);
    const twoToFour = (acsNum(row[10]) ?? 0) + (acsNum(row[11]) ?? 0);
    const fivePlus = (acsNum(row[12]) ?? 0) + (acsNum(row[13]) ?? 0) + (acsNum(row[14]) ?? 0) + (acsNum(row[15]) ?? 0);

    let predominantStructure: string | null = null;
    if (total > 0) {
      const max = Math.max(singleFamily, twoToFour, fivePlus);
      predominantStructure = max === fivePlus ? '5+ units (multifamily)' : max === twoToFour ? '2–4 units' : 'Single-family';
    }

    const area: AreaProfile = {
      medianRent: acsNum(row[2]),
      medianHomeValue: acsNum(row[3]),
      medianYearBuilt: acsNum(row[4]),
      pctRenter: occupied && renter != null ? renter / occupied : null,
      pctMultifamily: total > 0 ? fivePlus / total : null,
      predominantStructure,
    };
    return { income, population, area };
  } catch {
    return { income: null, population: null, area: null };
  }
}

/** Best-effort building facts from OpenStreetMap (Overpass). Sparse in the US; returns null on miss. */
async function buildingInfo(lat: number, lon: number): Promise<BuildingInfo | null> {
  try {
    const q = `[out:json][timeout:5];(way["building"](around:35,${lat},${lon});relation["building"](around:35,${lat},${lon}););out tags 8;`;
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: q,
      signal: AbortSignal.timeout(7000),
    });
    const j = await res.json();
    const els: { tags?: Record<string, string> }[] = j?.elements ?? [];
    // prefer the richest-tagged building (most keys)
    const best = els
      .filter((e) => e.tags?.building)
      .sort((a, b) => Object.keys(b.tags ?? {}).length - Object.keys(a.tags ?? {}).length)[0];
    if (!best?.tags) return null;
    const tg = best.tags;
    const lv = Number(tg['building:levels']);
    const un = Number(tg['building:units'] ?? tg['residential:units'] ?? tg['building:flats']);
    return {
      type: tg.building && tg.building !== 'yes' ? tg.building : (tg.amenity ?? tg.shop ?? null),
      levels: Number.isFinite(lv) && lv > 0 ? lv : null,
      units: Number.isFinite(un) && un > 0 ? un : null,
      name: tg.name ?? null,
    };
  } catch {
    return null;
  }
}

async function floodZone(lat: number, lon: number): Promise<string | null> {
  try {
    const url =
      `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?where=1%3D1` +
      `&geometry=${lon}%2C${lat}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects` +
      `&outFields=FLD_ZONE&returnGeometry=false&f=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const j = await res.json();
    return j?.features?.[0]?.attributes?.FLD_ZONE ?? null;
  } catch {
    return null;
  }
}

function floodLabel(zone: string | null): string {
  if (!zone) return '—';
  if (zone === 'X') return 'Zone X (minimal)';
  if (zone.startsWith('A') || zone.startsWith('V')) return `Zone ${zone} (100-yr / high)`;
  return `Zone ${zone}`;
}

// Short-TTL in-memory cache so repeated lookups of the same address don't re-fan-out to the external
// APIs (helps with latency + third-party quota / abuse). Per-instance only (serverless), which is fine.
const LOOKUP_CACHE = new Map<string, { at: number; result: PropertyLookup }>();
const LOOKUP_TTL = 10 * 60 * 1000; // 10 min
const LOOKUP_MAX = 500;

export async function lookupProperty(address: string): Promise<PropertyLookup> {
  const key = address.trim().toLowerCase();
  const hit = LOOKUP_CACHE.get(key);
  if (hit && Date.now() - hit.at < LOOKUP_TTL) return hit.result;
  const result = await lookupPropertyCore(address);
  if (result.ok) {
    if (LOOKUP_CACHE.size >= LOOKUP_MAX) LOOKUP_CACHE.clear();
    LOOKUP_CACHE.set(key, { at: Date.now(), result });
  }
  return result;
}

async function lookupPropertyCore(address: string): Promise<PropertyLookup> {
  const geo = await geocode(address);
  if (!geo) {
    return {
      ok: false,
      query: address,
      medianHouseholdIncome: null,
      population: null,
      floodZone: null,
      sources: [],
      note: 'Address not found. Try a full street address (e.g. "123 Main St, City, ST").',
    };
  }
  const [acsData, flood, building] = await Promise.all([
    acs(geo.tract),
    floodZone(geo.lat, geo.lon),
    buildingInfo(geo.lat, geo.lon),
  ]);
  const keyMissing = !process.env.CENSUS_API_KEY;

  const sources: LookupSource[] = [
    { label: 'Location', value: `${geo.city}, ${geo.state} ${geo.zip}`, source: 'U.S. Census Geocoder', real: true },
    {
      label: 'Median income',
      value: acsData.income ? `$${acsData.income.toLocaleString()}` : keyMissing ? 'add Census key' : '—',
      source: 'U.S. Census ACS (tract)',
      real: acsData.income != null,
    },
    {
      label: 'Tract population',
      value: acsData.population ? acsData.population.toLocaleString() : keyMissing ? 'add Census key' : '—',
      source: 'U.S. Census ACS (tract)',
      real: acsData.population != null,
    },
    { label: 'Flood zone', value: floodLabel(flood), source: 'FEMA NFHL', real: flood != null },
  ];

  return {
    ok: true,
    query: address,
    matchedAddress: geo.matchedAddress,
    city: geo.city,
    state: geo.state,
    zip: geo.zip,
    lat: geo.lat,
    lon: geo.lon,
    tract: geo.tract,
    medianHouseholdIncome: acsData.income,
    population: acsData.population,
    floodZone: flood,
    area: acsData.area ?? undefined,
    building,
    sources,
    note: keyMissing ? 'Add a free CENSUS_API_KEY to enable income/population & the area housing profile.' : undefined,
  };
}
