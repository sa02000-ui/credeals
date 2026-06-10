'use client';

import { dataClient } from '@/lib/supabase/dataClient';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import type { Scenario, ScenarioStep } from '@/lib/sim';

export interface AuthoredScenario extends Scenario {
  phase: string;
  severity: number;
}

/** Load admin-authored, ACTIVE scenarios for a lifecycle phase (Scenario Builder content). */
export async function fetchActiveScenarios(phase: string): Promise<AuthoredScenario[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const { data, error } = await dataClient()
      .from('scenarios')
      .select('id,title,phase,severity,entry,steps,status')
      .eq('status', 'active')
      .eq('phase', phase);
    if (error || !data) return [];
    return (data as unknown as { id: string; title: string; phase: string; severity: number; entry: string; steps: Record<string, ScenarioStep> }[])
      .filter((r) => r.steps && r.entry && r.steps[r.entry])
      .map((r) => ({ id: r.id, title: r.title, entry: r.entry, steps: r.steps, phase: r.phase, severity: r.severity }));
  } catch {
    return [];
  }
}
