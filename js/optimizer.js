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
