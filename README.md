# 🇨🇦 Canadian Credit Card Stack Optimizer

> **Maximize your rewards:** Find the optimal combination of Canadian credit cards based on your actual spending patterns.

A sophisticated, fully client-side web application that analyzes 40+ Canadian credit cards to recommend the perfect stack for your spending profile. Built with vanilla JavaScript — no frameworks, no build steps, no backend required.

![JavaScript](https://img.shields.io/badge/javascript-ES6+-yellow.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## 📖 Table of Contents

- [Features](#-features)
- [Live Demo](#-live-demo)
- [Quick Start](#-quick-start)
- [How It Works](#-how-it-works)
- [Card Database](#-card-database)
- [Architecture](#-architecture)
- [Customization](#-customization)

---

## ✨ Features

### Core Functionality
- **40+ Canadian Credit Cards** — Comprehensive database including cashback, travel rewards, and premium cards from all major issuers
- **Multi-Category Optimization** — Analyzes 8+ spending categories: groceries, dining, gas, recurring bills, rent, travel, and more
- **Real Net Value Calculations** — Accounts for annual fees, income requirements, network acceptance (Visa/MC/Amex), and spending caps
- **Rent Payment Integration** — Built-in support for Chexy (Visa) and Casa (Mastercard) with automatic fee calculations (1.75%)
- **Foreign Transaction Handling** — Properly calculates FX fees (2.5%) vs. no-FX cards for international spending
- **Income-Based Filtering** — Automatically excludes cards above your income qualification tier
- **Fee Waiver Logic** — Identifies when annual fees can be waived through banking relationships (CIBC Smart Plus, TD All-Inclusive, etc.)

### Advanced Features
- **Smart Cap Management** — Handles both per-category caps and combined category group caps (e.g., Scotia Momentum's $25K/yr groceries+recurring+rent cap)
- **Multi-Card Stack Builder** — Generates optimal 1-4 card combinations to maximize total rewards across all spending
- **Points Valuation Flexibility** — Switch between cashback redemption (lower cpp) and travel/transfer partners (higher cpp) for points cards
- **Amex Acceptance Modeling** — Adjustable acceptance rate to discount Amex card values based on real-world usability
- **Category Assignments** — Shows exactly which card to use for each purchase category
- **Comparative Analysis** — Displays single-card vs. stack performance to quantify multi-card benefits

### User Experience
- **Fully Responsive Design** — Desktop sidebar navigation, mobile bottom tabs, polished UI with custom iconography
- **Real-Time Calculations** — Instant recalculation as you adjust spending inputs or profile settings
- **Clean Visual Hierarchy** — Card recommendations sorted by net annual value with clear breakdowns
- **PWA-Ready** — Installable on mobile devices with proper viewport and touch optimizations
- **Accessibility** — Semantic HTML, keyboard navigation, proper ARIA labels

---

## 🚀 Live Demo

**Try it now:** [https://m-tahmid.github.io/canadian-credit-card-stack-optimizer]

Or run locally:
```bash
# Clone the repository
git clone https://github.com/yourusername/canadian-credit-card-stack-optimizer.git
cd canadian-credit-card-stack-optimizer

# Open in your browser (no build required)
open index.html
# or
python3 -m http.server 8000  # then visit http://localhost:8000
```

---

## 🎯 Quick Start

### For Users

1. **Enter Your Spending** (Step 1)
   - Input your typical monthly spending across 8 categories
   - Travel and foreign spend are entered as annual totals
   - Estimates are fine — the optimizer is robust to approximations

2. **Configure Your Profile** (Step 2)
   - Set your household income tier (determines card eligibility)
   - Select accepted card networks (Visa, MC, Amex)
   - Enable Chexy/Casa if you pay rent via credit card
   - Choose credit goal: cashback vs. travel/points optimization
   - Set max cards you're willing to manage (1-4)

3. **Review Results** (Step 3)
   - See your optimal card stack with total annual value
   - Review per-card and per-category breakdowns
   - Compare single-card vs. multi-card performance
   - Get specific recommendations for each spending category

### For Developers

The entire application runs client-side with zero dependencies:

```bash
# Project structure
.
├── index.html          # Main application shell
├── css/
│   └── styles.css      # Complete styling (sidebar, responsive, themes)
├── js/
│   ├── cards.js        # Card database + profile state
│   ├── optimizer.js    # Core optimization algorithms
│   └── ui.js           # DOM manipulation + rendering
└── images/
    ├── logo.svg
    └── apple-touch-icon.png
```

**No build step required.** Just edit and refresh.

---

## 🧮 How It Works

### The Optimization Algorithm

The optimizer uses a **greedy best-card-per-category heuristic** with cap-aware allocation:

1. **Filter Eligible Cards**
   - Remove cards above user's income tier
   - Exclude unwanted networks (Visa/MC/Amex)
   - Respect Chexy/Casa requirements for rent cards
   - Apply fee waiver logic based on banking relationships

2. **Calculate Per-Card Net Value**
   For each card and each spending category:
   ```javascript
   netValue = (spendAmount × earnRate) - annualFee
   ```
   - Adjust for monthly/yearly spending caps
   - Handle combined category caps (proportional allocation)
   - Subtract platform fees for rent (Chexy 1.75%, Casa 1.75%)
   - Subtract FX fees (2.5%) unless card has no-FX benefit
   - Apply Amex acceptance discount (default 80%)

3. **Build Optimal Stack**
   - Generate all valid card combinations (1 to maxCards)
   - For each combo, assign best available card per category
   - Respect spending caps across multiple cards
   - Calculate total annual value = total rewards - total fees
   - Return highest-value stack

4. **Present Results**
   - Sort cards by net annual contribution
   - Show category assignments (which card for groceries, gas, etc.)
   - Display comparative metrics vs. single-card baseline

### Key Formulas

**Rent Net Rate** (after platform fees):
```javascript
rentNetRate = max(0, grossRate - 0.0175)
```

**Foreign Spend Net Rate** (cards without FX fees):
```javascript
fxNetRate = card.noFx ? grossRate : max(0, grossRate - 0.025)
```

**Points Cards** (dynamic cpp based on goal):
```javascript
effectiveRate = (pointsPerDollar × centsPerPoint) / 100
```

**Combined Cap Allocation** (e.g., Scotia Momentum):
```javascript
allocatedCap[category] = groupCap × (categorySpend / totalGroupSpend)
```

---

## 💳 Card Database

The database (`js/cards.js`) contains 40+ Canadian cards with granular metadata:

### Data Schema
```javascript
{
  id: 'cibc-div',
  name: 'CIBC Dividend Visa Infinite',
  network: 'visa',           // 'visa' | 'mc' | 'amex'
  type: 'cashback',          // 'cashback' | 'travel' | 'points'
  fee: 120,                  // Annual fee in CAD
  minIncome: 60000,          // Minimum household income
  chexyOk: true,             // Works with Chexy for rent payments
  rogersReq: false,          // Requires Rogers/Fido account
  noFx: false,               // No foreign transaction fees
  feeWaivedBy: ['cibc'],     // Banks that waive fee via banking packages
  
  // Cashback cards: direct percentages
  rates: {
    groceries: 0.04,         // 4%
    dining: 0.02,            // 2%
    gas: 0.04,               // 4%
    recurring: 0.02,         // 2%
    rent: 0.02,              // 2%
    other: 0.01,             // 1%
    travel: 0.01             // 1%
  },
  
  // Points/travel cards: points per dollar + valuation
  pts: { groceries: 5, other: 1 },
  cpp: { stmt: 0.67, transfer: 1.8, airline: 2.0 },
  
  // Spending caps (monthly unless capYearly: true)
  caps: { groceries: 500 },
  capYearly: { groceries: true },
  
  // Combined category caps (e.g., Scotia Momentum)
  capGroups: [
    { cats: ['groceries', 'recurring', 'rent'], monthly: 2083, yearly: true }
  ],
  
  notes: 'Human-readable details about the card',
  warning: 'Important caveats (e.g., Chexy incompatibility)',
  amexBlock: false           // Excluded from Amex acceptance discount
}
```

### Included Card Families

**Cashback Cards:**
- CIBC Dividend Visa Infinite (4% groceries/gas)
- Scotia Momentum Visa Infinite (4% groceries/recurring)
- BMO CashBack World Elite (5% groceries capped)
- TD Cash Back Visa Infinite (3% groceries/gas/recurring)
- Rogers World Elite (1.5% everything + 3% foreign)
- Tangerine Money-Back (2% on 3 categories)
- SimplyCash Preferred Amex (4% groceries up to $30K/yr)

**Travel/Points Cards:**
- Amex Cobalt (5× dining/groceries)
- Amex Gold (2× travel/dining/gas/groceries)
- Scotiabank Passport VI (no FX fees + lounge access)
- HSBC World Elite (travel insurance + no FX fees)
- Capital One Venture (2% flat on everything)
- National Bank World Elite (5× travel, 3× dining)

**Premium Cards:**
- Amex Platinum ($799 fee, airport lounge access, 5× hotels)
- TD Aeroplan VIP ($599 fee, airline perks)
- CIBC Aventura Infinite Privilege ($499 fee, travel insurance)

*(See `js/cards.js` for complete list with full details)*

---

## 🏗️ Architecture

### Technology Stack
- **Frontend:** Pure HTML5, CSS3, ES6+ JavaScript (no frameworks)
- **Styling:** Custom CSS with CSS Variables for theming
- **Icons:** Inline SVG (Lucide-inspired)
- **Fonts:** Inter (UI), DM Serif Display (headings), DM Mono (data)
- **Hosting:** Static files (GitHub Pages, Netlify, Vercel compatible)

### File Breakdown

**`index.html`** (~700 lines)
- Semantic HTML structure
- Sidebar navigation (desktop) + bottom tabs (mobile)
- Three-step flow: Spending → Profile → Results
- Accessibility attributes (ARIA labels, semantic tags)

**`css/styles.css`** (~800 lines)
- CSS Grid + Flexbox layouts
- Responsive breakpoints (mobile-first)
- Custom properties for colors, spacing, typography
- Dark theme optimized (zinc palette)
- Smooth transitions and hover states

**`js/cards.js`** (~600 lines)
- `profile` object: global user state
- `CARDS` array: complete card database
- Helper functions: grocer detection, profile management

**`js/optimizer.js`** (~500 lines)
- `effectiveRate()`: computes net rate per card/category
- `computeEffectiveCaps()`: handles complex cap logic
- `optimize()`: main greedy optimizer
- `getEffectiveCpp()`: dynamic points valuation
- Rent/FX fee calculations

**`js/ui.js`** (~2000 lines)
- DOM manipulation and event handlers
- `renderResults()`: main results renderer
- `renderStackTable()`: multi-card stack display
- `renderCategoryAssignments()`: per-category breakdown
- `goStep()`: navigation flow control
- Profile toggles, form handling, mobile responsiveness

### State Management

Global state is stored in the `profile` object:

```javascript
const profile = {
  income: '60to80',              // Income tier
  networks: new Set(['visa','mc']), // Allowed networks
  chexy: 'yes',                  // Rent payment platform
  rogers: 'no',                  // Rogers customer status
  goal: 'cashback',              // Optimization goal
  grocers: new Set(),            // Preferred grocery stores
  maxcards: '4',                 // Max cards in stack
  amexAcceptance: 0.8,           // Amex acceptance rate
  perks: { /* travel prefs */ }
};
```

Spending data is read from DOM inputs on-demand via `getSpend()`.

---

## 🎨 Customization

### Adding New Cards

Edit `js/cards.js` and append to the `CARDS` array:

```javascript
{
  id: 'new-card-id',
  name: 'Bank Name Card Name',
  network: 'visa',  // or 'mc' or 'amex'
  type: 'cashback', // or 'travel' or 'points'
  fee: 150,
  minIncome: 80000,
  chexyOk: true,
  rogersReq: false,
  noFx: false,
  feeWaivedBy: ['bankname'],
  rates: {
    groceries: 0.05,
    dining: 0.03,
    gas: 0.02,
    recurring: 0.02,
    rent: 0.01,
    other: 0.01,
    travel: 0.02
  },
  caps: { groceries: 600 },  // monthly cap
  notes: 'Description of benefits and restrictions',
  warning: null,
  amexBlock: false
}
```

The optimizer will automatically include the new card in calculations.

### Modifying Optimization Logic

Key functions in `js/optimizer.js`:

- **`effectiveRate(card, cat)`** — Change how rates are computed
- **`computeEffectiveCaps(card, spend)`** — Modify cap allocation logic
- **`optimize(spend)`** — Replace greedy algorithm with exhaustive search or ILP solver
- **`getEffectiveCpp(card)`** — Adjust points valuation based on perks selections

### Styling Customization

All colors and spacing use CSS variables defined in `:root`:

```css
:root {
  --clr-bg: #09090b;        /* Background */
  --clr-card: #18181b;      /* Card surfaces */
  --clr-border: #27272a;    /* Borders */
  --clr-text: #fafafa;      /* Primary text */
  --clr-muted: #a1a1aa;     /* Secondary text */
  --clr-accent: #10b981;    /* Success/accent */
  
  --font-ui: 'Inter', sans-serif;
  --font-display: 'DM Serif Display', serif;
  --font-mono: 'DM Mono', monospace;
}
```

Change these to instantly retheme the entire app.

### Adding New Spending Categories

1. Add input field in `index.html` Step 1
2. Update `getSpend()` in `optimizer.js` to read the new input
3. Add rate key to all cards in `cards.js`:
   ```javascript
   rates: { ..., newCategory: 0.02 }
   ```
4. Update `renderCategoryAssignments()` in `ui.js` to display the category

---

## 📊 Example Output

For a user with:
- $700/mo groceries
- $400/mo dining
- $150/mo gas
- $2000/mo rent (via Chexy)
- $60-80K household income

**Optimal 3-Card Stack:**

| Card | Net Annual Value | Best For |
|------|-----------------|----------|
| Scotia Momentum Visa Infinite | $912 | Rent (2.25% after Chexy fee) |
| CIBC Dividend Visa Infinite | $456 | Groceries (4%), Gas (4%) |
| Amex Cobalt | $324 | Dining (5×/MR → 3.33% at 0.67cpp) |

**Total Stack Value:** $1,692/year  
**Single Best Card:** Scotia Momentum at $1,140/year  
**Stack Advantage:** +$552/year (+48%)

---

## 🙏 Acknowledgments

- **Card data sources:** Official bank websites, RedFlagDeals forums, Prince of Travel, Milesopedia
- **Design inspiration:** Linear, Stripe, Vercel
- **Icon set:** Lucide (MIT licensed)

---

## 🔮 Roadmap

Planned features for future releases:

- [ ] **Welcome bonus calculator** — Factor in sign-up bonuses amortized over card lifetime
- [ ] **Statement credit handling** — Track Amex offers, shop small credits, merchant-specific promos
- [ ] **CSV export** — Download spending breakdown and recommendations
- [ ] **Historical comparison** — Track how your stack value changes as cards get refreshed
- [ ] **Referral link integration** — Opt-in affiliate links for supported cards
- [ ] **Advanced points valuations** — Aeroplan sweet spots, Marriott category modeling
- [ ] **Business card support** — Separate module for small business spending

---

**Built with ❤️ for the Canadian personal finance community**

*Not affiliated with any financial institution. Card data provided for informational purposes only. Always verify current terms and conditions with card issuers before applying.*
