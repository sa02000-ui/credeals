'use client';

/**
 * "Team & Raise" — the GP team-formation and capital-raise deliverables, available once a deal is
 * tied up (LOI accepted → PSA negotiation). Three connected tools that chain off each other:
 *   1. GP Roles & Splits  → who's on the GP and how the economics divide (feeds 2 & 3)
 *   2. Org Chart          → the lender-facing entity structure (Class A LPs + Class B GP members)
 *   3. Investor Teaser    → the 4-slide summary deck, auto-filled from the UW + team
 */

import { useState } from 'react';
import { InfoTip } from '@/components/InfoTip';
import { GPTeamPanel } from '@/components/GPTeamPanel';
import { OrgChartPanel } from '@/components/OrgChartPanel';
import { TeaserDeckPanel } from '@/components/TeaserDeckPanel';
import type { MarketDeal } from '@/lib/sim';

type TeamTab = 'splits' | 'org' | 'teaser';

const TABS: { id: TeamTab; label: string; emoji: string }[] = [
  { id: 'splits', label: 'GP Roles & Splits', emoji: '🤝' },
  { id: 'org', label: 'Org Chart', emoji: '🏛️' },
  { id: 'teaser', label: 'Investor Teaser', emoji: '📑' },
];

export function DealTeamPanel({ deal }: { deal: MarketDeal }) {
  const [tab, setTab] = useState<TeamTab>('splits');

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 px-1 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Team &amp; Capital Raise</span>
        <InfoTip
          title="Team & Raise"
          what="Once your LOI is accepted and you're negotiating the PSA, you form the GP team and prepare to raise equity. These deliverables — the roles & splits, the lender org chart, and the investor teaser — all build off the same deal numbers and the same partner list."
          app="Start with GP Roles & Splits; the Org Chart and Teaser pull from it."
        />
        <span className="text-slate-400">— build these after your LOI is accepted.</span>
      </div>

      <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-1.5">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                tab === t.id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-violet-100'
              }`}
            >
              <span>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'splits' && <GPTeamPanel deal={deal} />}
      {tab === 'org' && <OrgChartPanel deal={deal} />}
      {tab === 'teaser' && <TeaserDeckPanel deal={deal} />}
    </div>
  );
}
