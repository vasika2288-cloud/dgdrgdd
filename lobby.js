/* Meow Squad — lobby & meta-progression (energy, currencies, chapters, squad, talents, shop, quests).
   Loaded before game.js. game.js calls MeowLobby.init(bridge) on boot, MeowLobby.runBoost() when a run
   is created, MeowLobby.onRunEnd(result) when a run finishes and MeowLobby.onMenu() when returning. */
(() => {
  'use strict';

  const SAVE_KEY = 'meowsquad-profile';
  const ENERGY_MAX = 30;
  const ENERGY_REGEN = 300; // sec per point
  const RUN_COST = 5;
  const CHALLENGE_COST = 10;
  const CAT_MAX = 10;

  const CHAPTERS = [
    { name: 'Мятная долина', icon: '🌿', color: '#3fae5a', enemyHp: 1, reward: 1, desc: 'Мыши-зомби бродят по мятным полям' },
    { name: 'Сырные катакомбы', icon: '🧀', color: '#e0a52e', enemyHp: 1.4, reward: 1.5, desc: 'Подземные ходы, полные бронированных крыс' },
    { name: 'Ледяной чердак', icon: '❄️', color: '#5ec8ff', enemyHp: 1.9, reward: 2.1, desc: 'Холод, сквозняки и стаи летучих мышей' },
    { name: 'Грозовые крыши', icon: '⛈️', color: '#8f7dff', enemyHp: 2.5, reward: 2.8, desc: 'Плевуны засели на каждой трубе' },
    { name: 'Трон Мракуса', icon: '👑', color: '#ff4d6d', enemyHp: 3.3, reward: 3.6, desc: 'Логово Крысиного Короля. Только для легенд' },
  ];
  // survival milestones (seconds) with base rewards; coins scale with the chapter reward multiplier
  const MILES = [
    { t: 60, gems: 15, coins: 80 },
    { t: 150, gems: 25, coins: 200 },
    { t: 270, gems: 50, coins: 450 },
  ];
  const TALENTS = [
    { id: 'hp', name: 'Крепкое здоровье', icon: 'heart', max: 10, per: 0.08, fmt: (v) => `+${Math.round(v * 100)}% к HP` },
    { id: 'dmg', name: 'Острые когти', icon: 'swords', max: 10, per: 0.06, fmt: (v) => `+${Math.round(v * 100)}% к урону отряда` },
    { id: 'armor', name: 'Пушистая броня', icon: 'shield', max: 8, per: 0.03, fmt: (v) => `−${Math.round(v * 100)}% входящего урона` },
    { id: 'speed', name: 'Лёгкие лапы', icon: 'speed', max: 8, per: 0.03, fmt: (v) => `+${Math.round(v * 100)}% к скорости` },
    { id: 'magnet', name: 'Притяжение', icon: 'magnet', max: 8, per: 0.12, fmt: (v) => `+${Math.round(v * 100)}% к радиусу сбора` },
  ];
  const DAILY = [
    { coins: 150 }, { gems: 20 }, { coins: 300 }, { energy: 15 }, { coins: 500 }, { gems: 40 }, { gems: 80, catLvl: 1 },
  ];
  const QUESTS = [
    { id: 'kills', name: 'Победи 500 врагов', goal: 500, gems: 20 },
    { id: 'runs', name: 'Сыграй 3 забега', goal: 3, gems: 15 },
    { id: 'survive', name: 'Продержись 3:00 в одном забеге', goal: 180, gems: 25 },
    { id: 'upgrades', name: 'Сделай 2 улучшения', goal: 2, gems: 10 },
  ];

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const fmtNum = (n) => (n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'K' : String(n));
  const today = () => new Date().toLocaleDateString('sv-SE');
  // inline icon from the SVG sprite in index.html
  const I = (name, cls) => `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const fmtClock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  let MS = null; // bridge from game.js
  let P = null;  // profile
  let tab = 'battle';
  let runCtx = { chapter: 0, challenge: false };
  let lastWasChallenge = false;

  // ---------------------------------------------------------------- profile
  function freshProfile() {
    return {
      v: 1, name: 'Маг', xp: 0, lvl: 1, coins: 300, gems: 60,
      energy: ENERGY_MAX, energyAt: Date.now(),
      chapter: 0, unlocked: 0, best: {}, chests: {},
      cats: {}, talents: {},
      daily: { last: '', idx: 0 },
      quests: { day: '', kills: 0, runs: 0, survive: 0, upgrades: 0, claimed: [] },
      shopFree: '', challengeDay: '',
      stats: { runs: 0, wins: 0, kills: 0, bestTime: 0 },
    };
  }
  function load() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (_) { p = null; }
    const base = freshProfile();
    if (!p || p.v !== 1) {
      // carry over the record from the pre-lobby version of the game
      try {
        const old = JSON.parse(localStorage.getItem('meowsquad-best') || '{}');
        if (old.time) { base.stats.bestTime = old.time; base.stats.wins = old.wins || 0; }
      } catch (_) { /* ignore */ }
      return base;
    }
    return Object.assign(base, p, {
      daily: Object.assign(base.daily, p.daily), quests: Object.assign(base.quests, p.quests), stats: Object.assign(base.stats, p.stats),
    });
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(P)); } catch (_) { /* ignore */ } }

  function tickEnergy() {
    const now = Date.now();
    if (P.energy >= ENERGY_MAX) { P.energyAt = now; return; }
    const gained = Math.floor((now - P.energyAt) / 1000 / ENERGY_REGEN);
    if (gained > 0) {
      P.energy = Math.min(ENERGY_MAX, P.energy + gained);
      P.energyAt = P.energy >= ENERGY_MAX ? now : P.energyAt + gained * ENERGY_REGEN * 1000;
    }
  }
  function quests() {
    if (P.quests.day !== today()) P.quests = { day: today(), kills: 0, runs: 0, survive: 0, upgrades: 0, claimed: [] };
    return P.quests;
  }
  const catLvl = (id) => P.cats[id] || 1;
  const talentLvl = (id) => P.talents[id] || 0;
  const xpNeed = (lvl) => 80 + lvl * 60;
  const catCost = (lvl) => Math.round((80 * Math.pow(lvl, 1.5)) / 10) * 10;
  const talentCost = (lvl) => Math.round((150 * Math.pow(1.55, lvl)) / 10) * 10;
  const squadPower = () => {
    let p = 0;
    for (const d of MS.CAT_TYPES) p += catLvl(d.id) * 120;
    for (const t of TALENTS) p += talentLvl(t.id) * 90;
    return p + P.lvl * 50;
  };

  function grant(r) {
    if (r.coins) P.coins += r.coins;
    if (r.gems) P.gems += r.gems;
    if (r.energy) P.energy += r.energy;
    if (r.xp) addXp(r.xp);
  }
  function addXp(x) {
    P.xp += x;
    let ups = 0;
    while (P.xp >= xpNeed(P.lvl)) { P.xp -= xpNeed(P.lvl); P.lvl++; P.energy += 10; ups++; }
    return ups;
  }
  const rewardText = (r) => [r.coins && `🐟 ${r.coins}`, r.gems && `💎 ${r.gems}`, r.energy && `⚡ ${r.energy}`, r.catLvl && '🐱 +1 ур.'].filter(Boolean).join(' · ');

  // ---------------------------------------------------------------- chapter art (inline SVG scenes)
  const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return `rgb(${x.map((v, k) => Math.round(v + (y[k] - v) * t)).join(',')})`; };
  // Chapter islands: chunky outlined dioramas standing on a slab tinted with the chapter colour
  const OL = 'stroke="#0b0718" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
  const OS = 'stroke="#0b0718" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"';
  const ISLES = [
    // 1 — mint valley: shop street with a zombie mouse
    () => `
      <rect x="15" y="198" width="270" height="24" fill="#8a84b0"/>
      <path d="M36 210h22M82 210h22M128 210h22M174 210h22M250 210h18" stroke="#e9e6ff" stroke-width="4" stroke-linecap="round"/>
      <rect x="92" y="34" width="62" height="152" rx="7" fill="#6d6796" ${OL}/>
      <rect x="98" y="40" width="10" height="140" rx="4" fill="#fff" opacity=".12"/>
      <path d="M140 62h76l12 12v112h-88z" fill="#8f8ab8" ${OL}/>
      <path d="M172 88h12v14h-12zM192 88h12v14h-12zM212 88h10v14h-10zM172 114h12v14h-12zM192 114h12v14h-12z" fill="#5d5888"/>
      <rect x="38" y="84" width="118" height="112" rx="9" fill="#dcd9f0" ${OL}/>
      <rect x="50" y="96" width="94" height="34" rx="6" fill="#b9e6ff" ${OS}/>
      <path d="M58 122l14-20h12l-14 20z" fill="#fff" opacity=".7"/>
      <rect x="52" y="138" width="90" height="7" rx="3.5" fill="#b3aed6"/>
      <rect x="60" y="172" width="74" height="24" fill="#3b3560"/>
      <path d="M44 156h106v14q-8.8 7-17.7 0-8.8 7-17.6 0-8.9 7-17.7 0-8.8 7-17.7 0-8.8 7-17.6 0-8.9 7-17.7 0z" fill="#fff" ${OS}/>
      <path d="M61.7 158h17.6v12q-8.8 6-17.6 0zM97 158h17.7v12q-8.9 6-17.7 0zM132.3 158H150v12q-8.8 6-17.7 0z" fill="#3fae5a"/>
      <path d="M18 200l10-24 16 6 8 18z" fill="#b9b4d6" ${OS}/>
      <rect x="250" y="158" width="10" height="34" rx="2" fill="#7a4a2a" ${OS}/>
      <path d="M255 86c20 0 26 32 26 48s-10 30-26 30-26-14-26-30 6-48 26-48z" fill="#2f8f4a" ${OL}/>
      <path d="M246 108q4-12 10-12" fill="none" stroke="#7ee081" stroke-width="5" stroke-linecap="round"/>
      <path d="M150 226q4-12 8 0 4-10 8 0z" fill="#7ee081" ${OS}/>
      <circle cx="207" cy="152" r="9" fill="#9ad3a0" ${OS}/><circle cx="239" cy="152" r="9" fill="#9ad3a0" ${OS}/>
      <rect x="208" y="186" width="30" height="22" rx="5" fill="#4a7bd8" ${OS}/>
      <path d="M238 198h12" fill="none" ${OS}/>
      <rect x="203" y="152" width="40" height="36" rx="12" fill="#9ad3a0" ${OL}/>
      <circle cx="215" cy="167" r="6.5" fill="#fff" ${OS}/><circle cx="232" cy="167" r="6.5" fill="#fff" ${OS}/>
      <circle cx="216" cy="168" r="2" fill="#0b0718"/><circle cx="231" cy="166" r="2" fill="#0b0718"/>
      <path d="M214 208v6M232 208v6" ${OS}/>`,
    // 2 — cheese catacombs: giant wedge and a crypt entrance
    () => `
      <ellipse cx="60" cy="220" rx="13" ry="5" fill="#c98a1c"/><ellipse cx="236" cy="206" rx="10" ry="4" fill="#c98a1c"/><ellipse cx="176" cy="224" rx="8" ry="3" fill="#c98a1c"/>
      <path d="M100 190v-70l146-74q16-6 16 10v134z" fill="#ffcf3f" ${OL}/>
      <path d="M100 120l146-74q16-6 16 10v12L100 138z" fill="#ffe98a"/>
      <circle cx="150" cy="158" r="12" fill="#e0a52e" ${OS}/><circle cx="208" cy="112" r="15" fill="#e0a52e" ${OS}/>
      <circle cx="232" cy="164" r="9" fill="#e0a52e" ${OS}/><circle cx="178" cy="126" r="6" fill="#e0a52e" ${OS}/>
      <path d="M30 204v-66q0-42 46-42t46 42v66z" fill="#9a94b8" ${OL}/>
      <path d="M36 150h14M102 150h14M40 176h12M100 176h12M62 104v12M90 104v12" stroke="#6d6796" stroke-width="4" stroke-linecap="round"/>
      <path d="M50 204v-60q0-26 26-26t26 26v60z" fill="#1b1432" ${OS}/>
      <circle cx="68" cy="168" r="4" fill="#ffd166"/><circle cx="84" cy="168" r="4" fill="#ffd166"/>
      <path d="M134 204v-34" ${OL}/><path d="M134 146q10 12 0 24-10-12 0-24z" fill="#ff8a3d" ${OS}/>
      <rect x="160" y="178" width="30" height="32" rx="7" fill="#a8683a" ${OS}/>
      <path d="M160 188h30M160 200h30" stroke="#0b0718" stroke-width="3"/>
      <path d="M206 218l58-28v28z" fill="#ffe27a" ${OS}/>
      <circle cx="246" cy="208" r="4" fill="#e0a52e"/>`,
    // 3 — icy attic: snowed-in house, pine and a snowman
    () => `
      <ellipse cx="64" cy="222" rx="30" ry="6" fill="#fff"/><ellipse cx="226" cy="224" rx="36" ry="6" fill="#fff"/>
      <rect x="182" y="44" width="16" height="40" fill="#8a5a48" ${OS}/>
      <rect x="72" y="112" width="136" height="88" fill="#b07a5e" ${OL}/>
      <path d="M72 140h136M72 168h136" stroke="#8a5a48" stroke-width="3"/>
      <rect x="124" y="150" width="32" height="50" rx="5" fill="#6b4030" ${OS}/><circle cx="149" cy="176" r="2.5" fill="#ffd166"/>
      <rect x="84" y="150" width="26" height="24" rx="3" fill="#ffe27a" ${OS}/><rect x="170" y="150" width="26" height="24" rx="3" fill="#ffe27a" ${OS}/>
      <path d="M54 116l86-84 86 84z" fill="#5a6fb8" ${OL}/>
      <path d="M140 32l-46 45q12 12 22 0 12 14 24 0 12 14 24 0 10 12 22 0z" fill="#fff" ${OS}/>
      <circle cx="140" cy="94" r="13" fill="#ffe27a" ${OS}/><path d="M140 81v26M127 94h26" stroke="#0b0718" stroke-width="3"/>
      <path d="M70 117l5 16 5-16zM92 117l5 22 5-22zM178 117l5 22 5-22zM200 117l5 16 5-16z" fill="#dff6ff" ${OS}/>
      <rect x="243" y="176" width="10" height="24" fill="#7a4a2a" ${OS}/>
      <path d="M248 84l24 40h-12l20 36h-64l20-36h-12z" fill="#3f8f7a" ${OL}/>
      <path d="M248 84l12 20q-12 8-24 0z" fill="#fff" ${OS}/>
      <circle cx="38" cy="194" r="17" fill="#fff" ${OL}/><circle cx="38" cy="166" r="12" fill="#fff" ${OL}/>
      <circle cx="34" cy="163" r="2" fill="#0b0718"/><circle cx="43" cy="163" r="2" fill="#0b0718"/><path d="M38 168l12 3-12 3z" fill="#ff8a3d" ${OS}/>
      <path d="M222 60q10-16 18 0 6-4 8 0 2-4 8 0 8-16 18 0-12 0-14 12-6-6-12 0-6-6-12 0-2-12-14-12z" fill="#3b3560" ${OS}/>`,
    // 4 — storm rooftops: gabled houses under a thundercloud
    () => `
      <path d="M40 226l8-14M96 228l8-14M150 228l8-14M214 226l8-14M262 224l6-12" stroke="#e9e6ff" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      <rect x="156" y="30" width="16" height="36" fill="#463a8c" ${OS}/>
      <rect x="100" y="76" width="82" height="124" fill="#7466c4" ${OL}/>
      <path d="M90 80l51-50 51 50z" fill="#3d3180" ${OL}/>
      <path d="M114 96h18v20h-18zM150 96h18v20h-18zM114 132h18v20h-18zM150 132h18v20h-18z" fill="#ffe27a" ${OS}/>
      <rect x="130" y="170" width="22" height="30" rx="3" fill="#2a2058" ${OS}/>
      <rect x="28" y="126" width="76" height="74" fill="#5b4f9a" ${OL}/>
      <path d="M20 130l46-44 46 44z" fill="#463a8c" ${OL}/>
      <path d="M42 146h18v20H42zM72 146h18v20H72z" fill="#ffe27a" ${OS}/>
      <path d="M36 108l16-16M92 108L76 92" stroke="#6f62b8" stroke-width="4" stroke-linecap="round"/>
      <rect x="178" y="118" width="84" height="82" fill="#5b4f9a" ${OL}/>
      <path d="M170 122l50-42 50 42z" fill="#463a8c" ${OL}/>
      <path d="M192 140h18v20h-18zM230 140h18v20h-18z" fill="#ffe27a" ${OS}/>
      <rect x="208" y="170" width="22" height="30" rx="3" fill="#2a2058" ${OS}/>
      <path d="M246 100V70M238 76h16M241 84h10" fill="none" ${OS}/>
      <path d="M186 44q0-16 18-14 8-16 28-6 22-6 24 14 16 2 12 16-2 10-16 10h-56q-18 0-10-20z" fill="#3b3560" ${OL}/>
      <path d="M198 40q8-6 16-2" fill="none" stroke="#6f62b8" stroke-width="4" stroke-linecap="round"/>
      <path d="M232 52l-16 30h13l-9 28 30-38h-14l10-20z" fill="#ffd166" ${OS}/>`,
    // 5 — Mrakus' throne: crowned keep with a red carpet
    () => `
      <path d="M128 200h44l12 32h-68z" fill="#ff4d6d"/><path d="M134 200l-8 32M166 200l8 32" stroke="#ffd166" stroke-width="3"/>
      <rect x="38" y="86" width="54" height="114" fill="#4a3a6e" ${OL}/>
      <path d="M32 90V66h14v10h12V66h14v10h12V66h14v24z" fill="#5d4c86" ${OL}/>
      <rect x="208" y="86" width="54" height="114" fill="#4a3a6e" ${OL}/>
      <path d="M202 90V66h14v10h12V66h14v10h12V66h14v24z" fill="#5d4c86" ${OL}/>
      <path d="M60 112q5-8 10 0v20H60zM230 112q5-8 10 0v20h-10z" fill="#ff4d6d" ${OS}/>
      <path d="M52 146h26v32l-13-9-13 9zM222 146h26v32l-13-9-13 9z" fill="#ff4d6d" ${OS}/>
      <rect x="86" y="110" width="128" height="90" fill="#5d4c86" ${OL}/>
      <path d="M82 114V96h16v8h14v-8h16v8h44v-8h16v8h14v-8h16v18z" fill="#6f5e9c" ${OL}/>
      <path d="M124 200v-36q0-26 26-26t26 26v36z" fill="#1b1432" ${OS}/>
      <path d="M138 200v-26h24v26zM134 174q16-18 32 0z" fill="#ffd166" ${OS}/>
      <path d="M104 200v-30M196 200v-30" ${OL}/>
      <path d="M104 148q10 12 0 24-10-12 0-24zM196 148q10 12 0 24-10-12 0-24z" fill="#ff8a3d" ${OS}/>
      <path d="M116 98l-8-42 24 20 18-32 18 32 24-20-8 42z" fill="#ffd166" ${OL}/>
      <circle cx="150" cy="80" r="6" fill="#ff4d6d" ${OS}/><circle cx="128" cy="86" r="4" fill="#5ee7ff" ${OS}/><circle cx="172" cy="86" r="4" fill="#5ee7ff" ${OS}/>
      <circle cx="34" cy="214" r="9" fill="#f4efff" ${OS}/><circle cx="31" cy="213" r="2" fill="#0b0718"/><circle cx="37" cy="213" r="2" fill="#0b0718"/>
      <path d="M258 222l8-18 10 18z" fill="#3a2a52" ${OS}/>`,
  ];
  const ISLE_GROUND = ['#8fe07a', '#f3c64a', '#c9f0ff', '#8a7ccf', '#8a2f52'];
  function chapterArt(i) {
    const k = i % ISLES.length, top = ISLE_GROUND[k], side = mix(top, '#0b0718', 0.42);
    return `<svg viewBox="0 0 300 266" aria-hidden="true">
      <path d="M12 178q0-10 10-10h256q10 0 10 10v60q0 9-9 9h-97l-22 12-22-12H21q-9 0-9-9z" fill="${side}" ${OL}/>
      <path d="M15 180q0-9 9-9h252q9 0 9 9v46q0 6-6 6H21q-6 0-6-6z" fill="${top}"/>
      <path d="M15 180q0-9 9-9h252q9 0 9 9v3H15z" fill="#fff" opacity=".25"/>
      ${ISLES[k]()}
    </svg>`;
  }

  // ---------------------------------------------------------------- bridge API
  const api = {
    init(bridge) {
      MS = bridge;
      P = load();
      if (!P.cats || typeof P.cats !== 'object') P.cats = {};
      runCtx = { chapter: P.chapter, challenge: false };
      bindStatic();
      render();
      setInterval(() => { if (!$('menu').classList.contains('hidden')) renderTop(); }, 1000);
      save();
    },
    runBoost() {
      if (!P) return null;
      const t = (id) => talentLvl(id) * TALENTS.find((x) => x.id === id).per;
      const cat = {};
      for (const id in P.cats) cat[id] = 1 + (P.cats[id] - 1) * 0.1;
      const ch = CHAPTERS[runCtx.chapter] || CHAPTERS[0];
      return {
        hp: 1 + t('hp'), dmg: 1 + t('dmg'), armor: t('armor'), speed: 1 + t('speed'), magnet: 1 + t('magnet'),
        enemyHp: ch.enemyHp * (runCtx.challenge ? 2 : 1), cat,
      };
    },
    requestRun() {
      const fromOver = !$('over').classList.contains('hidden');
      if (fromOver && lastWasChallenge) { $('menuBtn').click(); return; }
      tickEnergy();
      if (runCtx.chapter > P.unlocked) { toast('Глава ещё закрыта'); return; }
      const cost = runCtx.challenge ? CHALLENGE_COST : RUN_COST;
      if (runCtx.challenge && P.challengeDay === today()) { toast('Испытание уже пройдено сегодня'); runCtx.challenge = false; return; }
      if (P.energy < cost) {
        if (fromOver) $('menuBtn').click();
        runCtx = { chapter: P.chapter, challenge: false };
        openEnergy(true);
        return;
      }
      if (P.energy >= ENERGY_MAX && P.energy - cost < ENERGY_MAX) P.energyAt = Date.now();
      P.energy -= cost;
      if (runCtx.challenge) P.challengeDay = today();
      save();
      closeModal();
      MS.startRun();
    },
    onRunEnd(r) {
      const ch = CHAPTERS[runCtx.chapter];
      const mul = ch.reward * (runCtx.challenge ? 3 : 1);
      const coins = Math.round((r.kills * 0.4 + r.time * 0.6) * mul * (r.won ? 1.5 : 1));
      const xp = Math.round(r.time / 4 + r.kills / 15 + (r.won ? 60 : 0));
      const extraGems = runCtx.challenge && r.time >= 240 ? 40 : 0;
      P.coins += coins; P.gems += extraGems;
      const lvUps = addXp(xp);
      const key = String(runCtx.chapter);
      const prevBest = P.best[key] || 0;
      if (!runCtx.challenge) P.best[key] = Math.max(prevBest, r.won ? 360 : Math.min(r.time, 359));
      let unlockedNew = false;
      if (r.won && !runCtx.challenge && runCtx.chapter === P.unlocked && P.unlocked < CHAPTERS.length - 1) { P.unlocked++; unlockedNew = true; }
      P.stats.runs++; P.stats.kills += r.kills; if (r.won) P.stats.wins++;
      P.stats.bestTime = Math.max(P.stats.bestTime, r.time);
      const q = quests(); q.kills += r.kills; q.runs++; q.survive = Math.max(q.survive, Math.floor(r.time));
      save();

      const cost = runCtx.challenge ? CHALLENGE_COST : RUN_COST;
      const lines = [
        `<div class="rw">${I('fish')}<b>+${coins}</b></div>`,
        `<div class="rw">${I('star')}<b>+${xp} опыта</b></div>`,
        extraGems ? `<div class="rw">${I('gem')}<b>+${extraGems}</b></div>` : '',
      ].join('');
      const notes = [
        lvUps ? `Новый уровень профиля: ${P.lvl}! +${lvUps * 10} ⚡` : '',
        unlockedNew ? `Открыта глава ${P.unlocked + 1}: ${CHAPTERS[P.unlocked].name}` : '',
        !runCtx.challenge && r.time > prevBest && !r.won ? `Новый рекорд главы: ${fmtClock(r.time)}` : '',
      ].filter(Boolean).map((n) => `<div class="note">${esc(n)}</div>`).join('');
      $('overRewards').innerHTML = `<div class="rw-title">${runCtx.challenge ? 'Награда испытания ×3' : 'Награда · ' + esc(ch.name)}</div><div class="rw-row">${lines}</div>${notes}`;
      lastWasChallenge = runCtx.challenge;
      $('againBtn').innerHTML = lastWasChallenge ? 'В лобби' : `Ещё забег <span class="cost">${I('bolt')}${cost}</span>`;
      runCtx.challenge = false;
    },
    onMenu() {
      lastWasChallenge = false;
      runCtx = { chapter: P.chapter, challenge: false };
      render();
    },
  };
  window.MeowLobby = api;

  // ---------------------------------------------------------------- static bindings
  function bindStatic() {
    document.querySelectorAll('.lb-nav button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.goto)));
    $('lbPlay').addEventListener('click', () => { runCtx = { chapter: P.chapter, challenge: false }; api.requestRun(); });
    $('lbChArt').addEventListener('click', openPick);
    $('lbChest').addEventListener('click', openChest);
    $('lbChestBack').addEventListener('click', () => { MS.sfx.click(); closeChest(); });
    $('lbChestRail').addEventListener('scroll', () => {
      const k = Math.max(0, Math.min(MILES.length - 1, Math.round($('lbChestRail').scrollLeft / railStep($('lbChestRail')))));
      if (k !== chestIdx) { chestIdx = k; MS.sfx.click(); renderChest(); }
    }, { passive: true });
    $('lbPickBack').addEventListener('click', () => { MS.sfx.click(); closePick(); });
    $('lbPickGo').addEventListener('click', confirmPick);
    $('lbPickRail').addEventListener('scroll', () => {
      const k = Math.max(0, Math.min(CHAPTERS.length - 1, Math.round($('lbPickRail').scrollLeft / pickStep())));
      if (k !== pickIdx) { pickIdx = k; MS.sfx.click(); renderPick(); }
    }, { passive: true });
    $('lbEnergyPill').addEventListener('click', () => openEnergy(false));
    $('lbDailyBtn').addEventListener('click', openDaily);
    $('lbQuestBtn').addEventListener('click', openQuests);
    $('lbStatsBtn').addEventListener('click', openStats);
    $('lbProfile').addEventListener('click', openProfile);
    $('lbSoundBtn').addEventListener('click', () => { MS.sfx.toggle(); renderTop(); });
    $('lbMClose').addEventListener('click', closeModal);
    $('lbModal').addEventListener('click', (e) => { if (e.target.id === 'lbModal') closeModal(); });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(); closePick(); closeChest(); }
      if (chestOpen()) { if (e.key === 'ArrowLeft') chestScroll(chestIdx - 1, true); else if (e.key === 'ArrowRight') chestScroll(chestIdx + 1, true); return; }
      if (!pickOpen()) return;
      if (e.key === 'ArrowLeft') pickScroll(pickIdx - 1, true);
      else if (e.key === 'ArrowRight') pickScroll(pickIdx + 1, true);
      else if (e.key === 'Enter') confirmPick();
    });
  }

  function setTab(t) {
    tab = t;
    closeChest();
    MS.sfx.click();
    document.querySelectorAll('.lb-nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('.lb-view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== t));
    $('menu').classList.toggle('dim', t !== 'battle');
    renderTab();
  }
  // ---------------------------------------------------------------- chapter picker
  let pickIdx = 0;
  const pickOpen = () => !$('lbPick').classList.contains('hidden');
  const railStep = (rail) => { const r = rail.children; return r.length > 1 ? r[1].offsetLeft - r[0].offsetLeft : 1; };
  const pickStep = () => railStep($('lbPickRail'));
  function openPick() {
    MS.sfx.click();
    pickIdx = P.chapter;
    const rail = $('lbPickRail');
    rail.innerHTML = '';
    CHAPTERS.forEach((c, k) => {
      const b = el(`<button class="lb-pickisle${k > P.unlocked ? ' locked' : ''}" aria-label="Глава ${k + 1}: ${esc(c.name)}">${chapterArt(k)}</button>`);
      b.addEventListener('click', () => (k === pickIdx ? confirmPick() : pickScroll(k, true)));
      rail.appendChild(b);
    });
    $('lbPick').classList.remove('hidden');
    pickScroll(pickIdx, false);
    renderPick();
  }
  function closePick() { $('lbPick').classList.add('hidden'); }
  function pickScroll(k, smooth) {
    if (k < 0 || k >= CHAPTERS.length) return;
    $('lbPickRail').scrollTo({ left: k * pickStep(), behavior: smooth ? 'smooth' : 'instant' });
  }
  function renderPick() {
    const i = pickIdx, ch = CHAPTERS[i], locked = i > P.unlocked, best = P.best[i] || 0;
    $('lbPickName').textContent = `${i + 1}. ${ch.name}`;
    const state = locked ? `${I('lock')}Победи в главе ${i}, чтобы открыть`
      : best >= 360 ? `${I('check')}Пройдено` : `Рекорд: ${best ? fmtClock(best) : '—'}`;
    $('lbPickDesc').innerHTML = `<p>${esc(ch.desc)}…</p><small><span>${state}</span><span>Враги ×${ch.enemyHp} · награды ×${ch.reward}</span></small>`;
    const go = $('lbPickGo');
    go.disabled = locked;
    go.textContent = locked ? 'Закрыто' : 'Выбрать';
    [...$('lbPickRail').children].forEach((b, k) => b.classList.toggle('on', k === i));
  }
  function confirmPick() {
    if (pickIdx > P.unlocked) return toast('Глава ещё закрыта');
    P.chapter = pickIdx; runCtx = { chapter: pickIdx, challenge: false }; save();
    MS.sfx.choose();
    closePick();
    renderBattle();
    const art = $('lbChArt');
    art.classList.remove('pop'); void art.offsetWidth; art.classList.add('pop');
  }

  // chapter chest screen: survival milestones of the selected chapter
  let chestIdx = 0;
  const chestOpen = () => !$('lbChestScr').classList.contains('hidden');
  const chestState = (k) => (P.chests[`${P.chapter}-${k}`] ? 'claimed' : (P.best[P.chapter] || 0) >= MILES[k].t ? 'ready' : 'todo');
  function openChest() {
    MS.sfx.click();
    // start on a reward that can be claimed, else on the next one to earn
    const st = MILES.map((_, k) => chestState(k));
    chestIdx = Math.max(0, st.includes('ready') ? st.indexOf('ready') : st.indexOf('todo'));
    const rail = $('lbChestRail');
    rail.innerHTML = '';
    MILES.forEach((m, k) => {
      const b = el(`<button class="lb-medal"><b>${fmtClock(m.t)}</b><em>Гл. ${P.chapter + 1}</em><i>✓</i></button>`);
      b.addEventListener('click', () => chestScroll(k, true));
      rail.appendChild(b);
    });
    $('lbChestScr').classList.remove('hidden');
    chestScroll(chestIdx, false);
    renderChest();
  }
  function closeChest() { $('lbChestScr').classList.add('hidden'); }
  function chestScroll(k, smooth) {
    if (k < 0 || k >= MILES.length) return;
    $('lbChestRail').scrollTo({ left: k * railStep($('lbChestRail')), behavior: smooth ? 'smooth' : 'instant' });
  }
  function renderChest() {
    const k = chestIdx, m = MILES[k], ch = CHAPTERS[P.chapter], st = chestState(k), r = scaled(m, ch);
    const best = P.best[P.chapter] || 0;
    $('lbChestGoal').textContent = `Продержись дольше ${fmtClock(m.t)}`;
    [...$('lbChestRail').children].forEach((b, n) => { b.className = `lb-medal ${chestState(n)}${n === k ? ' on' : ''}`; });
    $('lbChestRew').innerHTML = [['gem', r.gems], ['fish', r.coins]].map(([ic, v]) => `<div class="it">${I(ic)}<b>×${fmtNum(v)}</b></div>`).join('');
    const foot = $('lbChestFoot');
    if (st === 'ready') {
      foot.innerHTML = '<button class="lb-pickgo">Забрать</button>';
      foot.firstChild.addEventListener('click', () => {
        P.chests[`${P.chapter}-${k}`] = true; grant(r); save(); MS.sfx.choose();
        render(); renderChest(); rewardModal('Сундук главы', r);
      });
    } else {
      foot.innerHTML = st === 'claimed' ? `<p class="ok">${I('check')}Награда получена</p>`
        : `<p>Продержись дольше ${fmtClock(m.t)}, чтобы забрать<small>Рекорд главы: ${best ? fmtClock(best) : '—'}</small></p>`;
    }
  }

  // ---------------------------------------------------------------- rendering
  function render() { tickEnergy(); renderTop(); renderTab(); }
  function renderTab() {
    if (tab === 'battle') renderBattle();
    else if (tab === 'shop') renderShop();
    else if (tab === 'squad') renderSquad();
    else if (tab === 'evolve') renderTalents();
    else if (tab === 'challenge') renderChallenges();
  }

  function renderTop() {
    tickEnergy();
    $('lbName').textContent = P.name;
    $('lbLvl').textContent = P.lvl;
    $('lbXp').style.width = Math.min(100, (100 * P.xp) / xpNeed(P.lvl)) + '%';
    $('lbEnergy').textContent = `${P.energy}/${ENERGY_MAX}`;
    const left = ENERGY_REGEN - ((Date.now() - P.energyAt) / 1000) % ENERGY_REGEN;
    $('lbEnergyT').textContent = P.energy < ENERGY_MAX ? fmtClock(left) : '';
    $('lbCoins').textContent = fmtNum(P.coins);
    $('lbGems').textContent = fmtNum(P.gems);
    $('lbSoundIc').setAttribute('href', MS.sfx.muted ? '#i-mute' : '#i-sound');
    const ava = $('lbAva');
    if (ava.dataset.id !== MS.leader) { ava.innerHTML = ''; ava.appendChild(MS.catPortrait(leaderDef(), 1, 44)); ava.dataset.id = MS.leader; }
    $('lbDailyDot').classList.toggle('hidden', P.daily.last === today());
    const q = quests();
    $('lbQuestDot').classList.toggle('hidden', !QUESTS.some((x) => q[x.id] >= x.goal && !q.claimed.includes(x.id)));
  }
  const leaderDef = () => MS.CAT_TYPES.find((d) => d.id === MS.leader) || MS.CAT_TYPES[0];

  function renderBattle() {
    const i = P.chapter, ch = CHAPTERS[i], locked = i > P.unlocked;
    const best = P.best[i] || 0;
    $('lbChName').textContent = `${i + 1}. ${ch.name}`;
    const card = $('lbChCard');
    card.style.setProperty('--cc', ch.color);
    if (card.dataset.ch !== String(i)) { $('lbChArt').innerHTML = chapterArt(i); card.dataset.ch = i; }
    card.classList.toggle('locked', locked);
    card.classList.toggle('cleared', best >= 360);
    $('lbChMeta').innerHTML = locked
      ? `<span class="lb-tag lock">${I('lock')}Победи в главе ${i}, чтобы открыть</span>`
      : `<span class="desc">${esc(ch.desc)}</span><span class="lb-tag ${best >= 360 ? 'ok' : ''}">${best >= 360 ? I('check') + 'Пройдено' : best ? 'Рекорд: ' + fmtClock(best) : 'Рекорд: —'}</span>`;
    // chapter chest: milestones live in its modal
    const ready = MILES.some((m, k) => best >= m.t && !P.chests[`${i}-${k}`]);
    const done = MILES.every((m, k) => P.chests[`${i}-${k}`]);
    $('lbChest').classList.toggle('ready', ready);
    $('lbChest').querySelector('use').setAttribute('href', done ? '#i-chest-open' : '#i-chest');
    $('lbChestDot').classList.toggle('hidden', !ready);

    $('lbPlay').disabled = locked;
    $('lbPlay').classList.toggle('poor', P.energy < RUN_COST);
    $('lbCost').textContent = RUN_COST;
    $('best').textContent = P.stats.runs ? `Забегов: ${P.stats.runs} · побед: ${P.stats.wins} · рекорд ${fmtClock(P.stats.bestTime)}` : 'Enter — быстрый старт';
  }
  const scaled = (m, ch) => ({ gems: m.gems, coins: Math.round(m.coins * ch.reward) });

  function renderSquad() {
    $('lbPower').innerHTML = `${I('swords')}${fmtNum(squadPower())}`;
    const wrap = $('lbCats');
    wrap.innerHTML = '';
    for (const d of MS.CAT_TYPES) {
      const lv = catLvl(d.id);
      const b = document.createElement('button');
      b.className = 'lb-cat' + (d.id === MS.leader ? ' leader' : '');
      b.style.setProperty('--cc', d.magic);
      b.appendChild(MS.catPortrait(d, Math.min(5, Math.ceil(lv / 2)), 64));
      b.insertAdjacentHTML('beforeend', `<div class="nm">${esc(d.name)}</div><div class="tt">${esc(d.title)}</div><div class="lvbar"><i style="width:${(100 * lv) / CAT_MAX}%"></i><span>${lv >= CAT_MAX ? 'MAX' : `ур. ${lv}`}</span></div>` +
        (d.id === MS.leader ? '<span class="tag">Лидер</span>' : '') + (lv < CAT_MAX && P.coins >= catCost(lv) ? '<i class="dot"></i>' : ''));
      b.addEventListener('click', () => openCat(d));
      wrap.appendChild(b);
    }
  }

  function openCat(d) {
    const lv = catLvl(d.id), cost = catCost(lv), isLead = d.id === MS.leader;
    const body = el(`<div class="lb-catd" style="--cc:${d.magic}">
      <div class="pt"></div>
      <h4>${esc(d.name)}</h4><div class="tt">${d.icon} ${esc(d.title)}</div>
      <p>${esc(d.about)}</p>
      <div class="lb-statrow"><div><b>${lv}/${CAT_MAX}</b><small>Уровень</small></div><div><b>+${(lv - 1) * 10}%</b><small>Урон</small></div><div><b>${lv < CAT_MAX ? '+' + lv * 10 + '%' : '—'}</b><small>След. ур.</small></div></div>
      <div class="lb-btns">
        <button class="lb-btn ${isLead ? 'ghost' : 'blue'}" data-a="lead" ${isLead ? 'disabled' : ''}>${isLead ? 'Текущий лидер' : 'Сделать лидером'}</button>
        <button class="lb-btn gold" data-a="up" ${lv >= CAT_MAX ? 'disabled' : ''}>${lv >= CAT_MAX ? 'Максимум' : `Улучшить ${I('fish')}${cost}`}</button>
      </div>
      <small class="hint">Лидер всегда начинает забег. Прокачка в лобби усиливает кота во всех забегах.</small>
    </div>`);
    body.querySelector('.pt').appendChild(MS.catPortrait(d, Math.min(5, Math.ceil(lv / 2)), 110));
    body.querySelector('[data-a=lead]').addEventListener('click', () => { MS.setLeader(d.id); MS.sfx.meow(1.1); toast(`${d.name} ведёт отряд!`); closeModal(); render(); });
    body.querySelector('[data-a=up]').addEventListener('click', () => {
      if (P.coins < cost) return toast('Не хватает рыбок 🐟');
      P.coins -= cost; P.cats[d.id] = lv + 1; quests().upgrades++; save();
      MS.sfx.levelUp(); openCat(d); render();
    });
    openModal(body);
  }

  function renderTalents() {
    const wrap = $('lbTalents');
    wrap.innerHTML = `<p class="lb-lead">Таланты действуют в каждом забеге. Новый уровень таланта открывается с ростом уровня профиля.</p>`;
    for (const t of TALENTS) {
      const lv = talentLvl(t.id), cost = talentCost(lv), need = lv + 1, max = lv >= t.max, gated = P.lvl < need;
      const row = el(`<div class="lb-talent">
        <div class="ic">${I(t.icon)}<b>${lv}</b></div>
        <div class="tx"><b>${esc(t.name)}</b><small>${lv ? t.fmt(lv * t.per) : 'Не изучено'}${max ? '' : ` → ${t.fmt((lv + 1) * t.per)}`}</small>
          <div class="pips">${Array.from({ length: t.max }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="lb-btn gold sm" ${max || gated ? 'disabled' : ''}>${max ? 'MAX' : gated ? `${I('lock')}ур. ${need}` : `${I('fish')}${cost}`}</button>
      </div>`);
      row.querySelector('button').addEventListener('click', () => {
        if (P.coins < cost) return toast('Не хватает рыбок 🐟');
        P.coins -= cost; P.talents[t.id] = lv + 1; quests().upgrades++; save();
        MS.sfx.levelUp(); toast(`${t.name}: ур. ${lv + 1}`); render();
      });
      wrap.appendChild(row);
    }
  }

  function renderShop() {
    const wrap = $('lbShop');
    const freeReady = P.shopFree !== today();
    const offers = [
      { id: 'free', icon: 'gift', name: 'Улов дня', desc: 'Бесплатно раз в день', price: freeReady ? 'Бесплатно' : 'Завтра', cls: 'green', dis: !freeReady,
        buy: () => { P.shopFree = today(); const r = { coins: 120 + P.lvl * 20 }; grant(r); return r; } },
      { id: 'box', icon: 'basket', name: 'Корзинка котика', desc: '+1 уровень случайному коту', gems: 60, buy: () => catBox(1) },
      { id: 'box5', icon: 'basket', qty: '×5', name: 'Большая корзина', desc: '+5 уровней случайным котам', gems: 270, best: true, buy: () => catBox(5) },
      { id: 'energy', icon: 'bolt', name: 'Банка энергии', desc: '+30 энергии', gems: 40, buy: () => { const r = { energy: 30 }; grant(r); return r; } },
      { id: 'fish', icon: 'fish', name: 'Мешок рыбки', desc: '+800 рыбок', gems: 50, buy: () => { const r = { coins: 800 }; grant(r); return r; } },
      { id: 'fish2', icon: 'barrel', name: 'Бочка рыбки', desc: '+4000 рыбок', gems: 200, buy: () => { const r = { coins: 4000 }; grant(r); return r; } },
    ];
    wrap.innerHTML = '<div class="lb-shopgrid"></div>';
    const grid = wrap.firstChild;
    for (const o of offers) {
      const card = el(`<div class="lb-offer ${o.best ? 'best' : ''}">${o.best ? '<span class="ribbon">Выгодно</span>' : ''}
        <div class="art">${I(o.icon)}${o.qty ? `<span class="qty">${o.qty}</span>` : ''}</div><b>${esc(o.name)}</b><small>${esc(o.desc)}</small>
        <button class="lb-btn ${o.cls || 'blue'} sm" ${o.dis ? 'disabled' : ''}>${o.price || I('gem') + o.gems}</button></div>`);
      card.querySelector('button').addEventListener('click', () => {
        if (o.gems && P.gems < o.gems) return toast('Не хватает кристаллов 💎 — проходи главы и задания');
        if (o.gems) P.gems -= o.gems;
        const r = o.buy(); save(); MS.sfx.choose();
        if (r && r.cats) catBoxModal(r.cats); else rewardModal(o.name, r);
        render();
      });
      grid.appendChild(card);
    }
    wrap.insertAdjacentHTML('beforeend', `<p class="lb-lead small">Кристаллы ${I('gem')} добываются в сундуках глав, ежедневных наградах, заданиях и испытаниях.</p>`);
  }
  function catBox(n) {
    const got = [];
    for (let k = 0; k < n; k++) {
      const pool = MS.CAT_TYPES.filter((d) => catLvl(d.id) < CAT_MAX);
      if (!pool.length) { P.coins += 500; got.push(null); continue; }
      const d = pool[(Math.random() * pool.length) | 0];
      P.cats[d.id] = catLvl(d.id) + 1;
      got.push(d);
    }
    return { cats: got };
  }
  function catBoxModal(list) {
    const body = el(`<div class="lb-rwm"><h4>Котики в корзинке!</h4><div class="lb-boxgrid"></div></div>`);
    list.forEach((d, k) => {
      const c = el(`<div class="it" style="animation-delay:${k * 0.12}s;--cc:${d ? d.magic : '#ffd166'}"></div>`);
      if (d) { c.appendChild(MS.catPortrait(d, 1, 60)); c.insertAdjacentHTML('beforeend', `<b>${esc(d.name)}</b><small>ур. ${catLvl(d.id)}</small>`); }
      else c.innerHTML = `<div class="big">${I('fish')}</div><b>+500</b><small>все коты MAX</small>`;
      body.querySelector('.lb-boxgrid').appendChild(c);
    });
    MS.sfx.meow(1.2);
    openModal(body);
  }

  function renderChallenges() {
    const wrap = $('lbChallenges');
    const done = P.challengeDay === today();
    const ch = CHAPTERS[P.unlocked];
    wrap.innerHTML = '';
    const night = el(`<div class="lb-chal" style="--cc:#c86bff">
      <div class="hd"><span class="ic">${I('moon')}</span><div><b>Ночь Мракуса</b><small>Ежедневное · глава ${P.unlocked + 1}: ${esc(ch.name)}</small></div></div>
      <p>Враги вдвое крепче, но награда ×3. Продержись 4:00 — получи ещё ${I('gem')}40.</p>
      <button class="lb-btn purple" ${done ? 'disabled' : ''}>${done ? 'Пройдено сегодня' : `Начать ${I('bolt')}${CHALLENGE_COST}`}</button>
    </div>`);
    night.querySelector('button').addEventListener('click', () => { runCtx = { chapter: P.unlocked, challenge: true }; api.requestRun(); });
    wrap.appendChild(night);
    wrap.appendChild(el(`<div class="lb-chal soon"><div class="hd"><span class="ic">${I('inf')}</span><div><b>Бесконечная орда</b><small>Скоро</small></div></div><p>Сколько продержится твой отряд без таймера?</p><button class="lb-btn ghost" disabled>${I('lock')}Откроется с 10 ур. профиля</button></div>`));
    wrap.appendChild(el(`<div class="lb-chal soon"><div class="hd"><span class="ic">${I('tower')}</span><div><b>Башня котов</b><small>Скоро</small></div></div><p>Поднимайся по этажам и забирай редких котов.</p><button class="lb-btn ghost" disabled>${I('lock')}В разработке</button></div>`));
  }

  // ---------------------------------------------------------------- modals
  function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function openModal(node) { const b = $('lbMBody'); b.innerHTML = ''; b.appendChild(node); $('lbModal').classList.remove('hidden'); }
  function closeModal() { $('lbModal').classList.add('hidden'); }
  let toastT = 0;
  function toast(msg) {
    const t = $('lbToast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function rewardModal(title, r) {
    const items = [r.coins && ['fish', r.coins], r.gems && ['gem', r.gems], r.energy && ['bolt', r.energy]].filter(Boolean);
    const body = el(`<div class="lb-rwm"><h4>${esc(title)}</h4><div class="lb-boxgrid">${items.map(([i, v], k) => `<div class="it" style="animation-delay:${k * 0.1}s"><div class="big">${I(i)}</div><b>+${v}</b></div>`).join('')}</div>
      <button class="lb-btn gold">Забрать</button></div>`);
    body.querySelector('button').addEventListener('click', closeModal);
    openModal(body);
  }

  function openEnergy(lack) {
    tickEnergy();
    const body = el(`<div class="lb-rwm"><h4>${lack ? 'Не хватает энергии' : 'Энергия'}</h4>
      <div class="big-e">${I('bolt')}${P.energy}/${ENERGY_MAX}</div>
      <p class="lb-lead">+1 ${I('bolt')} каждые ${ENERGY_REGEN / 60} минут. Забег стоит ${RUN_COST} ${I('bolt')}. Новый уровень профиля даёт +10 ${I('bolt')}.</p>
      <div class="lb-btns"><button class="lb-btn blue" data-a="buy">+30 ${I('bolt')} за ${I('gem')}40</button><button class="lb-btn ghost" data-a="x">Закрыть</button></div></div>`);
    body.querySelector('[data-a=buy]').addEventListener('click', () => {
      if (P.gems < 40) return toast('Не хватает кристаллов 💎');
      P.gems -= 40; P.energy += 30; save(); MS.sfx.choose(); render(); openEnergy(false);
    });
    body.querySelector('[data-a=x]').addEventListener('click', closeModal);
    openModal(body);
  }

  function openDaily() {
    const ready = P.daily.last !== today();
    const body = el(`<div class="lb-rwm"><h4>Ежедневная награда</h4><p class="lb-lead">Заходи каждый день — на 7-й день большой подарок.</p>
      <div class="lb-daily">${DAILY.map((r, k) => {
        const st = k < P.daily.idx ? 'got' : k === P.daily.idx && ready ? 'now' : '';
        const ic = I(r.catLvl ? 'paw' : r.gems ? 'gem' : r.energy ? 'bolt' : 'fish');
        return `<div class="d ${st} ${k === 6 ? 'big' : ''}"><small>День ${k + 1}</small><span>${ic}</span><b>${r.coins || r.gems || r.energy}</b>${st === 'got' ? `<i>${I('check')}</i>` : ''}</div>`;
      }).join('')}</div>
      <button class="lb-btn gold" ${ready ? '' : 'disabled'}>${ready ? 'Забрать' : 'Возвращайся завтра'}</button></div>`);
    body.querySelector('button').addEventListener('click', () => {
      const r = Object.assign({}, DAILY[P.daily.idx]);
      grant(r);
      let extra = null;
      if (r.catLvl) extra = catBox(1).cats;
      P.daily.last = today(); P.daily.idx = (P.daily.idx + 1) % DAILY.length;
      save(); MS.sfx.choose(); render();
      if (extra) catBoxModal(extra); else rewardModal('Награда дня', r);
    });
    openModal(body);
  }

  function openQuests() {
    const q = quests();
    const body = el(`<div class="lb-rwm"><h4>Задания дня</h4><div class="lb-quests"></div><small class="hint">Обновляются каждый день</small></div>`);
    const list = body.querySelector('.lb-quests');
    for (const x of QUESTS) {
      const v = Math.min(x.goal, q[x.id] || 0), done = v >= x.goal, claimed = q.claimed.includes(x.id);
      const shown = x.id === 'survive' ? `${fmtClock(v)} / ${fmtClock(x.goal)}` : `${v} / ${x.goal}`;
      const row = el(`<div class="q ${claimed ? 'claimed' : ''}"><div class="tx"><b>${esc(x.name)}</b><div class="bar"><i style="width:${(100 * v) / x.goal}%"></i><span>${shown}</span></div></div>
        <button class="lb-btn ${done && !claimed ? 'gold' : 'ghost'} sm" ${done && !claimed ? '' : 'disabled'}>${claimed ? I('check') : I('gem') + x.gems}</button></div>`);
      row.querySelector('button').addEventListener('click', () => { q.claimed.push(x.id); P.gems += x.gems; save(); MS.sfx.choose(); toast(`+${x.gems} 💎`); render(); openQuests(); });
      list.appendChild(row);
    }
    openModal(body);
  }

  function openStats() {
    const rows = CHAPTERS.map((c, i) => {
      const b = P.best[i] || 0;
      return `<div class="q"><div class="tx"><b><i class="sw" style="--cc:${c.color}"></i>${i + 1}. ${esc(c.name)}</b></div><span class="val">${i > P.unlocked ? I('lock') : b >= 360 ? I('check') + 'Победа' : b ? fmtClock(b) : '—'}</span></div>`;
    }).join('');
    const body = el(`<div class="lb-rwm"><h4>Рекорды</h4>
      <div class="lb-statrow"><div><b>${P.stats.runs}</b><small>Забегов</small></div><div><b>${P.stats.wins}</b><small>Побед</small></div><div><b>${fmtNum(P.stats.kills)}</b><small>Врагов</small></div></div>
      <div class="lb-quests">${rows}</div></div>`);
    openModal(body);
  }

  function openProfile() {
    const body = el(`<div class="lb-rwm"><h4>Профиль</h4>
      <div class="pt"></div>
      <label class="lb-field">Имя мага<input maxlength="14" value="${esc(P.name)}" /></label>
      <div class="lb-statrow"><div><b>${P.lvl}</b><small>Уровень</small></div><div><b>${fmtNum(squadPower())}</b><small>Сила</small></div><div><b>${P.unlocked + 1}/${CHAPTERS.length}</b><small>Глав</small></div></div>
      <div class="lb-btns"><button class="lb-btn gold" data-a="save">Сохранить</button><button class="lb-btn ghost" data-a="reset">Сбросить прогресс</button></div></div>`);
    body.querySelector('.pt').appendChild(MS.catPortrait(leaderDef(), 3, 90));
    const inp = body.querySelector('input');
    inp.addEventListener('keydown', (e) => e.stopPropagation());
    body.querySelector('[data-a=save]').addEventListener('click', () => { P.name = inp.value.trim().slice(0, 14) || 'Маг'; save(); closeModal(); render(); });
    body.querySelector('[data-a=reset]').addEventListener('click', (e) => {
      const b = e.currentTarget;
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Точно? Нажми ещё раз'; b.classList.add('danger'); return; }
      P = freshProfile(); runCtx = { chapter: 0, challenge: false }; save(); MS.setLeader('fire'); closeModal(); render(); toast('Прогресс сброшен');
    });
    openModal(body);
  }
})();
