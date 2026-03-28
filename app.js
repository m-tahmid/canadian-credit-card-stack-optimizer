// ── STATE ──
const profile = {
  income: '60to80',
  networks: new Set(['visa','mc']),
  chexy: 'yes',
  rogers: 'no',
  goal: 'cashback',
  grocers: new Set(),
  activeBanking: new Set(), // computed by optimizer — do not set directly
  willingToDD: 'no',
  minBal: 0,
  assetBanks: new Set(),    // banks where user has $100K+ assets (unlocks fee waivers for free)
  maxcards: '4',
  amexAcceptance: 0.8,      // fraction of spend where Amex is accepted (applied to Amex card net value)
  perks: { flights: null, intl: null, flightClass: null, lounges: null, hotelNights: null, nexus: null, airline: null },
};

// ── ALL CARDS DATA ──
const CARDS = [
  // ── CASHBACK ──
  {
    id: 'cibc-div',
    name: 'CIBC Dividend Visa Infinite',
    network: 'visa', type: 'cashback', fee: 120, minIncome: 60000,
    chexyOk: true, rogersReq: false, noFx: false, feeWaivedBy: ['cibc'],
    rates: { groceries: 0.04, dining: 0.02, gas: 0.04, recurring: 0.02, rent: 0.02, other: 0.01, travel: 0.01 },
    caps: {},
    notes: '4% groceries & gas, no caps. Works at No Frills, FreshCo, Iqbal Foods. Fee waived with CIBC Smart Plus.',
    warning: null, amexBlock: false,
  },
  {
    id: 'td-cashback',
    name: 'TD Cash Back Visa Infinite',
    network: 'visa', type: 'cashback', fee: 139, minIncome: 60000,
    chexyOk: true, rogersReq: false, noFx: false, feeWaivedBy: ['td'],
    rates: { groceries: 0.03, dining: 0.01, gas: 0.03, recurring: 0.03, rent: 0.03, other: 0.01, travel: 0.01 },
    caps: { groceries: 15000/12, gas: 15000/12, recurring: 15000/12 },
    capYearly: { groceries: true, gas: true, recurring: true },
    notes: '3% groceries/gas/recurring ($15K/yr annual cap each = $1,250/mo). Roadside assist. Fee waived with TD All-Inclusive.',
    warning: null, amexBlock: false,
  },
  {
    id: 'scotia-momentum',
    name: 'Scotia Momentum Visa Infinite',
    network: 'visa', type: 'cashback', fee: 120, minIncome: 60000,
    chexyOk: true, rogersReq: false, noFx: false, feeWaivedBy: ['scotia'],
    rates: { groceries: 0.04, dining: 0.02, gas: 0.02, recurring: 0.04, rent: 0.04, other: 0.01, travel: 0.01 },
    caps: {},
    capGroups: [{ cats: ['groceries', 'recurring', 'rent'], monthly: 2083, yearly: true }],
    notes: '4% groceries & recurring (great for rent via Chexy). $25K/yr combined cap across groceries + recurring + rent (~$2,083/mo total). Only 2% gas — weakness vs CIBC. Fee waived with Scotia Ultimate Package.',
    warning: null, amexBlock: false,
  },
  {
    id: 'bmo-cashback',
    name: 'BMO CashBack World Elite',
    network: 'mc', type: 'cashback', fee: 120, minIncome: 80000,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: ['bmo'],
    rates: { groceries: 0.05, dining: 0.01, gas: 0.03, recurring: 0.02, rent: 0.02, other: 0.01, travel: 0.01 },
    caps: { groceries: 500 },
    notes: '5% groceries (capped $500/mo), 4% transit, 3% gas, 2% recurring. Dining only 1% — weak. Fee waived with BMO Premium Plan.',
    warning: 'Chexy is Visa-only — use Casa for rent with this card', amexBlock: false,
  },
  {
    id: 'neo-we',
    name: 'Neo World Elite',
    network: 'mc', type: 'cashback', fee: 125, minIncome: 80000,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.05, dining: 0.01, gas: 0.03, recurring: 0.04, rent: 0.01, other: 0.01, travel: 0.01 },
    caps: { groceries: 1000, recurring: 500 },
    notes: '5% groceries ($1K/mo cap), 4% recurring ($500/mo cap — subscriptions/digital only, not rent), 3% gas. Rent via Casa earns 1% base rate.',
    warning: 'Chexy is Visa-only — use Casa for rent with this card', amexBlock: false,
  },
  {
    id: 'simplycash',
    name: 'SimplyCash Preferred',
    network: 'amex', type: 'cashback', fee: 119.88, minIncome: 0,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.04, dining: 0.0125, gas: 0.02, recurring: 0.0125, rent: 0, other: 0.0125, travel: 0.0125 },
    caps: { groceries: 2500 },
    capYearly: { groceries: true },
    notes: '4% groceries (capped $30K/yr spend = $1,200/yr cashback max), 2% gas, 1.25% everything else. No income requirement.',
    warning: 'Amex — not accepted at No Frills, FreshCo, Iqbal Foods, or Costco', amexBlock: true,
  },
  {
    id: 'simplii',
    name: 'Simplii Cash Back Visa',
    network: 'visa', type: 'cashback', fee: 0, minIncome: 0,
    chexyOk: true, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.015, dining: 0.04, gas: 0.015, recurring: 0.015, rent: 0.015, other: 0.005, travel: 0.005 },
    caps: { dining: 5000/12 }, capYearly: { dining: true },
    notes: 'Best dining card in Canada at 4%, zero annual fee. $5K/yr annual dining cap ($416/mo). Payout once/year in January.',
    warning: null, amexBlock: false,
  },
  {
    id: 'rogers-we',
    name: 'Rogers Red World Elite',
    network: 'mc', type: 'cashback', fee: 0, minIncome: 80000,
    chexyOk: false, rogersReq: true, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.03, dining: 0.03, gas: 0.03, recurring: 0.03, rent: 0.03, other: 0.03, travel: 0.03 },
    caps: {},
    notes: '3% cashback on all purchases for Rogers/Fido/Shaw customers. 2.5% FX fee applies (net 0.5% on international spend). No annual fee, no caps.',
    warning: 'Chexy is Visa-only — use Casa for rent with this card', amexBlock: false,
  },
  {
    id: 'desjardins',
    name: 'Desjardins Cash Back WE',
    network: 'mc', type: 'cashback', fee: 100, minIncome: 80000,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.04, dining: 0.03, gas: 0.01, recurring: 0.01, rent: 0.01, other: 0.01, travel: 0.01 },
    caps: {},
    notes: '4% groceries, 3% dining/entertainment/transit. Dragon Pass lounge access (3 visits/yr).',
    warning: 'Chexy is Visa-only — use Casa for rent with this card', amexBlock: false,
  },
  {
    id: 'mbna-we',
    name: 'MBNA World Elite Mastercard',
    network: 'mc', type: 'cashback', fee: 120, minIncome: 80000,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.0451, dining: 0.0451, gas: 0.009, recurring: 0.0451, rent: 0.009, other: 0.009, travel: 0.009 },
    pts: { groceries: 5.5, dining: 5.5, gas: 1.1, recurring: 5.5, rent: 1.1, other: 1.1, travel: 1.1 },
    caps: { groceries: 4167, dining: 4167, recurring: 4167 },
    capYearly: { groceries: true, dining: true, recurring: true },
    notes: '5pts/$1 on groceries, dining & recurring (each capped $50K/yr = $4,167/mo). 1pt/$1 base on everything else. +10% birthday bonus = 5.5pts effective on bonus cats. MBNA Rewards redeem for statement credit at ~0.82cpp — effectively cashback. Rent does not earn at bonus rate.',
    warning: 'Rent earns only 1x (base rate) — does not code as a recurring bonus category', amexBlock: false,
    cpp: { stmt: 0.82, avgTravel: 0.82 },
    loyalty: { program: 'mbna-rewards', label: 'MBNA Rewards', transfersTo: [], isolated: true },
  },
  {
    id: 'ws-infinite',
    name: 'Wealthsimple Visa Infinite',
    network: 'visa', type: 'cashback', fee: 240, minIncome: 60000,
    chexyOk: true, rogersReq: false, wsReq: true, noFx: true, feeWaivedBy: ['ws'],
    rates: { groceries: 0.02, dining: 0.02, gas: 0.02, recurring: 0.02, rent: 0.02, other: 0.02, travel: 0.02 },
    caps: {},
    notes: '$240/yr fee — waived with Wealthsimple Premium ($4K/mo direct deposit or $100K+ assets). No FX fees. 2% flat everywhere. No spending caps.',
    warning: 'Fee waiver requires $4K/mo direct deposit to Wealthsimple (Premium tier).',
    amexBlock: false,
  },
  // ── POINTS ──
  {
    id: 'cobalt',
    name: 'Amex Cobalt',
    network: 'amex', type: 'points', fee: 191.88, minIncome: 0,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.05, dining: 0.05, gas: 0.02, recurring: 0.01, rent: 0, other: 0.01, travel: 0.01 },
    pts: { groceries: 5, dining: 5, gas: 2, recurring: 1, rent: 0, other: 1, travel: 1 },
    caps: {},
    capGroups: [{ cats: ['groceries', 'dining'], monthly: 2500 }],
    notes: '5x MR on food & dining = 5% at 1cpp (statement) or ~10% at 2cpp (Aeroplan biz class). Combined $2,500/mo cap across groceries + dining (12,500 pts/mo total). 1:1 transfer to Aeroplan/Avios.',
    warning: 'Amex — not accepted at Costco, No Frills, or Iqbal Foods',
    amexBlock: true, cpp: { stmt: 1.0, avgTravel: 2.0 },
    loyalty: { program: 'mr', label: 'Amex MR', transfersTo: ['aeroplan', 'avios', 'asia-miles', 'ba', 'flying-blue'] },
    cppBreakdown: [
      { label: 'Economy — Continental (Aeroplan/Avios)', cpp: 1.3 },
      { label: 'Economy — International (Aeroplan/Avios/Asia Miles)', cpp: 1.6 },
      { label: 'Business — Continental (Aeroplan)', cpp: 2.2 },
      { label: 'Business — International (Aeroplan/Avios/Asia Miles)', cpp: 2.8 },
      { label: 'Statement credit (MR → 1cpp)', cpp: 1.0 },
    ],
  },
  {
    id: 'nb-we',
    name: 'National Bank World Elite',
    network: 'mc', type: 'points', fee: 150, minIncome: 80000,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.05, dining: 0.05, gas: 0.02, recurring: 0.02, rent: 0.02, other: 0.02, travel: 0.02 },
    pts: { groceries: 5, dining: 5, gas: 2, recurring: 2, rent: 2, other: 2, travel: 2 },
    caps: {},
    capGroups: [{ cats: ['groceries', 'dining'], monthly: 2083, yearly: true }],
    notes: '5pts/$1 on groceries & restaurants (combined $25K/yr cap across groceries + dining). 3 lounge visits/yr. 2% on gas, recurring & travel. Has 2.5% FX fee — not ideal for international spend.',
    warning: 'Chexy is Visa-only — use Casa for rent with this card',
    amexBlock: false, cpp: { stmt: 1.0, avgTravel: 1.0 },
    loyalty: { program: 'ala-carte', label: 'NB À la carte', transfersTo: [], isolated: true },
  },
  {
    id: 'scotia-gold',
    name: 'Scotia Gold Amex',
    network: 'amex', type: 'points', fee: 120, minIncome: 0,
    chexyOk: false, rogersReq: false, noFx: true, feeWaivedBy: ['scotia'],
    rates: { groceries: 0.0402, dining: 0.0402, gas: 0.0134, recurring: 0.0134, rent: 0, other: 0.0134, travel: 0.0134 },
    pts: { groceries: 6, dining: 6, gas: 2, recurring: 2, rent: 0, other: 2, travel: 2 },
    caps: {},
    notes: '6x Scene+ on groceries (incl. Sobeys, FreshCo, IGA, Safeway), dining, and entertainment (4.02% at 0.67cpp). No FX fees. Fee waived with Scotia Ultimate. Max value via Apply to Travel (1cpp = 6%).',
    warning: 'Amex — limited acceptance. Scene+ best redeemed via Scotia Travel portal (1cpp).',
    amexBlock: true, cpp: { stmt: 0.67, avgTravel: 1.0 },
    loyalty: { program: 'scene+', label: 'Scene+', transfersTo: [], isolated: false },
  },
  // ── TRAVEL ──
  {
    id: 'td-aeroplan',
    name: 'TD Aeroplan Visa Infinite',
    network: 'visa', type: 'travel', fee: 139, minIncome: 60000,
    chexyOk: true, rogersReq: false, noFx: false, feeWaivedBy: ['td'],
    rates: { groceries: 0.015, dining: 0.015, gas: 0.015, recurring: 0.015, rent: 0.015, other: 0.01, travel: 0.03 },
    pts: { groceries: 1, dining: 1, gas: 1, recurring: 1, rent: 1, other: 1, travel: 2 },
    caps: {},
    notes: 'Free first checked bag on Air Canada flights (you + up to 8 companions). NEXUS rebate $100/48mo. Fee waived with TD All-Inclusive. Best value if you fly Air Canada regularly.',
    warning: 'Low earn rate (1x–2x). Free bag perk is Air Canada flights only — limited value for WestJet/BA flyers.',
    amexBlock: false, cpp: { stmt: 1.0, avgTravel: 1.5 },
    loyalty: { program: 'aeroplan', label: 'Aeroplan', transfersTo: [] },
    cppBreakdown: [
      { label: 'Economy — Continental (AC / Star Alliance)', cpp: 1.3 },
      { label: 'Economy — International (AC / Star Alliance)', cpp: 1.5 },
      { label: 'Business — Continental (AC / Star Alliance)', cpp: 2.2 },
      { label: 'Business — International (AC / Star Alliance)', cpp: 2.8 },
      { label: 'Statement credit (1cpp)', cpp: 1.0 },
    ],
  },
  {
    id: 'cibc-aeroplan',
    name: 'CIBC Aeroplan Visa Infinite',
    network: 'visa', type: 'travel', fee: 139, minIncome: 60000,
    chexyOk: true, rogersReq: false, noFx: false, feeWaivedBy: ['cibc'],
    rates: { groceries: 0.015, dining: 0.015, gas: 0.015, recurring: 0.015, rent: 0.015, other: 0.01, travel: 0.03 },
    pts: { groceries: 1, dining: 1, gas: 1, recurring: 1, rent: 1, other: 1, travel: 2 },
    caps: {},
    notes: 'Free first checked bag on Air Canada flights (you + up to 8 companions). Ecopass bonus. Same perks as TD Aeroplan — choose based on banking relationship. Fee waived with CIBC Smart Plus.',
    warning: 'Low earn rate (1x–2x). Free bag perk is Air Canada flights only — limited value for WestJet/BA flyers.',
    amexBlock: false, cpp: { stmt: 1.0, avgTravel: 1.5 },
    loyalty: { program: 'aeroplan', label: 'Aeroplan', transfersTo: [] },
    cppBreakdown: [
      { label: 'Economy — Continental (AC / Star Alliance)', cpp: 1.3 },
      { label: 'Economy — International (AC / Star Alliance)', cpp: 1.5 },
      { label: 'Business — Continental (AC / Star Alliance)', cpp: 2.2 },
      { label: 'Business — International (AC / Star Alliance)', cpp: 2.8 },
      { label: 'Statement credit (1cpp)', cpp: 1.0 },
    ],
  },
  {
    id: 'scotia-passport',
    name: 'Scotiabank Passport Visa Infinite',
    network: 'visa', type: 'travel', fee: 150, minIncome: 60000,
    chexyOk: true, rogersReq: false, noFx: true, feeWaivedBy: ['scotia'],
    rates: { groceries: 0.0201, dining: 0.0201, gas: 0.0067, recurring: 0.0067, rent: 0.0067, other: 0.0067, travel: 0.0067 },
    pts: { groceries: 3, dining: 3, gas: 1, recurring: 1, rent: 1, other: 1, travel: 1 },
    caps: {},
    notes: '3x Scene+ on groceries/dining/entertainment (2.01% at 0.67cpp). 1pt/$1 on everything else (0.67%). 6 free lounge visits/yr. No FX fees. Fee waived with Scotia Ultimate.',
    warning: 'Scene+ best redeemed via Scotia Travel portal (1cpp). FX travel earns only 1pt/$1.',
    amexBlock: false, cpp: { stmt: 0.67, avgTravel: 1.0 },
    loyalty: { program: 'scene+', label: 'Scene+', transfersTo: [], isolated: false },
  },
  {
    id: 'rbc-avion',
    name: 'RBC Avion Visa Infinite',
    network: 'visa', type: 'travel', fee: 120, minIncome: 60000,
    chexyOk: true, rogersReq: false, noFx: false, feeWaivedBy: ['rbc'],
    rates: { groceries: 0.0125, dining: 0.0125, gas: 0.0125, recurring: 0.0125, rent: 0.0125, other: 0.0125, travel: 0.0175 },
    pts: { groceries: 1.25, dining: 1.25, gas: 1.25, recurring: 1.25, rent: 1.25, other: 1.25, travel: 1.75 },
    caps: {},
    notes: '1.25x Avion everywhere (1.75x on travel). Transfers to Aeroplan, Avios, Asia Miles, BA. Fee waived with RBC VIP Banking.',
    warning: 'Value comes from transfer partner flexibility, not everyday earn rate.',
    amexBlock: false, cpp: { stmt: 1.0, avgTravel: 1.5 },
    loyalty: { program: 'avion', label: 'RBC Avion', transfersTo: ['aeroplan', 'avios', 'asia-miles', 'ba'] },
    cppBreakdown: [
      { label: 'Economy — Continental (Avios/Aeroplan)', cpp: 1.3 },
      { label: 'Economy — International (Avios/Asia Miles)', cpp: 1.5 },
      { label: 'Business — Continental (Aeroplan)', cpp: 2.0 },
      { label: 'Business — International (Avios/Asia Miles)', cpp: 2.5 },
      { label: 'Statement credit (1cpp)', cpp: 1.0 },
    ],
  },
  {
    id: 'amex-aeroplan',
    name: 'Amex Aeroplan',
    network: 'amex', type: 'travel', fee: 120, minIncome: 0,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.015, dining: 0.0225, gas: 0.015, recurring: 0.015, rent: 0, other: 0.015, travel: 0.015 },
    pts: { groceries: 1, dining: 1.5, gas: 1, recurring: 1, rent: 0, other: 1, travel: 1 },
    caps: {},
    notes: '1pt/$1 everywhere (1.5% at avgTravel cpp), 1.5pt on eligible dining (2.25%). Bonus: 2x on direct Air Canada purchases. No income requirement.',
    warning: 'Amex — limited acceptance. No free bags unlike Visa Aeroplan cards.',
    amexBlock: true, cpp: { stmt: 1.0, avgTravel: 1.5 },
    loyalty: { program: 'aeroplan', label: 'Aeroplan', transfersTo: [] },
    cppBreakdown: [
      { label: 'Economy — Continental (AC / Star Alliance)', cpp: 1.3 },
      { label: 'Economy — International (AC / Star Alliance)', cpp: 1.5 },
      { label: 'Business — Continental (AC)', cpp: 2.2 },
      { label: 'Business — International (AC / Star Alliance)', cpp: 2.8 },
      { label: 'Statement credit (1cpp)', cpp: 1.0 },
    ],
  },
  {
    id: 'amex-plat',
    name: 'Amex Platinum',
    network: 'amex', type: 'travel', fee: 799, minIncome: 0,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    perksValue: 600,
    rates: { groceries: 0.03, dining: 0.03, gas: 0.01, recurring: 0.01, rent: 0, other: 0.01, travel: 0.02 },
    pts: { groceries: 3, dining: 3, gas: 1, recurring: 1, rent: 0, other: 1, travel: 2 },
    caps: {},
    notes: '3x MR on dining & groceries, 2x on travel. $200 travel credit + $200 FHR hotel credit + NEXUS rebate + unlimited Centurion & Priority Pass lounge access. $600 credit value used in net calculation.',
    warning: 'High $799 fee — only worthwhile if you maximize all credits and lounge access.',
    amexBlock: true, cpp: { stmt: 1.0, avgTravel: 1.5 },
    loyalty: { program: 'mr', label: 'Amex MR', transfersTo: ['aeroplan', 'avios', 'asia-miles', 'ba', 'flying-blue'] },
    cppBreakdown: [
      { label: 'Economy — Continental (Aeroplan/Avios)', cpp: 1.3 },
      { label: 'Economy — International (Aeroplan/Avios/Asia Miles)', cpp: 1.6 },
      { label: 'Business — Continental (Aeroplan)', cpp: 2.2 },
      { label: 'Business — International (Aeroplan/Avios/Asia Miles)', cpp: 2.8 },
      { label: 'Hotel — FHR / Amex Travel', cpp: 1.4 },
      { label: 'Statement credit (MR → 1cpp)', cpp: 1.0 },
    ],
  },
  {
    id: 'westjet-rbc',
    name: 'WestJet RBC World Elite Mastercard',
    network: 'mc', type: 'cashback', fee: 119, minIncome: 80000,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: ['rbc'],
    rates: { groceries: 0.015, dining: 0.015, gas: 0.015, recurring: 0.015, rent: 0.015, other: 0.015, travel: 0.02 },
    caps: {},
    notes: '1.5% WestJet dollars everywhere, 2% on WestJet flights & vacation packages. Free first checked bag on WestJet flights only (you + up to 8 companions). Annual round-trip companion voucher for WestJet flights (significant value for WestJet flyers). Fee waived with RBC VIP Banking.',
    warning: 'WestJet dollars can only be redeemed on WestJet flights & packages — limited value if you don\'t fly WestJet regularly. Free bag and companion voucher apply to WestJet flights only.',
    amexBlock: false,
    loyalty: { program: 'westjet', label: 'WestJet Rewards', transfersTo: [], isolated: false },
  },
  {
    id: 'tangerine-mc',
    name: 'Tangerine Money-Back Mastercard',
    network: 'mc', type: 'cashback', fee: 0, minIncome: 0,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.02, dining: 0.02, gas: 0.005, recurring: 0.005, rent: 0.005, other: 0.005, travel: 0.005 },
    caps: {},
    notes: 'Choose 2 categories at 2% (3 categories with Tangerine banking). Ideal as a no-fee companion: pick categories your primary card doesn\'t cover. 0.5% base everywhere else.',
    warning: 'Best paired with a specialist card — use it for your 2 weakest categories on your main card. Cashback deposited to Tangerine savings only.',
    amexBlock: false,
  },
  {
    id: 'amex-gold',
    name: 'Amex Gold Rewards Card',
    network: 'amex', type: 'points', fee: 250, minIncome: 0,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.02, dining: 0.02, gas: 0.02, recurring: 0.01, rent: 0, other: 0.01, travel: 0.02 },
    pts: { groceries: 2, dining: 2, gas: 2, recurring: 1, rent: 0, other: 1, travel: 2 },
    caps: {},
    notes: '2x MR on groceries, dining, gas & travel. $100 annual travel credit (hotels/flights via Amex Travel). 4 complimentary lounge passes/yr. 1:1 transfers to Aeroplan, Avios, Asia Miles.',
    warning: 'Amex — not accepted everywhere. Lower earn than Cobalt on food (2x vs 5x) but more coverage across gas & travel with the annual travel credit.',
    amexBlock: true,
    cpp: { stmt: 1.0, avgTravel: 2.0 },
    loyalty: { program: 'mr', label: 'Amex MR', transfersTo: ['aeroplan', 'avios', 'asia-miles', 'ba', 'flying-blue'] },
    cppBreakdown: [
      { label: 'Economy — Continental (Aeroplan/Avios)', cpp: 1.3 },
      { label: 'Economy — International (Aeroplan/Avios/Asia Miles)', cpp: 1.6 },
      { label: 'Business — Continental (Aeroplan)', cpp: 2.2 },
      { label: 'Business — International (Aeroplan/Avios/Asia Miles)', cpp: 2.8 },
      { label: 'Statement credit (MR → 1cpp)', cpp: 1.0 },
    ],
  },
  {
    id: 'cibc-aventura',
    name: 'CIBC Aventura Visa Infinite',
    network: 'visa', type: 'travel', fee: 139, minIncome: 60000,
    chexyOk: true, rogersReq: false, noFx: false, feeWaivedBy: ['cibc'],
    rates: { groceries: 0.015, dining: 0.015, gas: 0.015, recurring: 0.01, rent: 0.01, other: 0.01, travel: 0.02 },
    pts: { groceries: 1.5, dining: 1.5, gas: 1.5, recurring: 1, rent: 1, other: 1, travel: 2 },
    caps: {},
    notes: '1.5x Aventura on groceries/gas/dining, 1x everything else, 2x on travel via CIBC Rewards. Redeem for any flight at 1cpp via CIBC travel portal. No airline transfers. Fee waived with CIBC Smart Plus.',
    warning: 'Aventura points only redeem via CIBC travel portal — no Aeroplan/Avios transfers. Value locked to 1cpp.',
    amexBlock: false,
    cpp: { stmt: 1.0, avgTravel: 1.0 },
    loyalty: { program: 'aventura', label: 'CIBC Aventura', transfersTo: [], isolated: false },
  },
  {
    id: 'pc-financial',
    name: 'PC Financial World Elite Mastercard',
    network: 'mc', type: 'cashback', fee: 120, minIncome: 80000,
    chexyOk: false, rogersReq: false, noFx: false, feeWaivedBy: [],
    rates: { groceries: 0.03, dining: 0.01, gas: 0.015, recurring: 0.01, rent: 0.01, other: 0.01, travel: 0.01 },
    caps: {},
    notes: '30 PC Optimum points per $ at Loblaws/Shoppers (= ~3% toward free groceries). 20pts/$ at Loblaw gas bars. 10pts/$ elsewhere (= ~1%). Points only redeemable at Loblaws/Shoppers/PC Travel — restricted cashback.',
    warning: 'PC Optimum redeemable at Loblaws/Shoppers Drug Mart only. Best if you regularly shop at Loblaws, Zehrs, No Frills, Shoppers, or Esso/Mobil with PC.',
    amexBlock: false,
  },
  {
    id: 'brim-we',
    name: 'Brim World Elite Mastercard',
    network: 'mc', type: 'travel', fee: 199, minIncome: 80000,
    chexyOk: true, rogersReq: false, noFx: true, feeWaivedBy: [],
    rates: { groceries: 0.015, dining: 0.015, gas: 0.01, recurring: 0.01, rent: 0.01, other: 0.01, travel: 0.02 },
    pts: { groceries: 1.5, dining: 1.5, gas: 1, recurring: 1, rent: 1, other: 1, travel: 2 },
    caps: {},
    notes: 'No FX fees on all purchases. 1.5% on groceries/dining, 2% on travel, 1% everywhere else. Points transfer 1:1 to Air France/KLM Flying Blue. Priority Pass lounge access (6 visits/yr). $10/month in Brim bonus credits.',
    warning: 'Points primarily valuable via Flying Blue (SkyTeam). High annual fee vs value requires Flying Blue redemptions for business-class flights.',
    amexBlock: false,
    cpp: { stmt: 1.0, avgTravel: 1.8 },
    loyalty: { program: 'flying-blue', label: 'Air France/KLM Flying Blue', transfersTo: [] },
    cppBreakdown: [
      { label: 'Economy — Continental (Flying Blue)', cpp: 1.3 },
      { label: 'Economy — International (Flying Blue)', cpp: 1.8 },
      { label: 'Business — Continental (Flying Blue)', cpp: 2.2 },
      { label: 'Business — International (Flying Blue)', cpp: 2.8 },
      { label: 'Statement credit (1cpp)', cpp: 1.0 },
    ],
  },
];

// ── NAVIGATION ──
function goStep(n) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById('sec'+n)?.classList.add('active');
  document.querySelectorAll('[data-step]').forEach(el => {
    el.classList.toggle('active', String(el.dataset.step) === String(n));
  });
  window._activeStep = n;
  window.scrollTo(0, 0);
}

// ── PROFILE PICKERS ──
function pick(btn) {
  const group = btn.dataset.group;
  document.querySelectorAll(`[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  profile[group] = btn.dataset.val;
}

const multiState = {};
function pickMulti(btn) {
  const group = btn.dataset.group;
  const val = btn.dataset.val;
  if (!multiState[group]) multiState[group] = new Set();
  if (btn.classList.contains('selected')) {
    btn.classList.remove('selected');
    multiState[group].delete(val);
  } else {
    btn.classList.add('selected');
    multiState[group].add(val);
  }
  if (group === 'network') {
    profile.networks = multiState[group];
  } else if (group === 'grocer') {
    profile.grocers = multiState[group];
  } else if (group === 'assetBank') {
    profile.assetBanks = multiState[group];
  }
}

function toggleSpouseCard(cardId) {
  if (window._spouseSet?.has(cardId)) window._spouseSet.delete(cardId);
  else window._spouseSet?.add(cardId);
  calculate(true);
}

function toggleExcludeCard(cardId) {
  if (!window._excludedSet) window._excludedSet = new Set();
  if (window._excludedSet.has(cardId)) window._excludedSet.delete(cardId);
  else window._excludedSet.add(cardId);
  calculate(true);
}

function resetExcluded() {
  window._excludedSet = new Set();
  window._pinnedSet = new Set();
  calculate(true);
}

function openSwapPicker(cardId) {
  if (!window._allScored || !window._currentStack) return;
  const stackCards = window._currentStack;
  const target = stackCards.find(c => c.id === cardId);
  if (!target) return;

  const spend = getSpend();

  // Candidates: eligible, same type as target, not in stack, not excluded
  const stackIds = new Set(stackCards.map(c => c.id));
  const rest = stackCards.filter(c => c.id !== cardId);
  const candidates = window._allScored.filter(c =>
    c.eligible && c.type === target.type &&
    !stackIds.has(c.id) && !window._excludedSet?.has(c.id)
  );

  // Score each candidate: slot-for-slot swap using actual _spouseSet.
  // If target was in spouse, candidate inherits that slot; otherwise it doesn't.
  const originalNet = calcStackValue([...rest, target], spend).net;
  const targetInSpouse = window._spouseSet?.has(target.id);
  const scored = candidates.map(c => {
    const saved = window._spouseSet;
    const localSpouse = new Set(window._spouseSet);
    localSpouse.delete(target.id);
    if (targetInSpouse) localSpouse.add(c.id);
    window._spouseSet = localSpouse;
    const net = calcStackValue([...rest, c], spend).net;
    window._spouseSet = saved;
    return { card: c, net, delta: net - originalNet };
  }).sort((a, b) => b.net - a.net).slice(0, 10);

  const currentPinned = window._pinnedSet?.has(cardId) ? null : [...(window._pinnedSet || [])].find(id => id);

  let html = `
    <div class="swap-modal-header">
      <div class="swap-modal-title">Swap out ${target.name.split(' ').slice(0,3).join(' ')}</div>
      <div class="swap-modal-sub">Pick a replacement — stack reoptimizes around your choice</div>
    </div>
  `;

  if (scored.length === 0) {
    html += `<div style="font-size:12px;color:var(--t2);text-align:center;padding:20px 0;">No eligible alternatives found.</div>`;
  } else {
    scored.forEach(({ card, delta }) => {
      const isPinned = window._pinnedSet?.has(card.id);
      const sign = delta >= 0 ? '+' : '−';
      const valColor = delta >= 0 ? 'var(--green)' : '#c06060';
      const label = delta >= 0 ? 'net gain' : 'net loss';
      const fee = card.effectiveFee > 0 ? `$${card.effectiveFee}/yr fee` : 'No fee';
      html += `
        <div class="swap-alt-row${isPinned ? ' pinned' : ''}" onclick="applySwap('${cardId}','${card.id}')">
          <div>
            <div class="swap-alt-name">${card.name}</div>
            <div class="swap-alt-detail">${fee}</div>
          </div>
          <div style="text-align:right;">
            <div class="swap-alt-val" style="color:${valColor}">${sign}$${Math.abs(Math.round(delta))}</div>
            <div style="font-size:9px;color:var(--t3);">${label}</div>
          </div>
        </div>
      `;
    });
  }

  html += `<button class="swap-cancel" onclick="closeSwapModal()">Cancel</button>`;

  document.getElementById('swap-modal-body').innerHTML = html;
  document.getElementById('swap-overlay').classList.add('open');
}

function closeSwapModal() {
  document.getElementById('swap-overlay').classList.remove('open');
}

function applySwap(originalId, replacementId) {
  if (!window._pinnedSet) window._pinnedSet = new Set();
  if (!window._excludedSet) window._excludedSet = new Set();
  // Remove any prior pin for this slot
  window._excludedSet.add(originalId);
  window._pinnedSet.add(replacementId);
  closeSwapModal();
  calculate(true);
}

function undoSwap(originalId, replacementId) {
  window._excludedSet?.delete(originalId);
  window._pinnedSet?.delete(replacementId);
  calculate(true);
}

function switchAltStack(idx) {
  window._altIdx = idx;
  window._useAltStack = true;
  calculate(true);
}

function setStackSize(n) {
  if (n === null || n === undefined) {
    window._pinnedSet = new Set();
    window._excludedSet = new Set();
    window._stackSizeOverride = null;
    calculate(true);
    return;
  }
  const newN = Math.max(1, n);
  const currentStack = window._currentStack || [];
  window._excludedSet = new Set();
  if (newN < currentStack.length) {
    // Reducing: pin cards that currently have spouse copies so partner count stays stable
    // (total physical cards goes down by exactly 1, not 2)
    const spouseCards = currentStack.filter(c => window._spouseSet?.has(c.id));
    const maxToPin = Math.max(0, newN - 1); // leave at least 1 free slot for optimizer
    window._pinnedSet = new Set(spouseCards.slice(0, maxToPin).map(c => c.id));
  } else {
    window._pinnedSet = new Set();
  }
  window._stackSizeOverride = newN;
  calculate(true);
}

function pickPerk(btn, key) {
  const group = btn.dataset.group;
  document.querySelectorAll(`[data-group="${group}"]`).forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  profile.perks[key] = btn.dataset.val;
}

function updateRedemptionCpp() {
  const cost   = parseFloat(document.getElementById('redemption-cost').value)   || 0;
  const points = parseFloat(document.getElementById('redemption-points').value) || 0;
  const display = document.getElementById('redemption-cpp-display');
  const note    = document.getElementById('redemption-cpp-note');
  if (cost > 0 && points > 0) {
    const cpp = cost / points * 100;
    display.innerHTML = `= <span style="color:var(--accent)">${cpp.toFixed(2)}cpp</span>`;
    // Compare against typical statement credit baseline (1cpp)
    const stmtBaseline = 1.0;
    if (cpp >= 2.0) {
      note.innerHTML = `<span style="color:var(--green)">💎 Excellent redemption — at ${cpp.toFixed(2)}cpp, points are worth ${(cpp/stmtBaseline).toFixed(1)}× their statement credit value. Sweet spot for Aeroplan/MR transfers.</span>`;
    } else if (cpp >= 1.3) {
      note.innerHTML = `<span style="color:var(--accent)">✅ Good redemption — ${cpp.toFixed(2)}cpp beats statement credit. Points ahead of cash for this booking.</span>`;
    } else if (cpp >= 1.0) {
      note.innerHTML = `<span style="color:var(--muted)">Fair — ${cpp.toFixed(2)}cpp is at or slightly above statement credit. Cash and points are roughly equivalent here.</span>`;
    } else {
      note.innerHTML = `<span style="color:var(--yellow)">⚠️ Below average — at ${cpp.toFixed(2)}cpp you'd get more value using statement credit (1cpp). Hold your points for a better redemption.</span>`;
    }
  } else {
    display.innerHTML = '';
    note.innerHTML = '';
  }
}

// ── CALCULATIONS ──
const CHEXY_FEE = 0.0175; // Chexy charges 1.75% on Visa rent payments
const CASA_FEE  = 0.0175; // Casa charges 1.75% on Mastercard rent payments
const FX_FEE    = 0.025;  // Standard foreign transaction fee (most cards)

function rentNetRate(card) {
  const gross = card.rates.rent || 0;
  if (gross === 0 || profile.chexy !== 'yes') return 0;
  const fee = card.network === 'visa' ? CHEXY_FEE : card.network === 'mc' ? CASA_FEE : 0;
  return Math.max(0, gross - fee);
}

function travelNetRate(card) {
  const gross = card.rates.travel || 0;
  if (gross === 0) return 0;
  if (!card.noFx && profile.perks?.intl === 'yes') return Math.max(0, gross - FX_FEE);
  return gross;
}

// Returns the cpp to use for points valuation based on goal selection
function getGoalCpp(card) {
  if (!card.pts || !card.cpp) return null;
  return profile.goal === 'cashback' ? card.cpp.stmt : getEffectiveCpp(card);
}

function effectiveRate(card, cat) {
  // Points/travel cards: compute dynamically from pts × goalCpp
  if (card.pts && card.cpp) {
    const cpp = getGoalCpp(card);
    if (cat === 'rent') {
      const p = card.pts.rent || 0;
      if (p === 0 || profile.chexy !== 'yes') return 0;
      const grossRate = p * cpp / 100;
      const fee = card.network === 'visa' ? CHEXY_FEE : card.network === 'mc' ? CASA_FEE : 0;
      return Math.max(0, grossRate - fee);
    }
    if (cat === 'fxTravel') {
      const p = card.pts.other || 0;
      const grossRate = p * cpp / 100;
      return card.noFx ? grossRate : Math.max(0, grossRate - FX_FEE);
    }
    return (card.pts[cat] || 0) * cpp / 100;
  }
  // Cashback / flat-rate cards
  if (cat === 'rent') return rentNetRate(card);
  if (cat === 'travel') return card.rates.travel || 0;
  if (cat === 'fxTravel') {
    // Foreign charges come through as 'other' — card networks don't recognize foreign MCCs
    const gross = card.rates.other || 0;
    return card.noFx ? gross : Math.max(0, gross - FX_FEE);
  }
  return card.rates[cat] || 0;
}

function getSpend() {
  return {
    groceries: +document.getElementById('sp-groceries').value || 0,
    dining:    +document.getElementById('sp-dining').value    || 0,
    gas:       +document.getElementById('sp-gas').value       || 0,
    recurring: +document.getElementById('sp-recurring').value || 0,
    other:     +document.getElementById('sp-other').value     || 0,
    rent:      +document.getElementById('sp-rent').value      || 0,
    travel:    (+document.getElementById('sp-travel').value    || 0) / 12,
    fxTravel:  (+document.getElementById('sp-fx-travel').value || 0) / 12,
  };
}

// Returns per-category effective monthly cap for a card, accounting for combined capGroups.
// Proportionally allocates group budget when total group spend exceeds the group cap.
function computeEffectiveCaps(card, spend) {
  const effCaps = {};
  for (const cat in (card.caps || {})) effCaps[cat] = card.caps[cat];
  if (card.capGroups) {
    for (const group of card.capGroups) {
      const totalGroupSpend = group.cats.reduce((s, cat) => s + (spend[cat] || 0), 0);
      if (totalGroupSpend <= group.monthly) continue; // group cap not binding
      for (const cat of group.cats) {
        const catSpend = spend[cat] || 0;
        if (catSpend === 0) continue;
        const allocated = group.monthly * catSpend / totalGroupSpend;
        effCaps[cat] = effCaps[cat] !== undefined ? Math.min(effCaps[cat], allocated) : allocated;
      }
    }
  }
  return effCaps;
}

function calcCardValue(card, spend) {
  const cats = ['groceries','dining','gas','recurring','rent','other','travel','fxTravel'];
  let gross = 0;
  const capMult = window._spouseSet?.has(card.id) ? 2 : 1;
  // Amex acceptance factor: reduces effective earn on Amex cards since they're not universally accepted
  const acceptFactor = (card.network === 'amex' && profile.networks.has('amex')) ? (profile.amexAcceptance ?? 0.8) : 1.0;
  const effCaps = computeEffectiveCaps(card, spend);
  for (const cat of cats) {
    const monthly = spend[cat] || 0;
    const rate = effectiveRate(card, cat);
    const rawCap = effCaps[cat];
    const cap = rawCap ? rawCap * capMult : undefined;
    const effectiveMonthly = cap ? Math.min(monthly, cap) : monthly;
    gross += effectiveMonthly * 12 * rate * acceptFactor;
  }
  gross += (card.perksValue || 0) + airlinePerksValue(card) + loungePerksValue(card);
  const effectiveFee = card.feeWaivedBy?.some(b => profile.activeBanking.has(b)) ? 0 : card.fee;
  return { gross: Math.round(gross), net: Math.round(gross - effectiveFee), effectiveFee };
}

function isEligible(card) {
  const incomeMap = { under60: 50000, '60to80': 70000, '80plus': 100000 };
  const income = incomeMap[profile.income];
  if (card.minIncome > income) return false;
  if (!profile.networks.has(card.network)) return false;
  if (card.rogersReq && profile.rogers !== 'yes') return false;
  if (card.wsReq && profile.willingToDD !== 'yes' && !profile.assetBanks.has('ws')) return false;
  return true;
}

// ── STACK OPTIMIZER ──
function calcStackValue(stackCards, spend) {
  const cats = ['groceries','dining','gas','recurring','rent','other','travel','fxTravel'];
  let gross = 0;
  // Pre-compute effective caps per card accounting for combined capGroups
  const cardEffCaps = new Map(stackCards.map(c => [c.id, computeEffectiveCaps(c, spend)]));
  for (const cat of cats) {
    const monthly = spend[cat] || 0;
    if (monthly === 0) continue;
    // Split spend into Amex-accessible vs non-Amex (rent is always 0 for Amex)
    const amexFrac  = (cat === 'rent') ? 0 : (profile.amexAcceptance ?? 0.8);
    const amexAmt   = monthly * amexFrac;
    const nonAmexAmt = monthly * (1 - amexFrac);

    let bestAmexEarn = 0;    // best earn on the Amex-accessible portion
    let bestNonAmexEarn = 0; // best earn on the non-Amex portion

    for (const card of stackCards) {
      const capMult = window._spouseSet?.has(card.id) ? 2 : 1;
      const rate = effectiveRate(card, cat);
      const rawCap = cardEffCaps.get(card.id)[cat];
      if (card.network === 'amex') {
        // Amex cards only earn on Amex-accessible portion
        const eff = rawCap ? Math.min(amexAmt, rawCap * capMult) : amexAmt;
        bestAmexEarn = Math.max(bestAmexEarn, eff * rate);
      } else {
        // Visa/MC earn on non-Amex portion; also compete on Amex portion as fallback
        const effNon = rawCap ? Math.min(nonAmexAmt, rawCap * capMult) : nonAmexAmt;
        bestNonAmexEarn = Math.max(bestNonAmexEarn, effNon * rate);
        const effAmex = rawCap ? Math.min(amexAmt, rawCap * capMult) : amexAmt;
        bestAmexEarn = Math.max(bestAmexEarn, effAmex * rate);
      }
    }
    gross += (bestAmexEarn + bestNonAmexEarn) * 12;
  }
  stackCards.forEach(c => { gross += (c.perksValue || 0) + airlinePerksValue(c) + loungePerksValue(c); });
  // Spouse copy always pays full card.fee — banking waivers don't extend to a separate account
  const fees = stackCards.reduce((s, c) => s + c.effectiveFee + (window._spouseSet?.has(c.id) ? c.fee : 0), 0);
  return { gross: Math.round(gross), fees: Math.round(fees), net: Math.round(gross - fees) };
}

// Returns top N distinct stacks sorted by net value descending
function buildTopStacks(eligibleCards, spend, maxCards, topN = 1) {
  const limit = Math.min(maxCards, 7);
  const pinned = eligibleCards.filter(c => window._pinnedSet?.has(c.id));
  const unpinned = eligibleCards.filter(c => !window._pinnedSet?.has(c.id));

  const candidates = unpinned
    .map(c => ({ card: c, solo: calcStackValue([c], spend).net }))
    .sort((a, b) => b.solo - a.solo)
    .slice(0, 20)
    .map(x => x.card);

  const remainingSlots = Math.max(0, limit - pinned.length);
  const tops = []; // { cards, net } sorted desc

  function tryInsert(stack, net) {
    if (net <= 0) return;
    const ids = stack.map(c => c.id).sort().join(',');
    for (const t of tops) if (t._key === ids) return; // exact duplicate
    tops.push({ cards: [...stack], net, _key: ids });
    tops.sort((a, b) => b.net - a.net);
    if (tops.length > topN) tops.pop();
  }

  function search(start, current) {
    const stack = [...pinned, ...current];
    const { net } = calcStackValue(stack, spend);
    if (topN > 1 || net > (tops[0]?.net ?? 0)) tryInsert(stack, net);
    if (current.length >= remainingSlots) return;
    for (let i = start; i < candidates.length; i++) {
      const candidate = candidates[i];
      const netWithCard = calcStackValue([...stack, candidate], spend).net;
      if (netWithCard <= net) continue; // card adds no value — skip
      current.push(candidate);
      search(i + 1, current);
      current.pop();
    }
  }

  search(0, []);
  return tops;
}

function buildOptimalStack(eligibleCards, spend, maxCards) {
  return buildTopStacks(eligibleCards, spend, maxCards, 1)[0]?.cards || [];
}

// Returns whether two cards share a compatible loyalty ecosystem (points can combine)
function isLoyaltyCompatible(cardA, cardB) {
  if (!cardA.loyalty || !cardB.loyalty) return false;
  const a = cardA.loyalty, b = cardB.loyalty;
  if (a.program === b.program) return true;
  if (a.transfersTo?.includes(b.program)) return true;
  if (b.transfersTo?.includes(a.program)) return true;
  const aT = new Set(a.transfersTo || []);
  return (b.transfersTo || []).some(p => aT.has(p));
}

// Computes custom cpp from target redemption inputs
function getCustomCppValue() {
  const cost   = parseFloat(document.getElementById('redemption-cost')?.value)   || 0;
  const points = parseFloat(document.getElementById('redemption-points')?.value) || 0;
  if (cost > 0 && points > 0) return cost / points * 100;
  return null;
}

// Returns the cpp ceiling for a given loyalty program (max achievable in that program)
function loyaltyCppCeiling(card) {
  if (!card.loyalty) return Infinity;
  if (card.loyalty.isolated) {
    // NB À la carte = 1cpp ceiling, MBNA = 0.82cpp
    return card.cpp?.stmt || 1.0;
  }
  if (card.loyalty.program === 'scene+') return 1.0; // Scene+ portal max
  return Infinity; // MR, Aeroplan, Avion can achieve high cpp via airline redemptions
}

function getEffectiveCpp(card) {
  if (!card.cpp) return 1.0;

  // Custom redemption: apply to transferable programs, capped by program ceiling
  const customCpp = getCustomCppValue();
  if (customCpp) {
    const ceiling = loyaltyCppCeiling(card);
    if (customCpp <= ceiling) return Math.min(customCpp, ceiling);
    // If custom target exceeds program ceiling, cap at ceiling
    return ceiling;
  }

  if (!card.cppBreakdown?.length) return card.cpp?.avgTravel || 1.0;
  const cls = profile.perks.flightClass;
  const intl = profile.perks.intl === 'yes';
  if (!cls) return card.cpp.avgTravel;
  const isBiz = cls === 'business' || cls === 'mix';
  if (intl && isBiz)  return card.cppBreakdown.find(r => /Business.*International/i.test(r.label))?.cpp  ?? card.cpp.avgTravel;
  if (intl)           return card.cppBreakdown.find(r => /Economy.*International/i.test(r.label))?.cpp   ?? card.cpp.avgTravel;
  if (isBiz)          return card.cppBreakdown.find(r => /Business.*Continental/i.test(r.label))?.cpp    ?? card.cpp.avgTravel;
  return               card.cppBreakdown.find(r => /Economy.*Continental/i.test(r.label))?.cpp           ?? card.cpp.avgTravel;
}

function getPerksMatch(card) {
  const p = profile.perks;
  const badges = [];
  const loungeCards = ['amex-plat','scotia-passport','nb-we'];
  const nexusCards  = ['td-aeroplan','cibc-aeroplan','amex-plat'];
  const hotelCards  = ['amex-plat'];
  if (loungeCards.includes(card.id) && (p.lounges === 'frequently' || p.lounges === 'occasionally'))
    badges.push('Lounge access');
  if (nexusCards.includes(card.id) && (p.nexus === 'want' || p.nexus === 'have'))
    badges.push('NEXUS rebate');
  if (card.noFx && p.intl === 'yes')
    badges.push('No FX fees');
  if (hotelCards.includes(card.id) && (p.hotelNights === '1-4' || p.hotelNights === '5+'))
    badges.push('Hotel credit');
  if ((p.flights === '3-5' || p.flights === '6+') && (card.type === 'travel' || card.id === 'cobalt'))
    badges.push('Travel rewards');
  if (p.airline === 'ac' && ['td-aeroplan','cibc-aeroplan','amex-aeroplan'].includes(card.id))
    badges.push('Free bags (Air Canada)');
  if (p.airline === 'westjet' && card.id === 'westjet-rbc')
    badges.push('WestJet companion voucher');
  // MR cards highlighted for SkyTeam / BA / Asia flyers (best transfer options)
  if (['ba','skyteam','asia'].includes(p.airline) && card.loyalty?.program === 'mr')
    badges.push(`Best transfer for ${p.airline === 'ba' ? 'Avios/Oneworld' : p.airline === 'skyteam' ? 'Flying Blue/SkyTeam' : 'Asia Miles'}`);
  if (p.airline === 'ba' && card.loyalty?.program === 'avion')
    badges.push('Transfers to Avios');
  if (p.airline === 'asia' && card.loyalty?.program === 'avion')
    badges.push('Transfers to Asia Miles');
  if (p.airline === 'skyteam' && card.loyalty?.program === 'flying-blue')
    badges.push('Native Flying Blue card (SkyTeam)');
  return badges;
}

// Detect cross-card synergies that go beyond raw earn rate
function getStackSynergies(stackCards) {
  const synergies = [];
  const ids = new Set(stackCards.map(c => c.id));
  const pointsCards = stackCards.filter(c => c.type === 'points' || c.type === 'travel');

  // ── Loyalty compatibility check ──
  // If 2+ points cards are in stack, group by compatible ecosystems
  if (pointsCards.length >= 2) {
    const ecosystems = []; // [[card, card, ...], ...]
    const assigned = new Set();
    for (const card of pointsCards) {
      if (assigned.has(card.id)) continue;
      const group = [card];
      assigned.add(card.id);
      for (const other of pointsCards) {
        if (assigned.has(other.id)) continue;
        if (isLoyaltyCompatible(card, other)) {
          group.push(other);
          assigned.add(other.id);
        }
      }
      ecosystems.push(group);
    }

    // Highlight compatible groups
    const compatibleGroups = ecosystems.filter(g => g.length >= 2);
    for (const group of compatibleGroups) {
      const programs = [...new Set(group.map(c => c.loyalty?.label || c.name))];
      const destination = group.find(c => c.loyalty?.transfersTo?.length === 0 && !c.loyalty?.isolated)?.loyalty?.label
        || group.find(c => c.loyalty?.transfersTo?.length > 0)?.loyalty?.transfersTo?.[0];
      const progStr = programs.join(' + ');
      synergies.push({
        icon: '⚡',
        title: `${progStr} — Compatible Ecosystem`,
        note: `These cards' points flow into the same program${destination ? ` (${destination})` : ''} — you're building one pool, not splitting across multiple programs. Combine earn rates from both cards for faster accumulation.`,
        type: 'positive',
      });
    }

    // Warn about isolated programs mixed with others
    const isolatedInStack = pointsCards.filter(c => c.loyalty?.isolated);
    const otherPointsCards = pointsCards.filter(c => !c.loyalty?.isolated);
    if (isolatedInStack.length > 0 && otherPointsCards.length > 0) {
      for (const iso of isolatedInStack) {
        synergies.push({
          icon: '⚠️',
          title: `${iso.loyalty?.label || iso.name} — Isolated Program`,
          note: `${iso.name}'s points (${iso.loyalty?.label}) cannot be transferred or combined with your other cards' programs. You'd be managing two separate reward systems. Consider whether the earn rate justifies the fragmentation.`,
          type: 'warning',
        });
      }
    }
  }

  // ── MR earner + Aeroplan card → points pipeline ──
  const mrEarnerIds  = ['cobalt','amex-plat'];
  const aeroplanIds  = ['td-aeroplan','cibc-aeroplan','amex-aeroplan'];
  const mrEarner     = stackCards.find(c => mrEarnerIds.includes(c.id));
  const aeroplanCard = stackCards.find(c => aeroplanIds.includes(c.id));
  if (mrEarner && aeroplanCard && !synergies.some(s => s.title.includes('Compatible'))) {
    const bagNote = ['td-aeroplan','cibc-aeroplan'].includes(aeroplanCard.id)
      ? ' Book with your Aeroplan Visa for free checked bags on Air Canada flights only.'
      : '';
    synergies.push({
      icon: '⚡',
      title: `${mrEarner.name.split(' ').slice(0,2).join(' ')} + ${aeroplanCard.name.split(' ').slice(0,2).join(' ')} — Points Pipeline`,
      note: `Earn MR at ${mrEarner.name.includes('Cobalt') ? '5x on food & dining' : '3x on dining & groceries'}, transfer 1:1 to Aeroplan. At ${mrEarner.cpp.avgTravel}cpp avg redemption, that's real travel value.${bagNote}`,
      type: 'positive',
    });
  }

  // ── MR for SkyTeam / Flying Blue flyers ──
  if (mrEarner && profile.perks.airline === 'skyteam') {
    synergies.push({
      icon: '🇫🇷',
      title: `${mrEarner.name.split(' ').slice(0,2).join(' ')} — Flying Blue Transfer (SkyTeam)`,
      note: `Amex MR transfers 1:1 to Air France/KLM Flying Blue. Redeem for flights on Air France, KLM, Delta, Korean Air, Aeromexico, and all SkyTeam partners. Flying Blue promo rewards periodically offer 50%+ discount on points for specific routes.`,
      type: 'positive',
    });
  }

  // ── MR + Avion → multi-program transfer flexibility ──
  if (mrEarner && ids.has('rbc-avion')) {
    synergies.push({
      icon: '🔄',
      title: 'MR + Avion — Maximum Transfer Flexibility',
      note: `MR transfers to Aeroplan (Star Alliance), Avios (Oneworld), Asia Miles, Flying Blue (SkyTeam), and more. Avion adds Aeroplan/Avios/Asia Miles routes. Together you cover Star Alliance, Oneworld, and SkyTeam — pick whichever program gives the best value per redemption.`,
      type: 'positive',
    });
  }

  // ── Scotia Gold + Scotia Passport → Scene+ stacking ──
  if (ids.has('scotia-gold') && ids.has('scotia-passport')) {
    synergies.push({
      icon: '🏦',
      title: 'Scotia Gold + Scotia Passport — Scene+ Stacking',
      note: 'Earn Scene+ at 6x on groceries & dining (Gold), redeem via the Scotia Travel portal at 1cpp max (Passport). Both cards have no FX fees — stack Scene+ for travel.',
      type: 'positive',
    });
  }

  // ── Aeroplan Visa + AC flyer → free bag ──
  const aeroplanVisa = stackCards.find(c => ['td-aeroplan','cibc-aeroplan'].includes(c.id));
  if (aeroplanVisa && profile.perks.airline === 'ac' && !mrEarner) {
    synergies.push({
      icon: '🎒',
      title: `${aeroplanVisa.name.split(' ').slice(0,2).join(' ')} — Free Checked Bag`,
      note: `Free first checked bag for you + up to 8 companions on every Air Canada flight. At $35/bag each way, that's $70+ saved per round trip.`,
      type: 'positive',
    });
  }

  // ── Custom redemption: points vs cash analysis ──
  const customCpp = getCustomCppValue();
  if (customCpp && pointsCards.length > 0) {
    const transferableCards = pointsCards.filter(c => c.loyalty && !c.loyalty.isolated && c.loyalty.program !== 'scene+');
    if (transferableCards.length > 0) {
      const stmtCpp = transferableCards[0].cpp?.stmt || 1.0;
      const beatsCash = customCpp > stmtCpp;
      const formatted = customCpp.toFixed(2);
      synergies.push({
        icon: beatsCash ? '💎' : '💡',
        title: `Target Redemption: ${formatted}cpp — ${beatsCash ? 'Points Beat Cash' : 'Cash May Be Better'}`,
        note: beatsCash
          ? `At ${formatted}¢/point, your points are worth more than statement credit (${stmtCpp}cpp). This redemption is a sweet spot — use your points here rather than cashing out.`
          : `At ${formatted}¢/point, this redemption is below your cards' statement credit value (${stmtCpp}cpp). You may get more value keeping points for a better flight redemption.`,
        type: beatsCash ? 'positive' : 'warning',
      });
    }
  }

  return synergies;
}

// Airline-specific perk value (free bags, companion vouchers) that only apply to certain airlines
function airlinePerksValue(card) {
  const airline = profile.perks.airline;
  if (!airline || airline === 'no') return 0;
  if (['td-aeroplan','cibc-aeroplan'].includes(card.id)) {
    return airline === 'ac' ? 70 : 0;
  }
  if (card.id === 'westjet-rbc') {
    return airline === 'westjet' ? 200 : 20;
  }
  return 0;
}

function loungePerksValue(card) {
  const pref = profile.perks.lounges;
  if (!pref || pref === 'no') return 0;
  // amex-plat lounge already included in card.perksValue ($600 credits)
  if (card.id === 'amex-plat') return 0;
  // visits/yr per card
  const visitMap = { 'scotia-passport': 6, 'amex-gold': 4, 'cibc-aventura': 4, 'nb-we': 3, 'desjardins': 3 };
  const totalVisits = visitMap[card.id];
  if (!totalVisits) return 0;
  const usedVisits = pref === 'frequently' ? totalVisits : Math.ceil(totalVisits / 2);
  return usedVisits * 32; // ~$32 per lounge visit
}

// Format rate with pts multiplier AND effective % for clarity when goal=points
function fmtRateFull(card, cat) {
  if (card.pts && card.cpp && profile.goal !== 'cashback') {
    const p = cat === 'fxTravel' ? (card.pts.other || 0) : (card.pts[cat] || 0);
    if (p === 0) return '—';
    const cpp = getEffectiveCpp(card);
    return `${p}x @ ${cpp.toFixed(2)}¢/pt`;
  }
  return `${parseFloat((effectiveRate(card, cat) * 100).toFixed(2))}%`;
}

function rateClass(pct) {
  if (pct >= 0.05) return 'r5';
  if (pct >= 0.04) return 'r4';
  if (pct >= 0.03) return 'r3';
  if (pct >= 0.02) return 'r2';
  return 'r1';
}

// Format a rate for display: always "5x (1¢ stmt)" for points, "4.51%" for cashback
function fmtRate(card, cat, decimals = 2) {
  if (card.pts) {
    const p = cat === 'fxTravel' ? (card.pts.other || 0) : (card.pts[cat] || 0);
    if (p > 0) {
      const stmtCpp = card.cpp?.stmt ?? 1.0;
      return `${p}x<span style="display:block;font-size:9px;color:var(--muted);line-height:1.3;">${stmtCpp}¢ stmt</span>`;
    }
    return '—';
  }
  return `${(effectiveRate(card, cat) * 100).toFixed(decimals)}%`;
}

// Format a raw rate number (not card-specific) — for stack viz best rates
function fmtRateVal(rate) {
  return `${parseFloat((rate * 100).toFixed(2))}%`;
}

// Rate to use for sort/comparison — in cashback filter always use stmt cpp for points cards
function sortRate(card, cat) {
  if (window._currentFilter === 'cashback' && card.pts && card.cpp) {
    const stmtCpp = card.cpp.stmt || 1.0;
    if (cat === 'rent') {
      if (!card.pts.rent || profile.chexy !== 'yes') return 0;
      const gross = card.pts.rent * stmtCpp / 100;
      const fee = card.network === 'visa' ? CHEXY_FEE : card.network === 'mc' ? CASA_FEE : 0;
      return Math.max(0, gross - fee);
    }
    if (cat === 'fxTravel') {
      const p = card.pts.other || 0;
      const gross = p * stmtCpp / 100;
      return card.noFx ? gross : Math.max(0, gross - FX_FEE);
    }
    return (card.pts[cat] || 0) * stmtCpp / 100;
  }
  return effectiveRate(card, cat);
}

const BANKING_OPTIONS  = ['none','cibc','td','scotia','bmo','rbc'];
const BANKING_LABELS   = { none:'None', cibc:'CIBC Smart Plus', td:'TD All-Inclusive Banking', scotia:'Scotia Ultimate Package', bmo:'BMO Premium Plan', rbc:'RBC VIP Banking', ws:'Wealthsimple Premium' };
const BANKING_MIN_BAL  = { none:0, cibc:5000, td:5000, scotia:4000, bmo:4000, rbc:4000, ws:0 };

// ── CARD BENEFITS (perks beyond earn rates) ──
const CARD_BENEFITS = {
  'cibc-div': [
    'Emergency travel medical — up to 10 days per trip (must charge full trip cost to card)',
    'Trip cancellation & interruption — up to $2,500/person cancellation, $5,000 interruption',
    'Mobile device insurance — up to $1,000 if purchased on card',
    'Purchase protection — 90 days against theft or accidental damage',
    'Extended warranty — doubles manufacturer warranty up to 1 additional year',
    'Rental car loss/damage insurance — waives collision damage waiver at rental desks',
  ],
  'td-cashback': [
    'Emergency travel medical — up to 10 days per trip',
    'Trip cancellation & interruption insurance included',
    'TD Auto Club roadside assistance — towing, battery boost, flat tire, lockout',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'scotia-momentum': [
    'Emergency travel medical — up to 10 days per trip',
    'Trip cancellation & interruption insurance',
    'Mobile device insurance — up to $1,000 replacement/repair',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'bmo-cashback': [
    'Emergency travel medical — up to 8 days per trip (up to 64 days if 65+)',
    'Trip cancellation & interruption coverage',
    'Mobile device insurance included',
    'Purchase protection (90 days) & extended warranty (+1 yr)',
    'Rental car collision/loss damage insurance',
  ],
  'neo-we': [
    'Purchase protection — 120 days against theft or damage (longer than most cards)',
    'Extended warranty — adds 2 extra years (best-in-class warranty extension)',
    'Mobile device insurance for phones purchased on card',
    'Rental car collision/loss damage insurance',
  ],
  'simplycash': [
    'Emergency travel medical insurance',
    'Trip cancellation, interruption & flight delay insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'simplii': [
    'Emergency travel medical — up to 10 days per trip',
    'Trip interruption insurance',
    'Purchase protection & extended warranty',
  ],
  'rogers-we': [
    'Emergency travel medical — up to 15 days per trip (under 65)',
    'Trip cancellation & interruption insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
    'Note: 3% cashback on FX purchases offsets the 2.5% FX fee, netting +0.5% on foreign spend',
  ],
  'desjardins': [
    'Dragon Pass lounge access — 3 free visits/yr at 1,300+ airport lounges worldwide',
    'Emergency travel medical insurance',
    'Trip interruption coverage',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'mbna-we': [
    '10% birthday bonus points every year — applied automatically on your birthday month',
    '24/7 roadside assistance — towing, fuel delivery, lockout, flat tire',
    'Emergency travel medical insurance',
    'Trip cancellation & interruption insurance',
    'Purchase protection & extended warranty',
  ],
  'ws-infinite': [
    'No foreign transaction fees — save 2.5% on all international purchases',
    'Emergency travel medical insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
    'Requires Wealthsimple Premium ($10/mo or $100K+ assets for free)',
  ],
  'cobalt': [
    '1:1 Membership Rewards transfer to Aeroplan (Star Alliance), Avios (Oneworld/BA/Iberia), Asia Miles, Flying Blue (Air France/KLM), BA Executive Club',
    'Emergency travel medical — covers entire trip if booked on card',
    'Flight delay insurance — meals/hotel if delayed 4+ hours',
    'Lost & delayed baggage insurance',
    'Purchase protection (90 days) & extended warranty (+1 yr)',
    'Rental car collision/loss damage insurance',
    'Amex Offers — targeted discounts at restaurants, retailers, and travel',
  ],
  'nb-we': [
    'Mastercard Travel Pass (DragonPass) — 3 free lounge visits/yr at 1,300+ lounges',
    'Mobile device insurance for phones purchased on card',
    'Emergency travel medical insurance',
    'Trip cancellation & interruption coverage',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'scotia-gold': [
    'No foreign transaction fees — save 2.5% on all international purchases',
    'Scene+ points redeemable on travel bookings at 1cpp, movies, and statement credit',
    'Emergency travel medical insurance',
    'Trip cancellation & interruption insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'td-aeroplan': [
    'Free first checked bag — you + up to 8 travel companions per Air Canada flight',
    'NEXUS fee rebate — $100 every 4.5 years (covers full application cost)',
    'Preferred boarding on Air Canada flights (Group 2 boarding)',
    'Emergency travel medical — up to 21 days per trip',
    'Trip cancellation, interruption & delayed baggage insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
    'Fee waived with TD All-Inclusive Banking (min $5K balance)',
  ],
  'cibc-aeroplan': [
    'Free first checked bag — you + up to 8 companions per Air Canada flight',
    'Preferred boarding on Air Canada flights (Group 2 boarding)',
    'Emergency travel medical — up to 21 days per trip',
    'Trip cancellation & interruption insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'scotia-passport': [
    'Visa Airport Companion — 6 free lounge visits/yr at 1,300+ airports worldwide',
    'No foreign transaction fees — save 2.5% on all international purchases',
    'Emergency travel medical — up to 25 days per trip (best among cashback/points VIs)',
    'Trip cancellation, interruption & flight delay insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
    'Fee waived with Scotia Ultimate Package (min $4K balance)',
  ],
  'rbc-avion': [
    'Transfer to Aeroplan (Star Alliance — Air Canada, Lufthansa, Singapore Airlines, United)',
    'Transfer to Avios (Oneworld — British Airways, Iberia, Qatar Airways, Cathay Pacific)',
    'Transfer to Asia Miles & BA Executive Club',
    'Emergency travel medical insurance',
    'Trip cancellation & interruption insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'amex-aeroplan': [
    'Aeroplan points redeemable on Air Canada, Lufthansa, Singapore Airlines & 45+ Star Alliance partners',
    'Aeroplan Status Qualifying Miles (SQM) on eligible purchases — helps reach Elite status',
    'Emergency travel medical insurance',
    'Baggage delay & flight delay insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
    'Amex Offers — targeted cashback/bonus deals at restaurants and retailers',
  ],
  'amex-plat': [
    '$200 Annual Travel Credit — flights, hotels, car rental booked via Amex Travel (auto-applied)',
    '$200 Fine Hotels & Resorts credit — prepaid hotel stays booked via Amex (noon check-in, upgrade, breakfast)',
    'NEXUS rebate — $100 application fee reimbursed every 4.5 years',
    'Unlimited Centurion Lounge access — Toronto Pearson Terminal 1, Calgary + 50+ global locations',
    'Unlimited Priority Pass access — 1,300+ airport lounges worldwide (guest fees apply)',
    '1:1 MR transfer to Aeroplan, Avios, Asia Miles, Flying Blue, BA Executive Club',
    'Emergency travel medical — up to 15 days per trip',
    'Trip cancellation, interruption & flight delay insurance',
    'Platinum concierge — 24/7 restaurant reservations, event tickets, travel planning',
    'Purchase protection (90 days) & extended warranty (+1 yr)',
    'Rental car collision/loss damage insurance',
    'Amex Offers — exclusive targeted deals across travel, dining, retail',
  ],
  'westjet-rbc': [
    'Free first checked bag — you + up to 8 companions on every WestJet flight',
    'Annual WestJet companion voucher — round-trip economy or WestJet Plus fare (~$200–$400 value)',
    'Emergency travel medical & trip cancellation insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'tangerine-mc': [
    'Choose 2 (or 3 with direct deposit) cashback categories — change them quarterly via app',
    'Purchase protection (90 days) & extended warranty (+1 yr)',
    'Note: No travel insurance — pair with a card that has travel medical coverage',
  ],
  'amex-gold': [
    '$100 Annual Travel Credit — hotels or flights booked via Amex Travel (auto-applied)',
    '4 complimentary lounge visits/yr — Priority Pass lounges + Centurion Lounges',
    '1:1 MR transfer to Aeroplan, Avios, Asia Miles, Flying Blue, BA Executive Club',
    'Emergency travel medical insurance',
    'Trip cancellation, interruption & flight delay insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
    'Amex Offers — targeted discounts at restaurants, retailers, and travel',
  ],
  'cibc-aventura': [
    'Visa Airport Companion — 4 free lounge visits/yr at 1,300+ airports worldwide',
    'NEXUS fee rebate — $100 every 4.5 years',
    'Emergency travel medical — up to 15 days per trip',
    'Trip cancellation & interruption insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
  'pc-financial': [
    'PC Optimum points — redeemable at Loblaws, Shoppers Drug Mart, No Frills, Zehrs, Real Canadian Superstore',
    'No annual fee, no income requirement — easy to get and keep',
    'Basic purchase protection & warranty',
    'Note: No travel insurance — not suitable as a primary travel card',
  ],
  'brim-we': [
    'No foreign transaction fees — save 2.5% on all international purchases',
    'Brim Marketplace — earn bonus points at select retailers and restaurants via app',
    '$10/month in Brim credits (auto-applied against purchases)',
    'Points transferable to Air France/KLM Flying Blue (SkyTeam)',
    'Emergency travel medical insurance',
    'Purchase protection & extended warranty',
    'Rental car collision/loss damage insurance',
  ],
};

function calculate(skipSpouseInit = false) {
  const spend = getSpend();
  window._lastSpend = spend;
  if (!skipSpouseInit) {
    window._currentFilter = 'all';
    window._sortSet = new Set();
    window._networkFilter = 'all';
    window._feeFilter = 'all';
    window._programFilter = 'all';
    window._showAllCards = false;
    window._cardSearch = '';
    const searchEl = document.getElementById('card-search');
    if (searchEl) searchEl.value = '';
    document.querySelectorAll('#sort-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    const netTab = document.querySelector('#sort-tabs [data-sort="net"]');
    if (netTab) netTab.classList.add('active');
    ['network-select','fee-select','program-select'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = 'all'; el.className = 'filter-select'; }
    });
    const sortSel = document.getElementById('sort-select');
    if (sortSel) sortSel.value = 'net';
    document.querySelectorAll('#type-tabs .filter-chip, #type-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    const allTab = document.querySelector('#type-tabs .filter-chip, #type-tabs .filter-tab');
    if (allTab) allTab.classList.add('active');
    // Auto-assume partner also holds any card where spend exceeds its effective cap (per-cat or combined)
    window._spouseSet = new Set(
      CARDS.filter(c => {
        const effCaps = computeEffectiveCaps(c, spend);
        return Object.entries(effCaps).some(([cat, cap]) => (spend[cat] || 0) > cap);
      }).map(c => c.id)
    );
    // Reset excluded cards, pinned cards, and stack size override on fresh calculate
    window._excludedSet = new Set();
    window._pinnedSet = new Set();
    window._stackSizeOverride = null;
  }
  const cats = ['groceries','dining','gas','recurring','rent','other','travel','fxTravel'];
  const catLabels = { groceries:'Groceries', dining:'Dining', gas:'Gas', recurring:'Recurring', rent:'Rent', other:'Other', travel:'Flights & Hotels', fxTravel:'FX Spend' };

  const profileMax = parseInt(profile.maxcards) || 4;
  const maxCards = window._stackSizeOverride ?? profileMax;

  // ── Determine best combination of banking packages within balance budget ──
  const userMinBal = parseInt(profile.minBal) || 0;
  // Asset banks + DD unlock fee waivers for free (no chequing balance needed)
  const freeBanks = new Set(profile.assetBanks);
  if (profile.willingToDD === 'yes') freeBanks.add('ws');
  // Additional banks available via chequing minimum balance
  const balCandidates = BANKING_OPTIONS.filter(b => b !== 'none' && !freeBanks.has(b));
  // Enumerate all 2^N subsets of balance-based additions; keep those within budget
  let bestSubset = [...freeBanks], bestNet = -Infinity;
  for (let mask = 0; mask < (1 << balCandidates.length); mask++) {
    const extra = balCandidates.filter((_, i) => mask & (1 << i));
    if (extra.reduce((s, b) => s + BANKING_MIN_BAL[b], 0) > userMinBal) continue;
    const subset = [...freeBanks, ...extra];
    profile.activeBanking = new Set(subset);
    const sc = CARDS.map(card => ({ ...card, ...calcCardValue(card, spend), eligible: isEligible(card) }));
    let fl = sc;
    if (profile.goal === 'cashback') fl = sc.filter(c => c.type === 'cashback');
    if (profile.goal === 'travel')   fl = sc.filter(c => c.type === 'points' || c.type === 'travel');
    const stk = buildOptimalStack(fl.filter(c => c.eligible && !window._excludedSet?.has(c.id)), spend, maxCards);
    const { net } = calcStackValue(stk, spend);
    if (net > bestNet) { bestNet = net; bestSubset = subset; }
  }
  profile.activeBanking = new Set(bestSubset);

  // Score all cards with the selected banking profile
  const scored = CARDS.map(card => {
    const val = calcCardValue(card, spend);
    const eligible = isEligible(card);
    return { ...card, ...val, eligible };
  }).sort((a,b) => b.net - a.net);

  // ── Filter by goal ──
  let filtered = scored;
  if (profile.goal === 'cashback') filtered = scored.filter(c => c.type === 'cashback');
  if (profile.goal === 'travel') filtered = scored.filter(c => c.type === 'points' || c.type === 'travel');

  // ── Find best stack (excluded cards removed) ──
  const eligibleCards = filtered.filter(c => c.eligible && !window._excludedSet?.has(c.id));

  // ── Build top 5 stacks; pick selected alternative ──
  if (!window._useAltStack) {
    window._topStacks = buildTopStacks(eligibleCards, spend, maxCards, 5);
    window._altIdx = 0;
  }
  window._useAltStack = false;
  const stackCards = window._topStacks?.[window._altIdx || 0]?.cards || buildOptimalStack(eligibleCards, spend, maxCards);
  window._currentStack = stackCards;
  const { gross: stackGross, fees: stackFees, net: stackNet } = calcStackValue(stackCards, spend);

  // ── Compute points per loyalty program ──
  const _stackPtsByProgram = {}; // { label: { pts, stmtCpp, card } }
  let _stackCash = 0;
  { const earnCats = ['groceries','dining','gas','recurring','rent','other','travel'];
    const _hasAmex = stackCards.some(c => c.network === 'amex');
    const _hasNonAmex = stackCards.some(c => c.network !== 'amex');
    for (const cat of earnCats) {
      const monthly = spend[cat] || 0;
      if (!monthly) continue;
      const amexFrac = (cat === 'rent') ? 0 : (profile.amexAcceptance ?? 0.8);
      const rows = (_hasAmex && _hasNonAmex && amexFrac > 0 && amexFrac < 1)
        ? [{ amt: monthly * amexFrac, cands: stackCards.filter(c => c.network === 'amex') },
           { amt: monthly * (1 - amexFrac), cands: stackCards.filter(c => c.network !== 'amex') }]
        : [{ amt: monthly, cands: stackCards }];
      for (const { amt, cands } of rows) {
        if (amt < 0.01 || !cands.length) continue;
        let bCard = null, bEarn = 0;
        for (const card of cands) {
          const cm = window._spouseSet?.has(card.id) ? 2 : 1;
          const rate = effectiveRate(card, cat);
          const rc = computeEffectiveCaps(card, spend)[cat];
          const eff = rc ? Math.min(amt, rc * cm) : amt;
          if (eff * rate > bEarn) { bEarn = eff * rate; bCard = card; }
        }
        if (!bCard) continue;
        const cm2 = window._spouseSet?.has(bCard.id) ? 2 : 1;
        const rc2 = computeEffectiveCaps(bCard, spend)[cat];
        const effAmt = rc2 ? Math.min(amt, rc2 * cm2) : amt;
        if (bCard.pts) {
          const ppl = bCard.pts[cat] || bCard.pts.other || 0;
          const prog = bCard.loyalty?.label || bCard.name.split(' ').slice(0,2).join(' ');
          if (!_stackPtsByProgram[prog]) _stackPtsByProgram[prog] = { pts: 0, stmtCpp: bCard.cpp?.stmt || 1, card: bCard };
          _stackPtsByProgram[prog].pts += effAmt * 12 * ppl;
        } else {
          _stackCash += effAmt * 12 * effectiveRate(bCard, cat);
        }
      }
    }
    Object.values(_stackPtsByProgram).forEach(p => { p.pts = Math.round(p.pts); });
    _stackCash = Math.round(_stackCash);
  }
  window._stackPtsData = { byProgram: _stackPtsByProgram, cash: _stackCash };
  window._ptsViewCash = false;

  // ── Render ──
  if (!skipSpouseInit) goStep(3);

  const totalSpend = Object.values(spend).reduce((a,b) => a+b, 0) * 12;
  document.getElementById('summary-stats').innerHTML = `
    <div class="stat-card">
      <div class="stat-value">$${totalSpend.toLocaleString()}</div>
      <div class="stat-label">Annual Spend</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">$${stackNet.toLocaleString()}</div>
      <div class="stat-label">Stack Net Value</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${totalSpend > 0 ? ((stackNet/totalSpend)*100).toFixed(1) : 0}%</div>
      <div class="stat-label">Effective Return</div>
    </div>
    <div class="stat-card">
      ${(() => {
        const spouseCount = stackCards.filter(c => window._spouseSet?.has(c.id)).length;
        const canDec = stackCards.length > 1;
        const canInc = stackCards.length < profileMax;
        return `<div class="stat-value" style="display:flex;align-items:center;justify-content:center;gap:10px;">
          <button onclick="setStackSize(${stackCards.length - 1})" ${canDec ? '' : 'disabled'} style="width:24px;height:24px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:14px;cursor:${canDec?'pointer':'default'};opacity:${canDec?'1':'0.3'};line-height:1;padding:0;">−</button>
          ${stackCards.length}
          <button onclick="setStackSize(${stackCards.length + 1})" ${canInc ? '' : 'disabled'} style="width:24px;height:24px;border-radius:50%;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:14px;cursor:${canInc?'pointer':'default'};opacity:${canInc?'1':'0.3'};line-height:1;padding:0;">+</button>
        </div>
        <div class="stat-label">Cards in Stack${window._stackSizeOverride !== null ? ` <span style="color:var(--accent);font-size:9px;cursor:pointer;" onclick="setStackSize(null)">reset</span>` : ''}${spouseCount > 0 ? `<br><span style="font-size:9px;color:var(--muted);text-transform:none;letter-spacing:0;font-weight:400;">${stackCards.length} yours · ${spouseCount} partner</span>` : ''}</div>`;
      })()}
    </div>
  `;

  // ── Stack cards display ──
  const roleColors = ['var(--accent)', 'var(--accent2)', 'var(--accent3)', '#a89cf8', '#60a5fa', '#f472b6', '#34d399'];
  const roleLabels = ['Primary', 'Companion', 'Third Card', 'Fourth Card', 'Fifth Card', 'Sixth Card', 'Seventh Card'];

  const waivedCards = stackCards.filter(c => c.fee > 0 && c.effectiveFee === 0);
  const activeBankList = [...profile.activeBanking];
  const freeBanksFinal = activeBankList.filter(b => freeBanks.has(b));
  const balBanksFinal  = activeBankList.filter(b => !freeBanks.has(b));
  const balRequired    = balBanksFinal.reduce((s, b) => s + BANKING_MIN_BAL[b], 0);
  const showNote = activeBankList.length > 0 && waivedCards.length > 0;
  const bankingNote = showNote
    ? (() => {
        const parts = [];
        if (freeBanksFinal.length) parts.push(freeBanksFinal.map(b => `<strong>${BANKING_LABELS[b]}</strong> <span style="color:var(--t3)">(via ${b === 'ws' ? profile.willingToDD === 'yes' ? '$4K DD' : '$100K assets' : '$100K assets'})</span>`).join(' + '));
        if (balBanksFinal.length)  parts.push(balBanksFinal.map(b => `<strong>${BANKING_LABELS[b]}</strong> <span style="color:var(--t3)">($${BANKING_MIN_BAL[b].toLocaleString()} chequing min)</span>`).join(' + '));
        return `<div style="margin-top:0;margin-bottom:18px;padding:11px 14px;background:rgba(200,240,69,0.05);border:1px solid rgba(200,240,69,0.18);border-radius:8px;font-size:12px;font-family:inherit;color:var(--accent);line-height:1.6;">
          Banking setup: ${parts.join(' &nbsp;+&nbsp; ')}
          ${balRequired ? `— <strong>$${balRequired.toLocaleString()} chequing balance needed</strong>` : ''}
          <span style="color:var(--t2);"> · waives ${waivedCards.map(c=>c.name.split(' ').slice(0,2).join(' ')).join(' + ')} fee${waivedCards.length>1?'s':''}</span>
        </div>`;
      })()
    : '';

  const _hasOverrides = (window._excludedSet?.size || 0) + (window._pinnedSet?.size || 0) > 0;
  const _altCount = window._topStacks?.length || 1;
  const _curAlt = window._altIdx || 0;

  let stackHtml = `<div class="stack-section">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <h2>${_curAlt === 0 ? 'Your Optimal Stack' : `Alternative Stack ${_curAlt + 1}`}</h2>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        ${_hasOverrides ? `<button onclick="resetExcluded()" style="font-size:10px;color:var(--t2);background:none;border:1px solid var(--border);border-radius:5px;padding:4px 10px;cursor:pointer;font-family:inherit;white-space:nowrap;">Revert to original</button>` : ''}
        ${_altCount > 1 ? `
          <div style="display:flex;align-items:center;gap:5px;">
            <button onclick="switchAltStack(${Math.max(0,_curAlt-1)})" ${_curAlt===0?'disabled':''} style="width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:none;color:${_curAlt===0?'var(--t3)':'var(--text)'};font-size:12px;cursor:${_curAlt===0?'default':'pointer'};line-height:1;padding:0;font-family:inherit;">‹</button>
            <span style="font-size:10px;color:var(--t2);white-space:nowrap;">${_curAlt+1} / ${_altCount}</span>
            <button onclick="switchAltStack(${Math.min(_altCount-1,_curAlt+1)})" ${_curAlt>=_altCount-1?'disabled':''} style="width:22px;height:22px;border-radius:4px;border:1px solid var(--border);background:none;color:${_curAlt>=_altCount-1?'var(--t3)':'var(--text)'};font-size:12px;cursor:${_curAlt>=_altCount-1?'default':'pointer'};line-height:1;padding:0;font-family:inherit;">›</button>
          </div>` : ''}
      </div>
    </div>
    <div class="subtitle">${stackCards.length} card${stackCards.length !== 1 ? 's' : ''} · optimized for your spending</div>
    ${bankingNote}
    <div class="stack-cards">
  `;

  stackCards.forEach((card, i) => {
    const winCats = cats.filter(cat => {
      if ((spend[cat] || 0) === 0) return false;
      const thisRate = effectiveRate(card, cat);
      if (thisRate === 0) return false;
      return stackCards.every(c => effectiveRate(c, cat) <= thisRate);
    });
    let useFor;
    if (!winCats.length) {
      useFor = 'Catch-all / backup';
    } else if (card.pts && card.cpp && profile.goal !== 'cashback') {
      // Group categories by multiplier, show once with shared cpp at end
      const cpp = getEffectiveCpp(card);
      const groups = new Map();
      for (const c of winCats) {
        const p = c === 'fxTravel' ? (card.pts.other || 0) : (card.pts[c] || 0);
        if (!groups.has(p)) groups.set(p, []);
        groups.get(p).push(catLabels[c]);
      }
      const parts = [...groups.entries()].sort(([a],[b]) => b-a).map(([p, names]) => `${p}x (${names.join(', ')})`);
      useFor = parts.join(' · ') + ` @ ${cpp.toFixed(2)}¢/pt`;
    } else {
      useFor = winCats.map(c => `${catLabels[c]} ${fmtRateFull(card, c)}`).join(' · ');
    }
    const waivingBank = card.feeWaivedBy?.find(b => profile.activeBanking.has(b));
    const feeDisplay = card.effectiveFee === 0
      ? (card.wsReq ? 'free — requires WS Premium ($4K/mo DD)'
        : waivingBank ? `fee waived (${BANKING_LABELS[waivingBank]})`
        : 'no annual fee')
      : `$${card.effectiveFee}/yr`;
    const _effCapsSpouse = computeEffectiveCaps(card, spend);
    const overflowCats = cats.filter(cat => _effCapsSpouse[cat] !== undefined && (spend[cat] || 0) > _effCapsSpouse[cat]);
    const inSpouseSet = window._spouseSet?.has(card.id);
    let spouseNote = '';
    if (overflowCats.length) {
      const catList = overflowCats.map(c => catLabels[c]).join(', ');
      if (inSpouseSet) {
        const spouseFeeNote = card.fee > 0 ? ` · spouse pays $${card.fee}/yr separately` : '';
        spouseNote = `<div style="margin-top:10px;font-size:11px;color:var(--yellow);line-height:1.5;">
          Partner also holds this card<br>
          <span style="color:var(--muted);font-size:10px;">${catList} cap doubled — spending exceeds limit${spouseFeeNote}</span><br>
          <button onclick="toggleSpouseCard('${card.id}')" style="margin-top:4px;font-size:10px;color:var(--muted);background:none;border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer;">Just me — remove spouse card</button>
        </div>`;
      } else {
        spouseNote = `<div style="margin-top:10px;font-size:11px;color:var(--muted);line-height:1.5;">
          Spouse card removed — ${catList} cap not doubled<br>
          <button onclick="toggleSpouseCard('${card.id}')" style="margin-top:4px;font-size:10px;color:var(--accent);background:none;border:1px solid var(--accent);border-radius:4px;padding:2px 8px;cursor:pointer;">+ Add spouse card</button>
        </div>`;
      }
    }
    // Build cpp context note for points/travel cards
    let cppContext = '';
    if (card.pts && card.cpp && profile.goal !== 'cashback') {
      const effectiveCpp = getEffectiveCpp(card);
      const ceiling = loyaltyCppCeiling(card);
      let cppLabel = 'avg travel estimate';
      if (card.cppBreakdown?.length) {
        const match = card.cppBreakdown.find(r => Math.abs(r.cpp - effectiveCpp) < 0.01);
        if (match) cppLabel = match.label;
      }
      const isCustom = !!getCustomCppValue();
      cppContext = `<div style="margin-top:5px;font-size:11px;color:var(--muted);line-height:1.4;">
        % = pts × <span style="color:var(--accent2);font-weight:700;">${effectiveCpp.toFixed(2)}¢/pt</span>
        &nbsp;—&nbsp; ${isCustom ? 'your custom target' : cppLabel}
        ${ceiling < Infinity && !isCustom ? `<span style="color:var(--yellow)"> · capped at ${ceiling}cpp (${card.loyalty?.label})</span>` : ''}
      </div>`;
    }

    const cardBenefits = CARD_BENEFITS[card.id] || [];
    const stripEmoji = s => s.replace(/^[\p{Emoji}\s·—\-–]+/u, '').trim();
    const perksHtml = cardBenefits.length ? `
      <details style="margin-top:10px;">
        <summary style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--t3);cursor:pointer;list-style:none;display:flex;align-items:center;gap:5px;user-select:none;">
          <span>Perks &amp; Coverage</span><span style="font-size:8px;">▼</span>
        </summary>
        <div style="margin-top:9px;display:flex;flex-direction:column;gap:5px;padding-left:2px;">
          ${cardBenefits.map(b => `<div style="font-size:11px;color:var(--t2);line-height:1.5;">${stripEmoji(b)}</div>`).join('')}
        </div>
      </details>
    ` : '';

    stackHtml += `
      <div class="stack-card">
        <div class="use-for" style="color:${roleColors[i]}">${roleLabels[i] || 'Card '+(i+1)}</div>
        <div class="card-n">${card.name}</div>
        <div class="rate-info">${feeDisplay}</div>
        ${perksHtml}
        ${spouseNote}
        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
          <button onclick="openSwapPicker('${card.id}')" style="font-size:10px;color:var(--accent);background:rgba(200,240,69,0.06);border:1px solid rgba(200,240,69,0.22);border-radius:4px;padding:3px 10px;cursor:pointer;font-family:inherit;">Swap card</button>
          <button onclick="toggleExcludeCard('${card.id}')" style="font-size:10px;color:var(--t3);background:none;border:1px solid var(--border);border-radius:4px;padding:3px 9px;cursor:pointer;font-family:inherit;">Remove</button>
        </div>
      </div>
    `;
  });

  if (stackCards.length === 0) {
    stackHtml += `<div style="color:var(--muted);font-size:14px;">No eligible cards found — adjust your profile filters.</div>`;
  }

  // ── Excluded cards banner ──
  // ── Swap / excluded overrides banner ──
  const pinnedIds = [...(window._pinnedSet || [])];
  const excludedIds = [...(window._excludedSet || [])];
  // Swaps: excluded card that has a corresponding pinned replacement
  // Simple heuristic: pair them in order (1st excluded → 1st pinned, etc.)
  const swapPairs = excludedIds.map((exId, i) => ({ out: exId, in: pinnedIds[i] })).filter(p => p.in);
  const bareExcluded = excludedIds.filter((_, i) => !pinnedIds[i]);

  if (swapPairs.length > 0 || bareExcluded.length > 0) {
    let bannerRows = '';
    swapPairs.forEach(({ out: outId, in: inId }) => {
      const outName = CARDS.find(c => c.id === outId)?.name?.split(' ').slice(0,3).join(' ') || outId;
      const inName  = CARDS.find(c => c.id === inId)?.name?.split(' ').slice(0,3).join(' ')  || inId;
      bannerRows += `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span style="font-size:11px;color:var(--t2);">Swapped: <strong style="color:var(--text);">${outName}</strong> → <strong style="color:var(--accent);">${inName}</strong></span>
          <button onclick="undoSwap('${outId}','${inId}')" style="font-size:10px;color:var(--t2);background:none;border:1px solid var(--border);border-radius:4px;padding:3px 9px;cursor:pointer;font-family:inherit;">Undo</button>
        </div>`;
    });
    if (bareExcluded.length > 0) {
      const names = bareExcluded.map(id => CARDS.find(c => c.id === id)?.name?.split(' ').slice(0,2).join(' ') || id).join(', ');
      bannerRows += `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
          <span style="font-size:11px;color:var(--t2);">Excluded: <strong style="color:var(--text);">${names}</strong></span>
        </div>`;
    }
    stackHtml += `
      <div style="margin-top:12px;padding:10px 14px;background:rgba(107,107,138,0.08);border:1px solid var(--border);border-radius:6px;display:flex;flex-direction:column;gap:7px;">
        ${bannerRows}
        <div style="display:flex;justify-content:flex-end;">
          <button onclick="resetExcluded()" style="font-size:10px;color:var(--accent);background:none;border:1px solid rgba(200,240,69,0.3);border-radius:4px;padding:3px 10px;cursor:pointer;font-family:inherit;">Reset all</button>
        </div>
      </div>
    `;
  }

  stackHtml += `</div>`;

  // ── Combined rate visualization ──
  if (stackCards.length > 0) {
    const activeCats = cats.filter(cat => (spend[cat] || 0) > 0);
    if (activeCats.length > 0) {
      // Build cpp context footnote for points cards in stack
      const ptsCardInStack = stackCards.find(c => c.pts && c.cpp && profile.goal !== 'cashback');
      let cppFootnote = '';
      if (ptsCardInStack) {
        const eCpp = getEffectiveCpp(ptsCardInStack);
        const isCustom = !!getCustomCppValue();
        let cppSrc = '';
        if (isCustom) {
          cppSrc = 'your custom target redemption';
        } else if (ptsCardInStack.cppBreakdown?.length) {
          const match = ptsCardInStack.cppBreakdown.find(r => Math.abs(r.cpp - eCpp) < 0.01);
          cppSrc = match ? match.label : 'avg travel estimate';
        } else {
          cppSrc = 'avg travel estimate';
        }
        cppFootnote = `<span style="font-size:10px;color:var(--accent2);font-weight:400;text-transform:none;letter-spacing:0;margin-left:8px;">% values assume ${eCpp.toFixed(2)}¢/pt &nbsp;·&nbsp; ${cppSrc}</span>`;
      }
      stackHtml += `<div style="margin:28px 0 12px;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:0.15em;text-transform:uppercase;">Combined earn rates across your stack${cppFootnote}</div>`;
      const hasAmexInStack = stackCards.some(c => c.network === 'amex');
      const hasNonAmexInStack = stackCards.some(c => c.network !== 'amex');

      stackHtml += `<div style="display:flex;flex-direction:column;gap:10px;margin-bottom:28px;">`;
      for (const cat of activeCats) {
        const monthly = spend[cat] || 0;
        const amexFrac = (cat === 'rent') ? 0 : (profile.amexAcceptance ?? 0.8);
        const amexAmt    = monthly * amexFrac;
        const nonAmexAmt = monthly * (1 - amexFrac);
        // Show Amex/non-Amex split only when both types of cards are in the stack and amex isn't 0 or 100%
        const showSplit = hasAmexInStack && hasNonAmexInStack && amexFrac > 0 && amexFrac < 1 && cat !== 'rent';
        const fmtMon = v => v >= 10000 ? `$${Math.round(v/1000)}K` : `$${Math.round(v).toLocaleString()}`;
        const fmtCap = c => c >= 1000 ? `$${(c/1000).toFixed(1)}K` : `$${Math.round(c)}`;

        // Rows: [{amount, candidates, label, labelColor}]
        const earnRows = showSplit
          ? [
              { amount: amexAmt,    candidates: stackCards.filter(c => c.network === 'amex'), label: `Amex (${Math.round(amexFrac*100)}%)`,    color: 'var(--accent3)' },
              { amount: nonAmexAmt, candidates: stackCards.filter(c => c.network !== 'amex'), label: `Visa/MC (${Math.round((1-amexFrac)*100)}%)`, color: 'var(--muted)'   },
            ]
          : [{ amount: monthly, candidates: stackCards, label: null, color: 'var(--muted)' }];

        let catHtml = `<div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:var(--s1);border:1px solid var(--border);border-radius:8px;">`;

        let rowIdx = 0;
        for (const row of earnRows) {
          const { amount, candidates, label, color } = row;
          if (amount < 0.01 || candidates.length === 0) continue;
          let bestCard = null, bestEarning = 0, bestRate = 0;
          for (const card of candidates) {
            const capMult = window._spouseSet?.has(card.id) ? 2 : 1;
            const rate = effectiveRate(card, cat);
            const rawCap = computeEffectiveCaps(card, spend)[cat];
            const cap = rawCap ? rawCap * capMult : undefined;
            const eff = cap ? Math.min(amount, cap) : amount;
            if (eff * rate > bestEarning) { bestEarning = eff * rate; bestCard = card; bestRate = rate; }
          }
          if (!bestCard) continue;
          const capMult2 = window._spouseSet?.has(bestCard.id) ? 2 : 1;
          const rawCapSingle = bestCard.caps?.[cat];
          const capGroupSingle = bestCard.capGroups?.find(g => g.cats.includes(cat));
          const isGroupCap = !rawCapSingle && !!capGroupSingle;
          const totalGroupSpend = capGroupSingle ? capGroupSingle.cats.reduce((s, c) => s + (spend[c] || 0), 0) : 0;
          const isCapped = rawCapSingle ? amount > rawCapSingle * capMult2
            : isGroupCap ? totalGroupSpend > capGroupSingle.monthly * capMult2 : false;
          const effCapForAmt = computeEffectiveCaps(bestCard, spend)[cat];
          const bestCap = effCapForAmt ? effCapForAmt * capMult2 : undefined;
          const effAmt = bestCap ? Math.min(amount, bestCap) : amount;
          const annual = Math.round(effAmt * 12 * bestRate);
          const annualSpend = Math.round(amount * 12);
          const fmtSpend = v => v >= 1000 ? `$${Math.round(v/1000)}K` : `$${Math.round(v)}`;
          const barW = Math.min(100, bestRate * 1500);
          const rc = rateClass(bestRate);
          const shortName = bestCard.name.replace('Visa Infinite','VI').replace('Mastercard','MC').replace('World Elite','WE').split(' ').slice(0,2).join(' ');
          const rateCell = bestCard.pts && bestCard.cpp
            ? `${bestCard.pts[cat] || bestCard.pts.other || 0}x<span style="font-size:9px;color:var(--accent2);"> @${getEffectiveCpp(bestCard).toFixed(2)}¢</span>`
            : `${parseFloat((bestRate*100).toFixed(2))}%`;

          // First column: category name on first row; network label on split rows
          const firstColHtml = rowIdx === 0
            ? `<div style="line-height:1.25;">
                <div style="font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;">${catLabels[cat]}</div>
                ${showSplit && label ? `<div style="font-size:9px;color:${color};margin-top:1px;">${label}</div>` : ''}
               </div>`
            : `<div style="font-size:9px;color:${color};padding-left:2px;">${label || ''}</div>`;

          // Overflow when capped
          let ovHtml = '';
          if (isCapped) {
            const ovAmt = amount - bestCap;
            let ovCard = null, ovEarn = 0;
            for (const oc of stackCards) {
              if (oc.id === bestCard.id) continue;
              const ovRate = effectiveRate(oc, cat);
              if (ovAmt * ovRate > ovEarn) { ovEarn = ovAmt * ovRate; ovCard = oc; }
            }
            if (ovCard) {
              const ovRate = effectiveRate(ovCard, cat);
              const ovShort = ovCard.name.replace('Visa Infinite','VI').replace('Mastercard','MC').replace('World Elite','WE').split(' ').slice(0,2).join(' ');
              const ovStr = ovCard.pts?.[cat] ? `${ovCard.pts[cat]}x` : `${parseFloat((ovRate*100).toFixed(2))}%`;
              ovHtml = `<div style="padding-left:2px;font-size:9px;color:var(--t3);margin-top:2px;">↳ overflow → ${ovShort} @ ${ovStr}</div>`;
            }
          }

          catHtml += `
            <div>
              <div style="display:grid;grid-template-columns:90px 1fr 64px 44px 76px 46px;align-items:center;gap:8px;">
                ${firstColHtml}
                <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;">
                  <div class="rate-bar ${rc}" style="width:${barW}%;height:100%;border-radius:6px;"></div>
                </div>
                <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text);text-align:right;white-space:nowrap;">${rateCell}</span>
                <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--t3);text-align:right;white-space:nowrap;">${fmtSpend(annualSpend)}</span>
                <span style="font-size:10px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${shortName}</span>
                <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--green);text-align:right;">+$${annual}</span>
              </div>
              ${ovHtml}
            </div>
          `;
          rowIdx++;
        }

        catHtml += `</div>`;
        stackHtml += catHtml;
      }
      stackHtml += `</div>`;

      // Caps summary below earn rates
      const capLines = [];
      for (const sc of stackCards) {
        const sn = sc.name.replace('Visa Infinite','VI').replace('Mastercard','MC').replace('World Elite','WE').replace('American Express','Amex').split(' ').slice(0,3).join(' ');
        if (sc.capGroups?.length) {
          for (const g of sc.capGroups) {
            const catStr = g.cats.map(c => ({groceries:'Groceries',dining:'Dining',gas:'Gas',recurring:'Recurring',rent:'Rent',travel:'Travel',other:'Other',transit:'Transit'}[c]||c)).join(' + ');
            const val = g.yearly ? `$${Math.round(g.monthly*12/1000)}K/yr` : `$${g.monthly>=1000?(g.monthly/1000).toFixed(1)+'K':Math.round(g.monthly)}/mo`;
            capLines.push(`<strong>${sn}</strong>: ${catStr} — ${val} combined cap`);
          }
        }
        if (sc.caps && Object.keys(sc.caps).length) {
          for (const [cat, val] of Object.entries(sc.caps)) {
            const catLabel = {groceries:'Groceries',dining:'Dining',gas:'Gas',recurring:'Recurring',rent:'Rent',travel:'Travel',other:'Other',transit:'Transit'}[cat]||cat;
            const isYr = sc.capYearly?.[cat];
            const fmtd = isYr ? `$${Math.round(val*12)>=1000?(Math.round(val*12)/1000).toFixed(0)+'K':Math.round(val*12)}/yr` : `$${val>=1000?(val/1000).toFixed(1)+'K':Math.round(val)}/mo`;
            capLines.push(`<strong>${sn}</strong>: ${catLabel} — ${fmtd} cap`);
          }
        }
      }
      if (capLines.length) {
        stackHtml += `<div style="margin-top:10px;padding:10px 14px;background:var(--s2);border:1px solid var(--border);border-radius:8px;display:flex;flex-direction:column;gap:4px;">
          <div style="font-size:9px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--t3);margin-bottom:4px;">Caps</div>
          ${capLines.map(l => `<div style="font-size:11px;color:var(--t2);line-height:1.5;">${l}</div>`).join('')}
        </div>`;
      }
    }

    const ptsPrograms = Object.entries(_stackPtsByProgram);
    const hasPts = ptsPrograms.length > 0;
    // Perks value (credits, lounge, airline) is in $ for all cards — same in both views
    const _stackPerks = stackCards.reduce((s, c) => s + (c.perksValue || 0) + airlinePerksValue(c) + loungePerksValue(c), 0);
    const stmtGross = hasPts
      ? Math.round(ptsPrograms.reduce((s,[,p]) => s + p.pts * p.stmtCpp / 100, 0) + _stackCash + _stackPerks)
      : stackGross;
    const stmtNet = stmtGross - stackFees;

    if (hasPts && profile.goal !== 'cashback') {
      // Points view
      const ptsRows = ptsPrograms.map(([prog, p]) =>
        `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;">
          <span style="font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--t2);">${prog}</span>
          <span style="font-family:'DM Serif Display',serif;font-size:22px;color:var(--accent);line-height:1;">${p.pts.toLocaleString()} <span style="font-size:11px;font-weight:400;font-family:inherit;">pts</span></span>
        </div>`).join('');
      const cashRow = _stackCash > 0
        ? `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px;">
            <span style="font-size:10px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:var(--t2);">Cash</span>
            <span style="font-family:'DM Serif Display',serif;font-size:22px;color:var(--accent);line-height:1;">$${_stackCash.toLocaleString()}</span>
          </div>` : '';

      stackHtml += `
        <div class="stack-total" style="flex-direction:column;gap:14px;">
          <div id="stk-pts-view" style="width:100%;">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--t3);margin-bottom:12px;">Annual Rewards</div>
            ${ptsRows}${cashRow}
            <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:10px;color:var(--t2);">Net value <span style="color:var(--t3);font-size:9px;">(travel redemption · −$${stackFees} fees)</span></div>
                <div style="font-family:'DM Serif Display',serif;font-size:30px;color:var(--accent);line-height:1.1;">$${stackNet.toLocaleString()}</div>
              </div>
              <button onclick="window._ptsViewCash=true;document.getElementById('stk-pts-view').style.display='none';document.getElementById('stk-cash-view').style.display='block';"
                style="font-size:11px;color:var(--t2);background:none;border:1px solid var(--border);border-radius:5px;padding:5px 10px;cursor:pointer;font-family:inherit;white-space:nowrap;">
                As cashback →
              </button>
            </div>
          </div>
          <div id="stk-cash-view" style="width:100%;display:none;">
            <div style="font-size:9px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--t3);margin-bottom:8px;">Cashback Value (stmt credit rate)</div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
              <div>
                <div style="font-family:'DM Serif Display',serif;font-size:38px;color:var(--accent);line-height:1;">$${stmtNet.toLocaleString()}</div>
                <div style="font-size:10px;color:var(--t2);margin-top:4px;">Gross $${stmtGross.toLocaleString()} − $${stackFees} fees</div>
              </div>
              <button onclick="window._ptsViewCash=false;document.getElementById('stk-cash-view').style.display='none';document.getElementById('stk-pts-view').style.display='block';"
                style="font-size:11px;color:var(--t2);background:none;border:1px solid var(--border);border-radius:5px;padding:5px 10px;cursor:pointer;font-family:inherit;white-space:nowrap;">
                ← As points
              </button>
            </div>
          </div>
        </div>
      `;
    } else {
      stackHtml += `
        <div class="stack-total">
          <div>
            <div class="label">Net Annual Value</div>
            <div class="sub">Gross $${stackGross.toLocaleString()} − $${stackFees} fees</div>
          </div>
          <div class="value">$${stackNet.toLocaleString()}</div>
        </div>
      `;
    }

    // Stack synergies
    const synergies = getStackSynergies(stackCards);
    if (synergies.length > 0) {
      stackHtml += `<div style="margin-top:20px;display:flex;flex-direction:column;gap:10px;">`;
      stackHtml += `<div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted);margin-bottom:2px;">Stack Synergies</div>`;
      for (const s of synergies) {
        const isWarning = s.type === 'warning';
        const bg    = isWarning ? 'rgba(251,191,36,0.07)'  : 'rgba(124,106,245,0.07)';
        const bdr   = isWarning ? 'rgba(251,191,36,0.25)'  : 'rgba(124,106,245,0.2)';
        const color = isWarning ? 'var(--yellow)' : 'var(--accent2)';
        stackHtml += `
          <div style="display:flex;gap:0;border-radius:7px;overflow:hidden;border:1px solid ${bdr};">
            <div style="width:3px;background:${color};flex-shrink:0;"></div>
            <div style="padding:11px 13px;background:${bg};">
              <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:3px;">${s.title}</div>
              <div style="font-size:11px;color:var(--t2);line-height:1.6;">${s.note}</div>
            </div>
          </div>
        `;
      }
      stackHtml += `</div>`;
    }

    // "Maximize Your Stack" tips
    const shortN = c => c.name.replace('Visa Infinite','VI').replace('Mastercard','MC').replace('World Elite','WE').replace('American Express','Amex').split(' ').slice(0,3).join(' ');
    const stackTips = [];
    const seen = new Set();
    const addTip = (topic, accent, tip) => { if (!seen.has(topic)) { seen.add(topic); stackTips.push({ accent, tip }); } };

    const travelOrder = ['amex-plat','scotia-passport','td-aeroplan','cibc-aeroplan','amex-aeroplan','amex-gold','cobalt','cibc-div','td-cashback','scotia-momentum','bmo-cashback','rogers-we','simplii','simplycash','westjet-rbc','brim-we','ws-infinite','cibc-aventura','rbc-avion','desjardins','mbna-we'];
    const travelCard = stackCards.find(c => travelOrder.includes(c.id));
    if (travelCard) {
      const tb = (CARD_BENEFITS[travelCard.id]||[]).find(b => /travel medical/i.test(b));
      if (tb) addTip('travel', 'var(--green)', `Charge all trip costs to <strong>${shortN(travelCard)}</strong> to activate ${tb.replace(/^[^\w$]*/, '')} and trip cancellation coverage`);
    }
    for (const sc of stackCards) {
      const b = CARD_BENEFITS[sc.id] || [];
      const sn = shortN(sc);
      if (b.some(x => /lounge/i.test(x))) addTip('lounge', 'var(--accent)', `Use <strong>${sn}</strong> for lounge access — ${b.find(x => /lounge/i.test(x)).replace(/^[^\w$]*/, '')}`);
      if (b.some(x => /no foreign/i.test(x))) addTip('fx', 'var(--green)', `Use <strong>${sn}</strong> for all international purchases — no foreign transaction fees`);
      if (b.some(x => /checked bag/i.test(x))) addTip('bag', '#ff9f0a', `Book flights with <strong>${sn}</strong> — ${b.find(x => /checked bag/i.test(x)).replace(/^[^\w$]*/, '')}`);
      if (b.some(x => /nexus/i.test(x))) addTip('nexus', 'var(--accent)', `Pay your NEXUS fee with <strong>${sn}</strong> — ${b.find(x => /nexus/i.test(x)).replace(/^[^\w$]*/, '')}`);
      if (b.some(x => /travel credit/i.test(x))) addTip('travelcredit', 'var(--green)', `Use the annual travel credit on <strong>${sn}</strong> — ${b.find(x => /travel credit/i.test(x)).replace(/^[^\w$]*/, '')}`);
      if (b.some(x => /companion voucher/i.test(x))) addTip('companion', '#ff9f0a', `Book a WestJet trip for two — <strong>${sn}</strong> includes an annual companion voucher (~$200+ value)`);
      if (b.some(x => /mobile device/i.test(x))) addTip('mobile', 'var(--t2)', `Buy phones and devices with <strong>${sn}</strong> to activate mobile device insurance`);
      if (b.some(x => /transfer.*aeroplan|aeroplan.*transfer|transfer.*avios|avios.*transfer/i.test(x))) addTip('transfer', '#a89cf8', `Transfer <strong>${sn}</strong> points to Aeroplan or Avios for higher travel redemption value`);
      if (b.some(x => /birthday bonus/i.test(x))) addTip('birthday', 'var(--yellow)', `Use <strong>${sn}</strong> heavily in your birthday month — earns 10% bonus points`);
      if (b.some(x => /roadside/i.test(x))) addTip('roadside', 'var(--t2)', `<strong>${sn}</strong> includes 24/7 roadside assistance`);
    }

    if (stackTips.length > 0) {
      stackHtml += `
        <div style="margin-top:28px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:var(--t3);margin-bottom:10px;">How to Maximize Your Stack</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${stackTips.map(t => `
              <div style="display:flex;gap:0;border-radius:7px;overflow:hidden;border:1px solid var(--border);">
                <div style="width:3px;background:${t.accent};flex-shrink:0;"></div>
                <div style="padding:10px 13px;font-size:12px;color:var(--t2);line-height:1.55;">${t.tip}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  document.getElementById('recommended-stack').innerHTML = stackHtml + '</div>';


  // All cards grid — preserve current filter when recalculating in place
  window._allScored = scored;
  renderCardGrid(scored, skipSpouseInit ? (window._currentFilter || 'all') : 'all');
}

function renderCardGrid(cards, filter) {
  const grid = document.getElementById('card-grid');
  const cats = ['groceries','dining','gas','recurring','rent','other','travel','fxTravel'];
  const catLabels = { groceries:'Groceries', dining:'Dining', gas:'Gas', recurring:'Recurring', rent:'Rent', other:'Other', travel:'Flights & Hotels', fxTravel:'FX Spend' };
  const spend = window._lastSpend || {};

  let shown = cards;
  // "cashback" includes cashback + all points cards (any points card can be redeemed as stmt credit)
  if (filter === 'cashback') shown = cards.filter(c => c.type === 'cashback' || c.type === 'points');
  if (filter === 'points') shown = cards.filter(c => c.type === 'points');
  if (filter === 'travel') shown = cards.filter(c => c.type === 'travel');
  if (filter === 'eligible') shown = cards.filter(c => c.eligible);
  if (filter === 'nofx') shown = cards.filter(c => c.noFx);
  // Additional filters
  const netFilter = window._networkFilter || 'all';
  const feeFilter = window._feeFilter || 'all';
  const progFilter = window._programFilter || 'all';
  if (netFilter !== 'all') shown = shown.filter(c => c.network === netFilter);
  if (feeFilter === '0')    shown = shown.filter(c => c.fee === 0);
  if (feeFilter === 'low')  shown = shown.filter(c => c.fee > 0 && c.fee < 120);
  if (feeFilter === 'mid')  shown = shown.filter(c => c.fee >= 120 && c.fee <= 200);
  if (feeFilter === 'high') shown = shown.filter(c => c.fee > 200);
  if (progFilter !== 'all') shown = shown.filter(c => c.loyalty?.program === progFilter);

  // Search filter
  const searchQ = (window._cardSearch || '').toLowerCase().trim();
  if (searchQ) {
    shown = shown.filter(c =>
      c.name.toLowerCase().includes(searchQ) ||
      c.notes?.toLowerCase().includes(searchQ) ||
      c.loyalty?.label?.toLowerCase().includes(searchQ) ||
      c.network.toLowerCase().includes(searchQ)
    );
  }

  const sortSet = window._sortSet;
  if (sortSet && sortSet.size > 0) {
    shown = [...shown].sort((a, b) => {
      const sumA = [...sortSet].reduce((s, cat) => s + sortRate(a, cat), 0);
      const sumB = [...sortSet].reduce((s, cat) => s + sortRate(b, cat), 0);
      return sumB - sumA;
    });
  }

  const topPick = shown[0]?.id;

  const INITIAL_CARD_LIMIT = 10;
  const showAll = window._showAllCards || false;
  const displayedCards = showAll ? shown : shown.slice(0, INITIAL_CARD_LIMIT);
  const hasMore = shown.length > INITIAL_CARD_LIMIT && !showAll;

  grid.innerHTML = displayedCards.map((card, idx) => {
    const badgeClass = card.type === 'cashback' ? 'badge-cashback' : card.type === 'points' ? 'badge-points' : 'badge-travel';
    const badgeLabel = card.type === 'cashback' ? 'Cash Back' : card.type === 'points' ? 'Points' : 'Travel Points';

    const rateBars = cats.map(cat => {
      const rate = effectiveRate(card, cat);
      const monthly = spend[cat] || 0;
      // Only show bars for categories where the user actually has spending
      if (!monthly) return '';
      const barW = Math.min(100, rate * 1500);
      const rc = rateClass(rate);
      const perCatCap = cat === 'fxTravel' ? undefined : card.caps?.[cat];
      const capGroupTile = card.capGroups?.find(g => g.cats.includes(cat));
      const cap = perCatCap ?? (capGroupTile ? capGroupTile.monthly : undefined);
      const isGroupCapTile = !perCatCap && !!capGroupTile;
      const isYrCap = card.capYearly?.[cat] || (isGroupCapTile && capGroupTile.yearly);
      const totalGroupSpendTile = isGroupCapTile ? capGroupTile.cats.reduce((s, c) => s + (spend[c] || 0), 0) : 0;
      const capExceeded = perCatCap ? monthly > perCatCap : (isGroupCapTile && totalGroupSpendTile > capGroupTile.monthly);
      const combinedTagSuffix = isGroupCapTile ? ' comb.' : '';
      const fmtCapVal = isYrCap ? `$${Math.round(cap*12/1000)}K/yr${combinedTagSuffix}` : (cap >= 1000 ? `$${(cap/1000).toFixed(1)}K/mo${combinedTagSuffix}` : `$${Math.round(cap)}/mo${combinedTagSuffix}`);
      return `
        <div class="rate-row">
          <span class="rate-category">${catLabels[cat]}</span>
          <div class="rate-bar-wrap"><div class="rate-bar ${rc}" style="width:${barW}%"></div></div>
          <span class="rate-pct">${fmtRate(card, cat)}</span>
        </div>
      `;
    }).filter(Boolean).join('');

    // CPP note for points/travel cards — compact single line + collapsible details
    let cppNote = '';
    if (card.cpp && (card.type === 'points' || card.type === 'travel')) {
      const effectiveCpp = getEffectiveCpp(card);
      const isCustom = !!getCustomCppValue();
      const ceiling = loyaltyCppCeiling(card);
      const isAtStmt = Math.abs(effectiveCpp - card.cpp.stmt) < 0.001;

      // Short summary line
      let summaryParts = [];
      if (card.loyalty) {
        const l = card.loyalty;
        const xfers = l.transfersTo?.length
          ? l.transfersTo.map(p => ({'aeroplan':'Aeroplan','avios':'Avios','asia-miles':'Asia Miles','ba':'BA Exec Club','flying-blue':'Flying Blue','krisflyer':'KrisFlyer'}[p]||p)).join(', ')
          : null;
        if (l.isolated) summaryParts.push(`${l.label} — statement/portal only`);
        else if (xfers) summaryParts.push(`${l.label} → ${xfers}`);
        else summaryParts.push(l.label);
      }
      if (!isAtStmt) {
        let travelLabel = isCustom ? 'custom target' : 'avg travel';
        if (!isCustom && card.cppBreakdown?.length) {
          const bMatch = card.cppBreakdown.find(r => Math.abs(r.cpp - effectiveCpp) < 0.01);
          if (bMatch) travelLabel = bMatch.label;
        }
        summaryParts.push(`${card.cpp.stmt}¢ stmt → <strong style="color:var(--accent2);">${effectiveCpp.toFixed(2)}¢</strong> (${travelLabel})${ceiling < Infinity ? ' ⚠capped' : ''}`);
      }

      // Collapsible breakdown table
      let breakdownHtml = '';
      if (card.cppBreakdown?.length) {
        const rows = card.cppBreakdown.map(r => {
          const isMatch = Math.abs(r.cpp - effectiveCpp) < 0.01;
          return `<tr style="${isMatch ? 'background:rgba(124,106,245,0.12);' : ''}">
            <td style="padding:2px 8px 2px 4px;font-size:10px;${isMatch ? 'color:var(--text);font-weight:600;' : 'color:var(--muted);'}">${isMatch ? '▶ ' : ''}${r.label}</td>
            <td style="font-family:'DM Mono',monospace;font-size:10px;text-align:right;${isMatch ? 'color:var(--accent2);font-weight:700;' : 'color:var(--muted);'}">${r.cpp}¢</td>
          </tr>`;
        }).join('');
        breakdownHtml = `<details style="margin-top:4px;">
          <summary style="font-size:9px;color:var(--muted);cursor:pointer;list-style:none;">▸ Redemption value estimates</summary>
          <table style="width:100%;border-collapse:collapse;margin-top:4px;">${rows}</table>
        </details>`;
      }

      cppNote = `<div class="card-note" style="border-left-color:var(--accent2);background:rgba(124,106,245,0.05);margin-top:8px;font-size:10px;color:var(--muted);line-height:1.5;">
        ${summaryParts.join('<br>')}${breakdownHtml}
      </div>`;
    }

    // Perks lifestyle match badges
    const perksBadges = getPerksMatch(card);
    const perksMatchHtml = perksBadges.map(b => `<span class="card-type-badge badge-perks">★ ${b}</span>`).join(' ');

    // Perks note — brief, full detail is in Benefits & Perks section
    const perksNote = card.perksValue
      ? `<div class="card-note" style="border-left-color:var(--accent3);color:var(--accent3);background:rgba(240,149,74,0.05);margin-top:8px;font-size:10px;">~$${card.perksValue}/yr in annual credits included in net value ↓</div>`
      : '';

    const feeLabel = card.effectiveFee === 0
      ? (card.fee > 0 ? '<span style="color:var(--green);">Fee waived</span>' : 'No fee')
      : `$${card.fee}/yr`;
    const networkLabel = card.network === 'mc' ? 'Mastercard' : card.network === 'visa' ? 'Visa' : 'Amex';
    const fxBadge = card.noFx ? ` · <span style="color:var(--green);font-weight:700;">NO FX</span>` : '';

    const noteClass = !card.eligible ? 'ineligible' : card.warning ? 'warning' : '';
    const amexAcceptNote = (card.network === 'amex' && profile.networks.has('amex') && (profile.amexAcceptance ?? 0.8) < 1.0)
      ? ` ⚠ Net value reflects ${Math.round((profile.amexAcceptance ?? 0.8) * 100)}% Amex acceptance at your stores.` : '';
    // Ineligible: short reason. Eligible: just the warning (notes moved to benefits)
    const noteText = !card.eligible
      ? `Not eligible — ${[
          card.minIncome > 0 ? `$${card.minIncome.toLocaleString()} income required` : null,
          card.rogersReq ? 'Rogers/Fido/Shaw required' : null,
          card.wsReq && profile.willingToDD !== 'yes' && !profile.assetBanks.has('ws') ? 'Wealthsimple Premium required' : null,
          !profile.networks.has(card.network) ? `${networkLabel} not in selected networks` : null,
        ].filter(Boolean).join(' · ')}`
      : ([card.warning, amexAcceptNote].filter(Boolean).join(' '));

    const isTop = card.id === topPick && idx === 0;
    const isExcluded = window._excludedSet?.has(card.id);

    return `
      <div class="card-tile${isTop ? ' top-pick' : ''}${isExcluded ? '" style="opacity:0.45;' : ''}">
        ${isExcluded ? `<div style="padding:6px 12px;background:rgba(107,107,138,0.15);border-bottom:1px solid var(--border);font-size:10px;color:var(--t3);display:flex;align-items:center;justify-content:space-between;">
          <span>Excluded from stack</span>
          <button onclick="toggleExcludeCard('${card.id}')" style="font-size:10px;color:var(--accent);background:none;border:none;cursor:pointer;padding:0;font-family:inherit;">Restore</button>
        </div>` : ''}
        <div class="card-header">
          <div class="card-network">${networkLabel} · ${feeLabel}${fxBadge}</div>
          <div class="card-name">${card.name}</div>
          <span class="card-type-badge ${badgeClass}">${badgeLabel}</span>
          ${perksMatchHtml}
        </div>
        <div class="card-body">
          <div class="net-value">
            <span class="amount">${card.net >= 0 ? '$'+card.net.toLocaleString() : '-$'+Math.abs(card.net)}</span>
            <span class="label">net / year</span>
          </div>
          <div class="rate-bars">${rateBars}</div>
          ${cppNote}
          ${perksNote}
          <div class="card-meta">
            <div class="meta-item">
              <strong>$${card.gross.toLocaleString()}</strong>
              Gross/yr
            </div>
            <div class="meta-item">
              <strong>${card.effectiveFee === 0 && card.fee > 0 ? '<span style="color:var(--green)">Waived</span>' : '$'+card.effectiveFee}</strong>
              Ann. Fee
            </div>
            ${(() => {
              const capEntries = Object.entries(card.caps || {});
              const hasGroups = card.capGroups?.length > 0;
              if (capEntries.length === 0 && !hasGroups) return `<div class="meta-item"><strong style="color:var(--green);">None</strong>Spend Cap</div>`;
              const fmtCapMeta = (cat, v) => {
                if (card.capYearly?.[cat]) { const a=Math.round(v*12); return `${catLabels[cat]} $${a>=1000?(a/1000).toFixed(0)+'K':a}/yr`; }
                return `${catLabels[cat]} $${v>=1000?(v/1000).toFixed(1)+'K':Math.round(v)}/mo`;
              };
              const perCatParts = capEntries.map(([c,v])=>fmtCapMeta(c,v));
              const groupParts = (card.capGroups||[]).map(g => {
                const lbl = g.cats.map(c => catLabels[c]).join('+');
                const isYr = g.yearly;
                const fmtd = isYr ? `$${Math.round(g.monthly*12/1000)}K/yr` : (g.monthly>=1000?`$${(g.monthly/1000).toFixed(1)}K/mo`:`$${Math.round(g.monthly)}/mo`);
                return `${lbl} ${fmtd} combined`;
              });
              return `<div class="meta-item"><strong>${[...perCatParts,...groupParts].join(', ')}</strong>Cap</div>`;
            })()}
          </div>
          ${noteText ? `<div class="card-note ${noteClass}">${noteText}</div>` : ''}
          ${(() => {
            const bens = CARD_BENEFITS[card.id];
            if (!bens?.length) return '';
            return `<details style="margin-top:8px;">
              <summary style="font-size:10px;color:var(--muted);cursor:pointer;list-style:none;display:flex;align-items:center;gap:4px;font-weight:600;letter-spacing:0.05em;">
                ▸ Benefits & Perks (${bens.length})
              </summary>
              <ul style="margin:6px 0 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px;">
                ${bens.map(b => `<li style="font-size:10px;color:var(--muted);line-height:1.4;">${b}</li>`).join('')}
              </ul>
            </details>`;
          })()}
        </div>
      </div>
    `;
  }).join('');

  // "Show more" button
  document.getElementById('show-more-wrap')?.remove();
  if (hasMore) {
    grid.insertAdjacentHTML('afterend', `<div id="show-more-wrap" style="text-align:center;margin:16px 0 32px;">
      <button onclick="window._showAllCards=true;renderCardGrid(window._allScored,window._currentFilter||'all')"
        style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 28px;font-family:'Syne',sans-serif;font-size:13px;font-weight:600;color:var(--muted);cursor:pointer;transition:all 0.2s;"
        onmouseover="this.style.borderColor='var(--accent2)';this.style.color='var(--text)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
        Show ${shown.length - INITIAL_CARD_LIMIT} more cards ↓
      </button>
    </div>`);
  }
}

function filterCards(type, btn) {
  document.querySelectorAll('#type-tabs .filter-chip, #type-tabs .filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  window._currentFilter = type;
  if (window._allScored) renderCardGrid(window._allScored, type);
}

window._sortSet = new Set();
function toggleSort(btn) {
  const cat = btn.dataset.sort;
  if (cat === 'net') {
    window._sortSet.clear();
    document.querySelectorAll('#sort-tabs .filter-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
  } else {
    document.querySelector('#sort-tabs [data-sort="net"]').classList.remove('active');
    btn.classList.toggle('active');
    if (window._sortSet.has(cat)) window._sortSet.delete(cat);
    else window._sortSet.add(cat);
    if (window._sortSet.size === 0) document.querySelector('#sort-tabs [data-sort="net"]').classList.add('active');
  }
  if (window._allScored) renderCardGrid(window._allScored, window._currentFilter || 'all');
}

// Init network multistate
multiState['network'] = new Set(['visa','mc']);

// Additional grid filter state
window._networkFilter = 'all';
window._feeFilter = 'all';
window._programFilter = 'all';

function filterNetwork(net, el) {
  window._networkFilter = net;
  const sel = document.getElementById('network-select');
  if (sel) { sel.value = net; sel.className = 'filter-select' + (net !== 'all' ? ' active' : ''); }
  if (window._allScored) renderCardGrid(window._allScored, window._currentFilter || 'all');
}
function filterFee(fee, el) {
  window._feeFilter = fee;
  const sel = document.getElementById('fee-select');
  if (sel) { sel.value = fee; sel.className = 'filter-select' + (fee !== 'all' ? ' active' : ''); }
  if (window._allScored) renderCardGrid(window._allScored, window._currentFilter || 'all');
}
function filterProgram(prog, el) {
  window._programFilter = prog;
  const sel = document.getElementById('program-select');
  if (sel) { sel.value = prog; sel.className = 'filter-select' + (prog !== 'all' ? ' active' : ''); }
  if (window._allScored) renderCardGrid(window._allScored, window._currentFilter || 'all');
}

function setSortFromSelect(val) {
  window._sortSet = new Set();
  if (val !== 'net') window._sortSet.add(val);
  if (window._allScored) renderCardGrid(window._allScored, window._currentFilter || 'all');
}

function toggleCardGrid() {
  const el = document.getElementById('card-grid-collapsible');
  const icon = document.getElementById('card-grid-toggle-icon');
  if (!el || !icon) return;
  const isOpen = el.style.display !== 'none';
  el.style.display = isOpen ? 'none' : 'block';
  icon.textContent = isOpen ? '▶' : '▼';
}

function toggleAmexQuestion(btn) {
  const grp = document.getElementById('amex-acceptance-group');
  if (!grp) return;
  // Show if amex is now selected, hide if deselected
  const amexSelected = btn.classList.contains('selected');
  grp.style.display = amexSelected ? 'block' : 'none';
}

function togglePSection(header) {
  const body = header.nextElementSibling;
  if (!body || !body.classList.contains('p-section-body')) return;
  const closing = !body.classList.contains('closed');
  body.classList.toggle('closed', closing);
  const chevron = header.querySelector('.p-section-chevron');
  if (chevron) chevron.style.transform = closing ? 'rotate(-90deg)' : '';
}

function toggleMerchant(toggle) {
  const body = toggle.parentElement.querySelector('.merchant-body');
  const chevron = toggle.querySelector('.merchant-toggle-chevron');
  if (!body) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
}

// On mobile, collapse optional sections by default
if (window.innerWidth <= 768) {
  document.querySelectorAll('.p-section[data-collapse-mobile] .p-section-body').forEach(body => {
    body.classList.add('closed');
    const chevron = body.previousElementSibling?.querySelector('.p-section-chevron');
    if (chevron) chevron.style.transform = 'rotate(-90deg)';
  });
}

function toggleAllianceList() {
  const list = document.getElementById('alliance-list');
  const btn  = document.getElementById('alliance-toggle-btn');
  if (!list || !btn) return;
  const isOpen = list.style.display !== 'none';
  list.style.display = isOpen ? 'none' : 'block';
  btn.innerHTML = isOpen ? '▼ Full alliance membership lists' : '▲ Hide alliance lists';
}
