/**
 * Learn-as-you-go content registry (owner item 3). Every field / step / concept the user touches
 * can carry an info tooltip. Each entry has a short `what` (the CRE concept — industry-standard) and
 * an optional `app` line (how it works *in this app* specifically). Keyed by stable string ids the
 * UI references via <InfoTip k="..." />.
 */

export interface LearnEntry {
  /** plain-language title */
  title: string;
  /** the concept — what it is in commercial real estate */
  what: string;
  /** how to use it in this app (optional) */
  app?: string;
}

export const GLOSSARY: Record<string, LearnEntry> = {
  // --- Lifecycle steps (the top nav) ---
  'step.buybox': {
    title: 'Buy Box',
    what: 'Your acquisition criteria — the asset classes, markets, size, vintage, price and minimum return you will buy. It keeps you disciplined so you only chase deals that fit your strategy.',
    app: 'Set it on the left and click Approve to unlock sourcing. You can keep a different buy box per asset class — switch the asset-class chips and your size/price/cap targets adapt.',
  },
  'step.pick': {
    title: 'Pick a Deal',
    what: 'Sourcing — reviewing the flow of available properties (from brokers, listing sites, off-market) and choosing which ones are worth underwriting. Most deals you see, you pass on.',
    app: 'Deals outside your buy box are flagged. Click a deal to open its workspace and start the napkin underwriting.',
  },
  'step.napkin': {
    title: 'Napkin Underwriting',
    what: 'A fast, back-of-the-envelope valuation: take income, subtract expenses to get NOI, divide by a cap rate to get value, and compare to the asking price. It tells you in minutes whether a deal is worth a deeper look.',
    app: 'Adjust the blue inputs; the app recomputes value, % vs. ask, DSCR and a sensitivity grid. Pass it to advance to Detailed UW.',
  },
  'step.detailed': {
    title: 'Detailed Underwriting',
    what: 'A full multi-year proforma built from the actual T-12 and rent roll: line-item income and expenses, financing, capital plan, an exit, and the resulting investor returns (IRR, equity multiple, cash-on-cash).',
    app: 'Edit every income and expense line, model your debt and equity stack, save versions, and compare two financing scenarios side by side.',
  },
  'step.loi': {
    title: 'Letter of Intent (LOI)',
    what: 'A short, mostly non-binding offer that lays out the key business terms — price, earnest money, due-diligence period, closing timeline, financing — before the lawyers draft the full contract.',
    app: 'Fill the term form (prefilled from the deal); the LOI drafts live. Download it as Word or PDF, or in game mode submit it to the seller persona.',
  },
  'step.c2c': {
    title: 'Contract to Close',
    what: 'The period from a signed purchase agreement (PSA) to closing. A web of deadlines — title, survey, due diligence, financing, insurance, capital raise — all tracked against critical dates so nothing slips.',
    app: 'Upload the signed PSA and set the execution date; every workstream task gets a due date. The master plan shows what is due, soon, or overdue.',
  },
  'step.am': {
    title: 'Asset Management',
    what: 'Owning and operating the property over the hold (typically 3–7 years): driving occupancy and NOI, paying distributions, protesting taxes, renewing insurance, and reporting to investors — then refinancing or selling.',
    app: 'Run the takeover checklist, log quarterly performance, and track recurring reminders (tax protest, insurance, K-1) so annual obligations never get missed.',
  },

  // --- Buy box fields ---
  'bb.assetClass': {
    title: 'Asset class',
    what: 'The property type — multifamily, retail, industrial, etc. Each underwrites differently (e.g., NNN retail uses tighter DSCR gates). Most investors specialize.',
    app: 'You can store a separate buy box per asset class; pick one or more to target.',
  },
  'bb.states': { title: 'Target states', what: 'The markets you will buy in. Geographic focus lets you build local broker relationships and market knowledge — an edge over scattershot buyers.' },
  'bb.units': { title: 'Unit count range', what: 'Deal size by number of units. Bigger deals attract institutional capital and cheaper debt but need more equity; smaller deals are easier to finance solo.' },
  'bb.vintage': { title: 'Year built', what: 'Construction era. Older (e.g. 1980s) "value-add" assets are cheaper and can be renovated for upside, but carry more deferred maintenance and capex risk.' },
  'bb.price': { title: 'Price range', what: 'The total deal size you can support given your equity and debt capacity. Filtering by price keeps you out of deals you cannot fund.' },
  'bb.cap': {
    title: 'Minimum stabilized cap rate',
    what: 'Cap rate = NOI ÷ price. A higher minimum means you demand more income per dollar — more conservative. Markets with strong growth trade at lower caps.',
    app: 'Deals whose stabilized cap is below your minimum are flagged as outside the buy box.',
  },

  // --- Napkin / valuation concepts ---
  'm.offerPrice': { title: 'Offer price', what: 'What you propose to pay. Underwriting works backward from the price the returns justify — not from the seller’s ask.' },
  'm.inPlaceRent': { title: 'In-place rent', what: 'The average rent tenants are actually paying today (from the rent roll). The starting point — and often below what the market would bear.' },
  'm.marketRent': { title: 'Market rent', what: 'What comparable units lease for today. The gap between in-place and market rent is the core value-add thesis: raise rents to market over time.' },
  'm.otherIncome': { title: 'Other income', what: 'Non-rent revenue: utility reimbursements (RUBS), pet fees, parking, laundry, application fees. Often 5–15% of rental income and real upside if under-billed.' },
  'm.vacancy': { title: 'Economic vacancy', what: 'Income lost to empty units, concessions, bad debt and non-payment — not just physical vacancy. Underwrite economic vacancy; it is always higher.' },
  'm.expenseRatio': { title: 'Expense ratio', what: 'Operating expenses ÷ effective gross income. For stabilized multifamily, 40–55% is typical. A ratio that looks too low usually means the seller under-reported expenses.' },
  'm.expensePerUnit': { title: 'Expense per unit', what: 'Annual operating cost per unit (taxes, insurance, payroll, R&M, utilities, management). A quick sanity check against market norms (often $4,000–$7,000/unit).' },
  'm.walkInCap': { title: 'Walk-in (going-in) cap rate', what: 'Year-1 NOI ÷ purchase price — the yield the day you buy, before any improvements. Lower than the stabilized cap on a value-add deal.' },
  'm.stabilizedCap': { title: 'Stabilized / exit cap rate', what: 'The cap rate used to value NOI once your business plan is complete (and to estimate the sale price). Underwrite the exit cap a bit higher than today’s to be conservative.' },
  'm.noi': { title: 'Net Operating Income (NOI)', what: 'Effective gross income minus operating expenses — before debt service and capital items. The single most important number; value is NOI ÷ cap rate.' },
  'm.dscr': { title: 'Debt Service Coverage Ratio (DSCR)', what: 'NOI ÷ annual debt payments. Lenders require a cushion — usually ≥1.25x for multifamily, ≥1.50x for net-lease retail. Below it, the loan shrinks or dies.' },
  'm.affordability': { title: 'Affordability', what: 'The "30% rule": households can sustainably pay about 30% of gross income on rent. If your proforma rent exceeds local affordability, those increases may not stick.' },

  // --- Financing ---
  'f.ltv': { title: 'Loan-to-Value (LTV)', what: 'Loan amount ÷ property value. Higher leverage boosts returns but raises risk and lowers DSCR. Agency multifamily debt typically tops out around 65–75% LTV.' },
  'f.newLoan': { title: 'New loan', what: 'Originating fresh debt sized to an LTV target. Most flexible, but priced at today’s rates.' },
  'f.assumption': { title: 'Loan assumption', what: 'Taking over the seller’s existing loan and its rate. Powerful when that rate is below market — but you inherit its balance, terms and a large equity gap.' },
  'f.interestRate': { title: 'Interest rate', what: 'The annual cost of the loan. Even a 50 bps move materially changes cash flow and value at scale.' },
  'f.amort': { title: 'Amortization', what: 'The schedule (often 30 years / 360 months) over which principal is repaid. Longer amortization = lower payment = higher DSCR and cash flow.' },
  'f.io': { title: 'Interest-only (IO) period', what: 'Months where you pay only interest, no principal. Boosts early cash-on-cash and frees cash for the renovation plan; the balance does not fall during IO.' },
  'f.supplemental': { title: 'Supplemental loan', what: 'A second loan stacked on the first, usually taken later once you have grown NOI, to pull out cash without selling. Subordinate to the senior loan.' },
  'f.refi': { title: 'Refinance', what: 'Replacing existing debt with a new, larger loan after you have created value — often returning much of investors’ equity tax-free while you keep the asset.' },
  'f.sellerFinancing': { title: 'Seller financing', what: 'The seller acts as lender for part of the price, carrying a note at agreed terms. Bridges a financing gap and can lower the equity you must raise.' },
  'f.prefEquity': { title: 'Preferred equity', what: 'Equity that sits between debt and common equity. It earns a fixed preferred return and is repaid before common — cheaper than raising all common equity, but it must be served first.' },

  // --- Capital / returns ---
  'c.capex': { title: 'CapEx (capital expenditures)', what: 'One-time spending on the asset itself — renovations, roofs, exteriors, unit interiors. The fuel for value-add: spend to lift rents and NOI.' },
  'c.closingCosts': { title: 'Closing costs', what: 'Transaction costs at purchase: lender/origination fees, legal, title, appraisal, transfer taxes. Typically 2–4% of price; they raise the equity you need.' },
  'c.acqFee': { title: 'Acquisition fee', what: 'A fee the sponsor (GP) earns for finding and closing the deal — commonly 1–2% of price. It is a use of funds the equity must cover.' },
  'c.reserves': { title: 'Operating reserves', what: 'Cash set aside at close to cover shortfalls, capex overruns or slow lease-up. Lenders often require them; running out of cash kills otherwise-good deals.' },
  'c.exitCosts': { title: 'Exit / sale costs', what: 'Costs to sell: broker commission, legal, transfer taxes, prepayment penalties. Usually 1–3% of sale price, netted out of proceeds.' },
  'c.hold': { title: 'Hold period', what: 'How long you own before selling — typically 3–7 years for value-add. Longer holds compound rent growth but expose you to more market cycles.' },
  'r.irr': { title: 'Internal Rate of Return (IRR)', what: 'The annualized, time-weighted return on invested equity — it rewards getting cash back sooner. The headline return metric for most investors.' },
  'r.em': { title: 'Equity multiple', what: 'Total cash returned ÷ cash invested. A 2.0x means you doubled your money over the hold. Unlike IRR, it ignores timing.' },
  'r.coc': { title: 'Cash-on-cash', what: 'Annual cash distribution ÷ equity invested. The current yield investors actually receive each year, separate from the gain at sale.' },
  'r.waterfall': { title: 'Distribution waterfall', what: 'The agreed order in which cash is split between LPs (investors) and the GP (sponsor): usually return of capital, then a preferred return, then a "promote" split that rewards the GP for outperformance.' },
  'r.promote': { title: 'Promote (carried interest)', what: 'The GP’s outsized share of profits above the preferred return — the sponsor’s incentive. A common structure is 70/30 LP/GP above an 8% pref.' },
  'r.prefReturn': { title: 'Preferred return (hurdle)', what: 'A minimum annual return (e.g., 8%) LPs receive before the GP earns any promote. Protects investors by putting their return first.' },

  // --- LOI terms ---
  'loi.emd': { title: 'Earnest money deposit (EMD)', what: 'A good-faith deposit (often 1–2% of price) held in escrow. Refundable during due diligence, then typically "goes hard" (non-refundable) and applies to the price at closing.' },
  'loi.dd': { title: 'Due-diligence period', what: 'A window (often 30–60 days) to inspect the property, audit leases and finalize financing, during which you can usually walk and get your EMD back.' },
  'loi.goHard': { title: 'Earnest money "goes hard"', what: 'The date the deposit becomes non-refundable. After it, walking away forfeits your EMD — so it should fall only once your major contingencies are cleared.' },
  'loi.extensions': { title: 'Closing extensions', what: 'Optional rights to push the closing date, usually by putting up additional (often non-refundable) earnest money. A common structure is two 15-day extensions.' },
  'loi.financingContingency': { title: 'Financing contingency', what: 'A clause letting you terminate (and recover EMD) if you cannot secure acceptable financing by a deadline. Sellers prefer offers without it; it is real protection for you.' },
  'loi.closeFrom': { title: 'Closing countdown start', what: 'Whether the closing clock runs from PSA signing or from the end of due diligence. It shifts your real timeline by the length of the DD period.' },

  // --- C2C / AM ---
  'c2c.psa': { title: 'Purchase & Sale Agreement (PSA)', what: 'The binding contract that replaces the LOI — full terms, representations, schedules and the critical-dates calendar that governs the path to closing.' },
  'c2c.workstream': { title: 'Workstreams', what: 'Parallel tracks that must all finish to close: title & survey, debt, insurance, capital raise, legal and due diligence. Each has its own deadlines; the master plan ties them together.' },
  'c2c.criticalDates': { title: 'Critical dates', what: 'The hard deadlines in the PSA — DD expiration, financing contingency, closing. Miss one and you risk losing the deal or your deposit, so every task is dated against them.' },
  'am.occupancy': { title: 'Occupancy', what: 'The share of units leased and paying. Both physical (occupied) and economic (actually collecting) occupancy matter — it is the #1 operating metric.' },
  'am.taxProtest': { title: 'Property-tax protest', what: 'Challenging the county’s assessed value each year to lower the tax bill — taxes are often the largest single expense, so protesting can meaningfully lift NOI and value.' },
  'am.insurance': { title: 'Insurance renewal', what: 'Re-shopping property/liability coverage annually. Premiums have risen sharply; comparing carriers each renewal protects NOI.' },
  'am.k1': { title: 'K-1', what: 'The tax form issued to each LP reporting their share of the partnership’s income, losses and depreciation. Investors need it to file — getting it out on time is an annual obligation.' },
  'am.costSeg': { title: 'Cost segregation', what: 'An engineering study that accelerates depreciation by reclassifying building components, front-loading tax deductions for investors — typically done in year one.' },
  'am.distribution': { title: 'Distribution', what: 'Cash paid out to investors from operating cash flow (and from refinances or sale). The visible return LPs receive during the hold.' },
};

export function learn(k: string): LearnEntry | undefined {
  return GLOSSARY[k];
}
