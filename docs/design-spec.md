# MediStock — Design System & App Plan (v1)

Spec for the web app (step 2), mobile app (step 3) and polish pass (step 4).
Tokens live in [`tokens.json`](tokens.json); the visual preview is the published "MediStock Design System" artifact.
Dates below use 2026-10-01 as "today" for sample data.

---

## 1. Product

**What it is.** A stock and expiry manager for a retail or hospital pharmacy. It answers three questions all day:
1. What do we have, and where? (stock by medicine, batch and shelf)
2. What is about to expire, and what do we do with it? (alerts, return or dispose)
3. What do we need to order, and from whom? (low stock, suppliers, orders)

**Users and roles**

| Role | Can do |
|---|---|
| Admin (owner/manager) | Everything, plus users, settings, thresholds, delete records |
| Pharmacist | Receive, dispense, adjust, quarantine, dispose, returns, orders, reports |
| Assistant | View stock, receive stock, dispense, scan; no adjustments, disposal or settings |

**Core rule: FEFO.** Stock always leaves by *first expiry, first out*. Dispensing a medicine picks the batch with the nearest in-date expiry automatically; the user can override with a reason.

---

## 2. Features (MVP scope)

### 2.1 Stock (medicines catalogue)
- Medicine record: brand name, generic name, strength, dosage form, pack size, category, barcode (GTIN/EAN), storage type (room / cold chain 2–8 °C / controlled), schedule (OTC / Rx / Controlled), reorder level, shelf location.
- Stock on hand = sum of active batch quantities. Shown in units and packs.
- Search by name, generic, barcode; filter by category, storage, status (low, out, expiring).
- Low-stock flag when on-hand ≤ reorder level; out of stock at 0.

### 2.2 Batches (lots)
- Each receipt creates or tops up a batch: lot number, expiry date, quantity, unit cost, selling price, supplier, received date, invoice ref, location.
- Batch states: `active`, `quarantined`, `returned`, `disposed`, `depleted`.
- Every quantity change writes a **stock movement**: `receive`, `dispense`, `adjust`, `transfer`, `return`, `dispose`, with user, time, reason. Movements are append-only (the audit trail).
- Medicine detail shows batches sorted by expiry (FEFO order) with the expiry ribbon.

### 2.3 Expiry alerts
- Bands (configurable in Settings, defaults below) drive colour everywhere:

| Band | Rule | Token |
|---|---|---|
| Expired | days left < 0 | `expired` |
| Critical | 0–30 days | `critical` |
| Soon | 31–90 days | `soon` |
| In date | > 90 days | `ok` |

- Alert generation: a daily job (or computed on read for MVP) creates alerts for batches entering a band and for low stock.
- Alert actions: **Acknowledge**, **Quarantine**, **Return to supplier** (respecting supplier's return window), **Dispose** (records method + witness for controlled drugs), **Mark sold/used**.
- Expiry Center screen: timeline grouped by month, value at risk per band, bulk actions.
- Notifications: in-app bell + daily digest email (email can come later).

### 2.4 Suppliers
- Supplier record: name, contact person, phone, email, address, lead time (days), return window (days before expiry they accept returns), payment terms, notes, active flag.
- Supplier detail: medicines supplied, open orders, last deliveries, returns history, on-time rate.
- Purchase orders (lightweight): draft → sent → partially received → received / cancelled. "Reorder suggestions" pre-fills a PO from low-stock items for that supplier.
- Receiving against a PO creates batches.

### 2.5 Reports
- **Stock valuation** (cost and retail, by category).
- **Expiry report** (by band and month, value at risk, export).
- **Wastage report** (disposed and returned units/value over a period).
- **Stock movement log** (filterable audit trail).
- **Low stock / reorder report** (by supplier).
- **Fast and slow movers** (dispense volume over 30/90 days).
- Every report: date range, filters, chart + table, CSV export; PDF export later.

### 2.6 Cross-cutting
- Auth (email + password; magic link optional), roles above.
- Barcode scan: web uses a USB/keyboard scanner into the search field; mobile uses the camera.
- Settings: pharmacy profile, currency, expiry band thresholds, default reorder level, users and roles, locations (shelves/fridges).
- Light and dark themes, both first-class.

Out of MVP: multi-branch transfers, POS/billing, patient records, prescription handling.

---

## 3. Data model (shared by web and mobile)

```
medicines      id, name, generic_name, strength, form, pack_size, category, barcode,
               storage (room|cold|controlled), schedule (otc|rx|controlled),
               reorder_level, location_id, is_active, created_at
batches        id, medicine_id, supplier_id, lot_number, expiry_date, qty_on_hand,
               unit_cost, unit_price, received_at, invoice_ref, location_id,
               status (active|quarantined|returned|disposed|depleted)
stock_movements id, batch_id, type (receive|dispense|adjust|transfer|return|dispose),
               qty (signed), reason, reference, user_id, created_at
suppliers      id, name, contact_name, phone, email, address, lead_time_days,
               return_window_days, payment_terms, notes, is_active
purchase_orders id, supplier_id, status (draft|sent|partial|received|cancelled),
               ordered_at, expected_at, total, created_by
po_lines       id, po_id, medicine_id, qty_ordered, qty_received, unit_cost
alerts         id, kind (expiry|low_stock|out_of_stock), band, batch_id, medicine_id,
               status (open|acknowledged|resolved), created_at, resolved_by
locations      id, name, kind (shelf|fridge|safe)
profiles       id (auth user), full_name, role (admin|pharmacist|assistant)
settings       pharmacy_name, currency, band_critical_days (30), band_soon_days (90),
               default_reorder_level
```

Derived: `days_left = expiry_date - today`; `band` from settings; `on_hand(medicine) = Σ batches.qty_on_hand where status = active`.

**Stack default (later threads may revise):** React + Vite + TypeScript + Tailwind (tokens as CSS variables) for web; Expo (React Native + TypeScript) for mobile; Supabase (Postgres, auth, row-level security) as the shared backend so both apps see the same data. A seed script with ~40 realistic medicines, ~90 batches spread across all bands, 6 suppliers.

---

## 4. Screens

### Web (desktop-first, responsive to tablet)
Layout: fixed left sidebar (248px) + top bar (search/scan, alerts bell, user) + content (max 1320px).

| # | Screen | Key content |
|---|---|---|
| W1 | Sign in | Split layout, brand panel, email/password |
| W2 | Dashboard | KPI row (stock value, items low, expiring ≤30d, expired), expiry outlook chart (next 6 months, stacked by band), "Needs action" list, recent movements, reorder suggestions |
| W3 | Inventory | Data table: medicine, form/strength, on hand, nearest expiry (pill + ribbon), status, location; filters + saved views; bulk export |
| W4 | Medicine detail | Header card, batches table (FEFO order), movement history, supplier(s), stock chart |
| W5 | Receive stock | Form (PO optional): scan/lookup medicine, lot, expiry, qty, cost, supplier; multi-line; confirm summary |
| W6 | Dispense / Adjust | Quick dispense with FEFO pick shown; adjust with required reason |
| W7 | Expiry Center | Band tabs with counts and value, month timeline, batch list with actions, bulk return/dispose |
| W8 | Alerts | All alerts, filters, acknowledge/resolve |
| W9 | Suppliers | List with on-time rate, open POs; detail page with tabs (overview, medicines, orders, returns) |
| W10 | Purchase orders | List + PO editor, reorder suggestions |
| W11 | Reports | Report picker cards → report view (filters, chart, table, export) |
| W12 | Settings | Profile, thresholds, users & roles, locations, appearance |

### Mobile (phone, bottom tab bar)
Tabs: **Home · Stock · Scan (centre, raised) · Expiry · More**

| # | Screen | Key content |
|---|---|---|
| M1 | Sign in | Same as web, single column |
| M2 | Home | Greeting + date, 2×2 KPI tiles, "Needs action" cards |
| M3 | Stock | Search + filter chips, medicine list rows with on-hand and nearest-expiry pill |
| M4 | Medicine detail | Header, batches as cards with ribbon, quick actions (dispense, adjust) |
| M5 | Scan | Camera viewfinder → resolves medicine/batch → action sheet (receive, dispense, view) |
| M6 | Receive | Stepper form (medicine → batch details → confirm) |
| M7 | Expiry | Band segmented control, batch cards, swipe actions |
| M8 | Alerts | List; tap through to batch |
| M9 | More | Suppliers, reports (summary cards), settings, sign out |

---

## 5. Visual design

**Direction.** Calm clinical precision with the feel of a well-run dispensary: a deep formulary-teal brand on cool mint-grey paper, crisp white work surfaces, and data set in a monospace face the way lot numbers are printed on cartons. Colour is reserved for meaning: the four expiry bands and low stock. The brand teal is for navigation, primary actions and focus only.

### 5.1 Colour
See `tokens.json` for light and dark values. Rules:
- Text: `ink` (primary), `ink-2` (secondary), `ink-3` (hints, disabled). All pass WCAG AA on `paper` and `surface`.
- Status colours always come as a pair: strong (text/icon/dot) on its `-tint` background. Never status colour alone: pair with a label or icon (colour-blind safe).
- `info` (indigo) is for low stock and neutral system info, so it never competes with expiry colours.
- Charts: expiry series use band colours; other series use `brand`, `info`, `ink-3`.

### 5.2 Type
- **Bricolage Grotesque** (display, 600/700): page titles, KPI numbers, card titles. Use sparingly.
- **Instrument Sans** (body/UI, 400/500/600): everything else.
- **JetBrains Mono** (data, 400/500): lot numbers, barcodes, quantities in tables, dates in tables. Always `tabular-nums`.
- Scale (px): 12 / 13 / 15 (base) / 17 / 20 / 24 / 32 / 44. Mobile base stays 15–16.
- Labels: 12px, 600, uppercase, +0.06em tracking.

### 5.3 Space, radius, elevation
- 4-pt spacing scale. Page padding 24 (web) / 16 (mobile). Card padding 20 / 16.
- Radius: `sm` 6 (inputs, pills' inner), `md` 10 (buttons, cards), `lg` 16 (sheets, modals), `pill` for status pills.
- Elevation: cards are flat with a 1px `line` border; `raised` shadow only for floating things (menus, toasts, sticky action bars); `overlay` for modals and sheets.
- Motion: 120–200ms, ease `cubic-bezier(.2,.7,.2,1)`; respect reduced motion.

### 5.4 Signature elements
1. **Expiry ribbon.** A thin horizontal track showing today → +12 months, with the batch's expiry marked as a dot in its band colour and the shelf-life consumed shaded. Used in batch rows, cards and the medicine header. Instantly shows "how close".
2. **Lot label.** Lot number and expiry set in mono inside a small bordered label, echoing the printed carton stamp: `LOT A2417K · EXP 11/2026`.
3. **Band pills.** Dot + text: `● 23 days` in the band colour; expired reads `● Expired 12 days ago`.

---

## 6. Components

| Component | Variants / notes |
|---|---|
| Button | primary (brand), secondary (surface + line), ghost, danger; sizes sm 32 / md 40 / lg 48; icon-only needs aria-label |
| Input, Select, Date, Number | 40px, label above, help/error text below; error uses `expired` |
| Search/Scan field | Leading search icon, trailing barcode icon; Enter on a barcode jumps to the medicine |
| Band pill | expired / critical / soon / ok; dot + label |
| Stock badge | low (info), out (expired), in stock (neutral) |
| Expiry ribbon | sizes: row (4px track), card (6px with month ticks) |
| Lot label | mono, bordered, sm radius |
| KPI tile | label, big number (display font), delta or sub-line, optional sparkline; tile tinted only when it is an alert tile |
| Data table | sticky header, mono numeric columns right-aligned, row hover, row click to detail, column sort, pagination, empty state |
| Card | surface, 1px line, md radius |
| Tabs / Segmented control | tabs on web, segmented on mobile; count badges |
| Alert row / Action card | band stripe on the left edge, title, meta, primary action button |
| Toast | success / error / info, 4s, undo for reversible actions |
| Modal / Sheet | modal on web, bottom sheet on mobile; confirm destructive actions in-page |
| Sidebar nav item | icon + label + optional count; active = brand-tint bg + brand text |
| Bottom tab bar | 5 tabs, centre Scan button raised in brand |
| Empty state | icon, one-line explanation, primary action |
| Chart | stacked bars for expiry outlook, line for stock over time; grid lines in `line`, labels in `ink-3` |

Icons: **Lucide** (web: `lucide-react`, mobile: `lucide-react-native`), 1.75 stroke, 18/20px.

---

## 7. Accessibility baseline
- WCAG 2.2 AA contrast for all text and status pairs in both themes.
- Status never conveyed by colour alone (text + dot/icon).
- Visible focus ring: 2px `focus` + 2px offset.
- Touch targets ≥ 44px on mobile; table rows ≥ 44px.
- Full keyboard paths for receive, dispense and alert actions; scanner input works without a mouse.
- Dates shown as `12 Nov 2026` in UI with relative days alongside; ISO in exports.

---

## 8. Build order for later threads
1. **Web (step 2):** repo `medistock`, monorepo-ready (`apps/web`, later `apps/mobile`, shared `packages/tokens` generated from `tokens.json`). Supabase schema + seed, auth, then W2 → W3 → W4 → W5/W6 → W7 → W9/W10 → W11 → W12.
2. **Mobile (step 3):** Expo app in `apps/mobile`, same Supabase project and tokens; M2 → M3 → M4 → M5 → M7 → M6 → M8/M9.
3. **Polish (step 4):** accessibility audit against §7, design review against this spec, empty/loading/error states, dark-mode pass.
