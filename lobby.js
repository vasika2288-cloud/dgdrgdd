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
  const MILES = [
    { t: 120, label: '2:00', gems: 20, coins: 100 },
    { t: 240, label: '4:00', gems: 30, coins: 200 },
    { t: 360, label: 'Победа', gems: 60, coins: 500, win: true },
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
  const SCENES = [
    // 0 meadow: rolling hills, grass, a big mint leaf
    (c) => ({
      back: `<path d="M0 96 Q50 70 105 88 T215 82 T340 90 V150 H0z" fill="${mix(c, '#0b0718', 0.45)}"/>`,
      emblem: `<path d="M170 26c30 9 38 44 14 70-6 6-14 8-14 8s-8-2-14-8c-24-26-16-61 14-70z" fill="#7ee081" stroke="#174a24" stroke-width="3.5" stroke-linejoin="round"/><path d="M170 36v66M170 58l-12-9M170 74l13-10M170 88l-10-7" stroke="#174a24" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M160 40c-8 8-10 20-6 30" stroke="#c9ffcb" stroke-width="3" stroke-linecap="round" fill="none"/>`,
      front: Array.from({ length: 14 }, (_, k) => { const x = 10 + k * 24 + (k % 3) * 5, y = 128 - (k % 2) * 4; return `<path d="M${x} ${y + 8}l3-12 2 9 4-14 2 17" fill="none" stroke="${mix(c, '#ffffff', 0.15)}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`; }).join(''),
    }),
    // 1 cheese catacombs: stone arches and a cheese wedge
    (c) => ({
      back: [30, 250].map((x) => `<path d="M${x} 150V88a30 30 0 0 1 60 0V150z" fill="${mix(c, '#0b0718', 0.5)}"/><path d="M${x + 12} 150V92a18 18 0 0 1 36 0V150z" fill="${mix(c, '#0b0718', 0.82)}"/>`).join(''),
      emblem: `<path d="M126 100 214 100 214 62z" fill="#ffd23f" stroke="#6b4300" stroke-width="3.5" stroke-linejoin="round"/><path d="M126 100 214 62 214 46 126 86z" fill="#ffe98a" stroke="#6b4300" stroke-width="3.5" stroke-linejoin="round"/><g fill="#d99a1e"><circle cx="190" cy="86" r="6"/><circle cx="168" cy="93" r="4"/><circle cx="204" cy="76" r="3.5"/></g>`,
      front: '',
    }),
    // 2 ice attic: roof beams, icicles, a snowflake
    (c) => ({
      back: `<path d="M-10 150 170 34 350 150z" fill="${mix(c, '#0b0718', 0.6)}"/><path d="M20 150 170 52 320 150z" fill="${mix(c, '#0b0718', 0.8)}"/>`,
      emblem: `<g transform="translate(170 66)" stroke-linecap="round">${[0, 60, 120].map((a) => `<g transform="rotate(${a})"><path d="M0-36V36M-9-27 0-18 9-27M-9 27 0 18 9 27" fill="none" stroke="#0f3f63" stroke-width="9"/><path d="M0-36V36M-9-27 0-18 9-27M-9 27 0 18 9 27" fill="none" stroke="#e6faff" stroke-width="4.5"/></g>`).join('')}</g>`,
      front: Array.from({ length: 22 }, (_, k) => `<circle cx="${(k * 53) % 340}" cy="${(k * 37) % 120 + 6}" r="${1 + (k % 3) * 0.6}" fill="#fff" opacity=".7"/>`).join(''),
    }),
    // 3 storm roofs: city rooftops, clouds and a lightning bolt
    (c) => ({
      back: `<path d="M0 150V104h28V86h10v18h30V94l22-16 22 16v56zM122 150V98h42v-14h10v14h34v52zM210 150V90l26-18 26 18v-6h10v6h14v8h54v52z" fill="${mix(c, '#0b0718', 0.55)}"/><g fill="${mix(c, '#ffffff', 0.25)}" opacity=".55"><ellipse cx="70" cy="30" rx="48" ry="14"/><ellipse cx="280" cy="24" rx="56" ry="15"/></g>`,
      emblem: `<path d="M182 16 140 74h26l-8 44 44-62h-26z" fill="#ffd23f" stroke="#6b4300" stroke-width="3.5" stroke-linejoin="round"/><path d="M174 30 154 60" stroke="#fff6c2" stroke-width="4" stroke-linecap="round"/>`,
      front: Array.from({ length: 18 }, (_, k) => { const x = (k * 41) % 340, y = (k * 29) % 110; return `<path d="M${x} ${y}l-5 12" stroke="#cfe3ff" stroke-width="1.5" opacity=".45"/>`; }).join(''),
    }),
    // 4 Mrakus' throne: castle silhouette and a crown
    (c) => ({
      back: `<path d="M40 150V84h-8V68h12v8h8v-8h12v16h-8v22h40V60h-8V44h12v8h8v-8h12v8h8v-8h12v16h-8v46h40V84h-8V68h12v8h8v-8h12v16h-8v66z" fill="${mix(c, '#0b0718', 0.6)}" transform="translate(70 0)"/>`,
      emblem: `<path d="M132 96 124 46l26 20 20-34 20 34 26-20-8 50z" fill="#ffd23f" stroke="#6b4300" stroke-width="3.5" stroke-linejoin="round"/><rect x="130" y="94" width="80" height="12" rx="4" fill="#e0a52e" stroke="#6b4300" stroke-width="3.5"/><g fill="#ff4d6d" stroke="#6b0f22" stroke-width="2"><circle cx="170" cy="74" r="6"/><circle cx="146" cy="80" r="4"/><circle cx="194" cy="80" r="4"/></g>`,
      front: Array.from({ length: 12 }, (_, k) => `<circle cx="${(k * 61) % 340}" cy="${150 - ((k * 23) % 50)}" r="${1.5 + (k % 3)}" fill="#ff9a6b" opacity=".55"/>`).join(''),
    }),
  ];
  function chapterArt(i) {
    const c = CHAPTERS[i].color, sc = SCENES[i % SCENES.length](c);
    const stars = Array.from({ length: 16 }, (_, k) => `<circle cx="${(k * 89 + 17) % 340}" cy="${(k * 47 + 9) % 70}" r="${k % 4 ? 0.9 : 1.6}" fill="#fff" opacity="${0.35 + (k % 3) * 0.2}"/>`).join('');
    return `<svg viewBox="0 0 340 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs><linearGradient id="lbSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(c, '#07040f', 0.78)}"/><stop offset="1" stop-color="${mix(c, '#150f26', 0.35)}"/></linearGradient>
      <radialGradient id="lbGlow"><stop offset="0" stop-color="${c}" stop-opacity=".9"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs>
      <rect width="340" height="150" fill="url(#lbSky)"/>${stars}
      <circle cx="170" cy="70" r="78" fill="url(#lbGlow)" opacity=".55"/>
      ${sc.back}
      <path d="M0 122 Q85 104 170 116 T340 112 V150 H0z" fill="${mix(c, '#0b0718', 0.72)}"/>
      <ellipse cx="170" cy="118" rx="56" ry="9" fill="#000" opacity=".35"/>
      <g class="emb">${sc.emblem}</g>
      ${sc.front}
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
    $('lbPrev').addEventListener('click', () => shiftChapter(-1));
    $('lbNext').addEventListener('click', () => shiftChapter(1));
    $('lbEnergyPill').addEventListener('click', () => openEnergy(false));
    $('lbDailyBtn').addEventListener('click', openDaily);
    $('lbQuestBtn').addEventListener('click', openQuests);
    $('lbStatsBtn').addEventListener('click', openStats);
    $('lbProfile').addEventListener('click', openProfile);
    $('lbSoundBtn').addEventListener('click', () => { MS.sfx.toggle(); renderTop(); });
    $('lbMClose').addEventListener('click', closeModal);
    $('lbModal').addEventListener('click', (e) => { if (e.target.id === 'lbModal') closeModal(); });
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    // swipe between chapters on the stage
    let sx = null;
    const stage = document.querySelector('.lb-chapter');
    stage.addEventListener('pointerdown', (e) => { sx = e.clientX; });
    stage.addEventListener('pointerup', (e) => { if (sx != null && Math.abs(e.clientX - sx) > 50) shiftChapter(e.clientX < sx ? 1 : -1); sx = null; });
  }

  function setTab(t) {
    tab = t;
    MS.sfx.click();
    document.querySelectorAll('.lb-nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    document.querySelectorAll('.lb-view').forEach((v) => v.classList.toggle('hidden', v.dataset.view !== t));
    $('menu').classList.toggle('dim', t !== 'battle');
    renderTab();
  }
  function shiftChapter(d) {
    const n = P.chapter + d;
    if (n < 0 || n >= CHAPTERS.length) return;
    P.chapter = n; runCtx = { chapter: n, challenge: false }; save();
    MS.sfx.click();
    renderBattle();
    const card = $('lbChCard');
    card.classList.remove('slide-l', 'slide-r'); void card.offsetWidth; card.classList.add(d > 0 ? 'slide-l' : 'slide-r');
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
    $('lbChNum').textContent = `Глава ${i + 1}`;
    $('lbChName').textContent = ch.name;
    const card = $('lbChCard');
    card.style.setProperty('--cc', ch.color);
    if (card.dataset.ch !== String(i)) { $('lbChArt').innerHTML = chapterArt(i); card.dataset.ch = i; }
    card.classList.toggle('locked', locked);
    card.classList.toggle('cleared', best >= 360);
    $('lbChMeta').innerHTML = locked
      ? `<span class="lb-tag lock">${I('lock')}Победи в главе ${i}, чтобы открыть</span>`
      : `<span class="desc">${esc(ch.desc)}</span><span class="lb-tag ${best >= 360 ? 'ok' : ''}">${best >= 360 ? I('check') + 'Пройдено' : best ? I('clock') + 'Рекорд ' + fmtClock(best) : I('star') + 'Новая глава'}</span>`;
    $('lbChDots').innerHTML = CHAPTERS.map((c, k) => `<i class="${k === i ? 'on' : ''} ${k > P.unlocked ? 'lk' : ''}" style="--cc:${c.color}"></i>`).join('');
    $('lbPrev').disabled = i === 0;
    $('lbNext').disabled = i === CHAPTERS.length - 1;

    // milestone chests
    const miles = $('lbMiles');
    miles.innerHTML = `<div class="hd"><span>Награды главы</span><small>${locked ? 'Глава закрыта' : `Продержись ${fmtClock(Math.min(best, 360))} / 6:00`}</small></div><div class="rail"><div class="track"><i style="width:${Math.min(100, (100 * best) / 360)}%"></i></div></div>`;
    MILES.forEach((m, k) => {
      const id = `${i}-${k}`;
      const reached = best >= m.t, claimed = !!P.chests[id];
      const b = document.createElement('button');
      b.className = 'chest' + (claimed ? ' claimed' : reached ? ' ready' : '');
      b.style.left = `${(100 * m.t) / 360}%`;
      b.innerHTML = `<span>${I(claimed ? 'chest-open' : 'chest')}${claimed ? `<b class="ok">${I('check')}</b>` : ''}</span><em>${m.label}</em>`;
      b.addEventListener('click', () => {
        if (claimed) return toast('Награда уже получена');
        if (!reached) return toast(`Продержись ${m.label === 'Победа' ? 'до конца главы' : m.label}: ${rewardText(scaled(m, ch))}`);
        const r = scaled(m, ch);
        P.chests[id] = true; grant(r); save(); MS.sfx.choose();
        rewardModal('Сундук главы', r); render();
      });
      miles.querySelector('.rail').appendChild(b);
    });

    const ld = leaderDef();
    const lead = $('lbLeader');
    lead.innerHTML = '';
    lead.style.setProperty('--cc', ld.magic);
    lead.appendChild(MS.catPortrait(ld, 1, 38));
    lead.insertAdjacentHTML('beforeend', `<span class="who"><small>Лидер · ур. ${catLvl(ld.id)}</small><b>${esc(ld.name)}</b></span><span class="pw">${I('swords')}${fmtNum(squadPower())}</span>`);
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
