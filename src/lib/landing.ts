import "server-only";
import { CITIES } from "./geo";
import { BOOKING_FEE_MIN, BOOKING_FEE_RATE, KG_CO2_PER_KM, SIGNUP_BONUS, TRUCK_TYPES } from "./constants";
import { fmtDate } from "./format";

/*
  The public landing page at "/", served as finished HTML by src/app/route.ts.

  It is built with the design-taste-frontend kit (.claude/skills/design-taste-frontend), whose
  runtime files live in public/assets. The page is returned as plain HTML rather than rendered as a
  React page so React never hydrates over the DOM the kit's scripts adjust (nav sheet, loops,
  moments). Signed-in users never see it: the route redirects them to /dashboard first.
*/

export interface LandingTrip {
  company: string;
  initials: string;
  origin: string;
  dest: string;
  truckLabel: string;
  from: Date;
}

export interface LandingData {
  trips: LandingTrip[];
  openLoads: number;
  delivered: number;
  loadedKm: number;
  now: Date;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const num = (n: number) => Math.round(n).toLocaleString("en-PH");
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const arrow = `<svg class="m-arrow" viewBox="0 0 12 12" aria-hidden="true"><path class="m-arrow__stem" d="M1 6h8"/><path class="m-arrow__head" d="M4.5 2.5 8 6l-3.5 3.5"/></svg>`;
const tick = `<svg viewBox="0 0 16 16"><path d="m4.5 8.2 2.3 2.3 4.7-5"/></svg>`;

/** Return trips shown in the hero window when the database has fewer than six open ones (the demo seed's lanes). */
const SEED_TRIPS: Omit<LandingTrip, "from">[] = [
  { company: "RDC Trucking Services", initials: "RD", origin: "Batangas City", dest: "Valenzuela", truckLabel: TRUCK_TYPES.WING_VAN_10W.label },
  { company: "RDC Trucking Services", initials: "RD", origin: "Baguio", dest: "Valenzuela", truckLabel: TRUCK_TYPES.SIX_WHEELER.label },
  { company: "Ilocos Freight Lines", initials: "IF", origin: "Subic / Olongapo", dest: "Laoag", truckLabel: TRUCK_TYPES.WING_VAN_10W.label },
  { company: "Bisaya Haulers", initials: "BH", origin: "Toledo", dest: "Mandaue", truckLabel: TRUCK_TYPES.FLATBED_10W.label },
  { company: "Mindanao Cold Express", initials: "MC", origin: "Tagum", dest: "Cagayan de Oro", truckLabel: TRUCK_TYPES.REEFER.label },
  { company: "Ilocos Freight Lines", initials: "IF", origin: "Manila", dest: "Laoag", truckLabel: TRUCK_TYPES.TRAILER.label },
];


function heroRows(data: LandingData) {
  const live = data.trips.slice(0, 6);
  const fill = SEED_TRIPS.filter((s) => !live.some((t) => t.origin === s.origin && t.dest === s.dest))
    .slice(0, Math.max(0, 6 - live.length))
    .map((s, i) => ({ ...s, from: addDays(data.now, 1 + i) }));
  return [...live, ...fill]
    .map(
      (t, i) => `
            <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="${(i % 5) + 1}">${esc(t.initials)}</span><span class="ui-win__who">${esc(t.company)}</span><span class="ui-win__sub">${esc(t.origin)} → ${esc(t.dest)}</span><span class="ui-win__st${i === 1 ? " is-you" : ""}" data-st>${i === 1 ? "Offer sent" : "Open"}</span><span class="ui-win__age">${esc(fmtDate(t.from))}</span></li>`,
    )
    .join("");
}

export function renderLanding(data: LandingData): string {
  const pickup = fmtDate(addDays(data.now, 1));
  const deliverBy = fmtDate(addDays(data.now, 4));
  const tripA = `${fmtDate(addDays(data.now, 2))} – ${fmtDate(addDays(data.now, 4))}`;
  const tripB = `${fmtDate(addDays(data.now, 3))} – ${fmtDate(addDays(data.now, 6))}`;
  const feePct = `${(BOOKING_FEE_RATE * 100).toLocaleString("en-PH")}%`;
  const co2kg = data.loadedKm * KG_CO2_PER_KM;
  const co2 = co2kg >= 10_000 ? `${num(co2kg / 1000)} t` : `${num(co2kg)} kg`;
  const bonus = SIGNUP_BONUS > 0;

  return `<!doctype html>
<html lang="en" data-type="software" data-radius="soft" data-ground="sand" data-buttons="arrow" data-motion>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>BalikKarga: backhaul loads for Philippine trucks and shippers</title>
<meta name="description" content="Truckers post the empty drive home and shippers book it at a backhaul rate, about 40% under a regular trip.">
<meta property="og:type" content="website">
<meta property="og:title" content="BalikKarga: backhaul loads for Philippine trucks and shippers">
<meta property="og:description" content="Book a truck that is already heading your way, at about 40% under a regular trip.">
<meta property="og:image" content="/share.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta name="theme-color" content="#f7f6f3">
<!-- <link rel="canonical" href="https://[the client's domain]/"> : add once the production domain is set -->
<meta name="site-kind" content="software">
<meta name="page-type" content="software">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wdth,wght@75..100,400..700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/system.css">
<link rel="stylesheet" href="/assets/ui/cards.css">
<link rel="stylesheet" href="/assets/motion/motion.css">
<link rel="stylesheet" href="/assets/backgrounds/backgrounds.css">
<link rel="stylesheet" href="/assets/layout/layout.css">
<link rel="stylesheet" href="/assets/icons/icon.css">
<style>
:root {
  --p-bg: #f7f6f3; --p-surface: #eaeae8; --p-ink: #16202c; --p-muted: #5c636c;
  --p-accent: #d9540c; --p-accent-ink: #111111; --p-action: #d9540c; --p-action-ink: #111111;
  --p-inv-bg: #16202c; --p-inv-surface: #232c38; --p-inv-ink: #f7f6f3; --p-inv-muted: #999da1;
  --p-inv-accent: #d9540c; --p-inv-accent-ink: #111111; --p-inv-action: #d9540c; --p-inv-action-ink: #111111;
  --font-display: "Instrument Sans", system-ui, sans-serif;
  --font-text: "Instrument Sans", system-ui, sans-serif;
  --font-mono: "DM Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
  --display-weight: 500;
  --display-tracking: -0.028em;
  --display-tracking-xl: -0.036em;
  --display-stretch: 96%;
  --ly-scale: 1.04;
}
</style>
<link rel="stylesheet" href="/assets/ui/base.css">
<link rel="stylesheet" href="/assets/ui/window/fragment.css">
<link rel="stylesheet" href="/assets/ui/notify/fragment.css">
<link rel="stylesheet" href="/assets/ui/checklist/fragment.css">
<link rel="stylesheet" href="/assets/ui/toggles/fragment.css">
<link rel="stylesheet" href="/assets/diagrams/diagram.css">
<script>document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),700)</script>
<script src="/assets/backgrounds/backgrounds.js"></script>
<script>document.documentElement.classList.add('mo-js');setTimeout(()=>document.documentElement.classList.add('mo-safe'),2500)</script>
<link rel="modulepreload" href="/assets/moments/moments.js">
<link rel="modulepreload" href="/assets/moments/lib.js">
<link rel="modulepreload" href="/assets/moments/counter-rolls/moment.js">
<style>
/* page CSS: only what sits inside a visual, plus one --p-h per card group (references/system.md) */

/* nav cards: the client's own app screens */
.menu-card .panel { --p-h: 200px; }
.menu-card .panel > .frame__img { object-position: 0 0; }

/* hero: the window's columns, and the small match card over its lower-left corner */
.hero__art > .ly-piece { --fx-bg: #fff; }
.hero__art .ui-win__main { padding-right: var(--ly-cut-room); }
.hero__art > .ly-piece--note { left: var(--s-6); bottom: var(--s-6); width: 300px; z-index: 2; }
.bk-note { background: #fff; color: #16181a; border-radius: 12px; padding: 14px 16px; font: 400 14px/1.4 var(--font-text);
           box-shadow: 0 0 0 1px rgb(0 0 0 / .07), 0 18px 44px -20px rgb(0 0 0 / .45); }
.bk-note__row { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 4px; }
.bk-note__row h3 { margin: 0; font: 500 14px/1.3 var(--font-text); letter-spacing: 0; }
.bk-chip { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: 99px; font-size: 13px; font-weight: 500; background: #e7f4ec; color: #17673f; white-space: nowrap; }
.bk-chip::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.bk-line { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: 13px; color: #3d4247; border-top: 1px solid rgb(0 0 0 / .06); }
.bk-line:first-of-type { border-top: 0; }
.bk-line i { width: 18px; height: 18px; border-radius: 50%; flex: none; display: grid; place-items: center; background: #e7f4ec; color: #17673f; font-style: normal; font-size: 13px; font-weight: 500; }
.bk-line b { font-weight: 500; color: #16181a; }
@media (max-width: 1023px) { .hero__art > .ly-piece--note { left: var(--s-4); bottom: var(--s-4); width: 270px; } }
.hero__proof { font-size: var(--t-small); color: var(--muted); }

/* the app frame (sections-library.md, app-frame): the load list beside the open load's matches */
.app.ui { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); margin-top: var(--s-7); background: var(--u-bg); border: 1px solid var(--u-border); border-radius: var(--u-r); box-shadow: var(--u-shadow); }
.app > .app__pane { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.app > .app__pane + .app__pane { border-left: 1px solid var(--u-line); }
.app > .app__pane > .ui-panel { width: 100%; border: 0; border-radius: 0; box-shadow: none; }
.app > .app__pane::after { content: ""; position: absolute; inset: auto 0 0 0; height: 64px; background: linear-gradient(transparent, var(--u-bg)); pointer-events: none; }
@media (min-width: 1024px) and (max-width: 1279px) { .app.ui { grid-template-columns: minmax(0, 4fr) minmax(0, 8fr); } }
@media (max-width: 1023px) {
  .app.ui { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
  .app > .app__pane--list { max-height: 252px; }
  .app > .app__pane--list::after { display: none; }
  .app .ui-win__side { display: none; }
  .app .ui-win__body { grid-template-columns: minmax(0, 1fr); }
  .app > .app__pane + .app__pane { border-left: 0; border-top: 1px solid var(--u-line); }
}
@media (max-width: 639px) {
  .app.ui { grid-template-rows: minmax(0, 1fr); }
  .app > .app__pane--list { display: none; }
  .app > .app__pane + .app__pane { border-top: 0; }
}
/* the open load, drawn from the app's own load page (docs/screenshots/load-matches.png) */
.bk-load { padding: 20px 24px; font: 400 13px/1.45 var(--font-text); color: var(--u-ink, #16181a); }
.bk-load__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--u-muted, #5d6268); }
.bk-load h3 { margin: 4px 0 2px; font: 500 22px/1.2 var(--font-text); letter-spacing: -0.01em; color: var(--u-ink, #16181a); }
.bk-load h3 span { color: var(--u-muted, #5d6268); }
.bk-load__meta { color: var(--u-muted, #5d6268); }
.bk-load__facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 16px 0 20px; padding-bottom: 16px; border-bottom: 1px solid var(--u-line); }
.bk-load__facts dt { color: var(--u-muted, #5d6268); }
.bk-load__facts dd { margin: 2px 0 0; font-weight: 500; }
.bk-load h4 { margin: 0 0 10px; font: 500 15px/1.3 var(--font-text); }
.bk-match { display: grid; grid-template-columns: 44px minmax(0, 1fr) auto; gap: 4px 14px; align-items: start; padding: 14px 0; border-top: 1px solid var(--u-line); }
.bk-fit { grid-row: 1 / span 3; width: 44px; height: 44px; border-radius: 50%; border: 2px solid #17673f; color: #17673f; display: grid; place-content: center; text-align: center; font: 500 15px/1 var(--font-text); }
.bk-fit small { display: block; font-size: 9px; letter-spacing: .04em; margin-top: 1px; }
.bk-fit--b { border-color: #8a5300; color: #8a5300; }
.bk-match b { font-weight: 500; }
.bk-match__sub, .bk-match__nums { grid-column: 2; color: var(--u-muted, #5d6268); }
.bk-match__nums b { color: var(--u-ink, #16181a); }
.bk-match .ui-btn { grid-column: 3; grid-row: 1; background: var(--p-accent); color: #111; border-color: transparent; }
.bk-unv { display: inline-flex; height: 20px; align-items: center; padding: 0 6px; margin-left: 6px; border-radius: 4px; background: #fdf0dc; color: #8a5300; font-size: 12px; font-weight: 500; vertical-align: 1px; }
@media (max-width: 639px) { .bk-load { padding: 16px; } .bk-load__facts { grid-template-columns: 1fr 1fr; } .bk-load__facts > div:last-child { display: none; } .bk-match { grid-template-columns: 44px minmax(0, 1fr); } .bk-match .ui-btn { display: none; } }

/* the feature tiles; the fourth holds the app's own booking screen */
#features .panel { --p-h: 300px; }
#features .panel--screen > .frame__img { object-position: 50% 0; }
@media (max-width: 639px) { #features .panel { --p-h: 148px; } #features-h .muted { display: none; } .bk-counts { margin-top: var(--s-6); row-gap: var(--s-4); } }

/* the trucker's credits ledger beside the two plans */
.bk-ledger-frame { display: grid; place-items: center; padding: var(--s-6); }
.bk-ledger { width: 100%; max-width: 340px; padding: 16px 18px; font: 400 13px/1.4 var(--font-text); }
.bk-ledger__head { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 12px; border-bottom: 1px solid var(--u-line); font-weight: 500; }
.bk-ledger__head b { font: 500 22px/1 var(--font-text); letter-spacing: -0.01em; }
.bk-ledger ul { list-style: none; margin: 0; padding: 0; }
.bk-ledger li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--u-line); }
.bk-ledger li:last-child { border-bottom: 0; }
.bk-ledger small { display: block; color: var(--u-muted, #5d6268); font-size: 12px; }
.bk-ledger em { font-style: normal; font-weight: 500; white-space: nowrap; }
.bk-ledger em.plus { color: #17673f; }

/* pricing: two screens on a tablet, where the three columns stack */
@media (min-width: 640px) and (max-width: 1023px) { #pricing { --h: 2 } }
@media (max-width: 639px) { #pricing { --hm: 2 } }

/* the open load shows one match where the pane is short (tablet and phone) */
@media (max-width: 1023px) { .bk-load .bk-match + .bk-match { display: none; } }

/* the live figures under the feature tiles */
.bk-counts { margin-top: var(--s-8); }

/* the name across the .wrap in the close: hand-set so ten letters fill the line, descender kept */
#contact .close__word { font-size: clamp(56px, 18.4vw, 272px); line-height: 1; padding-bottom: .08em; }

/* the lanes frame on the dark band */
#lanes .frame { aspect-ratio: 5 / 4; }
@media (min-width: 1024px) and (max-width: 1279px) { #lanes .frame { aspect-ratio: 1; } }
#lanes .frame > .dg { position: absolute; inset: 0; }
@media (max-width: 639px) { #lanes .frame { aspect-ratio: 4 / 3; } }
</style>
</head>
<body>
<!-- type: software (a two-sided web app: shippers post loads, truckers post empty return trips)
     deal: hero collage, nav nav-cards, close close-word, footer footer-statement, rhythm dark-band, buttons arrow,
           mark wordmark, ground sand, palette from the client's own orange (start.mjs brand), type instrument
     effect: gradient-mesh in the hero frame
     moments: counter-rolls (the last row of #features); marquee-row was dealt too and left out (see the report)
     screens: hero 1 · matching 1 · features 2 · pricing 1 · faq 1 · lanes 1 · close 1 -->

<header class="nav">
  <div class="wrap nav__bar">
    <a class="skip-link" href="#top">Skip to content</a>
    <a class="nav__logo" href="#top">BalikKarga</a>
    <nav class="nav__links" aria-label="Main">
      <div class="nav__item">
        <a class="nav__link" href="#matching">Matching <svg class="chev" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></a>
        <div class="nav__menu">
          <div class="wrap grid">
            <a class="menu-card span-4" href="#matching">
              <div class="panel"><img class="frame__img" src="/assets/screens/load-matches.jpg" width="820" height="401" alt="A shipper's load from Tarlac City to Laoag with two trucks heading that way" loading="lazy" data-source="client" data-subject="the shipper's load page"></div>
              <span class="t-card">Load matching</span>
              <span class="t-small muted">Trucks heading your way, scored 0 to 100</span>
            </a>
            <a class="menu-card span-4" href="#lanes">
              <div class="panel"><img class="frame__img" src="/assets/screens/trucker-dashboard.jpg" width="820" height="401" alt="A trucker's dashboard listing loads on the way home to Valenzuela" loading="lazy" data-source="client" data-subject="the trucker's dashboard"></div>
              <span class="t-card">Lanes and return trips</span>
              <span class="t-small muted">Loads along the drive home, ranked for truckers</span>
            </a>
            <a class="menu-card span-4" href="#features">
              <div class="panel"><img class="frame__img" src="/assets/screens/booking.jpg" width="820" height="405" alt="A delivered booking with its agreed rate and proof of delivery" loading="lazy" data-source="client" data-subject="a booking page"></div>
              <span class="t-card">Bookings</span>
              <span class="t-small muted">From request to signed waybill, in one record</span>
            </a>
          </div>
        </div>
      </div>
      <div class="nav__item"><a class="nav__link" href="#features">Features</a></div>
      <div class="nav__item"><a class="nav__link" href="#pricing">Pricing</a></div>
      <div class="nav__item"><a class="nav__link" href="#faq">Questions</a></div>
      <div class="nav__item"><a class="nav__link" href="#lanes">Lanes</a></div>
    </nav>
    <div class="nav__actions">
      <a class="nav__link" href="/login">Log in</a>
      <a class="btn btn--primary" href="/signup?role=SHIPPER">Post a load</a>
    </div>
    <button class="nav__toggle" type="button" aria-expanded="false" aria-label="Menu">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 5h14M2 13h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
    </button>
  </div>
</header>

<main id="top">
  <section class="hero hero--collage" data-enter aria-labelledby="hero-h">
    <div class="wrap"><div class="hero-text grid hero__grid">
      <div class="hero__text span-5">
        <h1 id="hero-h">Backhaul loads for trucks driving home empty</h1>
        <p class="hero__lead">Truckers post the empty return leg. Shippers book a truck already heading their way and pay a backhaul rate, about 40% under a regular trip.</p>
        <div class="btn-row"><a class="btn btn--primary" href="/signup?role=SHIPPER">Post a load${arrow}</a><a class="btn btn--secondary" href="/signup?role=TRUCKER">Post a return trip</a></div>
        <p class="hero__proof">Matches loads between ${CITIES.length} hubs, from Laoag to Tagum.</p>
      </div>
      <div class="hero__art span-6 start-7" data-fx="gradient-mesh" data-fx-seed="41" role="img" aria-label="BalikKarga's list of open return trips, and a truck matched to a load from Tarlac City to Laoag">
        <div class="ly-piece ly-piece--main" aria-hidden="true">
          <div class="ui ui-panel ui-win">
            <div class="ui-win__bar">
              <span class="ui-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="ui-win__crumb">BalikKarga <i>/</i> <b>Return trips</b></span>
              <span class="ui-spacer"></span>
              <span class="ui-win__search" aria-hidden="true"><svg class="ui-icon" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg><span class="ui-win__ph">Search</span><span class="ui-kbd">/</span></span>
            </div>
            <div class="ui-win__body">
              <nav class="ui-win__side" aria-hidden="true">
                <span class="ui-win__nav is-on"><svg class="ui-icon" viewBox="0 0 16 16"><path d="M2 10.5h8.5V4H2zM10.5 6.5h2.4l1.6 2v2h-4"/><circle cx="4.5" cy="11.5" r="1.3"/><circle cx="12" cy="11.5" r="1.3"/></svg>Trips<em>${Math.max(data.trips.length, 6)}</em></span>
                <span class="ui-win__nav"><svg class="ui-icon" viewBox="0 0 16 16"><path d="M3 3.5h10v9H3z"/><path d="M3 6.5h10"/></svg>Loads<em>${data.openLoads}</em></span>
                <span class="ui-win__nav"><svg class="ui-icon" viewBox="0 0 16 16"><path d="m3.5 8.4 2.8 2.8 6.2-6.4"/></svg>Bookings</span>
                <span class="ui-win__label">Lanes</span>
                <span class="ui-win__nav"><span class="ui-win__hash">#</span>Batangas</span>
                <span class="ui-win__nav"><span class="ui-win__hash">#</span>Baguio</span>
              </nav>
              <div class="ui-win__main">
                <div class="ui-win__cols" aria-hidden="true"><span>Trucker</span><span>Return leg</span><span>Status</span><span>From</span></div>
                <ul class="ui-win__rows">${heroRows(data)}
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div class="ly-piece ly-piece--note bk-note" aria-hidden="true" data-ly-steps="700">
          <div class="bk-note__row"><h3>Tarlac City → Laoag</h3><span class="bk-chip" data-step data-step-at="4">Requested</span></div>
          <div class="bk-line" data-step><i>✓</i><span><b>Ilocos Freight Lines</b>, fit 90</span></div>
          <div class="bk-line" data-step><i>✓</i><span>On the way home, <b>+9 km</b> detour</span></div>
          <div class="bk-line" data-step><i>✓</i><span>Suggested <b>₱22,000</b>, regular ₱36,700</span></div>
        </div>
      </div>
    </div></div>
  </section>

  <section class="section" id="matching" aria-labelledby="matching-h">
    <div class="wrap">
      <div class="grid">
        <h2 id="matching-h" class="span-5">Every load, matched to trucks going home</h2>
        <div class="span-6 start-7 stack-4">
          <p>Post a load and BalikKarga lists the return trips it fits, scored by detour, dates, capacity, truck type and price. Request the truck at the suggested rate, or name your own.</p>
          <a class="link" href="#faq">Read how fit is scored</a>
        </div>
      </div>
      <div class="ui app fill" role="img" aria-label="A shipper's open loads beside the Tarlac City to Laoag load, with two trucks heading that way and their suggested rates">
        <div class="app__pane app__pane--list">
          <div class="ui ui-panel ui-win">
            <div class="ui-win__bar">
              <span class="ui-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              <span class="ui-win__crumb">Luzon Fresh Distribution <i>/</i> <b>My loads</b></span>
              <span class="ui-spacer"></span>
            </div>
            <div class="ui-win__body">
              <nav class="ui-win__side" aria-hidden="true">
                <span class="ui-win__nav is-on"><svg class="ui-icon" viewBox="0 0 16 16"><path d="M3 3.5h10v9H3z"/><path d="M3 6.5h10"/></svg>Open<em>6</em></span>
                <span class="ui-win__nav"><svg class="ui-icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5"/></svg>Booked<em>2</em></span>
                <span class="ui-win__nav"><svg class="ui-icon" viewBox="0 0 16 16"><path d="m3.5 8.4 2.8 2.8 6.2-6.4"/></svg>Delivered</span>
              </nav>
              <div class="ui-win__main">
                <div class="ui-win__cols" aria-hidden="true"><span>Load</span><span>Route</span><span>Status</span><span>Pickup</span></div>
                <ul class="ui-win__rows">
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="1">10t</span><span class="ui-win__who">Rice, grains and feeds</span><span class="ui-win__sub">Tarlac City → Laoag · 2 trucks</span><span class="ui-win__st is-you" data-st>Open</span><span class="ui-win__age">${esc(pickup)}</span></li>
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="2">11t</span><span class="ui-win__who">320 cartons of canned goods</span><span class="ui-win__sub">Lipa → Quezon City · 3 trucks</span><span class="ui-win__st" data-st>Open</span><span class="ui-win__age">${esc(pickup)}</span></li>
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="3">5t</span><span class="ui-win__who">Highland vegetables</span><span class="ui-win__sub">La Trinidad → Navotas · 1 truck</span><span class="ui-win__st is-done" data-st>Booked</span><span class="ui-win__age">${esc(fmtDate(addDays(data.now, 2)))}</span></li>
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="4">8t</span><span class="ui-win__who">Appliances, Ilocos restock</span><span class="ui-win__sub">Valenzuela → Laoag · 2 trucks</span><span class="ui-win__st" data-st>Open</span><span class="ui-win__age">${esc(fmtDate(addDays(data.now, 2)))}</span></li>
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="5">3t</span><span class="ui-win__who">Office furniture</span><span class="ui-win__sub">Manila → Legazpi · 1 truck</span><span class="ui-win__st" data-st>Open</span><span class="ui-win__age">${esc(fmtDate(addDays(data.now, 4)))}</span></li>
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="1">6t</span><span class="ui-win__who">Bohol-made furniture</span><span class="ui-win__sub">Tagbilaran → Cebu City · RoRo</span><span class="ui-win__st is-done" data-st>Booked</span><span class="ui-win__age">${esc(pickup)}</span></li>
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="2">8t</span><span class="ui-win__who">Chilled Cavendish bananas</span><span class="ui-win__sub">Tagum → Cagayan de Oro · reefer</span><span class="ui-win__st" data-st>Open</span><span class="ui-win__age">${esc(fmtDate(data.now))}</span></li>
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="3">20t</span><span class="ui-win__who">Milled rice, 400 sacks</span><span class="ui-win__sub">San Jose → Vigan · 1 truck</span><span class="ui-win__st" data-st>Open</span><span class="ui-win__age">${esc(fmtDate(addDays(data.now, 2)))}</span></li>
                  <li class="ui-win__row" data-row><span class="ui-avatar" data-tone="4">12t</span><span class="ui-win__who">GI sheets and steel bars</span><span class="ui-win__sub">Toledo → Mandaue · flatbed</span><span class="ui-win__st" data-st>Open</span><span class="ui-win__age">${esc(pickup)}</span></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div class="app__pane app__pane--open">
          <div class="ui-panel bk-load">
            <div class="bk-load__top"><span>200 bags of feeds</span><span class="ui-win__st" data-st>Open</span></div>
            <h3>Tarlac City <span>→</span> Laoag</h3>
            <div class="bk-load__meta">408 km · pickup ${esc(pickup)} · deliver by ${esc(deliverBy)}</div>
            <dl class="bk-load__facts">
              <div><dt>Cargo</dt><dd>10 t · rice, grains, feeds</dd></div>
              <div><dt>Truck needed</dt><dd>Any truck</dd></div>
              <div><dt>Budget</dt><dd>₱25,000</dd></div>
            </dl>
            <h4>Trucks already heading this way (2)</h4>
            <div class="bk-match">
              <span class="bk-fit">90<small>FIT</small></span>
              <span><b>Ilocos Freight Lines</b><span class="bk-unv">Unverified</span></span>
              <span class="ui-btn ui-btn--sm">Request truck</span>
              <span class="bk-match__sub">10-wheeler wing van, 14 t · empty at Subic, going home to Laoag · ${esc(tripA)}</span>
              <span class="bk-match__nums">Loaded 408 km · +9 km detour · suggested <b>₱22,000</b> (regular ≈ ₱36,700)</span>
            </div>
            <div class="bk-match">
              <span class="bk-fit bk-fit--b">80<small>FIT</small></span>
              <span><b>Ilocos Freight Lines</b><span class="bk-unv">Unverified</span></span>
              <span class="ui-btn ui-btn--sm ui-btn--ghost">Request truck</span>
              <span class="bk-match__sub">Tractor head and trailer, 30 t · empty at Manila, going home to Laoag · ${esc(tripB)}</span>
              <span class="bk-match__nums">Loaded 408 km · +9 km detour · suggested <b>₱29,400</b> (regular ≈ ₱49,000)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section g2" id="features" aria-labelledby="features-h">
    <div class="wrap">
      <div class="group">
        <div class="section-head">
          <h2 id="features-h">Features for every booking. <span class="muted">From the first text to the signed waybill.</span></h2>
        </div>
        <div class="grid">
          <article class="card card--row card--open span-6 m-nolift">
            <h3>Texts every booking step</h3>
            <p>Requests, confirmations, pickup and delivery each go out as one 160-character SMS with a link back to the booking.</p>
            <div class="panel" data-ground-panel>
              <div class="stage stage--fade-b"><div class="at-rise fit" style="--fit-max:380px;--ax:max(24px, 50% - 190px);--ay:calc(100% - 180px);--ay-sm:calc(100% - 180px)" data-ui-loop>
                <div class="ui ui-notify" data-ui="notify">
                  <ul class="ui-notify__list" data-notify-list>
                    <li class="ui-note"><span class="ui-avatar ui-note__av" data-tone="1">MS</span><span class="ui-note__text"><span class="ui-note__title">Truck requested<time>now</time></span><span class="ui-note__body">Maria Santos wants your Baguio → Valenzuela trip</span></span><span class="ui-btn ui-btn--sm ui-note__btn">Open</span></li>
                    <li class="ui-note"><span class="ui-note__ico"><svg class="ui-icon" viewBox="0 0 16 16"><path d="m3.5 8.4 2.8 2.8 6.2-6.4"/></svg></span><span class="ui-note__text"><span class="ui-note__title">Booking confirmed<time>4m</time></span><span class="ui-note__body">Phone numbers are now on the booking</span></span></li>
                    <li class="ui-note"><span class="ui-avatar ui-note__av" data-tone="3">RD</span><span class="ui-note__text"><span class="ui-note__title">Picked up at La Trinidad<time>1h</time></span><span class="ui-note__body">5 t of vegetables, on the way to Navotas</span></span></li>
                  </ul>
                </div>
              </div></div>
            </div>
          </article>
          <article class="card card--row card--open span-6 m-nolift">
            <h3>Checks every truck’s LTFRB franchise</h3>
            <p>Truckers upload the OR/CR and franchise for each truck. An admin opens every file before the truck shows as verified.</p>
            <div class="panel">
              <div class="stage stage--fade-b"><div class="at-rise fit" style="--fit-max:340px;--ax:max(24px, 50% - 170px);--ay:40px;--ay-sm:24px">
                <div class="ui ui-panel ui-checks" data-ui="checklist">
                  <div class="ui-checks__head"><div class="ui-title">NDA 1290 · 6-wheeler</div><span class="ui-spacer"></span><div class="ui-meta" data-checks-count>3 of 4</div></div>
                  <div class="ui-checks__bar"><i data-checks-bar style="--k:0.75"></i></div>
                  <ul class="ui-checks__list">
                    <li class="ui-check is-done"><span class="ui-check__box">${tick}</span><span class="ui-check__label">Government ID</span></li>
                    <li class="ui-check is-done"><span class="ui-check__box">${tick}</span><span class="ui-check__label">Driver’s license</span></li>
                    <li class="ui-check is-done"><span class="ui-check__box">${tick}</span><span class="ui-check__label">OR/CR for NDA 1290</span></li>
                    <li class="ui-check"><span class="ui-check__box">${tick}</span><span class="ui-check__label">LTFRB franchise (CPC)</span></li>
                  </ul>
                </div>
              </div></div>
            </div>
          </article>
        </div>
      </div>
      <div class="group">
        <div class="grid">
          <article class="card card--row card--open span-6 m-nolift">
            <h3>Alerts truckers to loads on saved lanes</h3>
            <p>Save the routes your trucks drive home empty, like Batangas City to Valenzuela. A new load on that lane sends a text.</p>
            <div class="panel">
              <div class="stage stage--fade-b"><div class="at-right to-edge" style="--ax:32px;--ay:48px">
                <div class="ui ui-panel ui-toggles" data-ui="toggles">
                  <div class="ui-head"><div class="ui-title">Saved lanes</div><span class="ui-spacer"></span><div class="ui-meta" data-tg-count>2 of 3 on</div></div>
                  <ul class="ui-toggles__list">
                    <li class="ui-tg"><span class="ui-tg__text"><span class="ui-tg__label">Batangas City → Valenzuela</span><span class="ui-tg__sub">10-wheeler wing van, 60 km detour</span></span><span class="ui-switch is-on" role="img" aria-label="On"><i></i></span></li>
                    <li class="ui-tg"><span class="ui-tg__text"><span class="ui-tg__label">Baguio → Valenzuela</span><span class="ui-tg__sub">6-wheeler, 40 km detour</span></span><span class="ui-switch is-on" role="img" aria-label="On"><i></i></span></li>
                    <li class="ui-tg"><span class="ui-tg__text"><span class="ui-tg__label">Toledo → Mandaue</span><span class="ui-tg__sub">Flatbed, 30 km detour</span></span><span class="ui-switch" role="img" aria-label="Off"><i></i></span></li>
                  </ul>
                </div>
              </div></div>
            </div>
          </article>
          <article class="card card--row card--open span-6 m-nolift">
            <h3>Records proof of delivery</h3>
            <p>At drop-off the driver adds a photo of the signed DR or waybill and the receiver’s name. The phone camera opens directly.</p>
            <div class="panel panel--screen"><img class="frame__img" src="/assets/screens/booking-proof.jpg" alt="A delivered booking: requested, confirmed, picked up and delivered, received by Jun Reyes with DR #2231" loading="lazy" width="770" height="368" data-source="client" data-subject="the booking page's proof of delivery"></div>
          </article>
        </div>
        <div class="grid bk-counts" data-moment="counter-rolls">
          <div class="span-4"><p class="t-stat">${num(data.delivered)}</p><p class="t-small muted">backhauls delivered so far</p></div>
          <div class="span-4"><p class="t-stat">${num(data.loadedKm)} km</p><p class="t-small muted">driven loaded that would have run empty</p></div>
          <div class="span-4"><p class="t-stat">${co2}</p><p class="t-small muted">of CO₂ avoided, estimated at ${KG_CO2_PER_KM} kg a km</p></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="pricing" aria-labelledby="pricing-h">
    <div class="wrap">
      <div class="section-head">
        <h2 id="pricing-h">Pricing. <span class="muted">One fee, paid by the trucker when a booking is accepted.</span></h2>
      </div>
      <div class="grid">
        <article class="card card--plan span-4 m-nolift">
          <h3>Shippers</h3>
          <p class="price"><span class="t-stat">₱0</span><span class="t-small muted">to post and book</span></p>
          <ul class="checks">
            <li>See trucks heading your way</li>
            <li>Suggested rate: 60% of a regular trip</li>
            <li>Pay the trucker the agreed rate</li>
          </ul>
        </article>
        <article class="card card--plan span-4 is-featured">
          <h3>Truckers</h3>
          <p class="price"><span class="t-stat">${feePct}</span><span class="t-small muted">a booking, at least ₱${BOOKING_FEE_MIN}</span></p>
          <ul class="checks">
            <li>Paid from credits, 1 credit = ₱1</li>
            <li>Top up by GCash, Maya or bank</li>
            ${bonus ? `<li>₱${num(SIGNUP_BONUS)} free once you are verified</li>` : ""}
            <li>Refunded if the shipper cancels</li>
          </ul>
          <a class="btn btn--secondary" href="/signup?role=TRUCKER">Post a return trip</a>
        </article>
        <div class="frame frame--lit span-4 bk-ledger-frame" role="img" aria-label="A trucker's credits page: welcome credits, a GCash top-up and a 550 peso booking fee for a 22,000 peso trip">
          <div class="ui ui-panel bk-ledger" aria-hidden="true">
            <div class="bk-ledger__head"><span>Credits</span><b>₱${num(bonus ? SIGNUP_BONUS + 1000 - 550 : 1000 - 550)}</b></div>
            <ul>
              ${bonus ? `<li><span>Welcome credits<small>Documents approved</small></span><em class="plus">+₱${num(SIGNUP_BONUS)}</em></li>` : ""}
              <li><span>Top-up by GCash<small>Approved by admin</small></span><em class="plus">+₱1,000</em></li>
              <li><span>Booking fee<small>Tarlac City → Laoag, ₱22,000</small></span><em>−₱550</em></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section g2m" id="faq" aria-labelledby="faq-h">
    <div class="wrap">
      <div class="grid">
        <div class="span-5 stack-4">
          <h2 id="faq-h">Questions</h2>
          <p>Rates and distances are estimates. Truckers carrying third-party cargo must hold a valid LTFRB franchise.</p>
          <a class="link" href="mailto:hello@balikkarga.example">Email the team</a>
        </div>
        <div class="faq span-6 start-7">
          <div class="faq__item"><h3>How is a truck’s fit scored?</h3><p>Detour, weight, truck type and dates must all fit. The 0 to 100 score drops with detour, unused space and a low budget.</p></div>
        </div>
      </div>
      <div class="grid">
        <div class="faq span-6 start-7">
          <div class="faq__item"><h3>How is a load’s suggested rate set?</h3><p>60% of an estimated regular rate for that truck class and distance, plus the full RoRo fee across water.</p></div>
          <div class="faq__item"><h3>When do shippers and truckers swap numbers?</h3><p>Once the booking is accepted and the trucker’s fee is paid. Until then you talk through offers.</p></div>
          <div class="faq__item"><h3>What if a booking is cancelled?</h3><p>If the shipper cancels, the trucker gets the fee back. If the trucker cancels, the fee is kept.</p></div>
          <div class="faq__item"><h3>How do truckers top up credits?</h3><p>Pay by GCash, Maya or bank transfer and enter the reference number. An admin approves it.</p></div>
        </div>
      </div>
    </div>
  </section>
  <section class="section ground-inverse" id="lanes" aria-labelledby="lanes-h">
    <div class="wrap">
      <div class="grid">
        <div class="span-5 stack-4">
          <h2 id="lanes-h">Lanes across ${CITIES.length} hubs, RoRo included</h2>
          <p>Distances are road kilometres between ${CITIES.length} logistics hubs. When cargo crosses water, the suggested rate adds the RoRo fee in full.</p>
          <ul class="checks">
            <li>Cold chain cargo goes only in a reefer van</li>
            <li>A 6-wheeler load can ride in a wing van</li>
            <li>The detour stays inside the trucker’s own limit</li>
          </ul>
        </div>
        <div class="frame span-6 start-7" data-visual data-ui-loop>
          <div class="dg" data-diagram><script type="application/json">{"layout":"lanes","curve":"curve","alt":"A return trip from Tagbilaran to Cebu City is checked for detour, capacity and truck type before it is offered to a shipper.","input":{"label":"Return trip","sub":"Tagbilaran → Cebu City"},"core":{"label":"Matching"},"lanes":[{"label":"Detour 12 km","done":true,"sub":"Limit 30 km"},{"label":"6 t of 15 t","done":true,"sub":"Capacity"},{"label":"RoRo fee added","done":true,"sub":"Bohol to Cebu"}]}</script></div>
        </div>
      </div>
    </div>
  </section>

</main>

<footer class="footer closing footer--statement" id="contact" aria-labelledby="close-h">
  <div class="wrap">
    <div class="closing__cta close--word">
      <div class="section-head--split">
        <div><h2 id="close-h">Post a load for the next truck home</h2><p class="t-lead">Free for shippers. Truckers pay ${feePct} only on accepted bookings.</p></div>
        <a class="btn btn--primary" href="/signup?role=SHIPPER">Post a load${arrow}</a>
      </div>
      <p class="close__word" aria-hidden="true">BalikKarga</p>
    </div>
    <div class="closing__links">
      <div class="grid">
        <div class="span-4 stack-4">
          <a class="nav__logo" href="#top">BalikKarga</a>
          <p class="footer__lede">Backhaul loads for Philippine trucks.</p>
        </div>
        <div class="span-2 footer__col"><h3>Product</h3><ul><li><a href="#matching">Load matching</a></li><li><a href="#features">Features</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Pricing</h3><ul><li><a href="#pricing">Booking fee</a></li><li><a href="#faq">Questions</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Lanes</h3><ul><li><a href="#lanes">68 hubs</a></li><li><a href="#lanes">RoRo crossings</a></li></ul></div>
        <div class="span-2 footer__col"><h3>Account</h3><ul><li><a href="/login">Log in</a></li><li><a href="mailto:hello@balikkarga.example">Email the team</a></li></ul></div>
      </div>
      <div class="footer__legal">
        <span>&copy; ${data.now.getFullYear()} BalikKarga</span>
        <div class="socials"></div>
      </div>
    </div>
  </div>
</footer>

<script type="module" src="/assets/system.js"></script>
<script type="module" src="/assets/motion/motion.js"></script>
<script type="module" src="/assets/layout/layout.js"></script>
<script type="module" src="/assets/diagrams/mount.js"></script>
</body>
</html>`;
}
