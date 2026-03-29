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
    const _capMult = window._spouseSet?.has(card.id) ? 2 : 1;
    const _effCapsSpouse = computeEffectiveCaps(card, spend);
    const overflowCats = cats.filter(cat => _effCapsSpouse[cat] !== undefined && (spend[cat] || 0) > _effCapsSpouse[cat] * _capMult);
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

        let catHtml = `<div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:var(--s1);border:1px solid var(--border);border-radius:8px;overflow-x:auto;">`;


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
            <div style="min-width:max-content;">
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

  const customBar = document.getElementById('custom-builder-bar');
  if (customBar) customBar.style.display = 'block';

  // All cards grid — preserve current filter when recalculating in place
  window._allScored = scored;
  renderCardGrid(scored, skipSpouseInit ? (window._currentFilter || 'all') : 'all');

  if (window._customMode) renderCustomStack();
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
          ${window._customMode ? (() => {
            const inCustom = window._customStackIds?.has(card.id);
            return `<button onclick="toggleCustomCard('${card.id}')" style="margin-top:8px;display:inline-block;font-size:10px;color:${inCustom ? 'var(--accent2)' : 'var(--t2)'};background:${inCustom ? 'rgba(124,106,245,0.12)' : 'none'};border:1px solid ${inCustom ? 'rgba(124,106,245,0.4)' : 'var(--border)'};border-radius:4px;padding:4px 12px;cursor:pointer;font-family:inherit;transition:all 0.15s;">${inCustom ? '✓ In Custom Stack' : '+ Add to Custom Stack'}</button>`;
          })() : ''}
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

// ── Custom Stack Builder ──
window._customMode = false;
window._customStackIds = new Set();

function toggleCustomBuilder() {
  window._customMode = !window._customMode;
  const wrap = document.getElementById('custom-stack-wrap');
  const btn  = document.getElementById('custom-builder-btn');
  if (window._customMode) {
    wrap.style.display = 'block';
    btn.textContent = '✕ Close Custom Builder';
    btn.style.color = 'var(--accent2)';
    btn.style.borderColor = 'rgba(124,106,245,0.4)';
    btn.style.background = 'rgba(124,106,245,0.07)';
    renderCustomStack();
  } else {
    wrap.style.display = 'none';
    btn.textContent = '＋ Build Custom Stack';
    btn.style.color = 'var(--t2)';
    btn.style.borderColor = 'var(--border)';
    btn.style.background = 'none';
  }
  if (window._allScored) renderCardGrid(window._allScored, window._currentFilter || 'all');
}

function toggleCustomCard(cardId) {
  if (!window._customStackIds) window._customStackIds = new Set();
  if (window._customStackIds.has(cardId)) {
    window._customStackIds.delete(cardId);
  } else {
    window._customStackIds.add(cardId);
  }
  renderCustomStack();
  if (window._allScored) renderCardGrid(window._allScored, window._currentFilter || 'all');
}

function clearCustomStack() {
  window._customStackIds = new Set();
  renderCustomStack();
  if (window._allScored) renderCardGrid(window._allScored, window._currentFilter || 'all');
}

function renderCustomStack() {
  const section = document.getElementById('custom-stack-section');
  if (!section) return;

  const ids    = window._customStackIds || new Set();
  const spend  = window._lastSpend || {};
  const stackCards = [...ids].map(id => window._allScored?.find(c => c.id === id)).filter(Boolean);

  const cats      = ['groceries','dining','gas','recurring','rent','other','travel','fxTravel'];
  const catLabels = { groceries:'Groceries', dining:'Dining', gas:'Gas', recurring:'Recurring', rent:'Rent', other:'Other', travel:'Flights & Hotels', fxTravel:'FX Spend' };
  const roleColors = ['var(--accent)','var(--accent2)','var(--accent3)','var(--green)','var(--yellow)','var(--muted)'];
  const roleLabels = ['Primary','Companion','Third Card','Fourth Card','Fifth Card','Sixth Card'];

  let html = `<div class="stack-section" style="border:1px solid rgba(124,106,245,0.25);background:rgba(124,106,245,0.025);">
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px;flex-wrap:wrap;">
      <div style="display:flex;align-items:center;gap:10px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        <h2 style="color:var(--text);">Custom Stack</h2>
      </div>
      ${stackCards.length > 0 ? `<button onclick="clearCustomStack()" style="font-size:10px;color:var(--t3);background:none;border:1px solid var(--border);border-radius:5px;padding:4px 10px;cursor:pointer;font-family:inherit;">Clear all</button>` : ''}
    </div>
    <div class="subtitle">Build your own stack — click <strong>+ Add to Custom Stack</strong> on any card below</div>`;

  if (stackCards.length === 0) {
    html += `<div style="padding:24px 0;text-align:center;color:var(--t2);font-size:13px;border-top:1px solid var(--border);margin-top:16px;">
      No cards added yet. Scroll down and click <strong style="color:var(--accent2);">+ Add to Custom Stack</strong> on any card.
    </div>`;
  } else {
    const { gross, fees, net } = calcStackValue(stackCards, spend);
    const totalAnnualSpend = cats.reduce((s, cat) => {
      if (cat === 'travel' || cat === 'fxTravel') return s + (spend[cat] || 0) * 12;
      return s + (spend[cat] || 0) * 12;
    }, 0);
    const effPct = totalAnnualSpend > 0 ? (gross / totalAnnualSpend * 100).toFixed(1) : '—';

    // Value summary
    html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px;margin-bottom:16px;">
      <div style="background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">
        <div style="font-family:'DM Serif Display',serif;font-size:26px;color:${net >= 0 ? 'var(--accent2)' : '#c06060'};line-height:1;">${net >= 0 ? '$'+net.toLocaleString() : '−$'+Math.abs(net).toLocaleString()}</div>
        <div style="font-size:10px;color:var(--t2);margin-top:3px;">net / year</div>
      </div>
      <div style="background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">
        <div style="font-family:'DM Serif Display',serif;font-size:26px;color:var(--text);line-height:1;">$${gross.toLocaleString()}</div>
        <div style="font-size:10px;color:var(--t2);margin-top:3px;">gross / year</div>
      </div>
      <div style="background:var(--s1);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">
        <div style="font-family:'DM Mono',monospace;font-size:22px;color:var(--text);line-height:1;">${effPct}%</div>
        <div style="font-size:10px;color:var(--t2);margin-top:3px;">effective return</div>
      </div>
    </div>`;

    // Compare vs recommended
    if (window._currentStack?.length > 0) {
      const recValue = calcStackValue(window._currentStack, spend);
      const diff = net - recValue.net;
      const sign  = diff >= 0 ? '+' : '−';
      const diffColor = diff >= 0 ? 'var(--green)' : '#c06060';
      html += `<div style="margin-bottom:16px;padding:9px 14px;background:var(--s2);border:1px solid var(--border);border-radius:8px;font-size:12px;color:var(--t2);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span>vs. recommended stack ($${recValue.net.toLocaleString()}/yr)</span>
        <span style="font-family:'DM Mono',monospace;font-size:13px;font-weight:700;color:${diffColor};">${sign}$${Math.abs(diff).toLocaleString()}</span>
      </div>`;
    }

    // Cards list
    html += `<div class="stack-cards" style="margin-bottom:16px;">`;
    stackCards.forEach((card, i) => {
      const feeDisplay = card.effectiveFee === 0
        ? (card.fee > 0 ? 'fee waived' : 'no annual fee')
        : `$${card.effectiveFee}/yr`;
      const winCats = cats.filter(cat => {
        if ((spend[cat] || 0) === 0) return false;
        const r = effectiveRate(card, cat);
        return r > 0 && stackCards.every(c => effectiveRate(c, cat) <= r);
      });
      const useFor = winCats.length
        ? winCats.map(c => `${catLabels[c]} ${fmtRateFull(card, c)}`).join(' · ')
        : 'Catch-all / backup';
      html += `<div class="stack-card" style="position:relative;padding-right:80px;">
        <div class="use-for" style="color:${roleColors[i % roleColors.length]}">${roleLabels[i] || 'Card '+(i+1)}</div>
        <div class="card-n">${card.name}</div>
        <div class="rate-info">${feeDisplay}</div>
        <div style="margin-top:4px;font-size:11px;color:var(--t2);line-height:1.4;">${useFor}</div>
        <button onclick="toggleCustomCard('${card.id}')" style="position:absolute;top:12px;right:12px;font-size:10px;color:var(--t3);background:none;border:1px solid var(--border);border-radius:4px;padding:3px 9px;cursor:pointer;font-family:inherit;white-space:nowrap;">Remove</button>
      </div>`;
    });
    html += `</div>`;

    // Earn rates by category
    html += `<div style="margin-bottom:8px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:var(--t3);">Earn rates by category</div>`;
    for (const cat of cats) {
      const monthly = spend[cat] || 0;
      if (!monthly) continue;
      let bestCard = null, bestEarning = 0, bestRate = 0;
      for (const card of stackCards) {
        const rate = effectiveRate(card, cat);
        const ec   = computeEffectiveCaps(card, spend)[cat];
        const eff  = ec ? Math.min(monthly, ec) : monthly;
        if (eff * rate > bestEarning) { bestEarning = eff * rate; bestCard = card; bestRate = rate; }
      }
      if (!bestCard) continue;
      const ec     = computeEffectiveCaps(bestCard, spend)[cat];
      const effAmt = ec ? Math.min(monthly, ec) : monthly;
      const annual = Math.round(effAmt * 12 * bestRate);
      const fmtSp  = v => v >= 1000 ? `$${Math.round(v/1000)}K` : `$${Math.round(v)}`;
      const barW   = Math.min(100, bestRate * 1500);
      const rc     = rateClass(bestRate);
      const short  = bestCard.name.replace('Visa Infinite','VI').replace('Mastercard','MC').replace('World Elite','WE').split(' ').slice(0,2).join(' ');
      const rateCell = bestCard.pts && bestCard.cpp
        ? `${bestCard.pts[cat] || bestCard.pts.other || 0}x`
        : `${parseFloat((bestRate*100).toFixed(2))}%`;
      html += `<div style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;background:var(--s1);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;overflow-x:auto;">
        <div style="min-width:max-content;">
          <div style="display:grid;grid-template-columns:90px 1fr 64px 44px 76px 46px;align-items:center;gap:8px;">
            <div style="font-size:11px;font-weight:600;color:var(--text);white-space:nowrap;">${catLabels[cat]}</div>
            <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:6px;overflow:hidden;"><div class="rate-bar ${rc}" style="width:${barW}%;height:100%;border-radius:6px;"></div></div>
            <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--text);text-align:right;white-space:nowrap;">${rateCell}</span>
            <span style="font-family:'DM Mono',monospace;font-size:10px;color:var(--t3);text-align:right;white-space:nowrap;">${fmtSp(monthly * 12)}</span>
            <span style="font-size:10px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${short}</span>
            <span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--green);text-align:right;">+$${annual}</span>
          </div>
        </div>
      </div>`;
    }
  }

  html += `</div>`;
  section.innerHTML = html;
}
