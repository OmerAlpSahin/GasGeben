/* ===================== COIN FEVER — game logic ===================== */
(() => {
'use strict';

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const SAVE_KEY = 'coinfever_save_v1';
const COST_GROWTH = 1.15;
const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc', 'UDc', 'DDc', 'TDc'];

function fmt(n) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  if (!isFinite(n)) return '∞';
  if (n < 0) return '-' + fmt(-n);
  if (n < 1000) {
    if (n < 100 && Math.abs(n - Math.round(n)) > 0.001) return n.toFixed(1);
    return Math.floor(n + 1e-9).toString();
  }
  let i = 0;
  while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
  const s = n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.floor(n).toString();
  return s + SUFFIX[i];
}
function fmtTime(s) {
  if (!isFinite(s)) return '∞';
  s = Math.max(0, Math.ceil(s));
  if (s < 60) return s + 's';
  const m = Math.floor(s / 60), sec = s % 60;
  if (m < 60) return m + 'm ' + sec + 's';
  const h = Math.floor(m / 60), mm = m % 60;
  if (h < 24) return h + 'h ' + mm + 'm';
  const d = Math.floor(h / 24);
  return d + 'd ' + (h % 24) + 'h';
}
const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------------
// Content definitions
// ------------------------------------------------------------------
// Ship systems. Ids are kept stable so old saves still load.
const BUILDINGS = [
  { id: 'piggy',    name: 'Solar Panel',      icon: '☀️', baseCost: 15,     baseCps: 0.1,  flavor: 'Sunlight in, coins out.' },
  { id: 'lemonade', name: 'Fuel Cell',        icon: '🔋', baseCost: 100,    baseCps: 1,    flavor: 'Steady juice for the engines.' },
  { id: 'vending',  name: 'Mining Drone',     icon: '🛰️', baseCost: 1100,   baseCps: 8,    flavor: 'Chips space rocks into coins.' },
  { id: 'truck',    name: 'Cargo Bay',        icon: '📦', baseCost: 12000,  baseCps: 47,   flavor: 'Haul goods between ports.' },
  { id: 'arcade',   name: 'Space Arcade',     icon: '🕹️', baseCost: 130000, baseCps: 260,  flavor: 'Bored crews pay very well.' },
  { id: 'casino',   name: 'Orbital Casino',   icon: '🎰', baseCost: 1.4e6,  baseCps: 1400, flavor: 'The house always wins. The house is a space station.' },
  { id: 'bank',     name: 'Galactic Bank',    icon: '🏦', baseCost: 2e7,    baseCps: 7800, flavor: 'Compound interest at light speed.' },
  { id: 'stocks',   name: 'Star Exchange',    icon: '📈', baseCost: 3.3e8,  baseCps: 44000,flavor: 'Number go up. Universally.' },
  { id: 'crypto',   name: 'Dark Matter Mine', icon: '⛏️', baseCost: 5.1e9,  baseCps: 260000, flavor: 'Nobody knows what it is. It sells.' },
  { id: 'moon',     name: 'Dyson Panel',      icon: '🌞', baseCost: 7.5e10, baseCps: 1.6e6, flavor: 'Wrap a star. Bill everyone.' },
  { id: 'time',     name: 'Wormhole Toll',    icon: '🌀', baseCost: 1e12,   baseCps: 1e7,  flavor: 'Charge the universe for shortcuts.' },
];
const TIER_NAMES = ['Boosted', 'Turbo', 'Hyper', 'Ultra', 'Omega'];
const TIER_REQ = [[1, 10], [5, 50], [25, 500], [50, 5000], [100, 50000]];

const UPGRADES = [];
BUILDINGS.forEach((b) => TIER_REQ.forEach(([n, m], t) => UPGRADES.push({
  id: `${b.id}_${t}`, name: `${TIER_NAMES[t]} ${b.name}`, icon: b.icon, cost: b.baseCost * m,
  desc: `${b.name}s produce twice as much.`, req: (s) => (s.buildings[b.id] || 0) >= n, type: 'building', target: b.id,
})));

const CLICK_UPG = [
  ['Sticky Fingers', 100, 10], ['Golden Fingers', 2500, 100], ['Midas Touch', 5e4, 500], ['Diamond Hands', 1e6, 2000],
  ['Platinum Palms', 2.5e7, 5000], ['Cosmic Claws', 5e8, 10000], ['Reality Ripper', 1e10, 25000],
  ['Infinity Fist', 2.5e11, 50000], ['Omnipotent Poke', 5e12, 100000],
];
CLICK_UPG.forEach(([name, cost, clicks], i) => UPGRADES.push({
  id: 'click_' + i, name, icon: '👆', cost, type: 'click',
  desc: i >= 2 ? 'Clicks are worth ×2 AND gain +1% of your income per click.' : 'Clicks are worth ×2.',
  req: (s) => s.totalClicks >= clicks,
}));

const DEFAULT_PARAMS = {
  critChance: 0.03, critMult: 10, comboWindow: 0.8, comboMaxMult: 3, goldenFreq: 1, goldenDur: 1, goldenLife: 1, offline: 0.5,
  bubbleFreq: 1, chestHp: 1, thiefSpeed: 1, droneFreq: 1, feverRate: 1, feverDur: 1, warp: 1,
  launchDiscount: 1, throttleMax: 4, landingMult: 1, pairPay: 1.5,
};
const SPECIALS = [
  { id: 'crit1', name: 'Lucky Charm', icon: '🍀', cost: 5000, desc: 'Critical click chance 3% → 6%.', req: (s) => s.crits >= 1, effect: { critChance: 0.06 } },
  { id: 'crit2', name: 'Four-Leaf Clover', icon: '☘️', cost: 5e5, desc: 'Critical click chance 6% → 10%.', req: (s) => !!s.upgrades.crit1, effect: { critChance: 0.10 } },
  { id: 'crit3', name: 'Horseshoe', icon: '🧲', cost: 5e7, desc: 'Critical hits deal ×25 instead of ×10.', req: (s) => !!s.upgrades.crit2, effect: { critMult: 25 } },
  { id: 'crit4', name: "Rabbit's Foot", icon: '🐇', cost: 5e9, desc: 'Critical click chance 10% → 15%.', req: (s) => !!s.upgrades.crit3, effect: { critChance: 0.15 } },
  { id: 'combo1', name: 'Rhythm', icon: '🎵', cost: 25000, desc: 'Combo window 0.8s → 1.2s. Easier to keep the streak alive.', req: (s) => s.maxCombo >= 25, effect: { comboWindow: 1.2 } },
  { id: 'combo2', name: 'Flow State', icon: '🌊', cost: 5e6, desc: 'Max combo multiplier ×3 → ×5.', req: (s) => s.maxCombo >= 100, effect: { comboMaxMult: 5 } },
  { id: 'combo3', name: 'Overdrive', icon: '🔥', cost: 1e9, desc: 'Combo window 1.2s → 1.6s.', req: (s) => !!s.upgrades.combo2, effect: { comboWindow: 1.6 } },
  { id: 'gold1', name: 'Gilded Luck', icon: '✨', cost: 1e5, desc: 'Golden coins appear twice as often.', req: (s) => s.goldenClicked >= 1, effect: { goldenFreq: 2 } },
  { id: 'gold2', name: 'Golden Age', icon: '👑', cost: 5e7, desc: 'Golden coin effects last twice as long.', req: (s) => s.goldenClicked >= 10, effect: { goldenDur: 2 } },
  { id: 'gold3', name: 'Fortune Magnet', icon: '🔮', cost: 1e10, desc: 'Golden coins appear even more often and stay 50% longer.', req: (s) => s.goldenClicked >= 40, effect: { goldenFreq: 3.5, goldenLife: 1.5 } },
  { id: 'off1', name: 'Night Shift', icon: '🌃', cost: 2e5, desc: 'Earn 100% (instead of 50%) of your income while away.', req: (s) => s.totalEarned >= 1e5, effect: { offline: 1 } },
  { id: 'bub1', name: 'Bubble Wrap', icon: '🫧', cost: 5e4, desc: 'Prize bubbles float by twice as often.', req: (s) => s.bubbles >= 5, effect: { bubbleFreq: 2 } },
  { id: 'bub2', name: 'Bubble Machine', icon: '🧼', cost: 2e8, desc: 'Prize bubbles float by 3× as often.', req: (s) => s.bubbles >= 60, effect: { bubbleFreq: 3.5 } },
  { id: 'chest1', name: 'Mining Laser', icon: '🔦', cost: 2e6, desc: 'Asteroids crack in half the clicks.', req: (s) => s.chests >= 3, effect: { chestHp: 0.5 } },
  { id: 'thief1', name: 'Tractor Beam', icon: '🧲', cost: 1e6, desc: 'Space pirates fly 40% slower. Easier to catch.', req: (s) => s.thieves >= 2, effect: { thiefSpeed: 0.6 } },
  { id: 'warp1', name: 'Ion Drive', icon: '🔵', cost: 5e7, desc: 'Ship speed ×3. Reach the next planet sooner.', req: (s) => s.stageIdx >= 6, effect: { warp: 3 } },
  { id: 'warp2', name: 'Fusion Drive', icon: '☢️', cost: 2e10, desc: 'Ship speed ×10.', req: (s) => s.stageIdx >= 10, effect: { warp: 10 } },
  { id: 'warp3', name: 'Warp Drive', icon: '🌀', cost: 1e13, desc: 'Ship speed ×50. Interstellar travel gets real.', req: (s) => s.stageIdx >= 11, effect: { warp: 50 } },
  { id: 'warp4', name: 'Alcubierre Engine', icon: '💠', cost: 5e15, desc: 'Ship speed ×500. Fold space itself.', req: (s) => s.stageIdx >= 14, effect: { warp: 500 } },
  { id: 'drone1', name: 'Radar', icon: '📡', cost: 1e7, desc: 'Drones fly by twice as often.', req: (s) => s.drones >= 3, effect: { droneFreq: 2 } },
  { id: 'fever1', name: 'Fever Pitch', icon: '🌡️', cost: 2.5e5, desc: 'Fever gauge fills 50% faster.', req: (s) => s.fevers >= 1, effect: { feverRate: 1.5 } },
  { id: 'fever2', name: 'Meltdown', icon: '☢️', cost: 2e8, desc: 'Fever gauge fills 2× faster and Fever lasts 50% longer.', req: (s) => s.fevers >= 10, effect: { feverRate: 2, feverDur: 1.5 } },
];
SPECIALS.forEach((u) => UPGRADES.push({ ...u, type: 'special' }));

const ACH = [];
const addAch = (id, icon, name, desc, check) => ACH.push({ id, icon, name, desc, check });
[[1, 'First Blood'], [100, 'Clicker'], [1000, 'Click Addict'], [10000, 'Carpal Tunnel'], [100000, 'Click God']]
  .forEach(([n, name]) => addAch('clk' + n, '👆', name, `Click ${n.toLocaleString()} times.`, (s) => s.totalClicks >= n));
[[1e3, 'Pocket Change'], [1e5, 'Comfortable'], [1e7, 'Millionaire×10'], [1e9, 'Billionaire'], [1e12, 'Trillionaire'], [1e15, 'Beyond Money']]
  .forEach(([n, name]) => addAch('earn' + n, '💰', name, `Earn ${fmt(n)} coins in total.`, (s) => s.totalEarned >= n));
[[10, 'Landlord'], [50, 'Tycoon'], [100, 'Mogul'], [250, 'Empire'], [500, 'Monopoly']]
  .forEach(([n, name]) => addAch('bld' + n, '🏗️', name, `Own ${n} buildings.`, (s) => totalBuildings(s) >= n));
addAch('collector', '🧩', 'Collector', 'Own at least one of every building.', (s) => BUILDINGS.every((b) => (s.buildings[b.id] || 0) > 0));
[[25, 'Warming Up'], [50, 'On Fire'], [100, 'Unstoppable'], [250, 'Inhuman']]
  .forEach(([n, name]) => addAch('combo' + n, '🔥', name, `Reach a ${n} click combo.`, (s) => s.maxCombo >= n));
[[10, 'Lucky Shot'], [100, 'Sharpshooter'], [1000, 'Critical Mass']]
  .forEach(([n, name]) => addAch('crit' + n, '💥', name, `Land ${n} critical clicks.`, (s) => s.crits >= n));
[[1, 'Shiny!'], [10, 'Gold Digger'], [50, 'Fortune Favors You']]
  .forEach(([n, name]) => addAch('gold' + n, '🪙', name, `Catch ${n} golden coins.`, (s) => s.goldenClicked >= n));
addAch('spin1', '🎰', 'High Roller', 'Spin the Lucky Spin.', (s) => s.spins >= 1);
addAch('spin50', '🎲', 'Degenerate', 'Spin the Lucky Spin 50 times.', (s) => s.spins >= 50);
addAch('jackpot', '7️⃣', 'JACKPOT', 'Hit triple sevens.', (s) => s.jackpots >= 1);
[[10, 'Trickle'], [1000, 'Stream'], [1e6, 'River'], [1e9, 'Tsunami']]
  .forEach(([n, name]) => addAch('cps' + n, '⚡', name, `Reach ${fmt(n)} coins per second.`, () => cache.cps >= n));
addAch('prestige1', '💎', 'Reborn', 'Cash out for the first time.', (s) => s.prestiges >= 1);
addAch('prestige5', '👑', 'Serial Retiree', 'Cash out 5 times.', (s) => s.prestiges >= 5);
[[10, 'Pop Pop'], [100, 'Bubble Trouble'], [500, 'Bubble Lord']]
  .forEach(([n, name]) => addAch('bub' + n, '🫧', name, `Pop ${n} prize bubbles.`, (s) => s.bubbles >= n));
[[1, 'Rock Hound'], [25, 'Belt Miner'], [100, 'Asteroid Crusher']]
  .forEach(([n, name]) => addAch('chest' + n, '🪨', name, `Mine ${n} asteroids.`, (s) => s.chests >= n));
[[1, 'Bounty Hunter'], [25, 'Sector Marshal'], [100, 'Scourge of Pirates']]
  .forEach(([n, name]) => addAch('thief' + n, '🏴‍☠️', name, `Catch ${n} space pirates.`, (s) => s.thieves >= n));
[[1, 'Slingshot'], [10, 'Event Horizon Surfer']]
  .forEach(([n, name]) => addAch('bh' + n, '🕳️', name, `Escape ${n} black holes.`, (s) => s.blackholes >= n));
[[1, 'Ace Pilot'], [25, 'Anti-Air'], [100, 'Skynet']]
  .forEach(([n, name]) => addAch('drone' + n, '🛸', name, `Shoot down ${n} drones.`, (s) => s.drones >= n));
[[1, 'Feverish'], [10, 'Burning Up'], [50, 'Pyromaniac']]
  .forEach(([n, name]) => addAch('fever' + n, '🌡️', name, `Enter Fever mode ${n} times.`, (s) => s.fevers >= n));
[[25, 'Sharp Eye'], [500, 'Eagle Eye']]
  .forEach(([n, name]) => addAch('sweet' + n, '⭐', name, `Hit the sweet spot ${n} times.`, (s) => s.sweetHits >= n));
addAch('streak3', '📅', 'Habit Forming', 'Claim the daily gift 3 days in a row.', (s) => s.dailyStreak >= 3);
addAch('streak7', '🗓️', 'Part of the Routine', 'Claim the daily gift 7 days in a row.', (s) => s.dailyStreak >= 7);

// ------------------------------------------------------------------
// The journey: Earth → Andromeda. Distances in km (real, roughly).
// ------------------------------------------------------------------
const MILESTONES = [
  { name: 'Launch Pad',        icon: '🌍', d: 0,       stage: 'orbit',        story: 'Engines hot. Every click is thrust. Every coin is fuel.' },
  { name: 'Kármán Line',       icon: '☁️', d: 100,     stage: 'orbit',        story: "100 km up. You're officially in space. Your mom is proud." },
  { name: 'Space Station',     icon: '🛰️', d: 400,     stage: 'orbit',        story: 'The crew waves from the window. You do not slow down.' },
  { name: 'The Moon',          icon: '🌕', d: 384400,  stage: 'orbit',        story: 'One small click for man. One giant payout for mankind.' },
  { name: 'Mars',              icon: '🔴', d: 7.8e7,   stage: 'inner',        story: 'Red. Dusty. Excellent real estate prices.' },
  { name: 'Asteroid Belt',     icon: '🪨', d: 3.3e8,   stage: 'inner',        story: 'Free rocks everywhere. You start mining.' },
  { name: 'Jupiter',           icon: '🟠', d: 6.3e8,   stage: 'giants',       story: 'A storm bigger than Earth. You sell it umbrellas.' },
  { name: 'Saturn',            icon: '🪐', d: 1.28e9,  stage: 'giants',       story: 'You liked it, so you put a ring on it.' },
  { name: 'Uranus',            icon: '🔵', d: 2.7e9,   stage: 'outer',        story: 'You resist the joke. Barely.' },
  { name: 'Neptune',           icon: '🌀', d: 4.35e9,  stage: 'outer',        story: 'Winds of 2,000 km/h. Great for drying laundry.' },
  { name: 'Pluto',             icon: '⚪', d: 5.9e9,   stage: 'outer',        story: 'Still a planet in your heart. You buy it to make it official.' },
  { name: 'Heliopause',        icon: '🌬️', d: 1.8e10,  stage: 'interstellar', story: "You leave the Sun's bubble. Voyager waves. Black holes lurk out here." },
  { name: 'Oort Cloud',        icon: '❄️', d: 1.5e13,  stage: 'interstellar', story: 'The last of home. Trillions of icy rocks, and you own the toll booth.' },
  { name: 'Proxima Centauri',  icon: '⭐', d: 4.0e13,  stage: 'stars',        story: 'Another star. Another sun. Same clicking.' },
  { name: 'Sirius',            icon: '🌟', d: 8.1e13,  stage: 'stars',        story: 'The brightest star in the sky. It dims next to your bank balance.' },
  { name: 'Orion Nebula',      icon: '🌌', d: 1.3e16,  stage: 'nebula',       story: 'Stars are born here. So are fortunes.' },
  { name: 'Galactic Core',     icon: '🕳️', d: 2.5e17,  stage: 'core',         story: 'Sagittarius A*, the black hole at the heart of the galaxy, eyes your wallet.' },
  { name: 'Intergalactic Void',icon: '⬛', d: 1.0e19,  stage: 'void',         story: 'Nothing for a million light-years. Except you, and the sound of clicking.' },
  { name: 'Andromeda',         icon: '💫', d: 2.4e19,  stage: 'andromeda',    story: 'You crossed the void. A whole new galaxy of things to buy.', end: true },
];
const KM_PER_AU = 1.496e8, KM_PER_LY = 9.461e12;
const KM_PER_COIN = 10;       // passive income → cruising speed
const CLICK_THRUST = 100;     // clicks push 10× harder per coin than passive income
// Planet colours (for the sky) and warp-lane boosts for the long interstellar legs
const MS_COLORS = ['#2f6fdb', '#3aa0ff', '#9aa4b8', '#c9c9d1', '#c1440e', '#8a7f72', '#d9a066', '#e3c47a', '#7fd8e6', '#3457d5', '#b9a89a', '#4bd0c0', '#a0d8ff', '#ff6a3d', '#cfe8ff', '#d05ac8', '#ff8c1a', '#3a3a3a', '#b58cff'];
const MS_BOOST = { 12: 400, 13: 400, 14: 400, 15: 4e4, 16: 4e4, 17: 4e5, 18: 4e5 };
MILESTONES.forEach((m, i) => { m.color = MS_COLORS[i]; m.boost = MS_BOOST[i] || 1; });
function fmtDist(km) {
  if (!isFinite(km)) return '∞';
  if (km < 1e7) return fmt(km) + ' km';
  if (km < KM_PER_LY * 0.05) return (km / KM_PER_AU < 10 ? (km / KM_PER_AU).toFixed(2) : fmt(km / KM_PER_AU)) + ' AU';
  return fmt(km / KM_PER_LY) + ' ly';
}
MILESTONES.forEach((m, i) => { if (i > 0) addAch('ms' + i, m.icon, 'Reached ' + m.name, m.story, (s) => s.stageIdx >= i); });
addAch('ngplus', '🌀', 'Again!', 'Start New Game+.', (s) => s.ngPlus >= 1);
[[1, 'Liftoff'], [10, 'Frequent Flyer']].forEach(([n, name]) => addAch('launch' + n, '🚀', name, `Launch ${n} times.`, (s) => s.launches >= n));
[[5, 'Space Stories'], [25, 'Seen Things']].forEach(([n, name]) => addAch('event' + n, '📡', name, `Face ${n} events in flight.`, (s) => s.events >= n));
[[3, 'Collector of Relics'], [10, 'Relic Hoarder']].forEach(([n, name]) => addAch('perk' + n, '🗿', name, `Install ${n} planetary relics.`, (s) => Object.values(s.perks || {}).reduce((a, b) => a + b, 0) >= n));

function totalBuildings(s) { return Object.values(s.buildings).reduce((a, b) => a + b, 0); }

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------
function defaultState() {
  return {
    coins: 0, totalEarned: 0, runEarned: 0, totalClicks: 0, crits: 0, maxCombo: 0, goldenClicked: 0,
    spins: 0, jackpots: 0, slotWon: 0, slotSpent: 0,
    bubbles: 0, chests: 0, thieves: 0, thievesEscaped: 0, drones: 0, fevers: 0, sweetHits: 0, feverCoins: 0,
    distance: 0, stageIdx: 0, arrivals: {}, ngPlus: 0, ended: false, blackholes: 0, blackholeFails: 0,
    phase: 'docked', perks: {}, permBonus: 0, pendingPerk: null, launches: 0, events: 0,
    buildings: {}, upgrades: {}, achievements: {},
    diamonds: 0, prestiges: 0,
    lastSave: Date.now(), firstPlayed: Date.now(), playTime: 0,
    lastDaily: null, dailyStreak: 0,
    muted: false, buyAmt: 1,
  };
}
let state = defaultState();
let params = { ...DEFAULT_PARAMS };
const cache = { cps: 0, clickBase: 0, globalMult: 1, buildingCps: {} };

let combo = 0, lastClickTime = -1e9;
let buffs = [];          // {type, label, remaining, total}
let goldenTimer = 0;
let uiDirty = true, upgKey = '';
let lastAffordable = new Set();
let lastPing = 0;
let slotSpinning = false;

// ------------------------------------------------------------------
// Audio (synthesized — no files needed)
// ------------------------------------------------------------------
const sfx = (() => {
  let ctx = null, master = null;
  function ensure() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.45; master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* audio unavailable */ }
  }
  function tone({ f = 440, f2 = null, t = 0.1, type = 'sine', v = 0.2, delay = 0 }) {
    if (!ctx || state.muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const s = ctx.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f, s);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, s + t);
    g.gain.setValueAtTime(v, s);
    g.gain.exponentialRampToValueAtTime(0.0001, s + t);
    o.connect(g); g.connect(master);
    o.start(s); o.stop(s + t + 0.02);
  }
  function noise(t = 0.05, v = 0.1, delay = 0) {
    if (!ctx || state.muted) return;
    const len = Math.floor(ctx.sampleRate * t);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; g.gain.value = v;
    src.connect(g); g.connect(master);
    src.start(ctx.currentTime + delay);
  }
  return {
    ensure,
    click(c, crit) {
      const f = 380 + Math.min(c, 120) * 9;
      tone({ f, f2: f * 1.5, t: 0.07, type: 'triangle', v: 0.14 });
      tone({ f: f * 2, t: 0.04, type: 'sine', v: 0.05 });
      if (crit) {
        tone({ f: 900, f2: 1800, t: 0.25, type: 'square', v: 0.1 });
        tone({ f: 1200, f2: 2400, t: 0.3, type: 'sine', v: 0.1, delay: 0.05 });
        noise(0.15, 0.12);
      }
    },
    buy() { tone({ f: 880, t: 0.08, type: 'square', v: 0.07 }); tone({ f: 1320, t: 0.16, type: 'square', v: 0.07, delay: 0.07 }); noise(0.04, 0.05); },
    deny() { tone({ f: 220, f2: 160, t: 0.15, type: 'sawtooth', v: 0.05 }); },
    ping() { tone({ f: 1500, f2: 2000, t: 0.18, type: 'sine', v: 0.06 }); },
    achievement() { [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: 0.2, type: 'triangle', v: 0.1, delay: i * 0.09 })); },
    golden() { [1200, 1600, 2000, 2400, 2000, 2400, 2800].forEach((f, i) => tone({ f, t: 0.15, type: 'sine', v: 0.06, delay: i * 0.05 })); },
    goldenGet() { [660, 880, 1100, 1320, 1760, 2200].forEach((f, i) => tone({ f, t: 0.22, type: 'triangle', v: 0.1, delay: i * 0.06 })); noise(0.3, 0.08); },
    tick() { noise(0.015, 0.07); tone({ f: 2200, t: 0.02, type: 'square', v: 0.03 }); },
    reelStop() { tone({ f: 600, f2: 400, t: 0.08, type: 'square', v: 0.08 }); noise(0.03, 0.1); },
    win() { [784, 988, 1175, 1568].forEach((f, i) => tone({ f, t: 0.18, type: 'square', v: 0.07, delay: i * 0.08 })); },
    lose() { tone({ f: 330, f2: 200, t: 0.3, type: 'sawtooth', v: 0.04 }); },
    jackpot() {
      const seq = [523, 659, 784, 1047, 784, 1047, 1319, 1047, 1319, 1568, 2093];
      seq.forEach((f, i) => { tone({ f, t: 0.25, type: 'square', v: 0.08, delay: i * 0.1 }); tone({ f: f / 2, t: 0.25, type: 'triangle', v: 0.06, delay: i * 0.1 }); });
      for (let i = 0; i < 8; i++) noise(0.1, 0.06, 1.2 + i * 0.12);
    },
    prestige() { [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, t: 0.5, type: 'triangle', v: 0.08, delay: i * 0.1 })); },
    bubble() { tone({ f: 1400, f2: 700, t: 0.12, type: 'sine', v: 0.12 }); noise(0.03, 0.06); },
    chestHit() { noise(0.05, 0.12); tone({ f: 180, f2: 90, t: 0.1, type: 'square', v: 0.08 }); },
    chestBreak() { noise(0.3, 0.15); [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ f, t: 0.25, type: 'square', v: 0.07, delay: 0.05 + i * 0.07 })); },
    thiefSpawn() { tone({ f: 500, f2: 250, t: 0.35, type: 'sawtooth', v: 0.06 }); tone({ f: 500, f2: 250, t: 0.35, type: 'sawtooth', v: 0.06, delay: 0.4 }); },
    thiefCaught() { tone({ f: 1800, f2: 2600, t: 0.15, type: 'sine', v: 0.1 }); [880, 1100, 1320].forEach((f, i) => tone({ f, t: 0.15, type: 'triangle', v: 0.08, delay: 0.15 + i * 0.07 })); },
    thiefEscape() { tone({ f: 300, f2: 120, t: 0.6, type: 'sawtooth', v: 0.05 }); },
    droneSpawn() { for (let i = 0; i < 6; i++) tone({ f: 700 + i * 120, t: 0.06, type: 'square', v: 0.03, delay: i * 0.07 }); },
    droneHit() { tone({ f: 2400, f2: 200, t: 0.25, type: 'sawtooth', v: 0.08 }); noise(0.2, 0.1); },
    feverStart() { [440, 554, 659, 880, 659, 880, 1109, 1319].forEach((f, i) => tone({ f, t: 0.18, type: 'square', v: 0.08, delay: i * 0.08 })); noise(0.4, 0.08, 0.6); },
    feverCoin(i) { tone({ f: 1000 + (i % 8) * 120, f2: 1400 + (i % 8) * 120, t: 0.08, type: 'triangle', v: 0.08 }); },
    sweet() { tone({ f: 1760, f2: 2640, t: 0.12, type: 'sine', v: 0.08 }); tone({ f: 2200, t: 0.08, type: 'sine', v: 0.05, delay: 0.06 }); },
    arrive() { [392, 494, 587, 784, 988, 1175, 1568].forEach((f, i) => { tone({ f, t: 0.6, type: 'triangle', v: 0.09, delay: i * 0.11 }); tone({ f: f / 2, t: 0.6, type: 'sine', v: 0.06, delay: i * 0.11 }); }); noise(0.5, 0.06, 0.2); },
    blackhole() { tone({ f: 80, f2: 40, t: 1.2, type: 'sawtooth', v: 0.12 }); tone({ f: 160, f2: 60, t: 1.2, type: 'square', v: 0.05, delay: 0.1 }); noise(0.8, 0.05); },
    slingshot() { tone({ f: 200, f2: 2400, t: 0.5, type: 'sawtooth', v: 0.08 }); [1200, 1600, 2000, 2400].forEach((f, i) => tone({ f, t: 0.15, type: 'square', v: 0.06, delay: 0.4 + i * 0.06 })); },
    suckedIn() { tone({ f: 600, f2: 40, t: 1.0, type: 'sawtooth', v: 0.1 }); noise(0.6, 0.1, 0.2); },
    ending() { [262, 330, 392, 523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => { tone({ f, t: 1.2, type: 'triangle', v: 0.07, delay: i * 0.22 }); tone({ f: f * 1.5, t: 1.2, type: 'sine', v: 0.03, delay: i * 0.22 + 0.1 }); }); },
    countdown() { tone({ f: 880, t: 0.12, type: 'square', v: 0.08 }); },
    liftoff() { tone({ f: 120, f2: 900, t: 1.4, type: 'sawtooth', v: 0.1 }); tone({ f: 60, f2: 400, t: 1.4, type: 'square', v: 0.06 }); for (let i = 0; i < 12; i++) noise(0.12, 0.1, i * 0.1); [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: 0.3, type: 'triangle', v: 0.08, delay: 1.0 + i * 0.08 })); },
    event() { tone({ f: 660, t: 0.12, type: 'sine', v: 0.08 }); tone({ f: 990, t: 0.18, type: 'sine', v: 0.08, delay: 0.14 }); },
    gift() { [988, 1319, 1568, 1976].forEach((f, i) => tone({ f, t: 0.3, type: 'sine', v: 0.09, delay: i * 0.1 })); },
  };
})();

// ------------------------------------------------------------------
// Particles & visual FX
// ------------------------------------------------------------------
const canvas = $('fx'), cx = canvas.getContext('2d');
let parts = [];
const COIN_COLORS = ['#ffd700', '#ffcc33', '#ffe27a', '#ffb347', '#fff2b0'];
const CONFETTI = ['#ff5c7a', '#5cf28a', '#35c9ff', '#ffcc33', '#ff9cf2', '#ffffff'];
const FLAME_COLORS = ['#ffcc33', '#ff8a00', '#ff3d00', '#fff2b0', '#ffd700'];
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();

function burst(x, y, n, opts = {}) {
  const spread = opts.spread || 8, colors = opts.colors || COIN_COLORS;
  if (parts.length > 900) return;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), sp = rand(0.3, 1) * spread;
    parts.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - spread * 0.6,
      r: rand(2.5, opts.big ? 8 : 5), life: 1, decay: rand(0.012, 0.025),
      color: colors[(Math.random() * colors.length) | 0], rot: rand(0, 6.28), vr: rand(-0.2, 0.2), rect: !!opts.rect,
    });
  }
}
function drawParticles(dt) {
  cx.clearRect(0, 0, canvas.width, canvas.height);
  const k = dt * 60;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.vy += 0.45 * k; p.x += p.vx * k; p.y += p.vy * k; p.life -= p.decay * k; p.rot += p.vr * k;
    if (p.life <= 0 || p.y > canvas.height + 20) { parts.splice(i, 1); continue; }
    cx.globalAlpha = Math.max(0, p.life);
    cx.fillStyle = p.color;
    if (p.rect) {
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); cx.restore();
    } else {
      cx.beginPath(); cx.ellipse(p.x, p.y, p.r, p.r * Math.abs(Math.cos(p.rot)) * 0.6 + p.r * 0.4, 0, 0, 6.29); cx.fill();
    }
  }
  cx.globalAlpha = 1;
}
let floatCount = 0;
function floatText(x, y, text, cls = '') {
  if (floatCount > 70) return;
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.textContent = text;
  el.style.left = (x + rand(-18, 18)) + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  floatCount++;
  el.addEventListener('animationend', () => { el.remove(); floatCount--; });
}
function shake() { document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }
function toast(title, body, gold = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (gold ? ' gold' : '');
  el.innerHTML = `<b></b><span></span>`;
  el.querySelector('b').textContent = title;
  el.querySelector('span').textContent = body;
  const wrap = $('toasts');
  while (wrap.children.length >= 4) wrap.firstElementChild.remove();
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 4100);
}
function centerOf(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

// ------------------------------------------------------------------
// Economy
// ------------------------------------------------------------------
function recompute() {
  const achCount = Object.keys(state.achievements).length;
  const streakBonus = Math.min(state.dailyStreak, 7) * 0.02;
  const pk = (id) => state.perks[id] || 0;
  const globalMult = (1 + achCount * 0.01) * (1 + state.diamonds * 0.02) * (1 + streakBonus) * Math.pow(1.15, pk('prod')) * (1 + (state.permBonus || 0));
  params = { ...DEFAULT_PARAMS };
  SPECIALS.forEach((u) => { if (state.upgrades[u.id]) Object.assign(params, u.effect); });
  // planetary relics
  params.critChance += 0.03 * pk('crit');
  params.comboWindow += 0.25 * pk('combo');
  params.feverDur *= Math.pow(1.3, pk('fever'));
  params.goldenFreq *= Math.pow(1.3, pk('golden'));
  params.launchDiscount *= Math.pow(0.8, pk('fuel'));
  params.throttleMax += pk('throttle');
  params.offline += 0.25 * pk('offline');
  params.bubbleFreq *= Math.pow(1.4, pk('pods'));
  params.goldenDur *= Math.pow(1.25, pk('buffs'));
  params.landingMult *= Math.pow(3, pk('landing'));
  if (pk('slots')) params.pairPay = 2;

  let cps = 0;
  BUILDINGS.forEach((b) => {
    let mult = 1;
    TIER_REQ.forEach((_, t) => { if (state.upgrades[`${b.id}_${t}`]) mult *= 2; });
    mult *= Math.pow(2, pk('bld_' + b.id));
    const each = b.baseCps * mult * globalMult;
    cache.buildingCps[b.id] = each;
    cps += each * (state.buildings[b.id] || 0);
  });
  let clickMult = 1, cpsPct = 0;
  CLICK_UPG.forEach((_, i) => { if (state.upgrades['click_' + i]) { clickMult *= 2; if (i >= 2) cpsPct += 0.01; } });
  clickMult *= Math.pow(1.5, pk('click'));
  cache.cps = cps;
  cache.globalMult = globalMult;
  cache.clickBase = clickMult * globalMult + cps * cpsPct;
  uiDirty = true;
}
const CPS_BUFFS = ['frenzy', 'fever', 'rocket', 'slingshot'];
function buffMult(type) { let m = 1; buffs.forEach((b) => { if (b.type === type) m *= b.mult; }); return m; }
function cpsBuffMult() { let m = 1; buffs.forEach((b) => { if (CPS_BUFFS.includes(b.type)) m *= b.mult; }); return m; }
function currentCps() { return cache.cps * cpsBuffMult(); }
function clickPower() { return cache.clickBase * buffMult('clickfrenzy'); }
function comboMult() { return 1 + (Math.min(combo, 100) / 100) * (params.comboMaxMult - 1); }
function costFor(b, n) {
  const owned = state.buildings[b.id] || 0;
  return b.baseCost * Math.pow(COST_GROWTH, owned) * (Math.pow(COST_GROWTH, n) - 1) / (COST_GROWTH - 1);
}
function gain(amount) {
  if (!(amount > 0)) return;
  state.coins += amount; state.totalEarned += amount; state.runEarned += amount;
}
function addBuff(type, label, mult, seconds) {
  const existing = buffs.find((b) => b.type === type);
  if (existing) { existing.remaining = Math.max(existing.remaining, seconds); existing.total = existing.remaining; }
  else buffs.push({ type, label, mult, remaining: seconds, total: seconds });
  renderBuffs();
}
function pendingDiamonds() {
  const total = Math.floor(Math.sqrt(Math.max(0, state.totalEarned) / 1e6));
  return Math.max(0, total - state.diamonds);
}
function tier() {
  const t = state.totalEarned;
  return t >= 1e12 ? 5 : t >= 1e9 ? 4 : t >= 1e7 ? 3 : t >= 1e5 ? 2 : t >= 1e3 ? 1 : 0;
}
function maxOwnedIdx() { let m = -1; BUILDINGS.forEach((b, i) => { if ((state.buildings[b.id] || 0) > 0) m = i; }); return m; }
function buildingVisibility(i) {
  const m = maxOwnedIdx();
  if (i <= m + 1) return 'shown';
  if (i === m + 2) return 'mystery';
  return 'hidden';
}
function availableUpgrades() {
  return UPGRADES.filter((u) => !state.upgrades[u.id] && u.req(state)).sort((a, b) => a.cost - b.cost);
}

// ------------------------------------------------------------------
// Clicking
// ------------------------------------------------------------------
const coinEl = $('coin');
function doClick(x, y, opts = {}) {
  sfx.ensure();
  const now = performance.now();
  combo = (now - lastClickTime <= params.comboWindow * 1000) ? combo + 1 : 1;
  lastClickTime = now;
  if (combo > state.maxCombo) state.maxCombo = combo;

  let amount = clickPower() * comboMult();
  const isCrit = !!opts.forceCrit || Math.random() < params.critChance;
  if (isCrit) { amount *= params.critMult; state.crits++; }
  gain(amount);
  state.totalClicks++;
  addFever((1 + Math.min(combo, 100) / 50) * params.feverRate * (opts.forceCrit ? 3 : 1));
  // thrust: clicks push the ship forward (10 s of income-equivalent per click value)
  if (inFlight()) { addDistance(amount * CLICK_THRUST * warpFactor() * legBoost()); bumpThrottle(); }
  if (activeBlackhole) blackholeEscapeClick();

  floatText(x, y - 20, (isCrit ? 'CRIT! +' : '+') + fmt(amount), isCrit ? 'crit' : '');
  burst(x, y + 90, isCrit ? 45 : 8 + Math.min(combo, 40) / 4, { spread: isCrit ? 16 : 7, big: isCrit, colors: isCrit ? COIN_COLORS : FLAME_COLORS });
  coinEl.classList.remove('pop'); void coinEl.offsetWidth; coinEl.classList.add('pop');
  if (isCrit) shake();
  sfx.click(combo, isCrit);
}
coinEl.addEventListener('pointerdown', (e) => { e.preventDefault(); doClick(e.clientX, e.clientY); });
coinEl.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('keydown', (e) => {
  if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && $('modal').classList.contains('hidden')) {
    e.preventDefault(); const c = centerOf(coinEl); doClick(c.x + rand(-40, 40), c.y + rand(-40, 40));
  }
});
document.addEventListener('pointerdown', () => sfx.ensure(), { passive: true });

// ------------------------------------------------------------------
// Buying
// ------------------------------------------------------------------
function buyBuilding(id, rowEl) {
  const b = BUILDINGS.find((x) => x.id === id);
  const n = state.buyAmt, cost = costFor(b, n);
  if (state.coins < cost) { sfx.deny(); return; }
  state.coins -= cost;
  state.buildings[id] = (state.buildings[id] || 0) + n;
  recompute(); sfx.buy();
  const c = centerOf(rowEl);
  floatText(c.x, c.y, `+${n} ${b.icon}`, 'big');
  burst(c.x, c.y, 14, { spread: 6 });
  rowEl.classList.remove('flash'); void rowEl.offsetWidth; rowEl.classList.add('flash');
  checkAchievements();
}
function buyUpgrade(u, el) {
  if (state.upgrades[u.id]) return;
  if (state.coins < u.cost) { sfx.deny(); return; }
  state.coins -= u.cost;
  state.upgrades[u.id] = 1;
  recompute(); sfx.buy();
  const c = el ? centerOf(el) : centerOf(coinEl);
  burst(c.x, c.y, 30, { spread: 9, colors: CONFETTI, rect: true });
  toast(`${u.icon} ${u.name}`, u.desc);
  hideTooltip();
  checkAchievements();
}

// ------------------------------------------------------------------
// Arena: dynamic clickables (bubbles, chests, thieves, drones, fever rain)
// ------------------------------------------------------------------
const arena = $('arena');
let ents = [];
const timers = { bubble: 0, chest: 0, thief: 0, drone: 0, blackhole: 0 };
function arenaSize() { const r = arena.getBoundingClientRect(); return { w: r.width, h: r.height }; }
function incomeReward(seconds, clicksEq, min = 10) { return Math.max(cache.cps * seconds, cache.clickBase * clicksEq, min); }
function pickWeighted(list) { const tot = list.reduce((a, b) => a + b.w, 0); let r = Math.random() * tot; for (const it of list) { r -= it.w; if (r < 0) return it; } return list[0]; }

function makeEnt(cls, html, x, y) {
  const el = document.createElement('div');
  el.className = 'ent ' + cls; el.innerHTML = html;
  arena.appendChild(el);
  const e = { el, x, y, t: 0, dead: false };
  el.style.left = x + 'px'; el.style.top = y + 'px';
  ents.push(e);
  return e;
}
function killEnt(e, pop = true) {
  if (e.dead) return; e.dead = true;
  if (pop) { e.el.classList.add('pop-out'); setTimeout(() => e.el.remove(), 400); } else e.el.remove();
}
function onEntClick(e, fn) {
  e.el.addEventListener('pointerdown', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (e.dead) return; sfx.ensure(); fn(ev.clientX, ev.clientY); });
  e.el.addEventListener('contextmenu', (ev) => ev.preventDefault());
}

// --- Prize bubbles: drift upward, pop for a random prize
const BUBBLE_KINDS = [
  { k: 'coins', icon: '💰', w: 50 }, { k: 'combo', icon: '⚡', w: 22 }, { k: 'rocket', icon: '🚀', w: 20 }, { k: 'gem', icon: '💎', w: 8 },
];
function spawnBubble(kind) {
  const { w, h } = arenaSize(); if (w < 100) return;
  kind = kind || pickWeighted(BUBBLE_KINDS);
  const e = makeEnt('bubble' + (kind.k === 'gem' ? ' rare' : ''), `<div class="inner">${kind.icon}</div>`, rand(20, w - 90), h + 10);
  e.vy = -rand(38, 55); e.phase = rand(0, 6.28); e.amp = rand(15, 40); e.baseX = e.x;
  e.update = (dt) => {
    e.t += dt; e.y += e.vy * dt; e.x = e.baseX + Math.sin(e.t * 1.6 + e.phase) * e.amp;
    if (e.y < -90) killEnt(e, false);
  };
  onEntClick(e, (px, py) => {
    state.bubbles++; sfx.bubble(); killEnt(e);
    burst(px, py, 18, { spread: 7, colors: ['#bfe9ff', '#ffffff', '#7fd4ff'] });
    if (kind.k === 'coins') { const amt = incomeReward(45, 40); gain(amt); floatText(px, py, '+' + fmt(amt), 'big'); }
    else if (kind.k === 'combo') { combo = Math.max(combo, 1) + 25; lastClickTime = performance.now(); if (combo > state.maxCombo) state.maxCombo = combo; floatText(px, py, 'COMBO +25!', 'crit'); }
    else if (kind.k === 'rocket') { addBuff('rocket', '🚀 ROCKET ×2 income', 2, 20 * params.goldenDur); floatText(px, py, 'ROCKET ×2!', 'crit'); }
    else { const amt = incomeReward(300, 300, 100); gain(amt); floatText(px, py, 'GEM! +' + fmt(amt), 'crit'); shake(); }
    checkAchievements();
  });
}

// --- Asteroid: needs many rapid clicks to mine before it drifts away
function spawnChest() {
  const { w, h } = arenaSize(); if (w < 100) return;
  const hp = Math.max(8, Math.round(25 * params.chestHp));
  const e = makeEnt('chest', `<div class="tag">MINE IT!</div><div class="inner">🪨</div><div class="hp"><i></i></div><div class="timer"></div>`, rand(20, w - 90), rand(60, h - 160));
  e.hp = hp; e.maxHp = hp; e.life = 9;
  const bar = e.el.querySelector('.hp i'), timerEl = e.el.querySelector('.timer');
  e.update = (dt) => {
    e.life -= dt; timerEl.textContent = Math.ceil(e.life) + 's';
    if (e.life <= 0) { killEnt(e, false); toast('🪨 It drifted away!', 'The asteroid escaped. Mine faster next time.'); }
  };
  onEntClick(e, (px, py) => {
    e.hp--; sfx.chestHit();
    bar.style.width = (e.hp / e.maxHp) * 100 + '%';
    e.el.classList.remove('hit'); void e.el.offsetWidth; e.el.classList.add('hit');
    burst(px, py, 4, { spread: 4, colors: ['#ffcc33', '#c98a4a', '#8a8a9a'] });
    if (e.hp <= 0) {
      state.chests++; sfx.chestBreak(); shake(); killEnt(e);
      const amt = incomeReward(180, 200, 50); gain(amt);
      floatText(px, py, 'GOLD ORE! +' + fmt(amt), 'crit');
      burst(px, py, 120, { spread: 16, big: true });
      if (Math.random() < 0.3) { for (let i = 0; i < 3; i++) setTimeout(() => spawnBubble(), i * 300); toast('🪨 Bonus!', 'The asteroid was hollow and full of supply pods!'); }
      checkAchievements();
    }
  });
}

// --- Space pirate: grabs some of your coins and runs. Catch him for 3x back.
function spawnThief() {
  const { w, h } = arenaSize(); if (w < 100 || state.coins < 50) return;
  const stolen = Math.max(1, Math.min(state.coins * 0.05, incomeReward(30, 30, 1)));
  state.coins -= stolen;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const e = makeEnt('thief' + (dir < 0 ? ' flip' : ''), `<div class="tag">PIRATE! -${fmt(stolen)}</div><div class="inner">🏴‍☠️<span class="bag">💰</span></div>`, dir > 0 ? -70 : w + 20, rand(40, h - 120));
  e.vx = dir * (w + 100) / (7 / params.thiefSpeed);
  const c0 = centerOf(coinEl); floatText(c0.x, c0.y - 60, '-' + fmt(stolen) + ' stolen!', 'crit');
  sfx.thiefSpawn();
  e.update = (dt) => {
    e.t += dt; e.x += e.vx * dt;
    if ((dir > 0 && e.x > w + 40) || (dir < 0 && e.x < -90)) { killEnt(e, false); state.thievesEscaped++; sfx.thiefEscape(); toast('🏴‍☠️ They got away!', `The pirates escaped with ${fmt(stolen)}. Catch the next crew.`); }
  };
  onEntClick(e, (px, py) => {
    state.thieves++; sfx.thiefCaught(); killEnt(e);
    const amt = stolen * 3; gain(amt);
    floatText(px, py, 'BOUNTY! +' + fmt(amt), 'crit');
    burst(px, py, 50, { spread: 12 });
    checkAchievements();
  });
}

// --- Black hole: a gravity well grabs the ship. Click the ship N times before time runs out.
let activeBlackhole = null;
function spawnBlackhole() {
  const { w, h } = arenaSize(); if (w < 100 || activeBlackhole || feverActive) return;
  const need = 30, life = 10;
  const side = Math.random() < 0.5 ? 0 : 1;
  const e = makeEnt('blackhole', `<div class="tag">GRAVITY WELL! CLICK THE SHIP ×${need}</div><div class="ring"></div><div class="inner">🕳️</div><div class="hp"><i></i></div><div class="timer"></div>`, side ? w - 130 : 30, rand(80, h - 220));
  e.need = need; e.clicks = 0; e.life = life;
  const bar = e.el.querySelector('.hp i'), timerEl = e.el.querySelector('.timer');
  activeBlackhole = e;
  document.body.classList.add('gravity');
  sfx.blackhole(); shake();
  toast('🕳️ GRAVITY WELL!', `A black hole has you. Click the ship ${need} times in ${life} seconds to slingshot out!`);
  e.update = (dt) => {
    e.life -= dt; timerEl.textContent = Math.ceil(e.life) + 's';
    bar.style.width = (e.clicks / e.need) * 100 + '%';
    if (e.life <= 0) {
      const lost = state.coins * 0.1;
      state.coins -= lost; state.blackholeFails++;
      const c0 = centerOf(coinEl); floatText(c0.x, c0.y - 60, '-' + fmt(lost) + ' sucked in!', 'crit');
      sfx.suckedIn(); shake(); toast('🕳️ Pulled in!', `The black hole ate ${fmt(lost)} coins. Click faster next time.`);
      endBlackhole(e);
    }
  };
  onEntClick(e, () => { floatText(centerOf(e.el).x, centerOf(e.el).y - 70, 'Click the SHIP!', 'small'); });
}
function blackholeEscapeClick() {
  const e = activeBlackhole; if (!e || e.dead) return;
  e.clicks++;
  if (e.clicks >= e.need) {
    state.blackholes++;
    const amt = incomeReward(120, 100, 40); gain(amt);
    addBuff('slingshot', '🌀 SLINGSHOT ×5 income', 5, 20 * params.goldenDur);
    const c = centerOf(e.el); burst(c.x, c.y, 120, { spread: 18, colors: ['#c080ff', '#ff60c0', '#ffffff'], rect: true });
    floatText(c.x, c.y, 'SLINGSHOT! +' + fmt(amt), 'crit');
    sfx.slingshot(); shake();
    toast('🌀 Slingshot!', `You whipped around the black hole. Income ×5 for ${Math.round(20 * params.goldenDur)}s and +${fmt(amt)}.`, true);
    endBlackhole(e);
    checkAchievements();
  }
}
function endBlackhole(e) { killEnt(e); activeBlackhole = null; document.body.classList.remove('gravity'); }

// --- Drone: fast flyover with a prize. Rare golden drone = huge payout.
function spawnDrone() {
  const { w, h } = arenaSize(); if (w < 100) return;
  const gold = Math.random() < 0.08;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const e = makeEnt('drone' + (gold ? ' gold' : ''), `<div class="inner">🛸</div><div class="beam"></div>`, dir > 0 ? -70 : w + 20, rand(30, Math.max(60, h * 0.25)));
  e.vx = dir * (w + 100) / (gold ? 3.2 : 4.5); e.baseY = e.y;
  sfx.droneSpawn();
  e.update = (dt) => { e.t += dt; e.x += e.vx * dt; e.y = e.baseY + Math.sin(e.t * 4) * 30; if ((dir > 0 && e.x > w + 40) || (dir < 0 && e.x < -90)) killEnt(e, false); };
  onEntClick(e, (px, py) => {
    state.drones++; sfx.droneHit(); killEnt(e);
    burst(px, py, 60, { spread: 13, colors: CONFETTI, rect: true });
    if (gold) { const amt = incomeReward(600, 800, 500); gain(amt); floatText(px, py, 'GOLDEN DRONE! +' + fmt(amt), 'crit'); shake(); toast('🛸 Golden drone!', `+${fmt(amt)} coins!`, true); }
    else {
      const r = Math.random();
      if (r < 0.5) { const amt = incomeReward(120, 120, 30); gain(amt); floatText(px, py, 'CARGO! +' + fmt(amt), 'big'); }
      else if (r < 0.8) { addBuff('clickfrenzy', '👆 CLICK FRENZY ×77', 77, 8 * params.goldenDur); floatText(px, py, 'CLICK FRENZY!', 'crit'); }
      else { addBuff('frenzy', '🔥 FRENZY ×7 income', 7, 15 * params.goldenDur); floatText(px, py, 'FRENZY!', 'crit'); }
    }
    checkAchievements();
  });
}

// --- Fever mode: gauge fills with clicks; when full, coins rain from the top
let feverGauge = 0, feverActive = false, feverTimer = 0, feverRainAcc = 0, feverIdle = 0, feverCoinIdx = 0;
function addFever(n) { if (feverActive) return; feverIdle = 0; feverGauge = Math.min(100, feverGauge + n); if (feverGauge >= 100) startFever(); }
function startFever() {
  feverActive = true; feverTimer = 12 * params.feverDur; feverGauge = 100; state.fevers++;
  document.body.classList.add('fever'); $('fever-wrap').classList.add('active');
  addBuff('fever', '🌡️ FEVER ×3 income', 3, feverTimer);
  sfx.feverStart(); shake();
  const c = centerOf(coinEl); burst(c.x, c.y, 150, { spread: 18, big: true });
  floatText(c.x, c.y - 120, 'FEVER MODE!', 'crit');
  toast('🌡️ FEVER MODE!', 'Coins are raining. Grab as many as you can!', true);
  checkAchievements();
}
function endFever() {
  feverActive = false; feverGauge = 0; feverRainAcc = 0;
  document.body.classList.remove('fever'); $('fever-wrap').classList.remove('active');
}
function spawnFeverCoin() {
  const { w, h } = arenaSize(); if (w < 100) return;
  const e = makeEnt('fcoin', `<div class="inner">🪙</div>`, rand(10, w - 50), -50);
  e.vy = rand(120, 200); e.vx = rand(-25, 25); e.idx = feverCoinIdx++;
  e.update = (dt) => { e.y += e.vy * dt; e.x += e.vx * dt; if (e.y > h + 40) killEnt(e, false); };
  onEntClick(e, (px, py) => {
    killEnt(e); state.feverCoins++; sfx.feverCoin(e.idx);
    const amt = Math.max(clickPower() * 12, cache.cps, 5); gain(amt);
    floatText(px, py, '+' + fmt(amt), 'big'); burst(px, py, 10, { spread: 6 });
  });
}

function updateArena(dt) {
  for (const e of ents) if (!e.dead && e.update) e.update(dt);
  ents = ents.filter((e) => !e.dead);
  for (const e of ents) { e.el.style.left = e.x + 'px'; e.el.style.top = e.y + 'px'; }

  const active = state.totalClicks >= 10 || state.totalEarned >= 30;
  if (active) {
    timers.bubble -= dt; if (timers.bubble <= 0) { spawnBubble(); timers.bubble = rand(18, 40) / params.bubbleFreq; }
    timers.chest -= dt; if (timers.chest <= 0 && state.totalClicks >= 40) { spawnChest(); timers.chest = rand(110, 220); }
    timers.thief -= dt; if (timers.thief <= 0 && cache.cps > 0 && state.totalEarned >= 500) { spawnThief(); timers.thief = rand(90, 200); }
    timers.drone -= dt; if (timers.drone <= 0 && state.totalEarned >= 2000) { spawnDrone(); timers.drone = rand(60, 150) / params.droneFreq; }
    timers.blackhole -= dt; if (timers.blackhole <= 0 && state.stageIdx >= 11) { spawnBlackhole(); timers.blackhole = rand(150, 320); }
  }

  if (feverActive) {
    feverTimer -= dt; feverRainAcc += dt * 5;
    while (feverRainAcc >= 1) { feverRainAcc -= 1; spawnFeverCoin(); }
    $('fever-bar').style.width = clamp((feverTimer / (12 * params.feverDur)) * 100, 0, 100) + '%';
    if (feverTimer <= 0) endFever();
  } else {
    feverIdle += dt;
    if (feverIdle > 2 && feverGauge > 0) feverGauge = Math.max(0, feverGauge - 4 * dt);
    $('fever-bar').style.width = feverGauge + '%';
    $('fever-wrap').classList.toggle('hot', feverGauge >= 70);
  }
}

// --- Sweet spot: a sparkle that hops around the coin; hitting it is a guaranteed crit
const sweet = $('sweet-spot');
let sweetTimer = 2.5;
function moveSweet() {
  const size = coinEl.clientWidth || 230;
  const R = size / 2 - 34, a = rand(0, 6.28), d = rand(0.2, 1) * R;
  sweet.style.left = (50 + (Math.cos(a) * d / size) * 100) + '%';
  sweet.style.top = (50 + (Math.sin(a) * d / size) * 100) + '%';
}
sweet.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  state.sweetHits++; sfx.sweet();
  doClick(e.clientX, e.clientY, { forceCrit: true });
  moveSweet(); sweetTimer = 2.5;
});

// ------------------------------------------------------------------
// Golden coins (random reward events)
// ------------------------------------------------------------------
function scheduleGolden() { goldenTimer = rand(75, 200) / params.goldenFreq; }
function spawnGolden() {
  const layer = $('golden-layer');
  if (layer.children.length >= 2) return;
  const el = document.createElement('div');
  el.className = 'golden'; el.textContent = '☄️';
  el.style.left = rand(60, innerWidth - 120) + 'px';
  el.style.top = rand(110, innerHeight - 140) + 'px';
  layer.appendChild(el);
  sfx.golden();
  const life = 13000 * params.goldenLife;
  const fadeT = setTimeout(() => el.classList.add('fading'), life - 1500);
  const killT = setTimeout(() => el.remove(), life);
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault(); clearTimeout(fadeT); clearTimeout(killT); el.remove();
    collectGolden(e.clientX, e.clientY);
  });
}
function collectGolden(x, y) {
  state.goldenClicked++;
  sfx.goldenGet();
  burst(x, y, 70, { spread: 14, big: true });
  const r = Math.random();
  const dur = params.goldenDur;
  if (r < 0.42) {
    addBuff('frenzy', '🔥 FRENZY ×7 income', 7, 30 * dur);
    floatText(x, y, 'FRENZY! ×7 income', 'crit');
    toast('🔥 Frenzy!', `Income ×7 for ${Math.round(30 * dur)} seconds. Go!`, true);
  } else if (r < 0.68) {
    addBuff('clickfrenzy', '👆 CLICK FRENZY ×77', 77, 12 * dur);
    floatText(x, y, 'CLICK FRENZY ×77!', 'crit');
    toast('👆 Click Frenzy!', `Clicks ×77 for ${Math.round(12 * dur)} seconds. CLICK CLICK CLICK!`, true);
  } else if (r < 0.95) {
    const amt = Math.max(Math.min(state.coins * 0.15, cache.cps * 60 * 15), cache.cps * 60, clickPower() * 30, 25);
    gain(amt);
    floatText(x, y, 'LUCKY! +' + fmt(amt), 'crit');
    toast('🍀 Lucky!', `+${fmt(amt)} coins out of nowhere.`, true);
  } else {
    const amt = Math.max(cache.cps * 3600, state.coins * 0.5, clickPower() * 500, 250);
    gain(amt);
    floatText(x, y, 'JACKPOT! +' + fmt(amt), 'crit');
    shake();
    burst(x, y, 150, { spread: 20, colors: CONFETTI, rect: true });
    toast('💎 GOLDEN JACKPOT!', `+${fmt(amt)} coins. That's an hour of income!`, true);
  }
  scheduleGolden();
  checkAchievements();
}

// ------------------------------------------------------------------
// Slot machine
// ------------------------------------------------------------------
const SYMBOLS = [
  { s: '🍒', w: 30, pay: 3 }, { s: '🍋', w: 25, pay: 4 }, { s: '🔔', w: 20, pay: 6 },
  { s: '💰', w: 12, pay: 12 }, { s: '💎', w: 9, pay: 30 }, { s: '7️⃣', w: 4, pay: 100 },
];
const SYM_TOTAL = SYMBOLS.reduce((a, s) => a + s.w, 0);
function rollSymbol() { let r = Math.random() * SYM_TOTAL; for (const s of SYMBOLS) { r -= s.w; if (r < 0) return s; } return SYMBOLS[0]; }
function spinCost() { return Math.max(25, Math.round(cache.cps * 20 + cache.clickBase * 10)); }
const SLOT_UNLOCK = 5000;
function slotUnlocked() { return state.totalEarned >= SLOT_UNLOCK; }

function spin() {
  if (slotSpinning || !slotUnlocked()) return;
  const bet = spinCost();
  if (state.coins < bet) { sfx.deny(); $('slot-result').textContent = 'Not enough coins!'; $('slot-result').className = 'slot-result lose'; return; }
  sfx.ensure();
  state.coins -= bet; state.spins++; state.slotSpent += bet;
  slotSpinning = true;
  $('spin-btn').disabled = true;
  const resEl = $('slot-result'); resEl.textContent = 'Spinning...'; resEl.className = 'slot-result';
  const reels = [0, 1, 2].map((i) => $('reel' + i));
  const result = [rollSymbol(), rollSymbol(), rollSymbol()];
  reels.forEach((r) => { r.classList.remove('win', 'stop', 'tense'); r.classList.add('spinning'); });

  const timers = reels.map((r) => setInterval(() => { r.firstElementChild.textContent = rollSymbol().s; sfx.tick(); }, 70));
  const nearMiss = result[0].s === result[1].s;
  const stopAt = [700, 1300, nearMiss ? 2900 : 1900];

  const stopReel = (i) => {
    clearInterval(timers[i]);
    const r = reels[i];
    r.classList.remove('spinning'); r.classList.add('stop');
    r.firstElementChild.textContent = result[i].s;
    sfx.reelStop();
    if (i === 1 && nearMiss) { reels[2].classList.add('tense'); resEl.textContent = 'Come on...'; }
  };
  stopAt.forEach((t, i) => setTimeout(() => stopReel(i), t));
  setTimeout(() => finishSpin(result, bet, reels), stopAt[2] + 250);
}
function finishSpin(result, bet, reels) {
  const [a, b, c] = result;
  const resEl = $('slot-result');
  const center = centerOf(reels[1]);
  let win = 0, msg = '', cls = '';
  reels[2].classList.remove('tense');
  if (a.s === b.s && b.s === c.s) {
    win = bet * a.pay;
    reels.forEach((r) => r.classList.add('win'));
    if (a.s === '7️⃣') {
      state.jackpots++; msg = '🎉 JACKPOT! +' + fmt(win); cls = 'jackpot';
      sfx.jackpot(); shake();
      burst(center.x, center.y, 250, { spread: 22, colors: CONFETTI, rect: true, big: true });
      toast('7️⃣ JACKPOT 7️⃣', `Triple sevens! +${fmt(win)} coins!`, true);
    } else {
      msg = `TRIPLE ${a.s}! +${fmt(win)}`; cls = 'win';
      sfx.win(); burst(center.x, center.y, 90, { spread: 14, colors: CONFETTI, rect: true });
    }
  } else if (a.s === b.s || b.s === c.s || a.s === c.s) {
    win = bet * params.pairPay;
    const pairSym = a.s === b.s ? a.s : b.s === c.s ? b.s : a.s;
    reels.forEach((r) => { if (r.firstElementChild.textContent === pairSym) r.classList.add('win'); });
    msg = `Pair! +${fmt(win)}`; cls = 'win';
    sfx.win(); burst(center.x, center.y, 30, { spread: 9 });
  } else {
    msg = ['So close!', 'Almost...', 'Next one!', 'Unlucky!', 'One more?'][(Math.random() * 5) | 0]; cls = 'lose';
    sfx.lose();
  }
  if (win > 0) { gain(win); state.slotWon += win; floatText(center.x, center.y - 40, '+' + fmt(win), win >= bet * 6 ? 'crit' : 'big'); }
  resEl.textContent = msg; resEl.className = 'slot-result ' + cls;
  slotSpinning = false; $('spin-btn').disabled = false;
  checkAchievements(); uiDirty = true;
}
$('spin-btn').addEventListener('click', spin);

// ------------------------------------------------------------------
// Achievements
// ------------------------------------------------------------------
function checkAchievements() {
  const unlocked = [];
  ACH.forEach((a) => {
    if (state.achievements[a.id]) return;
    let ok = false; try { ok = a.check(state); } catch (e) { ok = false; }
    if (ok) { state.achievements[a.id] = 1; unlocked.push(a); }
  });
  if (!unlocked.length) return;
  if (unlocked.length <= 2) unlocked.forEach((a) => toast(`🏆 ${a.name}`, `${a.desc}  (+1% production forever)`));
  else toast(`🏆 ${unlocked.length} trophies unlocked!`, unlocked.map((a) => a.name).join(', ') + `  (+${unlocked.length}% production forever)`);
  sfx.achievement();
  const c = centerOf(coinEl); burst(c.x, c.y, 40 + unlocked.length * 10, { spread: 12, colors: CONFETTI, rect: true });
  recompute(); renderAchievements();
}

// ------------------------------------------------------------------
// Prestige
// ------------------------------------------------------------------
function openPrestige() {
  const pend = pendingDiamonds();
  const nextNeed = Math.pow(state.diamonds + pend + 1, 2) * 1e6;
  const body = `
    <p>Dock at a station and sell the ship: coins, systems and upgrades go, and you get <b>💎 Diamonds</b> for a new ship.</p>
    <p class="dim">Each Diamond permanently boosts <b>all</b> production by 2% <b>and</b> makes the ship faster (warp ×${fmt(Math.pow(1 + (state.diamonds + pendingDiamonds()) * 0.1, 2))} after this). Distance travelled, trophies, stats and streaks are kept.</p>
    <div class="huge">+${pend} 💎</div>
    <p>You have <b>${state.diamonds} 💎</b> (+${state.diamonds * 2}% forever).</p>
    <p class="dim">${pend > 0 ? `After cashing out: <b>${state.diamonds + pend} 💎</b> = +${(state.diamonds + pend) * 2}% production.` : ''}
    Next Diamond at <b>${fmt(nextNeed)}</b> total coins earned (${fmt(Math.max(0, nextNeed - state.totalEarned))} to go).</p>`;
  showModal('💎 Cash Out', body, pend > 0 ? 'Cash Out & Reborn' : 'Not yet', () => {
    if (pend <= 0) return false;
    showModal('Are you sure?', `<p>You'll lose <b>${fmt(state.coins)}</b> coins and all ${totalBuildings(state)} buildings, but gain <b>+${pend} 💎</b> permanently.</p><p class="dim">Progress feels 2–5× faster after your first cash out.</p>`, 'Yes, do it!', () => { doPrestige(pend); return true; }, 'Cancel');
    return true;
  }, 'Close');
  if (pend <= 0) $('modal-ok').disabled = true;
}
function doPrestige(pend) {
  state.diamonds += pend; state.prestiges++;
  state.coins = 0; state.runEarned = 0; state.buildings = {}; state.upgrades = {};
  buffs = []; combo = 0;
  recompute(); buildBuildings(); renderBuffs();
  sfx.prestige(); shake();
  const c = centerOf(coinEl); burst(c.x, c.y, 200, { spread: 20, colors: CONFETTI, rect: true, big: true });
  toast('💎 Reborn!', `+${pend} Diamonds. Everything produces ${state.diamonds * 2}% more, forever.`, true);
  checkAchievements(); save();
}

// ------------------------------------------------------------------
// Daily gift & offline earnings
// ------------------------------------------------------------------
function todayStr() { return new Date().toDateString(); }
function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toDateString(); }
function dailyAvailable() { return state.lastDaily !== todayStr(); }
function claimDaily() {
  if (!dailyAvailable()) return;
  state.dailyStreak = state.lastDaily === yesterdayStr() ? state.dailyStreak + 1 : 1;
  state.lastDaily = todayStr();
  const days = Math.min(state.dailyStreak, 7);
  const reward = Math.max(cache.cps * 1800 * days, cache.clickBase * 250 * days, 100 * days);
  gain(reward);
  recompute(); sfx.gift();
  const c = centerOf($('daily-btn')); burst(c.x, c.y, 120, { spread: 16, colors: CONFETTI, rect: true });
  showModal('🎁 Daily Gift!', `
    <p>Day <b>${state.dailyStreak}</b> streak${state.dailyStreak > 1 ? ' — you came back!' : ''}</p>
    <div class="huge">+${fmt(reward)}</div>
    <p>Streak bonus: <b>+${days * 2}%</b> to all production.</p>
    <p class="dim">Come back tomorrow to keep the streak alive. Miss a day and it resets!</p>`, 'Nice!');
  checkAchievements();
}
function grantOffline(seconds) {
  const capped = Math.min(seconds, 8 * 3600);
  const earned = cache.cps * capped * params.offline;
  if (earned <= 0) return;
  gain(earned);
  showModal('👋 Welcome back!', `
    <p>You were away for <b>${fmtTime(seconds)}</b>.</p>
    <p>Your buildings kept working:</p>
    <div class="huge">+${fmt(earned)}</div>
    <p class="dim">${params.offline < 1 ? 'Earning 50% while away. The Night Shift upgrade raises it to 100%.' : 'Earning 100% while away thanks to Night Shift.'}${seconds > 8 * 3600 ? ' (Offline earnings cap at 8 hours.)' : ''}</p>`, 'Collect!');
}

// ------------------------------------------------------------------
// Modal
// ------------------------------------------------------------------
let modalCb = null;
function showModal(title, html, okText = 'Awesome!', onOk = null, secondaryText = null) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  const ok = $('modal-ok'); ok.textContent = okText; ok.disabled = false;
  const sec = $('modal-secondary');
  if (secondaryText) { sec.textContent = secondaryText; sec.classList.remove('hidden'); } else sec.classList.add('hidden');
  modalCb = onOk;
  $('modal').classList.remove('hidden');
}
function closeModal() { $('modal').classList.add('hidden'); modalCb = null; }
$('modal-ok').addEventListener('click', () => {
  const cb = modalCb;
  if (!cb) { closeModal(); return; }
  const titleBefore = $('modal-title').textContent;
  const r = cb();
  // If the callback opened another modal (title changed), keep it open. Otherwise close.
  if (r === true && $('modal-title').textContent !== titleBefore) return;
  closeModal();
});
$('modal-secondary').addEventListener('click', closeModal);

// ------------------------------------------------------------------
// Journey: distance, arrivals, ending, starfield, share card
// ------------------------------------------------------------------
function warpFactor() { return Math.pow(1 + state.diamonds * 0.1, 2) * Math.pow(3, state.ngPlus) * params.warp; }
function currentMilestone() { return MILESTONES[Math.min(state.stageIdx, MILESTONES.length - 1)]; }
function nextMilestone() { return MILESTONES[state.stageIdx + 1] || null; }
function legBoost() { const n = nextMilestone(); return n ? (n.boost || 1) : 1; }
function launchCost() { return nextMilestone() ? 12 * Math.pow(5.5, state.stageIdx + 1) * params.launchDiscount : Infinity; }
function inFlight() { return state.phase === 'flight'; }
let speedEma = 0, distAcc = 0, arrivalShowing = false, throttle = 0, throttleIdle = 0, launching = false;
function throttleMult() { return 1 + throttle; }
function addDistance(km) { if (!(km > 0)) return; state.distance += km; distAcc += km; }
function bumpThrottle() { if (!inFlight()) return; throttleIdle = 0; throttle = Math.min(params.throttleMax - 1, throttle + 0.12); }
function tickJourney(dt) {
  if (inFlight()) {
    addDistance(currentCps() * KM_PER_COIN * warpFactor() * legBoost() * throttleMult() * dt);
    throttleIdle += dt; if (throttleIdle > 0.8 && throttle > 0) throttle = Math.max(0, throttle - 0.6 * dt);
    tickEvents(dt);
    checkArrivals();
  } else throttle = 0;
  if (dt > 0) { const inst = distAcc / dt; speedEma += (inst - speedEma) * Math.min(1, dt * 4); distAcc = 0; }
}

// --- Launch sequence: spend fuel (coins) to leave the planet you're docked at
function launch() {
  if (launching || inFlight()) return;
  const n = nextMilestone(); if (!n) return;
  const cost = launchCost();
  if (state.coins < cost) { sfx.deny(); toast('⛽ Not enough fuel', `You need ${fmt(cost)} coins to launch for ${n.name}.`); return; }
  state.coins -= cost; launching = true; state.launches++;
  const btn = $('launch-btn'); btn.disabled = true;
  document.body.classList.add('launching');
  const c = centerOf(coinEl);
  let t = 3;
  const step = () => {
    if (t > 0) { btn.textContent = 'T-' + t; floatText(c.x, c.y - 170, 'T-' + t, 'crit'); sfx.countdown(); burst(c.x, c.y + 120, 12, { spread: 6, colors: FLAME_COLORS }); t--; setTimeout(step, 700); return; }
    btn.textContent = 'LIFTOFF!'; sfx.liftoff(); shake();
    burst(c.x, c.y + 120, 140, { spread: 15, colors: FLAME_COLORS, big: true });
    $('origin').classList.add('drop');
    state.phase = 'flight'; throttle = params.throttleMax - 1; throttleIdle = 0; eventTimer = rand(25, 45);
    toast('🚀 Liftoff!', `Next stop: ${n.name}. Click to burn, or let autopilot cruise.`, true);
    setTimeout(() => { document.body.classList.remove('launching'); $('origin').classList.remove('drop'); launching = false; btn.disabled = false; btn.textContent = '🚀 LAUNCH'; uiDirty = true; }, 1500);
    checkAchievements(); uiDirty = true; save();
  };
  step();
}
$('launch-btn').addEventListener('click', launch);

// --- Arrivals: reaching the next milestone docks the ship
function checkArrivals() {
  const n = nextMilestone(); if (!n || !inFlight() || arrivalShowing) return;
  if (state.distance >= n.d) {
    state.distance = n.d; state.stageIdx++; state.phase = 'docked'; throttle = 0; closeEvent();
    showArrival(state.stageIdx);
  }
}
function showArrival(i) {
  const m = MILESTONES[i];
  arrivalShowing = true;
  state.arrivals[i] = Date.now();
  const bonus = Math.max(cache.cps * 300, cache.clickBase * 100, 20) * (m.end ? 10 : 1) * params.landingMult;
  gain(bonus);
  $('arr-icon').textContent = m.icon; $('arr-name').textContent = m.name; $('arr-story').textContent = m.story;
  $('arr-bonus').textContent = 'Landing bonus +' + fmt(bonus);
  const a = $('arrival'); a.style.animationDuration = '4500ms'; a.classList.remove('hidden'); void a.offsetWidth;
  $('dest').classList.add('whoosh');
  sfx.arrive(); shake();
  const c = centerOf(coinEl); burst(c.x, c.y, 160, { spread: 20, colors: CONFETTI, rect: true, big: true });
  document.body.dataset.stage = m.stage;
  checkAchievements(); uiDirty = true;
  setTimeout(() => { $('dest').classList.remove('whoosh'); }, 1300);
  setTimeout(() => {
    a.classList.add('hidden'); arrivalShowing = false;
    if (m.end && !state.ended) showEnding();
    else if (i >= 3) { state.pendingPerk = i; openPerkChoice(); }
    save();
  }, 4500);
}

// --- Planetary relics: pick 1 of 3 permanent perks at every planet
const PERKS = [
  { id: 'prod',     icon: '⚙️', name: 'Overclocked Reactor', desc: 'All production +15%.' },
  { id: 'click',    icon: '🖱️', name: 'Reinforced Thrusters', desc: 'Clicks are worth ×1.5.', max: 6 },
  { id: 'crit',     icon: '🎯', name: 'Targeting Computer',   desc: 'Critical click chance +3%.', max: 5 },
  { id: 'combo',    icon: '🎼', name: 'Rhythm Module',        desc: 'Combo window +0.25s.', max: 4 },
  { id: 'fever',    icon: '🌡️', name: 'Coolant Bypass',       desc: 'Fever lasts 30% longer.', max: 4 },
  { id: 'golden',   icon: '☄️', name: 'Comet Radar',          desc: 'Golden comets appear 30% more often.', max: 4 },
  { id: 'fuel',     icon: '⛽', name: 'Efficient Injectors',  desc: 'Launch fuel costs 20% less.', max: 5 },
  { id: 'throttle', icon: '🔥', name: 'Afterburner',          desc: 'Max throttle +1 (burn even faster).', max: 4 },
  { id: 'offline',  icon: '🌙', name: 'Night Crew',           desc: 'Offline earnings +25%.', max: 2 },
  { id: 'pods',     icon: '🫧', name: 'Pod Magnet',           desc: 'Supply pods appear 40% more often.', max: 4 },
  { id: 'buffs',    icon: '⏳', name: 'Time Dilation',        desc: 'All temporary boosts last 25% longer.', max: 4 },
  { id: 'landing',  icon: '🏆', name: 'Trade Charter',        desc: 'Landing bonuses ×3.', max: 3 },
  { id: 'slots',    icon: '🎰', name: 'Loaded Dice',          desc: 'Lucky Spin pairs pay ×2 instead of ×1.5.', max: 1 },
];
function perkCount(id) { return state.perks[id] || 0; }
function totalPerks() { return Object.values(state.perks).reduce((a, b) => a + b, 0); }
function rollPerks() {
  const pool = PERKS.filter((p) => perkCount(p.id) < (p.max || 99));
  const owned = BUILDINGS.filter((b) => (state.buildings[b.id] || 0) > 0);
  const picks = [];
  if (owned.length && Math.random() < 0.6) {
    const b = owned[(Math.random() * owned.length) | 0];
    picks.push({ id: 'bld_' + b.id, icon: b.icon, name: b.name + ' Blueprint', desc: `${b.name}s produce ×2.` });
  }
  while (picks.length < 3 && pool.length) { const i = (Math.random() * pool.length) | 0; picks.push(pool.splice(i, 1)[0]); }
  return picks;
}
function openPerkChoice() {
  const i = state.pendingPerk; if (i == null) return;
  const m = MILESTONES[i];
  $('perk-title').textContent = `${m.icon} ${m.name}: choose your relic`;
  const wrap = $('perk-cards'); wrap.innerHTML = '';
  rollPerks().forEach((p) => {
    const el = document.createElement('div'); el.className = 'perk-card';
    el.innerHTML = `<div class="pk-icon"></div><div class="pk-name"></div><div class="pk-desc"></div><div class="pk-own"></div>`;
    el.querySelector('.pk-icon').textContent = p.icon; el.querySelector('.pk-name').textContent = p.name; el.querySelector('.pk-desc').textContent = p.desc;
    const n = perkCount(p.id); el.querySelector('.pk-own').textContent = n ? `owned ×${n}` : 'new';
    el.addEventListener('click', () => choosePerk(p, el));
    wrap.appendChild(el);
  });
  $('perk-modal').classList.remove('hidden');
  sfx.golden();
}
function choosePerk(p, el) {
  const c = el ? centerOf(el) : centerOf(coinEl);
  state.perks[p.id] = perkCount(p.id) + 1; state.pendingPerk = null;
  $('perk-modal').classList.add('hidden');
  recompute(); sfx.achievement();
  burst(c.x, c.y, 90, { spread: 14, colors: CONFETTI, rect: true });
  toast(`${p.icon} ${p.name}`, p.desc + ' Relic installed.', true);
  checkAchievements(); uiDirty = true; save();
}

// --- Flight events: a choice card with 20 seconds to decide
let eventTimer = 60, activeEvent = null, eventLeft = 0;
function evResult(msg, good) { toast(good ? '✅ Good call' : '📡 Event', msg, !!good); checkAchievements(); uiDirty = true; }
const EVENTS = [
  { icon: '📡', title: 'Distress signal', text: () => `A freighter is drifting without power. Towing them costs ${fmt(incomeReward(30, 30, 20))}.`,
    a: ['Help them', () => { const fee = incomeReward(30, 30, 20); if (state.coins < fee) return evResult("You can't afford the tow. You wave apologetically."); state.coins -= fee; if (Math.random() < 0.65) { const r = incomeReward(300, 300, 100); gain(r); evResult(`They were grateful. +${fmt(r)} coins.`, true); } else evResult('It was a pirate trap. The fee is gone.'); }],
    b: ['Ignore', () => evResult('You fly on. Somewhere, a captain sighs.')] },
  { icon: '🛸', title: 'Derelict ship', text: () => 'A dead hulk drifts past. Boarding could pay off. Or not.',
    a: ['Board it', () => { const r = Math.random(); if (r < 0.5) { const g = incomeReward(180, 200, 60); gain(g); evResult(`The hold was full. +${fmt(g)} coins.`, true); } else if (r < 0.8) evResult('Empty. Someone got here first.'); else { const l = state.coins * 0.05; state.coins -= l; evResult(`Booby-trapped. -${fmt(l)} coins.`); shake(); } }],
    b: ['Salvage the hull', () => { const g = incomeReward(45, 40, 20); gain(g); evResult(`Scrap sold. +${fmt(g)} coins.`, true); }] },
  { icon: '🌀', title: 'Wormhole', text: () => 'An unstable wormhole. It could skip a chunk of this leg. It could also eat your wallet.',
    a: ['Fly in', () => { const n = nextMilestone(); if (n) addDistance((n.d - state.distance) * 0.3); shake(); if (Math.random() < 0.25) { const l = state.coins * 0.1; state.coins -= l; evResult(`Skipped 30% of the leg, but it spaghettified ${fmt(l)} coins.`); } else evResult('Skipped 30% of the leg. Smooth.', true); }],
    b: ['Go around', () => evResult('You take the long way. Sensible.')] },
  { icon: '☄️', title: 'Comet tail', text: () => 'A comet is passing. Riding its tail would supercharge the engines.',
    a: ['Ride it', () => { addFever(60); throttle = params.throttleMax - 1; throttleIdle = 0; evResult('Fever gauge +60 and throttle maxed!', true); }],
    b: ['Avoid', () => evResult('You keep your distance.')] },
  { icon: '🛒', title: 'Wandering trader', text: () => `A trader offers a mystery crate for ${fmt(incomeReward(120, 120, 40))}.`,
    a: ['Buy the crate', () => { const fee = incomeReward(120, 120, 40); if (state.coins < fee) return evResult("You can't afford it. The trader shrugs."); state.coins -= fee; const r = Math.random(); if (r < 0.4) { addBuff('frenzy', '🔥 FRENZY ×7 income', 7, 20 * params.goldenDur); evResult('Inside: a Frenzy core! Income ×7.', true); } else if (r < 0.7) { addBuff('clickfrenzy', '👆 CLICK FRENZY ×77', 77, 8 * params.goldenDur); evResult('Inside: Click Frenzy! Click like mad.', true); } else { addBuff('rocket', '🚀 ROCKET ×2 income', 2, 40 * params.goldenDur); evResult('Inside: a Rocket booster. Income ×2.', true); } }],
    b: ['Decline', () => evResult('The trader drifts off.')] },
  { icon: '☀️', title: 'Solar flare', text: () => `A flare is coming. Shields cost ${fmt(incomeReward(20, 20, 10))}. Or you could surf it.`,
    a: ['Surf it', () => { if (Math.random() < 0.5) { const g = incomeReward(180, 180, 60); gain(g); evResult(`You surfed a solar flare. +${fmt(g)} coins.`, true); } else { const l = state.coins * 0.15; state.coins -= l; shake(); evResult(`Fried circuits. -${fmt(l)} coins.`); } }],
    b: ['Raise shields', () => { const fee = incomeReward(20, 20, 10); if (state.coins >= fee) { state.coins -= fee; evResult('Shields held. Minor scorching.'); } else { const l = state.coins * 0.1; state.coins -= l; evResult(`No shields. -${fmt(l)} coins.`); } }] },
  { icon: '👽', title: 'Alien ambassador', text: () => `An ambassador offers a gift, or a tech trade for ${fmt(incomeReward(120, 120, 50))}.`,
    a: ['Trade tech (+2% forever)', () => { const fee = incomeReward(120, 120, 50); if (state.coins < fee) return evResult("You can't afford the trade."); state.coins -= fee; state.permBonus = (state.permBonus || 0) + 0.02; recompute(); evResult('Alien tech installed: +2% production, forever.', true); }],
    b: ['Accept gift', () => { const g = incomeReward(90, 90, 30); gain(g); evResult(`A gift of ${fmt(g)} coins.`, true); }] },
  { icon: '🎲', title: 'Casino cruiser', text: () => `A casino ship hails you. One bet of ${fmt(incomeReward(60, 60, 20))}, triple or nothing.`,
    a: ['Bet', () => { const bet = incomeReward(60, 60, 20); if (state.coins < bet) return evResult('Not enough to bet.'); state.coins -= bet; if (Math.random() < 0.45) { gain(bet * 3); evResult(`Won! +${fmt(bet * 3)} coins.`, true); } else evResult('Lost. The dealer smiles.'); }],
    b: ['Pass', () => evResult('You keep flying. Discipline.')] },
  { icon: '🪨', title: 'Asteroid field', text: () => 'Dense rocks ahead. Cutting through means mining on the fly.',
    a: ['Cut through', () => { for (let i = 0; i < 3; i++) setTimeout(() => spawnChest(), i * 400); evResult('Rocks incoming. Mine them fast!', true); }],
    b: ['Go around', () => evResult('Slow and steady.')] },
];
function tickEvents(dt) {
  if (activeEvent) {
    eventLeft -= dt; $('ev-timer-fill').style.width = clamp(eventLeft / 20 * 100, 0, 100) + '%';
    if (eventLeft <= 0) { const ev = activeEvent; closeEvent(); ev.b[1](); }
    return;
  }
  eventTimer -= dt;
  if (eventTimer <= 0 && !arrivalShowing && !feverActive && $('modal').classList.contains('hidden') && $('perk-modal').classList.contains('hidden')) spawnEvent();
}
function spawnEvent(ev) {
  ev = ev || EVENTS[(Math.random() * EVENTS.length) | 0];
  activeEvent = ev; eventLeft = 20; state.events++;
  $('ev-icon').textContent = ev.icon; $('ev-title').textContent = ev.title; $('ev-text').textContent = ev.text();
  $('ev-a').textContent = ev.a[0]; $('ev-b').textContent = ev.b[0];
  $('event-card').classList.remove('hidden');
  sfx.event();
}
function closeEvent() { activeEvent = null; $('event-card').classList.add('hidden'); eventTimer = rand(50, 110); }
$('ev-a').addEventListener('click', () => { if (!activeEvent) return; const ev = activeEvent; closeEvent(); ev.a[1](); });
$('ev-b').addEventListener('click', () => { if (!activeEvent) return; const ev = activeEvent; closeEvent(); ev.b[1](); });

// --- Journey panel, planet backdrop, sky palette
function renderJourney() {
  const from = currentMilestone(), to = nextMilestone(), docked = !inFlight();
  $('j-flight').classList.toggle('hidden', docked); $('j-docked').classList.toggle('hidden', !docked);
  $('throttle-wrap').classList.toggle('hidden', docked);
  document.body.classList.toggle('docked', docked);
  const fromCol = from.color, toCol = to ? to.color : '#b58cff';
  const p = to ? clamp((state.distance - from.d) / (to.d - from.d), 0, 1) : 1;
  const bs = document.body.style;
  bs.setProperty('--from-col', fromCol); bs.setProperty('--to-col', toCol);
  bs.setProperty('--from-w', (docked ? 55 : 45 * (1 - p)).toFixed(1) + '%');
  bs.setProperty('--to-w', (docked ? 12 : 12 + 45 * p).toFixed(1) + '%');
  const ob = $('origin-body'); ob.textContent = from.icon;
  const oscale = docked ? 1 : Math.max(0, 1 - p * 3);
  ob.style.setProperty('--oscale', oscale.toFixed(3)); $('origin').style.opacity = docked ? 1 : oscale;
  ob.style.filter = `drop-shadow(0 0 50px ${fromCol})`;
  if (!to) {
    $('j-dest').textContent = 'Beyond Andromeda'; $('j-dist').textContent = fmtDist(state.distance) + ' travelled';
    $('j-speed').textContent = fmtDist(speedEma) + '/s'; $('j-eta').textContent = '';
    $('j-fill').style.width = '100%'; $('j-ship').style.left = '100%';
    $('dest-body').textContent = '💫'; $('dest-name').textContent = 'THE UNKNOWN';
    $('j-docked').classList.add('hidden'); $('j-flight').classList.remove('hidden');
    return;
  }
  const db = $('dest-body'); db.textContent = to.icon; $('dest-name').textContent = to.name.toUpperCase();
  db.style.setProperty('--dscale', (0.3 + p * 1.4).toFixed(3)); db.style.filter = `drop-shadow(0 0 30px ${toCol})`;
  if (docked) {
    const cost = launchCost(), can = state.coins >= cost;
    $('j-here').textContent = from.name; $('j-next').textContent = to.name;
    $('j-fuel').textContent = `${fmt(Math.min(state.coins, cost))} / ${fmt(cost)}`;
    $('j-fuel-fill').style.width = clamp(state.coins / cost * 100, 0, 100) + '%';
    const btn = $('launch-btn'); btn.classList.toggle('ready', can);
    if (!launching) {
      const cps = currentCps();
      btn.textContent = can ? `🚀 LAUNCH for ${to.name}` : cps > 0 ? `⛽ Refuelling… ${fmtTime((cost - state.coins) / cps)}` : '⛽ Click to earn fuel';
    }
  } else {
    $('j-from').textContent = from.icon; $('j-to').textContent = to.icon;
    $('j-fill').style.width = p * 100 + '%'; $('j-ship').style.left = p * 100 + '%';
    $('j-dest').textContent = to.name; $('j-dist').textContent = fmtDist(Math.max(0, to.d - state.distance)) + ' to go';
    $('j-speed').textContent = fmtDist(speedEma) + '/s';
    $('j-eta').textContent = speedEma > 0 ? 'ETA ' + fmtTime((to.d - state.distance) / speedEma) : 'click to burn!';
  }
}
function renderThrottle() {
  if (!inFlight()) return;
  const maxT = params.throttleMax - 1;
  $('throttle-bar').style.width = clamp(throttle / maxT * 100, 0, 100) + '%';
  $('throttle-label').textContent = throttle < 0.05 ? 'AUTOPILOT ×1.0 · click to burn' : `BURN ×${throttleMult().toFixed(1)}`;
  $('throttle-wrap').classList.toggle('max', throttle >= maxT - 0.01);
}
function renderJourneyList() {
  const wrap = $('journey-list'); wrap.innerHTML = '';
  MILESTONES.forEach((m, i) => {
    if (i === 0) return;
    const done = state.stageIdx >= i, cur = state.stageIdx + 1 === i;
    const el = document.createElement('div'); el.className = 'jl' + (done ? ' done' : cur ? ' current' : '');
    const when = state.arrivals[i] ? new Date(state.arrivals[i]).toLocaleDateString() : '';
    el.innerHTML = `<div class="jl-icon"></div><div><div class="jl-name"></div><div class="jl-story"></div></div><div class="jl-dist"></div>`;
    el.querySelector('.jl-icon').textContent = done || cur ? m.icon : '🔒';
    el.querySelector('.jl-name').textContent = m.name;
    el.querySelector('.jl-story').textContent = done ? m.story : cur ? (inFlight() ? 'En route. ' + fmtDist(Math.max(0, m.d - state.distance)) + ' to go.' : 'Next stop. Launch fuel: ' + fmt(launchCost()) + ' coins.') : 'Unknown territory.';
    el.querySelector('.jl-dist').textContent = done ? '✅ ' + when : fmtDist(m.d);
    wrap.appendChild(el);
  });
  const relics = Object.entries(state.perks).map(([id, n]) => { const p = PERKS.find((x) => x.id === id) || { icon: '🏭', name: id.replace('bld_', '') + ' blueprint' }; return `${p.icon} ${p.name}${n > 1 ? ' ×' + n : ''}`; }).join(' · ');
  $('journey-summary').innerHTML = `<b>${state.stageIdx}</b> / ${MILESTONES.length - 1} destinations · <b>${fmtDist(state.distance)}</b> travelled · warp <b>×${fmt(warpFactor())}</b>${state.ngPlus ? ` · New Game+ ${state.ngPlus}` : ''}` + (relics ? `<br><span class="dim">Relics: ${relics}</span>` : '');
}

// Ending & New Game+
function showEnding() {
  sfx.ending();
  const rows = [
    ['Distance', fmtDist(state.distance)], ['Coins earned', fmt(state.totalEarned)], ['Clicks', state.totalClicks.toLocaleString()],
    ['Best combo', state.maxCombo], ['Trophies', `${Object.keys(state.achievements).length} / ${ACH.length}`], ['Play time', fmtTime(state.playTime)],
    ['Cash outs', state.prestiges], ['Pirates caught', state.thieves],
  ];
  $('end-stats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('ending').classList.remove('hidden');
  save();
}
$('end-continue').addEventListener('click', () => { state.ended = true; $('ending').classList.add('hidden'); toast('💫 Beyond', 'The journey continues. There is always more.'); save(); });
$('end-ngplus').addEventListener('click', () => {
  const pend = pendingDiamonds();
  state.diamonds += pend; state.ngPlus++; state.ended = false;
  state.coins = 0; state.runEarned = 0; state.buildings = {}; state.upgrades = {};
  state.distance = 0; state.stageIdx = 0; state.arrivals = {}; state.phase = 'docked'; state.pendingPerk = null;
  throttle = 0; closeEvent();
  buffs = []; combo = 0; ents.forEach((e) => killEnt(e, false)); if (activeBlackhole) endBlackhole(activeBlackhole);
  document.body.dataset.stage = 'orbit';
  $('ending').classList.add('hidden');
  recompute(); buildBuildings(); renderBuffs(); upgKey = ''; renderJourney(); renderJourneyList();
  sfx.prestige();
  toast('🌀 New Game+', `Warp ×${fmt(warpFactor())}. Back to the launch pad, but much, much faster.`, true);
  checkAchievements(); save();
});

// Starfield
const starsCv = $('stars'), sctx = starsCv.getContext('2d');
let stars = [];
function initStars() {
  const r = $('clicker').getBoundingClientRect();
  starsCv.width = Math.max(1, r.width); starsCv.height = Math.max(1, r.height);
  stars = [];
  for (let i = 0; i < 180; i++) stars.push({ x: Math.random() * starsCv.width, y: Math.random() * starsCv.height, z: rand(0.25, 1), r: rand(0.6, 2) });
}
addEventListener('resize', initStars);
function drawStars(dt) {
  const w = starsCv.width, h = starsCv.height;
  sctx.clearRect(0, 0, w, h);
  const base = 12 + Math.log10(1 + speedEma) * 14;
  const sp = base * (feverActive ? 8 : 1) * (activeBlackhole ? 0.3 : 1);
  for (const s of stars) {
    s.y += sp * s.z * dt;
    if (s.y > h + 4) { s.y = -4; s.x = Math.random() * w; }
    sctx.globalAlpha = 0.35 + s.z * 0.65;
    sctx.fillStyle = '#ffffff';
    if (feverActive || sp > 80) {
      const len = Math.min(60, sp * s.z * 0.08);
      sctx.fillRect(s.x, s.y - len, s.r * 0.8, len);
    } else {
      sctx.beginPath(); sctx.arc(s.x, s.y, s.r * s.z, 0, 6.29); sctx.fill();
    }
  }
  sctx.globalAlpha = 1;
}

// Share card
function shareCard() {
  const cv = $('share-canvas'), c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#1c1433'); g.addColorStop(1, '#05000f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 220; i++) { c.globalAlpha = Math.random() * 0.8 + 0.2; c.fillStyle = '#fff'; c.beginPath(); c.arc(Math.random() * W, Math.random() * H, Math.random() * 1.8 + 0.3, 0, 6.29); c.fill(); }
  c.globalAlpha = 1;
  const m = currentMilestone();
  c.textAlign = 'left';
  c.font = '900 34px Segoe UI, system-ui, sans-serif'; c.fillStyle = '#ffcc33'; c.fillText('🚀 COIN FEVER', 60, 80);
  c.font = '600 20px Segoe UI, system-ui, sans-serif'; c.fillStyle = '#a9a3c7'; c.fillText('TO ANDROMEDA', 60, 110);
  c.font = '120px serif'; c.fillText(m.icon, W - 260, 250);
  c.font = '600 26px Segoe UI, system-ui, sans-serif'; c.fillStyle = '#f4f1ff'; c.fillText('I reached', 60, 230);
  c.font = '900 72px Segoe UI, system-ui, sans-serif'; c.fillStyle = '#fff'; c.shadowColor = '#ffcc33'; c.shadowBlur = 30; c.fillText(m.name.toUpperCase(), 60, 310); c.shadowBlur = 0;
  c.font = '600 26px Segoe UI, system-ui, sans-serif'; c.fillStyle = '#5cf28a'; c.fillText(fmtDist(state.distance) + ' from Earth', 60, 360);
  c.font = '500 22px Segoe UI, system-ui, sans-serif'; c.fillStyle = '#d8d4ee';
  const lines = [`💰 ${fmt(state.totalEarned)} coins earned`, `🔥 best combo ${state.maxCombo} · 💥 ${state.crits.toLocaleString()} crits`, `🏆 ${Object.keys(state.achievements).length}/${ACH.length} trophies · 💎 ${state.diamonds} diamonds`];
  lines.forEach((l, i) => c.fillText(l, 60, 430 + i * 36));
  c.font = '600 18px Segoe UI, system-ui, sans-serif'; c.fillStyle = '#a9a3c7'; c.fillText('One click at a time.', 60, H - 50);
  const text = `I reached ${m.name} in Coin Fever 🚀 ${fmtDist(state.distance)} from Earth, ${fmt(state.totalEarned)} coins earned. One click at a time.`;
  cv.toBlob(async (blob) => {
    const file = new File([blob], 'coin-fever.png', { type: 'image/png' });
    try {
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
    } catch (e) { /* user cancelled or unsupported; fall through to download */ }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'coin-fever.png'; a.click();
    try { await navigator.clipboard.writeText(text); toast('📸 Share card saved', 'Image downloaded and caption copied to clipboard.'); }
    catch (e) { toast('📸 Share card saved', 'Image downloaded.'); }
  }, 'image/png');
}
$('share-btn').addEventListener('click', shareCard);

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
const bldRows = {};
function buildBuildings() {
  const wrap = $('buildings'); wrap.innerHTML = '';
  BUILDINGS.forEach((b) => {
    const row = document.createElement('div');
    row.className = 'bld'; row.dataset.id = b.id;
    row.innerHTML = `<div class="bld-icon"></div><div class="bld-info"><div class="bld-name"></div><div class="bld-cps"></div><div class="bld-cost"></div></div><div class="bld-owned"></div>`;
    row.addEventListener('click', () => { if (!row.classList.contains('mystery')) buyBuilding(b.id, row); });
    row.addEventListener('mouseenter', () => { if (!row.classList.contains('mystery')) showTooltip(row, b.name, b.flavor, null); });
    row.addEventListener('mouseleave', hideTooltip);
    wrap.appendChild(row);
    bldRows[b.id] = { row, icon: row.querySelector('.bld-icon'), name: row.querySelector('.bld-name'), cps: row.querySelector('.bld-cps'), cost: row.querySelector('.bld-cost'), owned: row.querySelector('.bld-owned') };
  });
}
function renderBuildings() {
  let affordableCount = 0;
  BUILDINGS.forEach((b, i) => {
    const r = bldRows[b.id]; const vis = buildingVisibility(i);
    r.row.classList.toggle('hidden', vis === 'hidden');
    r.row.classList.toggle('mystery', vis === 'mystery');
    if (vis === 'hidden') return;
    const owned = state.buildings[b.id] || 0;
    if (vis === 'mystery') {
      r.icon.textContent = '❓'; r.name.textContent = '???'; r.cps.textContent = 'Keep growing to unlock'; r.cost.textContent = '🔒'; r.owned.textContent = '';
      r.row.classList.remove('affordable'); return;
    }
    const n = state.buyAmt, cost = costFor(b, n), can = state.coins >= cost;
    if (can) affordableCount++;
    r.icon.textContent = b.icon; r.name.textContent = b.name;
    const each = cache.buildingCps[b.id] || 0, total = each * owned * cpsBuffMult();
    const share = cache.cps > 0 ? Math.round(((each * owned) / cache.cps) * 100) : 0;
    r.cps.textContent = owned > 0 ? `${fmt(each)}/s each · ${fmt(total)}/s total (${share}%)` : `+${fmt(each)}/s each`;
    r.cost.textContent = `💰 ${fmt(cost)}` + (n > 1 ? ` for ${n}` : '');
    r.owned.textContent = owned || '';
    r.row.classList.toggle('affordable', can);
  });
  const badge = $('bld-badge');
  badge.classList.toggle('hidden', affordableCount === 0); badge.textContent = affordableCount;
}
function renderUpgrades() {
  const list = availableUpgrades();
  const key = list.map((u) => u.id).join(',');
  const wrap = $('upgrades');
  if (key !== upgKey) {
    upgKey = key; wrap.innerHTML = '';
    list.forEach((u) => {
      const el = document.createElement('div');
      el.className = 'upg'; el.dataset.id = u.id;
      el.innerHTML = `<span></span><span class="tag"></span>`;
      el.firstElementChild.textContent = u.icon;
      el.lastElementChild.textContent = fmt(u.cost);
      el.addEventListener('click', () => buyUpgrade(u, el));
      el.addEventListener('mouseenter', () => showTooltip(el, u.name, u.desc, u.cost));
      el.addEventListener('mouseleave', hideTooltip);
      wrap.appendChild(el);
    });
  }
  let aff = 0;
  wrap.querySelectorAll('.upg').forEach((el) => {
    const u = UPGRADES.find((x) => x.id === el.dataset.id);
    const can = state.coins >= u.cost; if (can) aff++;
    el.classList.toggle('affordable', can);
  });
  $('upg-empty').classList.toggle('hidden', list.length > 0);
  const badge = $('upg-badge'); badge.classList.toggle('hidden', aff === 0); badge.textContent = aff;
}
function renderGoal() {
  const items = [];
  BUILDINGS.forEach((b, i) => { if (buildingVisibility(i) === 'shown') items.push({ name: `${b.icon} ${b.name}`, cost: costFor(b, 1) }); });
  availableUpgrades().forEach((u) => items.push({ name: `${u.icon} ${u.name}`, cost: u.cost }));
  if (!inFlight() && nextMilestone()) items.push({ name: `🚀 Launch to ${nextMilestone().name}`, cost: launchCost() });
  items.sort((a, b) => a.cost - b.cost);
  const goal = items.find((it) => it.cost > state.coins) || (items[0] ? { ...items[0], ready: true } : null);
  const box = $('next-goal');
  if (!goal) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  $('goal-name').textContent = goal.name;
  const pct = clamp((state.coins / goal.cost) * 100, 0, 100);
  $('goal-fill').style.width = pct + '%';
  box.classList.toggle('ready', !!goal.ready);
  if (goal.ready) $('goal-time').textContent = 'READY!';
  else {
    const cps = currentCps();
    $('goal-time').textContent = cps > 0 ? fmtTime((goal.cost - state.coins) / cps) : `${fmt(goal.cost - state.coins)} to go`;
  }
}
function renderBuffs() {
  const wrap = $('buffs');
  const live = new Set(buffs.map((b) => b.type));
  wrap.querySelectorAll('.buff').forEach((el) => { if (!live.has(el.dataset.type)) el.remove(); });
  buffs.forEach((b) => {
    let el = wrap.querySelector(`.buff[data-type="${b.type}"]`);
    if (!el) {
      el = document.createElement('div'); el.className = 'buff'; el.dataset.type = b.type;
      el.innerHTML = `<span></span> <span class="t"></span><div class="bar"></div>`;
      el.firstElementChild.textContent = b.label;
      wrap.appendChild(el);
    }
    el.querySelector('.t').textContent = Math.ceil(b.remaining) + 's';
    el.querySelector('.bar').style.width = clamp((b.remaining / b.total) * 100, 0, 100) + '%';
  });
}
function renderAchievements() {
  const wrap = $('achievements'); wrap.innerHTML = '';
  let done = 0;
  ACH.forEach((a) => {
    const el = document.createElement('div'); el.className = 'ach' + (state.achievements[a.id] ? ' done' : '');
    if (state.achievements[a.id]) done++;
    el.textContent = a.icon;
    el.addEventListener('mouseenter', () => showTooltip(el, (state.achievements[a.id] ? '🏆 ' : '🔒 ') + a.name, a.desc + '  (+1% production)', null));
    el.addEventListener('mouseleave', hideTooltip);
    wrap.appendChild(el);
  });
  $('ach-summary').innerHTML = `<b>${done}</b> / ${ACH.length} trophies · <b>+${done}%</b> production · 💎 ${state.diamonds} (+${state.diamonds * 2}%) · 📅 streak ${state.dailyStreak} (+${Math.min(state.dailyStreak, 7) * 2}%)`;
}
function renderStats() {
  const rows = [
    ['Total earned', fmt(state.totalEarned)], ['This run', fmt(state.runEarned)],
    ['Total clicks', state.totalClicks.toLocaleString()], ['Critical hits', state.crits.toLocaleString()],
    ['Best combo', state.maxCombo], ['Golden coins caught', state.goldenClicked],
    ['Spins', state.spins], ['Slot net', (state.slotWon - state.slotSpent >= 0 ? '+' : '') + fmt(state.slotWon - state.slotSpent)],
    ['Bubbles popped', state.bubbles], ['Chests smashed', state.chests],
    ['Thieves caught', `${state.thieves} (${state.thievesEscaped} escaped)`], ['Drones downed', state.drones],
    ['Fevers', state.fevers], ['Sweet spot hits', state.sweetHits],
    ['Distance', fmtDist(state.distance)], ['Ship speed', fmtDist(speedEma) + '/s'],
    ['Black holes escaped', `${state.blackholes} (${state.blackholeFails} failed)`], ['Warp factor', '×' + fmt(warpFactor())],
    ['Launches', state.launches], ['Events survived', state.events], ['Relics', totalPerks()],
    ['Buildings', totalBuildings(state)], ['Upgrades', Object.keys(state.upgrades).length],
    ['Cash outs', state.prestiges], ['Play time', fmtTime(state.playTime)],
  ];
  $('stats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
}
function renderSlots() {
  const unlocked = slotUnlocked();
  $('slots-tab').textContent = unlocked ? '🎰 Lucky Spin' : '🔒 Lucky Spin';
  document.querySelector('.slot-machine').classList.toggle('hidden', !unlocked);
  $('slot-locked').classList.toggle('hidden', unlocked);
  if (unlocked) {
    const cost = spinCost();
    $('spin-cost').textContent = fmt(cost);
    $('spin-btn').disabled = slotSpinning || state.coins < cost;
  } else {
    $('slot-unlock-fill').style.width = clamp((state.totalEarned / SLOT_UNLOCK) * 100, 0, 100) + '%';
  }
}
function renderTop() {
  $('diamonds').textContent = state.diamonds;
  const pend = pendingDiamonds(); const pe = $('pending-diamonds');
  pe.classList.toggle('hidden', pend <= 0); pe.textContent = pend > 0 ? `(+${pend})` : '';
  $('daily-btn').classList.toggle('hidden', !dailyAvailable());
  $('mute-btn').textContent = state.muted ? '🔇' : '🔊';
  document.body.dataset.tier = tier();
  if (!arrivalShowing) document.body.dataset.stage = currentMilestone().stage;
}
function renderFast() {
  $('coins').textContent = fmt(state.coins);
  $('cps').textContent = fmt(currentCps());
  $('cpc').textContent = fmt(clickPower() * comboMult());
  const wrap = $('combo-wrap');
  if (combo > 1) {
    wrap.classList.remove('hidden');
    const left = clamp(1 - (performance.now() - lastClickTime) / (params.comboWindow * 1000), 0, 1);
    $('combo-bar').style.width = left * 100 + '%';
    const lbl = $('combo-label'); const m = comboMult();
    lbl.textContent = `COMBO ×${m.toFixed(2)}  (${combo})`;
    lbl.classList.toggle('hot', combo >= 30 && combo < 80); lbl.classList.toggle('fire', combo >= 80);
  } else wrap.classList.add('hidden');
  coinEl.classList.toggle('hot', combo >= 50);
  coinEl.style.setProperty('--flame', (0.8 + Math.min(combo, 100) / 100 * 1.6 + (feverActive ? 1 : 0) + throttle * 0.4).toFixed(2));
  renderThrottle();
}
function renderUI() {
  renderBuildings(); renderUpgrades(); renderGoal(); renderSlots(); renderTop(); renderJourney();
  if ($('tab-achievements').classList.contains('active')) renderStats();
  if ($('tab-journey').classList.contains('active')) renderJourneyList();
  // "something new is affordable" ping
  const now = performance.now();
  const aff = new Set();
  BUILDINGS.forEach((b, i) => { if (buildingVisibility(i) === 'shown' && state.coins >= costFor(b, 1)) aff.add('b:' + b.id); });
  availableUpgrades().forEach((u) => { if (state.coins >= u.cost) aff.add('u:' + u.id); });
  let fresh = false; aff.forEach((k) => { if (!lastAffordable.has(k)) fresh = true; });
  if (fresh && now - lastPing > 2500 && state.totalClicks > 3) { sfx.ping(); lastPing = now; }
  lastAffordable = aff;
}

// Tooltip
const tip = $('tooltip');
function showTooltip(anchor, title, desc, cost) {
  tip.innerHTML = `<b></b><span></span>` + (cost !== null ? `<div class="cost"></div>` : '');
  tip.querySelector('b').textContent = title; tip.querySelector('span').textContent = desc;
  if (cost !== null) { const c = tip.querySelector('.cost'); c.textContent = '💰 ' + fmt(cost); c.className = 'cost ' + (state.coins >= cost ? 'ok' : 'no'); }
  tip.classList.remove('hidden');
  const r = anchor.getBoundingClientRect(); const tw = tip.offsetWidth, th = tip.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
  if (y + th > innerHeight - 8) y = r.top - th - 8;
  x = clamp(x, 8, innerWidth - tw - 8);
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}
function hideTooltip() { tip.classList.add('hidden'); }

// Tabs / buttons
document.querySelectorAll('#tabs button').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active'); $('tab-' + btn.dataset.tab).classList.add('active');
  hideTooltip(); uiDirty = true;
  if (btn.dataset.tab === 'achievements') { renderAchievements(); renderStats(); }
  if (btn.dataset.tab === 'journey') renderJourneyList();
}));
document.querySelectorAll('.buy-amount button').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('.buy-amount button').forEach((b) => b.classList.remove('active'));
  btn.classList.add('active'); state.buyAmt = +btn.dataset.amt; uiDirty = true;
}));
$('mute-btn').addEventListener('click', () => { state.muted = !state.muted; renderTop(); if (!state.muted) { sfx.ensure(); sfx.ping(); } });
$('prestige-btn').addEventListener('click', openPrestige);
$('daily-btn').addEventListener('click', claimDaily);
let resetting = false;
$('reset-btn').addEventListener('click', () => {
  if (confirm('Wipe ALL progress including Diamonds and trophies? This cannot be undone.')) {
    resetting = true;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
});

// ------------------------------------------------------------------
// Save / load
// ------------------------------------------------------------------
function save() {
  if (resetting) return;
  state.lastSave = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* storage full or blocked */ }
}
function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state = { ...defaultState(), ...data };
    state.buildings = data.buildings || {}; state.upgrades = data.upgrades || {}; state.achievements = data.achievements || {};
    state.perks = data.perks || {}; state.arrivals = data.arrivals || {};
    // saves from before the dock/launch system: mid-journey players keep flying, fresh ones start docked
    if (!data.phase) state.phase = (state.stageIdx === 0 && !(state.distance > 0)) ? 'docked' : 'flight';
    return true;
  } catch (e) { return false; }
}
addEventListener('beforeunload', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ------------------------------------------------------------------
// Main loop
// ------------------------------------------------------------------
let lastFrame = performance.now(), lastWall = Date.now(), uiAcc = 0, achAcc = 0, saveAcc = 0, dailyAcc = 0;
function loop(now) {
  const wall = Date.now();
  let dt = (wall - lastWall) / 1000; lastWall = wall; lastFrame = now;
  if (dt > 90) { grantOffline(dt); dt = 0; } // tab was suspended for a long time
  dt = Math.min(dt, 90);

  // production & travel
  gain(currentCps() * dt);
  state.playTime += dt;
  tickJourney(dt);

  // combo decay
  if (combo > 0 && performance.now() - lastClickTime > params.comboWindow * 1000) combo = 0;

  // buffs
  if (buffs.length) {
    let changed = false;
    buffs.forEach((b) => { b.remaining -= dt; });
    const before = buffs.length; buffs = buffs.filter((b) => b.remaining > 0);
    if (buffs.length !== before) { changed = true; toast('Buff ended', 'Back to normal... catch another golden coin!'); }
    renderBuffs(); if (changed) uiDirty = true;
  }

  // arena clickables, fever, sweet spot
  updateArena(dt);
  sweetTimer -= dt; if (sweetTimer <= 0) { moveSweet(); sweetTimer = 2.5; }

  // golden coin spawn
  goldenTimer -= dt;
  if (goldenTimer <= 0 && (state.totalClicks >= 15 || state.totalEarned >= 50)) { spawnGolden(); scheduleGolden(); }

  // periodic
  uiAcc += dt; achAcc += dt; saveAcc += dt; dailyAcc += dt;
  if (uiAcc >= 0.1 || uiDirty) { uiAcc = 0; uiDirty = false; renderUI(); }
  if (achAcc >= 1) { achAcc = 0; checkAchievements(); }
  if (saveAcc >= 15) { saveAcc = 0; save(); }
  if (dailyAcc >= 60) { dailyAcc = 0; renderTop(); }

  renderFast();
  drawStars(dt);
  drawParticles(dt);
  requestAnimationFrame(loop);
}

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
function boot() {
  const had = load();
  recompute();
  buildBuildings(); renderAchievements(); renderStats(); renderBuffs();
  document.querySelector(`.buy-amount button[data-amt="${state.buyAmt}"]`)?.classList.add('active');
  if (state.buyAmt !== 1) document.querySelector('.buy-amount button[data-amt="1"]').classList.remove('active');
  scheduleGolden();
  goldenTimer = Math.min(goldenTimer, rand(35, 60)); // first one comes fairly quickly
  timers.bubble = rand(10, 20); timers.chest = rand(50, 100); timers.thief = rand(100, 180); timers.drone = rand(40, 80); timers.blackhole = rand(90, 150);
  moveSweet(); initStars();
  document.body.dataset.stage = currentMilestone().stage;
  renderJourney(); renderJourneyList();
  if (state.pendingPerk != null) openPerkChoice();
  if (had) {
    const away = (Date.now() - state.lastSave) / 1000;
    if (away > 60 && cache.cps > 0) grantOffline(away);
  } else {
    showModal('🚀 Welcome aboard!', `
      <p>Your mission: fly from Earth to <b>Andromeda</b>. 2.4 million light-years. On a budget.</p>
      <p><b>Click the ship</b> to thrust. Coins are fuel: buy ship systems that earn coins by themselves, and the ship flies by itself too.</p>
      <p>Chain clicks for a <b>COMBO</b>, fill the <b>FEVER</b> gauge, catch <b>golden comets</b>, mine <b>asteroids</b>, and don't let the <b>pirates</b> get away.</p>
      <p>Every planet you land on gives you a <b>relic</b> to choose. Refuel, hit <b>LAUNCH</b>, and burn for the next one.</p>
      <p class="dim">First stop: the Moon. Just one more planet. You know how this goes.</p>`, "Let's fly!");
  }
  renderUI(); renderFast();
  requestAnimationFrame(loop);
  // Opt-in debug hooks (open the page with #debug). Handy for testing; not advertised in-game.
  if (location.hash === '#debug') {
    window.CoinFever = { spawnGolden, spawnBubble, spawnChest, spawnThief, spawnDrone, spawnBlackhole, startFever, addBuff, addDistance, showEnding, shareCard, launch, spawnEvent, openPerkChoice, EVENTS, state: () => state, cache, give: (n) => gain(n), save };
  }
}
boot();

})();
