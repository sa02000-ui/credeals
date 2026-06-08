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

async function acs(t: Geo['tract']): Promise<{ income: number | null; population: number | null }> {
  const key = process.env.CENSUS_API_KEY;
  if (!key || !t.tract) return { income: null, population: null };
  try {
    const url =
      `https://api.census.gov/data/2022/acs/acs5?get=B19013_001E,B01003_001E` +
      `&for=tract:${t.tract}&in=state:${t.state}+county:${t.county}&key=${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const j = await res.json();
    const row = j?.[1];
    if (!row) return { income: null, population: null };
    const income = Number(row[0]);
    const population = Number(row[1]);
    return {
      income: income > 0 ? income : null,
      population: population > 0 ? population : null,
    };
  } catch {
    return { income: null, population: null };
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

export async function lookupProperty(address: string): Promise<PropertyLookup> {
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
  const [acsData, flood] = await Promise.all([acs(geo.tract), floodZone(geo.lat, geo.lon)]);
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
    sources,
    note: keyMissing ? 'Add a free CENSUS_API_KEY to enable income/population.' : undefined,
  };
}
