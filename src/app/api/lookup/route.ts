import { NextResponse } from 'next/server';
import { lookupProperty } from '@/lib/data/propertyLookup';

// Public address lookup (no auth) — powers the address-first landing.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get('address') ?? '').trim();
  if (!address) {
    return NextResponse.json({ ok: false, note: 'address required' }, { status: 400 });
  }
  if (address.length > 200) {
    return NextResponse.json({ ok: false, note: 'address too long' }, { status: 400 });
  }
  try {
    const result = await lookupProperty(address);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { ok: false, note: 'Lookup failed. Please try again.' },
      { status: 502 },
    );
  }
}
