/* Meow Squad — browser prototype (HTML5 Canvas, no dependencies) */
(() => {
  'use strict';

  // ------------------------------------------------------------------
  // Tunables
  // ------------------------------------------------------------------
  const RUN_TIME = 360;      // 6 minute run
  const BOSS_TIME = 300;     // boss arrives at 5:00
  const SWARM_TIMES = [90, 180, 260];
  const MAX_ENEMIES = 380;
  const MAX_CATS = 8;
  const MAX_GEMS = 450;
  const CELL = 64;
  const MAX_ENEMY_R = 56;
  const TAU = Math.PI * 2;

  const CAT_MAX_LVL = 5;
  const SQUAD_R = 92;        // how far from the hero the cats like to roam

  const HERO_SPEED = 170;
  const HERO_MAGNET = 90;
  const DASH_DIST = 140;     // px
  const DASH_TIME = 0.16;    // sec spent travelling
  const DASH_CD = 4.5;       // sec
  const DASH_IFRAMES = 0.32; // sec of invulnerability
  const BAT_FIRST = 50;      // first bat pack
  const SPITTER_FROM = 70;   // spitters join the horde
  const MAX_SPITTERS = 14;

  // Each cat is its own character with its own attack. Stat arrays are per level (1..5).
  // up[] describes what the NEXT level gives (index = new level - 2).
  const CAT_TYPES = [
    { id: 'fire', name: 'Рыжик', title: 'Огненный шар', icon: '🔥', fur: '#ff8a3d', stripe: '#c85a1a', hat: '#8a1f1f', magic: '#ff6a1a',
      about: 'Бросает огненный шар, который взрывается и поджигает всех рядом',
      st: { dmg: [16, 21, 25, 30, 38], cd: [1.35, 1.25, 1.12, 1.0, 0.9], aoe: [46, 54, 64, 70, 84], n: [1, 1, 1, 2, 2], range: 300 },
      up: ['Урон взрыва +30%', 'Взрыв шире, кидает чаще', '2 огненных шара за раз', 'Огромный взрыв и +25% урона'] },
    { id: 'star', name: 'Лаванда', title: 'Звёздные стрелы', icon: '✨', fur: '#a99cff', stripe: '#7d6fe0', hat: '#2b1d73', magic: '#d7a8ff',
      about: 'Выпускает самонаводящиеся звёзды, которые сами находят врагов',
      st: { dmg: [9, 11, 12, 14, 17], cd: [1.05, 1.0, 0.92, 0.85, 0.78], n: [2, 3, 3, 4, 5], range: 340 },
      up: ['+1 звезда', 'Звёзды сильнее, залп чаще', '+1 звезда', '+1 звезда и +20% урона'] },
    { id: 'sun', name: 'Солнце', title: 'Солнечный луч', icon: '☀️', fur: '#ffd166', stripe: '#e0a52e', hat: '#b5651d', magic: '#fff1a8',
      about: 'Прожигает лучом всех врагов на прямой линии',
      st: { dmg: [15, 19, 23, 27, 33], cd: [1.7, 1.55, 1.45, 1.35, 1.2], w: [12, 14, 17, 19, 24], beams: [1, 1, 1, 2, 3], range: 330 },
      up: ['Урон луча +25%', 'Луч толще и чаще', 'Второй луч в другую сторону', 'Три луча веером, ещё толще'] },
    { id: 'ice', name: 'Ледышка', title: 'Ледяные осколки', icon: '❄️', fur: '#bfefff', stripe: '#7cc6e0', hat: '#1d4e89', magic: '#5ee7ff',
      about: 'Веер острых льдинок, которые замедляют врагов',
      st: { dmg: [7, 9, 10, 12, 14], cd: [1.15, 1.05, 0.98, 0.9, 0.8], n: [3, 3, 4, 5, 6], slow: [0.35, 0.42, 0.48, 0.55, 0.65], pierce: [0, 0, 1, 1, 2], range: 260 },
      up: ['Сильнее замедление и урон', '+1 осколок, пробивают врага', '+1 осколок', '+1 осколок, почти заморозка'] },
    { id: 'yarn', name: 'Зефир', title: 'Клубок-бумеранг', icon: '🧶', fur: '#ffb3cf', stripe: '#e07aa0', hat: '#7a1f5c', magic: '#ff6fa8',
      about: 'Кидает клубок, который летит сквозь врагов и возвращается',
      st: { dmg: [12, 15, 18, 22, 27], cd: [1.9, 1.8, 1.7, 1.6, 1.45], n: [1, 1, 2, 2, 3], size: [10, 11, 12, 13, 15], range: 250 },
      up: ['Урон +25%', 'Второй клубок', 'Клубки больше и сильнее', 'Третий клубок'] },
    { id: 'mint', name: 'Мятка', title: 'Мятная бомба', icon: '🌿', fur: '#9fe8a3', stripe: '#5fb866', hat: '#24572b', magic: '#7ee081',
      about: 'Подбрасывает бомбу с мятой — ядовитое облако жжёт врагов',
      st: { dmg: [5, 6, 7, 9, 11], cd: [2.3, 2.1, 1.95, 1.8, 1.6], r: [46, 52, 58, 64, 76], dur: [2.6, 2.9, 3.2, 3.5, 4.0], n: [1, 1, 1, 2, 2], range: 300 },
      up: ['Облако больше и дольше', 'Яд сильнее', 'Две бомбы за раз', 'Огромное ядовитое облако'] },
    { id: 'spark', name: 'Искра', title: 'Цепная молния', icon: '⚡', fur: '#f4f1de', stripe: '#c9c3a6', hat: '#3a3f8f', magic: '#8fd3ff',
      about: 'Бьёт молнией, которая перескакивает с врага на врага',
      st: { dmg: [11, 13, 15, 18, 22], cd: [1.3, 1.2, 1.1, 1.0, 0.88], chain: [2, 3, 4, 5, 7], range: 280 },
      up: ['+1 прыжок молнии', '+1 прыжок, урон выше', '+1 прыжок, бьёт чаще', '+2 прыжка и +20% урона'] },
    { id: 'shadow', name: 'Чара', title: 'Теневые когти', icon: '🐾', fur: '#3d2f5c', stripe: '#2a1f40', hat: '#111', magic: '#c86bff',
      about: 'Сама бросается на врагов и рвёт их когтями вблизи',
      st: { dmg: [18, 23, 27, 33, 42], cd: [0.95, 0.88, 0.8, 0.72, 0.62], r: [50, 54, 60, 66, 76], range: 190 },
      up: ['Урон когтей +25%', 'Шире удар, бьёт чаще', 'Ещё сильнее и быстрее', 'Удар во все стороны'] },
  ];
  // Passive items (relics). Stack up to `max` times.
  const ITEMS = [
    { id: 'bell', name: 'Мятный колокольчик', icon: '🔔', color: '#7ee081', max: 3, desc: '+12% к скорости героя' },
    { id: 'magnet', name: 'Кошачий магнит', icon: '🧲', color: '#ff6b85', max: 3, desc: '+40% к радиусу сбора кристаллов' },
    { id: 'oil', name: 'Рыбий жир', icon: '🐠', color: '#ffb36b', max: 3, desc: 'Регенерация +1 HP каждые 3 сек' },
    { id: 'wool', name: 'Волшебный клубок', icon: '🌀', color: '#d7a8ff', max: 3, desc: '−10% к перезарядке всех котов' },
    { id: 'eye', name: 'Острое зрение', icon: '👁️', color: '#5ee7ff', max: 3, desc: '+15% к дальности и размеру заклинаний' },
  ];
  const AREA_KEYS = { range: 1, aoe: 1, r: 1, w: 1, size: 1 };
  const catStat = (c, k) => {
    let v = c.def.st[k];
    if (Array.isArray(v)) v = v[c.lvl - 1];
    if (k === 'dmg' && G && G.boost) v *= G.boost.dmg * (G.boost.cat[c.def.id] || 1);
    if (G && G.mods) {
      if (k === 'cd') v *= G.mods.cd;
      else if (AREA_KEYS[k]) v *= G.mods.area;
    }
    return v;
  };

  const ENEMY = {
    mouse: { r: 11, hp: 14, speed: 104, dmg: 8, xp: 1 },
    brute: { r: 21, hp: 75, speed: 56, dmg: 18, xp: 4 },
    spitter: { r: 14, hp: 24, speed: 88, dmg: 8, xp: 3 },
    bat:   { r: 8, hp: 4, speed: 158, dmg: 5, xp: 1 },
    boss:  { r: 54, hp: 6800, speed: 64, dmg: 30, xp: 0 },
  };

  // ------------------------------------------------------------------
  // Canvas
  // ------------------------------------------------------------------
  const canvas = document.getElementById('game');
  let ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const $ = (id) => document.getElementById(id);
  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function ell(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }
  function hash(x, y) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function fmtTime(t) {
    t = Math.max(0, Math.floor(t));
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }

  // ------------------------------------------------------------------
  // Sound: tiny Web Audio synthesizer, no audio files
  // ------------------------------------------------------------------
  const Sfx = (() => {
    let ac = null, master = null, noiseBuf = null;
    let muted = false;
    try { muted = localStorage.getItem('meowsquad-mute') === '1'; } catch (_) { /* ignore */ }
    const last = Object.create(null);
    let voices = 0;
    const MAX_VOICES = 28;

    function unlock() {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { ac = new AC(); } catch (_) { ac = null; return; }
        master = ac.createGain();
        master.gain.value = muted ? 0 : 0.55;
        const comp = ac.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        master.connect(comp); comp.connect(ac.destination);
        noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === 'suspended') ac.resume();
    }
    // throttle so 300 enemies don't produce 300 sounds per frame
    function ok(name, gap) {
      if (!ac || muted || ac.state !== 'running' || voices > MAX_VOICES) return false;
      const t = ac.currentTime;
      if (last[name] !== undefined && t - last[name] < gap) return false;
      last[name] = t;
      return true;
    }
    function env(g, t0, vol, attack, dur) {
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    }
    function track(node, end) {
      voices++;
      node.onended = () => { voices--; };
      node.stop(end);
    }
    function tone(o) {
      const t0 = ac.currentTime + (o.at || 0), dur = o.dur || 0.15;
      const osc = ac.createOscillator(), g = ac.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.f, t0);
      if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + (o.glide || dur));
      if (o.detune) osc.detune.value = o.detune;
      env(g, t0, o.vol || 0.15, o.attack || 0.005, dur);
      osc.connect(g);
      if (o.filter) {
        const f = ac.createBiquadFilter(); f.type = o.filter; f.frequency.value = o.ff || 1200; f.Q.value = o.q || 1;
        g.connect(f); f.connect(master);
      } else g.connect(master);
      osc.start(t0); track(osc, t0 + dur + 0.03);
    }
    function noise(o) {
      const t0 = ac.currentTime + (o.at || 0), dur = o.dur || 0.2;
      const src = ac.createBufferSource(); src.buffer = noiseBuf;
      const f = ac.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.Q.value = o.q || 1;
      f.frequency.setValueAtTime(o.f || 1000, t0);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t0 + dur);
      const g = ac.createGain(); env(g, t0, o.vol || 0.15, o.attack || 0.003, dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t0, Math.random() * 0.5); track(src, t0 + dur + 0.03);
    }
    // a little "meow": nasal saw with a formant sweep, pitch up then down
    function meowAt(at, pitch, vol) {
      const t0 = ac.currentTime + at, dur = 0.42;
      const osc = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420 * pitch, t0);
      osc.frequency.linearRampToValueAtTime(780 * pitch, t0 + 0.12);
      osc.frequency.linearRampToValueAtTime(560 * pitch, t0 + dur);
      f.type = 'bandpass'; f.Q.value = 5;
      f.frequency.setValueAtTime(900, t0);
      f.frequency.linearRampToValueAtTime(2100, t0 + 0.13);
      f.frequency.linearRampToValueAtTime(800, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.05);
      g.gain.setValueAtTime(vol, t0 + 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(f); f.connect(g); g.connect(master);
      osc.start(t0); track(osc, t0 + dur + 0.03);
    }
    const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
    function melody(notes, step, type, vol) {
      notes.forEach((n, i) => {
        if (n == null) return;
        tone({ type: type || 'triangle', f: NOTE(n), dur: step * 1.6, vol: vol || 0.12, at: i * step, attack: 0.01 });
        tone({ type: 'square', f: NOTE(n), dur: step * 1.2, vol: (vol || 0.12) * 0.25, at: i * step, attack: 0.01, filter: 'lowpass', ff: 2200 });
      });
    }

    return {
      unlock,
      get muted() { return muted; },
      toggle() {
        muted = !muted;
        try { localStorage.setItem('meowsquad-mute', muted ? '1' : '0'); } catch (_) { /* ignore */ }
        if (master) master.gain.value = muted ? 0 : 0.55;
        return muted;
      },
      meow(pitch) { if (ok('meow', 0.15)) meowAt(0, pitch || 1, 0.22); },
      step() { if (ok('step', 0.2)) noise({ f: 500, f2: 180, dur: 0.05, vol: 0.035, filter: 'lowpass' }); },
      fire() { if (ok('fire', 0.07)) noise({ f: 2400, f2: 500, dur: 0.18, vol: 0.07, filter: 'bandpass', q: 0.8 }); },
      boom() {
        if (!ok('boom', 0.06)) return;
        noise({ f: 900, f2: 90, dur: 0.32, vol: 0.2, filter: 'lowpass' });
        tone({ type: 'sine', f: 140, f2: 45, dur: 0.25, vol: 0.14 });
      },
      star() { if (ok('star', 0.08)) { const f = rand(1300, 1700); tone({ type: 'sine', f, f2: f * 1.6, dur: 0.12, vol: 0.05 }); tone({ type: 'sine', f: f * 1.5, dur: 0.1, vol: 0.03, at: 0.04 }); } },
      beam() { if (ok('beam', 0.1)) { tone({ type: 'sawtooth', f: 300, f2: 1300, dur: 0.28, vol: 0.06, filter: 'lowpass', ff: 2400 }); tone({ type: 'sine', f: 900, dur: 0.25, vol: 0.04 }); } },
      ice() { if (ok('ice', 0.08)) { noise({ f: 5000, dur: 0.07, vol: 0.09, filter: 'highpass', q: 2 }); tone({ type: 'triangle', f: 2600, f2: 1900, dur: 0.1, vol: 0.05 }); } },
      crack() { if (ok('crack', 0.05)) noise({ f: 3800, dur: 0.05, vol: 0.06, filter: 'bandpass', q: 3 }); },
      yarn() { if (ok('yarn', 0.12)) tone({ type: 'triangle', f: 500, f2: 260, dur: 0.14, vol: 0.08 }); },
      lob() { if (ok('lob', 0.12)) tone({ type: 'sine', f: 300, f2: 700, dur: 0.16, vol: 0.07 }); },
      hiss() { if (ok('hiss', 0.12)) noise({ f: 3500, f2: 1500, dur: 0.45, vol: 0.06, filter: 'bandpass', q: 1.5 }); },
      zap() {
        if (!ok('zap', 0.08)) return;
        tone({ type: 'square', f: rand(700, 1100), f2: rand(150, 300), dur: 0.12, vol: 0.06, filter: 'lowpass', ff: 3500 });
        noise({ f: 6000, dur: 0.08, vol: 0.06, filter: 'highpass' });
        tone({ type: 'sawtooth', f: rand(1800, 2400), f2: 600, dur: 0.06, vol: 0.03, at: 0.05 });
      },
      claw() { if (ok('claw', 0.08)) noise({ f: 1200, f2: 4500, dur: 0.12, vol: 0.09, filter: 'bandpass', q: 2 }); },
      squeak() { if (ok('squeak', 0.06)) tone({ type: 'sine', f: rand(1700, 2300), f2: rand(2600, 3200), dur: 0.06, vol: 0.03 }); },
      gem(combo) {
        if (!ok('gem', 0.025)) return;
        const f = 880 * Math.pow(2, Math.min(combo, 24) / 12);
        tone({ type: 'triangle', f, dur: 0.08, vol: 0.07 });
        tone({ type: 'sine', f: f * 2, dur: 0.05, vol: 0.03, at: 0.015 });
        noise({ f: 7000, dur: 0.025, vol: 0.03, filter: 'highpass' });
      },
      heal() { if (ok('heal', 0.1)) melody([76, 81, 88], 0.07, 'sine', 0.1); },
      pickup() { if (ok('pickup', 0.1)) { tone({ type: 'sine', f: 200, f2: 1600, dur: 0.45, vol: 0.12 }); tone({ type: 'triangle', f: 400, f2: 3200, dur: 0.45, vol: 0.05 }); } },
      hurt() {
        if (!ok('hurt', 0.15)) return;
        tone({ type: 'sine', f: 160, f2: 45, dur: 0.22, vol: 0.28 });
        noise({ f: 600, f2: 120, dur: 0.12, vol: 0.12 });
        tone({ type: 'square', f: 1180, dur: 0.07, vol: 0.05, at: 0.05, filter: 'lowpass', ff: 3000 });
        tone({ type: 'square', f: 880, dur: 0.07, vol: 0.05, at: 0.13, filter: 'lowpass', ff: 3000 });
      },
      dash() { if (ok('dash', 0.1)) { noise({ f: 400, f2: 3000, dur: 0.2, vol: 0.13, filter: 'bandpass', q: 1.2 }); tone({ type: 'sine', f: 500, f2: 1100, dur: 0.15, vol: 0.05 }); } },
      ready() { if (ok('ready', 0.3)) tone({ type: 'sine', f: 1320, dur: 0.08, vol: 0.04 }); },
      enemyShot() { if (ok('eshot', 0.12)) tone({ type: 'sine', f: 260, f2: 120, dur: 0.16, vol: 0.07, filter: 'lowpass', ff: 900 }); },
      warn() { if (ok('warn', 0.3)) { tone({ type: 'square', f: 660, dur: 0.09, vol: 0.05, filter: 'lowpass', ff: 1800 }); tone({ type: 'square', f: 660, dur: 0.09, vol: 0.05, at: 0.14, filter: 'lowpass', ff: 1800 }); } },
      bossShot() { if (ok('bshot', 0.2)) { tone({ type: 'sawtooth', f: 180, f2: 60, dur: 0.35, vol: 0.1, filter: 'lowpass', ff: 900 }); noise({ f: 800, f2: 200, dur: 0.3, vol: 0.08 }); } },
      bossDash() { if (ok('bdash', 0.3)) { noise({ f: 300, f2: 1200, dur: 0.4, vol: 0.18, filter: 'bandpass' }); tone({ type: 'sawtooth', f: 90, f2: 55, dur: 0.4, vol: 0.12, filter: 'lowpass', ff: 600 }); } },
      roar() {
        if (!ok('roar', 1)) return;
        tone({ type: 'sawtooth', f: 110, f2: 70, dur: 1.2, vol: 0.2, filter: 'lowpass', ff: 700, attack: 0.08 });
        tone({ type: 'sawtooth', f: 116, f2: 66, dur: 1.2, vol: 0.14, filter: 'lowpass', ff: 900, attack: 0.08 });
        noise({ f: 600, f2: 150, dur: 1.0, vol: 0.12, attack: 0.1 });
      },
      alarm() { if (ok('alarm', 1)) [0, 0.22, 0.44].forEach((at) => tone({ type: 'square', f: 520, f2: 760, dur: 0.16, vol: 0.05, at, filter: 'lowpass', ff: 2000 })); },
      levelUp() { if (ok('lvl', 0.3)) { melody([72, 76, 79, 84], 0.075, 'triangle', 0.12); meowAt(0.34, 1.15, 0.14); } },
      choose() { if (ok('choose', 0.1)) melody([79, 84], 0.06, 'triangle', 0.1); },
      victory() { if (ok('win', 2)) { melody([72, 72, 72, 76, null, 74, 77, null, 79, 79, 84], 0.12, 'triangle', 0.14); meowAt(1.4, 1.2, 0.2); } },
      defeat() { if (ok('lose', 2)) { melody([67, 66, 65, 64], 0.22, 'triangle', 0.12); meowAt(0.95, 0.75, 0.16); } },
      click() { if (ok('click', 0.05)) tone({ type: 'triangle', f: 900, dur: 0.05, vol: 0.05 }); },
    };
  })();
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => window.addEventListener(ev, () => Sfx.unlock(), { capture: true, passive: true }));

  // ------------------------------------------------------------------
  // Spatial grid for enemies
  // ------------------------------------------------------------------
  const grid = new Map();
  const gkey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
  function buildGrid() {
    grid.clear();
    for (const e of G.enemies) {
      if (e.dead) continue;
      const k = gkey(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
      let a = grid.get(k);
      if (!a) { a = []; grid.set(k, a); }
      a.push(e);
    }
  }
  // fn returns true to stop
  function forNear(x, y, r, fn) {
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const a = grid.get(gkey(cx, cy));
        if (!a) continue;
        for (let i = 0; i < a.length; i++) {
          const e = a[i];
          if (!e.dead && fn(e)) return;
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // Upgrades (1 of 3): every card either levels up one specific cat or recruits a new one
  // ------------------------------------------------------------------
  function buildChoices() {
    const pool = [];
    for (const c of G.cats) {
      if (c.lvl >= CAT_MAX_LVL) continue;
      pool.push({
        kind: 'lvl', cat: c, def: c.def, weight: 1,
        name: `${c.def.name}: ${c.def.title}`,
        tag: 'Уровень ' + (c.lvl + 1) + (c.lvl + 1 === CAT_MAX_LVL ? ' · макс.' : ''),
        desc: c.def.up[c.lvl - 1],
        apply: () => { c.lvl++; c.glow = 1; levelFx(c); },
      });
    }
    if (G.cats.length < MAX_CATS) {
      for (const def of CAT_TYPES) {
        if (G.cats.some((c) => c.def === def)) continue;
        pool.push({
          kind: 'new', def, weight: G.cats.length < 4 ? 1.3 : 0.8,
          name: `Новый кот: ${def.name}`, tag: def.title, desc: def.about,
          apply: () => addCat(def, true),
        });
      }
    }
    // passive relics: rarer while the squad is still growing, common once it is full / maxed
    const squadDone = G.cats.length >= MAX_CATS || pool.length < 3;
    for (const it of ITEMS) {
      const have = G.items[it.id] || 0;
      if (have >= it.max) continue;
      pool.push({
        kind: 'item', item: it, weight: squadDone ? 1.2 : G.level < 4 ? 0.25 : 0.55,
        name: it.name, tag: 'Реликвия · ' + (have ? 'ур. ' + (have + 1) : 'новая') + (have + 1 === it.max ? ' · макс.' : ''),
        desc: it.desc,
        apply: () => { G.items[it.id] = have + 1; applyMods(); itemFx(it); },
      });
    }
    return pool;
  }

  function applyMods() {
    const h = G.hero, p = G.items;
    h.speed = HERO_SPEED * (1 + 0.12 * (p.bell || 0));
    h.magnet = HERO_MAGNET * (1 + 0.4 * (p.magnet || 0));
    G.mods.cd = Math.pow(0.9, p.wool || 0);
    G.mods.area = 1 + 0.15 * (p.eye || 0);
  }

  function itemFx(it) {
    const h = G.hero;
    for (let k = 0; k < 20; k++) burst(h.x, h.y, it.color, 200, 0.6, 3);
    G.texts.push({ x: h.x, y: h.y - 34, txt: it.icon + ' ' + it.name, life: 1.2, color: it.color });
  }

  function pickUpgrades() {
    const pool = buildChoices();
    const out = [];
    // always try to offer at least one new cat while the squad is small
    const newOnes = pool.filter((u) => u.kind === 'new');
    if (G.cats.length < 3 && newOnes.length) {
      const u = newOnes[(Math.random() * newOnes.length) | 0];
      out.push(u); pool.splice(pool.indexOf(u), 1);
    }
    while (out.length < 3 && pool.length) {
      let total = 0;
      for (const u of pool) total += u.weight;
      let r = Math.random() * total, idx = 0;
      for (; idx < pool.length; idx++) { r -= pool[idx].weight; if (r <= 0) break; }
      out.push(pool.splice(Math.min(idx, pool.length - 1), 1)[0]);
    }
    if (!out.length) {
      out.push({
        kind: 'heal', name: 'Рыбный пирог', tag: 'Отряд на максимуме', desc: '+25 к максимуму здоровья и лечение 40%',
        apply: () => { const h = G.hero; h.maxHp += 25; h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.4); },
      });
    }
    out.sort(() => Math.random() - 0.5);
    return out;
  }

  function levelFx(c) {
    for (let k = 0; k < 18; k++) burst(c.x, c.y, c.def.magic, 180, 0.5, 3);
    G.texts.push({ x: c.x, y: c.y - 30, txt: 'Ур. ' + c.lvl, life: 1, color: c.def.magic });
  }

  // Small portrait of a cat for the level-up cards
  function catPortrait(def, lvl, size) {
    const cv = document.createElement('canvas');
    const S = 72, d = Math.min(window.devicePixelRatio || 1, 2) * ((size || S) / S);
    cv.width = Math.round(S * d); cv.height = Math.round(S * d);
    cv.style.width = (size || S) + 'px'; cv.style.height = (size || S) + 'px';
    cv.className = 'portrait';
    const old = ctx;
    ctx = cv.getContext('2d');
    ctx.scale(d, d);
    ctx.fillStyle = def.magic; ctx.globalAlpha = 0.18; circle(S / 2, S / 2 + 4, 30); ctx.globalAlpha = 1;
    drawCatBody({ def, lvl: lvl || 1, x: S / 2 - 4, y: S / 2 + 8, face: 1, walk: 0, moving: false, cast: 0.3, glow: 0.4, bob: 0, aim: 0 }, 1.75, 0);
    ctx = old;
    return cv;
  }

  // ------------------------------------------------------------------
  // Game state
  // ------------------------------------------------------------------
  let state = 'menu'; // menu | play | levelup | paused | over
  let G = null;

  // Meta-progression bonuses supplied by the lobby (lobby.js). Neutral when the lobby is absent.
  function lobbyBoost() {
    const base = { dmg: 1, hp: 1, speed: 1, magnet: 1, armor: 0, enemyHp: 1, cat: {} };
    try { return Object.assign(base, (window.MeowLobby && window.MeowLobby.runBoost()) || {}); } catch (_) { return base; }
  }

  function newGame() {
    const boost = lobbyBoost();
    G = {
      boost,
      t: 0, kills: 0, level: 1, xp: 0, xpNext: 5, pendingLevels: 0, dmgDealt: 0,
      hero: { x: 0, y: 0, r: 15, hp: 100, maxHp: 100, speed: HERO_SPEED, inv: 0, face: 1, magnet: HERO_MAGNET, moving: false, dead: false,
        dashT: 0, dashCd: 0, dvx: 0, dvy: 0, mx: 1, my: 0 },
      cats: [], items: {}, mods: { cd: 1, area: 1 },
      enemies: [], bullets: [], ebullets: [], gems: [], particles: [], texts: [], bolts: [],
      zones: [], beams: [], slashes: [],
      spawnAcc: 0, boss: null, bossSpawned: false, bossWarned: false, enraged: false,
      swarmsDone: 0, won: false, endTimer: 0, shake: 0, hurtFlash: 0,
      batT: BAT_FIRST, regenT: 0, stepT: 0, gemCombo: 0, gemComboT: 0, bossDmg: 0,
    };
    const hb = G.hero;
    hb.maxHp = hb.hp = Math.round(100 * boost.hp); hb.speed = HERO_SPEED * boost.speed; hb.magnet = HERO_MAGNET * boost.magnet;
    // start with the chosen leader plus one random partner
    const lead = leaderDef();
    addCat(lead, false);
    const others = CAT_TYPES.filter((d) => d !== lead);
    addCat(others[(Math.random() * others.length) | 0], false);
  }

  let leaderId = 'fire';
  try { leaderId = localStorage.getItem('meowsquad-leader') || 'fire'; } catch (_) { /* ignore */ }
  function leaderDef() { return CAT_TYPES.find((d) => d.id === leaderId) || CAT_TYPES[0]; }

  function addCat(def, fx) {
    const h = G.hero;
    const a = rand(0, TAU);
    const c = {
      def, lvl: 1, x: h.x + Math.cos(a) * 40, y: h.y + Math.sin(a) * 40, vx: 0, vy: 0,
      ox: Math.cos(a) * 50, oy: Math.sin(a) * 50, retarget: 0, idle: 0,
      cd: rand(0.2, 0.8), glow: 0, cast: 0, aim: 0, face: 1, walk: rand(0, TAU), moving: false,
      bob: rand(0, TAU), speed: rand(150, 185), prey: null,
      dealt: 0, kills: 0, bossDealt: 0, joined: G.t,
    };
    G.cats.push(c);
    if (fx) {
      Sfx.meow(0.85 + CAT_TYPES.indexOf(def) * 0.06);
      for (let k = 0; k < 24; k++) burst(c.x, c.y, def.magic, 220, 0.6, 3);
      G.texts.push({ x: c.x, y: c.y - 30, txt: def.name + '!', life: 1.1, color: def.magic });
    }
    return c;
  }

  function xpFor(level) { return Math.round(5 + (level - 1) * 3.6 + Math.pow(level - 1, 1.35)); }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  const keys = new Set();
  const joy = { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, vx: 0, vy: 0, max: 56 };

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys.add(k);
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    if ((k === 'escape' || k === 'p' || k === 'з') && (state === 'play' || state === 'paused')) togglePause();
    if (state === 'levelup' && ['1', '2', '3'].includes(k) && !cardsEl.classList.contains('locked')) {
      const u = currentChoices[Number(k) - 1];
      if (u) chooseUpgrade(u);
    }
    if (state === 'menu' && k === 'enter' && !document.querySelector('.lb-modal:not(.hidden)')) requestRun();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => { keys.clear(); releaseJoy(); if (state === 'play') togglePause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') togglePause(); });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    if (state !== 'play' || joy.active) return;
    joy.active = true; joy.id = e.pointerId;
    joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY; joy.vx = joy.vy = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!joy.active || e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const d = Math.hypot(dx, dy);
    if (d > joy.max) { // floating joystick: base follows the finger
      joy.ox += (dx / d) * (d - joy.max); joy.oy += (dy / d) * (d - joy.max);
      dx = e.clientX - joy.ox; dy = e.clientY - joy.oy;
    }
    joy.x = e.clientX; joy.y = e.clientY;
    joy.vx = dx / joy.max; joy.vy = dy / joy.max;
  });
  function releaseJoy() { joy.active = false; joy.id = -1; joy.vx = joy.vy = 0; }
  canvas.addEventListener('pointerup', (e) => { if (e.pointerId === joy.id) releaseJoy(); });
  canvas.addEventListener('pointercancel', (e) => { if (e.pointerId === joy.id) releaseJoy(); });

  // ------------------------------------------------------------------
  // UI wiring
  // ------------------------------------------------------------------
  const hud = $('hud'), menuEl = $('menu'), levelupEl = $('levelup'), pauseEl = $('pause'), overEl = $('over');
  const cardsEl = $('cards'), bannerEl = $('banner');
  const ui = {
    xpfill: $('xpfill'), lvl: $('lvl'), hpfill: $('hpfill'), hptext: $('hptext'), timer: $('timer'),
    runfill: $('runfill'), kills: $('kills'), catcount: $('catcount'), bossbar: $('bossbar'), bossfill: $('bossfill'),
  };
  let currentChoices = [];
  let bannerTimer = 0;

  const requestRun = () => (window.MeowLobby ? window.MeowLobby.requestRun() : startRun());
  $('againBtn').addEventListener('click', requestRun);
  $('menuBtn').addEventListener('click', toMenu);
  $('quitBtn').addEventListener('click', toMenu);
  $('resumeBtn').addEventListener('click', togglePause);
  $('pauseBtn').addEventListener('click', () => { if (state === 'play' || state === 'paused') togglePause(); });

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  function loadBest() {
    try { return JSON.parse(localStorage.getItem('meowsquad-best') || '{}'); } catch (_) { return {}; }
  }
  function saveBest(time, won, kills) {
    const b = loadBest();
    b.time = Math.max(b.time || 0, time);
    b.kills = Math.max(b.kills || 0, kills);
    if (won) b.wins = (b.wins || 0) + 1;
    try { localStorage.setItem('meowsquad-best', JSON.stringify(b)); } catch (_) { /* ignore */ }
  }
  function renderBest() {
    const b = loadBest();
    if (!$('best')) return;
    $('best').textContent = b.time ? `Рекорд: ${fmtTime(b.time)} · ${b.kills || 0} врагов · побед: ${b.wins || 0}` : '';
  }

  function toMenu() {
    state = 'menu';
    hide(hud); hide(pauseEl); hide(overEl); hide(levelupEl); show(menuEl);
    newGame();
    showcase();
    renderBest();
    if (window.MeowLobby) window.MeowLobby.onMenu();
  }

  function startRun() {
    newGame();
    releaseJoy();
    hide(menuEl); hide(overEl); hide(pauseEl); hide(levelupEl); show(hud); hide(ui.bossbar);
    ui.timer.classList.remove('boss');
    state = 'play';
    banner('Защити отряд!', 'Коты атакуют сами — просто двигайся', 2.2);
  }

  function togglePause() {
    if (state === 'play') {
      state = 'paused'; releaseJoy();
      const list = $('buildList');
      list.innerHTML = '';
      for (const c of G.cats) {
        const chip = document.createElement('span');
        chip.className = 'chip'; chip.style.borderColor = c.def.magic;
        chip.textContent = `${c.def.icon} ${c.def.name} · ${c.def.title} · ур. ${c.lvl}`;
        list.appendChild(chip);
      }
      if (!list.children.length) list.innerHTML = '<span class="chip">Котов пока нет</span>';
      show(pauseEl);
    } else if (state === 'paused') {
      state = 'play'; hide(pauseEl);
    }
  }

  function banner(title, sub, time) {
    bannerEl.innerHTML = title + (sub ? `<small>${sub}</small>` : '');
    bannerEl.classList.add('show');
    bannerTimer = time || 2;
  }

  // Build bar on the skill-choice screen: squad cats on the left, relics on the right
  function renderBuildSlots() {
    const fill = (row, icon, total, entries) => {
      row.innerHTML = `<span class="cap"><svg><use href="#i-${icon}"/></svg></span>`;
      for (let k = 0; k < total; k++) {
        const s = document.createElement('span');
        s.className = 'slot';
        const e = entries[k];
        if (e) {
          if (e.def) s.appendChild(catPortrait(e.def, e.lvl, 32)); else s.textContent = e.icon;
          if (e.lvl > 1) s.insertAdjacentHTML('beforeend', `<b>${e.lvl}</b>`);
        }
        row.appendChild(s);
      }
    };
    fill($('luCats'), 'paw', MAX_CATS, G.cats);
    fill($('luItems'), 'bag', ITEMS.length, ITEMS.filter((it) => G.items[it.id]).map((it) => ({ icon: it.icon, lvl: G.items[it.id] })));
  }

  function openLevelUp() {
    state = 'levelup';
    releaseJoy();
    currentChoices = pickUpgrades();
    renderBuildSlots();
    cardsEl.innerHTML = '';
    const star = (cls) => `<svg class="${cls}"><use href="#i-star"/></svg>`;
    currentChoices.forEach((u) => {
      const b = document.createElement('button');
      b.className = 'card';
      if (u.def) b.style.setProperty('--cc', u.def.magic);
      else if (u.item) b.style.setProperty('--cc', u.item.color);
      // stars: level after picking / max level
      const have = u.kind === 'lvl' ? u.cat.lvl : u.item ? G.items[u.item.id] || 0 : 0;
      const max = u.kind === 'heal' ? 0 : u.item ? u.item.max : CAT_MAX_LVL;
      const isNew = u.kind === 'new' || (u.item && !have);
      const tag = u.kind === 'new' ? u.tag : u.item ? 'Реликвия' : u.kind === 'lvl' ? u.def.title : u.tag;
      b.innerHTML =
        (isNew ? '<span class="cnew">Новый!</span>' : '') +
        `<div class="chead">${u.def ? u.def.name : u.name}</div>` +
        `<div class="cbody"><div class="icon"></div><div class="cdesc"><span class="clvl">${tag}</span>${u.desc}</div></div>` +
        `<div class="cstars">${star('on').repeat(have)}${max ? star('next') : ''}${star('').repeat(Math.max(0, max - have - 1))}</div>`;
      const icon = b.querySelector('.icon');
      if (u.def) icon.appendChild(catPortrait(u.def, have + 1, 60));
      else icon.textContent = u.item ? u.item.icon : '🐟';
      b.addEventListener('click', () => chooseUpgrade(u));
      cardsEl.appendChild(b);
    });
    const conf = $('luConfetti'), colors = ['#ffd166', '#ff8a3d', '#5ee7ff', '#7ee081', '#ff4d6d', '#b7a6ff'];
    conf.innerHTML = Array.from({ length: 26 }, (_, k) =>
      `<i style="left:${(Math.random() * 96).toFixed(1)}%;top:${(Math.random() * 92).toFixed(1)}%;background:${colors[k % colors.length]};rotate:${(Math.random() * 90) | 0}deg;animation-delay:${(Math.random() * 0.3).toFixed(2)}s,${(Math.random() * 1.5).toFixed(2)}s"></i>`).join('');
    // brief lock so a lifted finger doesn't pick a card by accident
    cardsEl.classList.add('locked');
    setTimeout(() => cardsEl.classList.remove('locked'), 380);
    show(levelupEl);
  }

  function chooseUpgrade(u) {
    if (state !== 'levelup') return;
    u.apply();
    G.upgradesTaken = (G.upgradesTaken || 0) + 1;
    G.pendingLevels--;
    if (G.pendingLevels > 0) { openLevelUp(); return; }
    hide(levelupEl);
    G.hero.inv = Math.max(G.hero.inv, 0.6);
    state = 'play';
  }

  function endRun(won) {
    state = 'over';
    hide(hud); hide(levelupEl);
    saveBest(G.t, won, G.kills);
    $('overTitle').textContent = won ? 'Победа!' : 'Отряд разбит';
    $('overSub').textContent = won
      ? 'Крысиный Король повержен. Кошачий отряд спас долину!'
      : G.t >= BOSS_TIME ? 'Король оказался сильнее. Ещё немного!' : 'Крысы победили в этот раз. Попробуй другую сборку!';
    const stats = [
      ['Время', fmtTime(G.t)], ['Уровень', G.level], ['Врагов', G.kills],
      ['Котов', G.cats.length], ['Урон', Math.round(G.dmgDealt).toLocaleString('ru-RU')], ['Улучшений', G.upgradesTaken || 0],
    ];
    $('overStats').innerHTML = stats.map(([k, v]) => `<div class="stat"><div class="v">${v}</div><div class="k">${k}</div></div>`).join('');
    if (window.MeowLobby) window.MeowLobby.onRunEnd({ won, time: G.t, kills: G.kills, level: G.level, bossTime: BOSS_TIME, runTime: RUN_TIME });
    show(overEl);
  }

  // ------------------------------------------------------------------
  // Spawning
  // ------------------------------------------------------------------
  function spawnPoint() {
    const a = rand(0, TAU), d = Math.hypot(W, H) / 2 + rand(40, 140);
    return [G.hero.x + Math.cos(a) * d, G.hero.y + Math.sin(a) * d];
  }

  function spawnEnemy(type, x, y) {
    const def = ENEMY[type];
    if (x === undefined) [x, y] = spawnPoint();
    const hpMul = (type === 'boss' ? 1 : 1 + (G.t / 60) * 0.45) * G.boost.enemyHp;
    const e = {
      type, x, y, r: def.r, hp: def.hp * hpMul, maxHp: def.hp * hpMul,
      speed: def.speed * (type === 'boss' ? 1 : rand(0.88, 1.12)), dmg: def.dmg, xp: def.xp,
      slow: 0, slowAmt: 0, flash: 0, kx: 0, ky: 0, wob: rand(0, TAU), dead: false,
      atk: 2.5, summon: 7, dash: 0,
    };
    G.enemies.push(e);
    return e;
  }

  function updateSpawns(dt) {
    const m = G.t / 60;
    let rate = 1.1 + m * 1.45 + m * m * 0.12;
    if (G.bossSpawned) rate *= 0.45;
    G.spawnAcc += rate * dt;
    while (G.spawnAcc >= 1) {
      G.spawnAcc -= 1;
      if (G.enemies.length >= MAX_ENEMIES) continue;
      const bruteChance = G.t < 40 ? 0 : Math.min(0.3, 0.06 + G.t / 900);
      spawnEnemy(Math.random() < bruteChance ? 'brute' : 'mouse');
    }

    if (G.swarmsDone < SWARM_TIMES.length && G.t >= SWARM_TIMES[G.swarmsDone]) {
      const n = 22 + G.swarmsDone * 10;
      const R = Math.max(W, H) * 0.55 + 40;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        spawnEnemy('mouse', G.hero.x + Math.cos(a) * R, G.hero.y + Math.sin(a) * R);
      }
      G.swarmsDone++;
      banner('Окружение!', 'Мыши-зомби сжимают кольцо', 1.8);
    }

    if (!G.bossWarned && G.t >= BOSS_TIME - 8) {
      G.bossWarned = true;
      banner('Земля дрожит…', 'Крысиный Король близко', 2.5);
    }
    if (!G.bossSpawned && G.t >= BOSS_TIME) {
      G.bossSpawned = true;
      const [x, y] = spawnPoint();
      G.boss = spawnEnemy('boss', x, y);
      show(ui.bossbar);
      ui.timer.classList.add('boss');
      banner('👑 Крысиный Король Мракус', 'Победи его до 6:00, иначе он впадёт в ярость', 3);
      G.shake = 12;
    }
    if (G.boss && !G.boss.dead && !G.enraged && G.t >= RUN_TIME) {
      G.enraged = true;
      banner('Король в ярости!', 'Он быстрее и бьёт сильнее', 2.5);
      G.shake = 14;
    }
  }

  // ------------------------------------------------------------------
  // Combat
  // ------------------------------------------------------------------
  function nearestEnemy(x, y, range) {
    let best = null, bd = range * range;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // --- cat attacks: one function per cat type
  const ATTACKS = {
    fire(c, t) {
      const n = catStat(c, 'n');
      const base = Math.atan2(t.y - c.y, t.x - c.x);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * 0.32;
        G.bullets.push({ kind: 'fire', x: c.x, y: c.y - 6, vx: Math.cos(a) * 360, vy: Math.sin(a) * 360, r: 7,
          dmg: catStat(c, 'dmg') * rand(0.9, 1.1), aoe: catStat(c, 'aoe'), life: 0.95, color: c.def.magic, hit: [], spin: 0 });
      }
    },
    star(c) {
      const n = catStat(c, 'n');
      for (let k = 0; k < n; k++) {
        const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.55 + rand(-0.15, 0.15);
        G.bullets.push({ kind: 'star', x: c.x, y: c.y - 8, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 6,
          dmg: catStat(c, 'dmg') * rand(0.9, 1.1), life: 2.4, color: c.def.magic, hit: [], target: null, spin: rand(0, TAU) });
      }
    },
    sun(c, t) {
      const beams = catStat(c, 'beams'), w = catStat(c, 'w'), L = catStat(c, 'range') * 1.15;
      const base = Math.atan2(t.y - c.y, t.x - c.x);
      const dirs = beams === 1 ? [base] : beams === 2 ? [base, base + Math.PI] : [base, base + 2.1, base - 2.1];
      for (const a of dirs) {
        const x2 = c.x + Math.cos(a) * L, y2 = c.y + Math.sin(a) * L;
        G.beams.push({ x1: c.x, y1: c.y - 6, x2, y2, w, life: 0.32, max: 0.32, color: c.def.magic });
        const dx = Math.cos(a), dy = Math.sin(a), dmg = catStat(c, 'dmg');
        for (const e of G.enemies) {
          if (e.dead) continue;
          const ex = e.x - c.x, ey = e.y - c.y, proj = ex * dx + ey * dy;
          if (proj < -e.r || proj > L + e.r) continue;
          const perp = Math.abs(ex * dy - ey * dx);
          if (perp < w / 2 + e.r) damageEnemy(e, dmg * rand(0.9, 1.1), dx * 60, dy * 60, '#fff1a8');
        }
      }
      G.shake = Math.max(G.shake, 2);
    },
    ice(c, t) {
      const n = catStat(c, 'n');
      const base = Math.atan2(t.y - c.y, t.x - c.x);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * 0.16;
        G.bullets.push({ kind: 'shard', x: c.x, y: c.y - 6, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, r: 4,
          dmg: catStat(c, 'dmg') * rand(0.9, 1.1), pierce: catStat(c, 'pierce'), slow: catStat(c, 'slow'),
          life: catStat(c, 'range') / 560 + 0.1, color: c.def.magic, hit: [] });
      }
    },
    yarn(c, t) {
      const n = catStat(c, 'n');
      const base = Math.atan2(t.y - c.y, t.x - c.x);
      for (let k = 0; k < n; k++) {
        const a = base + (k - (n - 1) / 2) * (TAU / Math.max(3, n + 1)) * (n > 1 ? 1 : 0);
        G.bullets.push({ kind: 'yarn', x: c.x, y: c.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: catStat(c, 'size'),
          dmg: catStat(c, 'dmg'), owner: c, dist: 0, maxDist: catStat(c, 'range'), back: false, life: 4,
          color: c.def.magic, hitT: new Map(), spin: 0 });
      }
    },
    mint(c, t) {
      const n = catStat(c, 'n');
      for (let k = 0; k < n; k++) {
        const tx = t.x + (k ? rand(-70, 70) : 0), ty = t.y + (k ? rand(-70, 70) : 0);
        const dist = Math.hypot(tx - c.x, ty - c.y);
        G.bullets.push({ kind: 'bomb', x: c.x, y: c.y, sx: c.x, sy: c.y, tx, ty, z: 0, tt: 0, dur: 0.45 + dist / 900, r: 6,
          dmg: catStat(c, 'dmg'), zr: catStat(c, 'r'), zdur: catStat(c, 'dur'), life: 3, color: c.def.magic, spin: 0 });
      }
    },
    spark(c, t) {
      const dmg = catStat(c, 'dmg');
      G.bolts.push({ x1: c.x, y1: c.y - 10, x2: t.x, y2: t.y, life: 0.2, color: c.def.magic });
      damageEnemy(t, dmg * rand(0.9, 1.1), 0, 0, '#bfe9ff');
      chainLightning(t, dmg * 0.85, catStat(c, 'chain'), c.def.magic);
      for (let k = 0; k < 6; k++) burst(t.x, t.y, '#dff4ff', 160, 0.25, 2);
    },
    shadow(c, t) {
      const R = catStat(c, 'r'), dmg = catStat(c, 'dmg');
      const a = Math.atan2(t.y - c.y, t.x - c.x);
      const all = c.lvl >= CAT_MAX_LVL;
      forNear(c.x, c.y, R + MAX_ENEMY_R, (e) => {
        const dx = e.x - c.x, dy = e.y - c.y, d = Math.hypot(dx, dy) || 1;
        if (d > R + e.r) return false;
        if (!all) { // front arc only
          let da = Math.abs(Math.atan2(dy, dx) - a); if (da > Math.PI) da = TAU - da;
          if (da > 1.25 && d > e.r + 8) return false;
        }
        damageEnemy(e, dmg * rand(0.9, 1.1), (dx / d) * 220, (dy / d) * 220, '#e3b8ff');
        return false;
      });
      G.slashes.push({ x: c.x, y: c.y - 4, a, r: R, life: 0.22, max: 0.22, all, color: c.def.magic });
    },
  };

  function damageEnemy(e, dmg, kx, ky, color, slow) {
    if (e.dead) return;
    e.hp -= dmg; e.flash = 0.08;
    G.dmgDealt += dmg;
    if (e.type !== 'boss') { e.kx += kx; e.ky += ky; }
    if (slow) {
      const prev = e.slow > 0 ? e.slowAmt || 0 : 0;
      e.slowAmt = Math.max(prev, e.type === 'boss' ? slow * 0.5 : slow); e.slow = 1.6;
    }
    if (G.texts.length < 110) {
      G.texts.push({ x: e.x + rand(-6, 6), y: e.y - e.r, txt: Math.round(dmg), life: 0.6, color: color || '#fff' });
    }
    if (e.hp <= 0) killEnemy(e);
  }

  function explode(x, y, r, dmg, color) {
    forNear(x, y, r + MAX_ENEMY_R, (e) => {
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < r + e.r) damageEnemy(e, dmg, (dx / d) * 140, (dy / d) * 140, '#ffb36b');
      return false;
    });
    G.zones.push({ kind: 'blast', x, y, r, life: 0.3, max: 0.3, color });
    for (let k = 0; k < 14; k++) burst(x, y, k % 2 ? '#ffd166' : color, 260, 0.4, 3.5);
    G.shake = Math.max(G.shake, 2.5);
  }

  function chainLightning(from, dmg, count, color) {
    let cur = from;
    const hit = new Set([from]);
    for (let i = 0; i < count; i++) {
      let next = null, bd = 170 * 170;
      forNear(cur.x, cur.y, 170, (e) => {
        if (hit.has(e)) return false;
        const dx = e.x - cur.x, dy = e.y - cur.y, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; next = e; }
        return false;
      });
      if (!next) break;
      G.bolts.push({ x1: cur.x, y1: cur.y, x2: next.x, y2: next.y, life: 0.18, color: color || '#bfe9ff' });
      hit.add(next);
      damageEnemy(next, dmg, 0, 0, '#bfe9ff');
      cur = next;
    }
  }

  function killEnemy(e) {
    e.dead = true;
    G.kills++;
    const col = e.type === 'mouse' ? '#a9b4c6' : e.type === 'brute' ? '#9a6b4f' : '#b48cff';
    for (let i = 0; i < (e.type === 'boss' ? 80 : e.type === 'brute' ? 14 : 7); i++) burst(e.x, e.y, col, e.type === 'boss' ? 420 : 160, 0.5, 3);
    if (e.type === 'boss') {
      G.won = true; G.endTimer = 2.8; G.shake = 18;
      hide(ui.bossbar);
      banner('Победа!', 'Крысиный Король повержен', 2.8);
      for (const o of G.enemies) {
        if (!o.dead) { o.dead = true; G.kills++; for (let i = 0; i < 4; i++) burst(o.x, o.y, '#a9b4c6', 160, 0.5, 3); }
      }
      for (const g of G.gems) g.mag = true;
      return;
    }
    dropGem(e.x, e.y, e.xp);
    if (e.type === 'brute' && Math.random() < 0.06) G.gems.push({ x: e.x + 8, y: e.y, v: 0, fish: true, mag: false, sp: 0 });
  }

  function dropGem(x, y, v) {
    if (G.gems.length >= MAX_GEMS) {
      const g = G.gems[(Math.random() * G.gems.length) | 0];
      if (!g.fish) { g.v += v; return; }
    }
    G.gems.push({ x: x + rand(-4, 4), y: y + rand(-4, 4), v, fish: false, mag: false, sp: 0 });
  }

  function hurtHero(dmg) {
    const h = G.hero;
    if (h.inv > 0 || h.dead || G.won) return;
    h.hp -= dmg * (1 - G.boost.armor); h.inv = 0.55;
    G.shake = Math.max(G.shake, 7); G.hurtFlash = 0.35;
    for (let i = 0; i < 8; i++) burst(h.x, h.y, '#ff4d6d', 180, 0.4, 2.5);
    if (h.hp <= 0) {
      h.hp = 0; h.dead = true; G.endTimer = 1.4;
      for (let i = 0; i < 40; i++) burst(h.x, h.y, '#9b8cff', 300, 0.8, 3.5);
    }
  }

  function addXP(v) {
    G.xp += v;
    while (G.xp >= G.xpNext) {
      G.xp -= G.xpNext;
      G.level++;
      G.xpNext = xpFor(G.level);
      G.pendingLevels++;
    }
  }

  function burst(x, y, color, speed, life, size) {
    if (G.particles.length > 700) return;
    const a = rand(0, TAU), s = rand(0.2, 1) * speed;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rand(0.6, 1.2), max: life, color, size: size * rand(0.6, 1.3) });
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  // Cats are alive: each one wanders to its own spot near the hero, trots to catch up,
  // pauses, looks around, turns to cast. The shadow cat hunts enemies up close.
  function updateCats(dt, canShoot) {
    const h = G.hero;
    const n = G.cats.length;
    for (let i = 0; i < n; i++) {
      const c = G.cats[i];
      c.glow = Math.max(0, c.glow - dt * 4);
      c.cast = Math.max(0, c.cast - dt);

      // pick a new favourite spot every now and then
      c.retarget -= dt;
      if (c.retarget <= 0) {
        const slot = (i / Math.max(1, n)) * TAU + G.t * 0.05;
        const a = slot + rand(-1.1, 1.1), d = rand(34, SQUAD_R);
        c.ox = Math.cos(a) * d; c.oy = Math.sin(a) * d * 0.85;
        c.retarget = rand(1.4, 3.4);
        c.idle = Math.random() < 0.35 ? rand(0.5, 1.4) : 0;
      }
      let tx = h.x + c.ox, ty = h.y + c.oy;
      let maxSp = c.speed;

      // shadow cat: pounce on enemies near the squad
      if (c.def.id === 'shadow' && canShoot) {
        if (!c.prey || c.prey.dead || Math.hypot(c.prey.x - h.x, c.prey.y - h.y) > 240) {
          c.prey = nearestEnemy(c.x, c.y, catStat(c, 'range'));
          if (c.prey && Math.hypot(c.prey.x - h.x, c.prey.y - h.y) > 240) c.prey = null;
        }
        if (c.prey) {
          const pa = Math.atan2(c.y - c.prey.y, c.x - c.prey.x);
          tx = c.prey.x + Math.cos(pa) * (c.prey.r + 14); ty = c.prey.y + Math.sin(pa) * (c.prey.r + 14);
          maxSp = 300;
        }
      }

      const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
      const far = Math.hypot(h.x - c.x, h.y - c.y);
      if (far > SQUAD_R + 40) maxSp = Math.max(maxSp, h.speed * 1.35); // run to catch up
      let want = 0;
      if (c.idle > 0 && far < SQUAD_R + 20 && !c.prey) c.idle -= dt;
      else if (d > 6) want = Math.min(maxSp, d * 3.2);
      let wx = d > 0.01 ? (dx / d) * want : 0, wy = d > 0.01 ? (dy / d) * want : 0;

      // keep a little personal space between cats and from the hero
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const o = G.cats[j], ox = c.x - o.x, oy = c.y - o.y, od = Math.hypot(ox, oy);
        if (od < 26 && od > 0.01) { wx += (ox / od) * (26 - od) * 6; wy += (oy / od) * (26 - od) * 6; }
      }
      const hx = c.x - h.x, hy = c.y - h.y, hd = Math.hypot(hx, hy);
      if (hd < 26 && hd > 0.01) { wx += (hx / hd) * (26 - hd) * 6; wy += (hy / hd) * (26 - hd) * 6; }

      const k = Math.min(1, dt * 9);
      c.vx += (wx - c.vx) * k; c.vy += (wy - c.vy) * k;
      c.x += c.vx * dt; c.y += c.vy * dt;
      const sp = Math.hypot(c.vx, c.vy);
      c.moving = sp > 18;
      c.walk += sp * dt * 0.11;
      if (c.cast > 0) c.face = Math.cos(c.aim) >= 0 ? 1 : -1;
      else if (Math.abs(c.vx) > 12) c.face = c.vx > 0 ? 1 : -1;
      else if (!c.moving && Math.random() < dt * 0.4) c.face = -c.face; // look around

      if (!canShoot) continue;
      c.cd -= dt;
      if (c.cd <= 0) {
        let t;
        if (c.def.id === 'shadow') {
          t = c.prey && Math.hypot(c.prey.x - c.x, c.prey.y - c.y) < catStat(c, 'r') + c.prey.r ? c.prey : null;
          if (!t) t = nearestEnemy(c.x, c.y, catStat(c, 'r') * 0.9 + 10);
        } else t = nearestEnemy(c.x, c.y, catStat(c, 'range'));
        if (t) {
          c.aim = Math.atan2(t.y - c.y, t.x - c.x);
          ATTACKS[c.def.id](c, t);
          c.glow = 1; c.cast = 0.28;
          c.cd = catStat(c, 'cd') * rand(0.92, 1.08);
        } else c.cd = 0.1;
      }
    }
  }

  function update(dt) {
    G.t += dt;
    const h = G.hero;

    // --- movement
    let mx = 0, my = 0;
    if (keys.has('a') || keys.has('arrowleft') || keys.has('ф')) mx -= 1;
    if (keys.has('d') || keys.has('arrowright') || keys.has('в')) mx += 1;
    if (keys.has('w') || keys.has('arrowup') || keys.has('ц')) my -= 1;
    if (keys.has('s') || keys.has('arrowdown') || keys.has('ы')) my += 1;
    if (joy.active) { mx += joy.vx; my += joy.vy; }
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    if (!h.dead) {
      h.x += mx * h.speed * dt; h.y += my * h.speed * dt;
      if (Math.abs(mx) > 0.1) h.face = mx > 0 ? 1 : -1;
    }
    h.moving = ml > 0.05 && !h.dead;
    h.inv = Math.max(0, h.inv - dt);
    if (G.items.oil && !h.dead) { G.regenT += dt; if (G.regenT >= 3) { G.regenT -= 3; h.hp = Math.min(h.maxHp, h.hp + G.items.oil); } }

    if (!G.won && !h.dead) updateSpawns(dt);
    buildGrid();
    updateCats(dt, !h.dead);

    // --- projectiles
    updateBullets(dt);
    updateZones(dt);

    // --- enemies
    const diag = Math.hypot(W, H);
    for (const e of G.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.slow = Math.max(0, e.slow - dt);
      let dx = h.x - e.x, dy = h.y - e.y;
      let d = Math.hypot(dx, dy) || 1;

      // recycle stragglers far behind the player
      if (e.type !== 'boss' && d > diag * 0.9) {
        const [nx, ny] = spawnPoint(); e.x = nx; e.y = ny; continue;
      }

      let sp = e.speed * (e.slow > 0 ? 1 - (e.slowAmt || 0) : 1);
      if (e.type === 'boss') {
        if (G.enraged) sp *= 1.55;
        updateBoss(e, dt, dx / d, dy / d);
        if (e.dash > 0) sp *= 3.2;
      }
      if (h.dead || G.won) sp *= -0.3;
      let vx = (dx / d) * sp, vy = (dy / d) * sp;

      // separation
      if (e.type !== 'boss') {
        let px = 0, py = 0;
        forNear(e.x, e.y, e.r + 24, (o) => {
          if (o === e) return false;
          const ox = e.x - o.x, oy = e.y - o.y, rr = e.r + o.r;
          const d2 = ox * ox + oy * oy;
          if (d2 < rr * rr && d2 > 0.01) {
            const od = Math.sqrt(d2), push = (rr - od) / rr;
            px += (ox / od) * push; py += (oy / od) * push;
          }
          return false;
        });
        vx += px * 90; vy += py * 90;
      }

      e.x += (vx + e.kx) * dt; e.y += (vy + e.ky) * dt;
      const kd = Math.pow(0.0005, dt);
      e.kx *= kd; e.ky *= kd;

      // contact with hero
      if (d < e.r + h.r - 2) hurtHero(e.dmg * (G.enraged && e.type === 'boss' ? 1.6 : 1));

    }
    G.enemies = G.enemies.filter((e) => !e.dead);

    // --- enemy bullets
    const eb = G.ebullets;
    for (let i = eb.length - 1; i >= 0; i--) {
      const b = eb[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const dx = b.x - h.x, dy = b.y - h.y;
      let remove = b.life <= 0 || G.won;
      if (!remove && dx * dx + dy * dy < (h.r + b.r) ** 2) { hurtHero(b.dmg); remove = true; }
      if (remove) { eb[i] = eb[eb.length - 1]; eb.pop(); }
    }

    // --- gems
    const gems = G.gems;
    for (let i = gems.length - 1; i >= 0; i--) {
      const g = gems[i];
      const dx = h.x - g.x, dy = h.y - g.y, d = Math.hypot(dx, dy) || 1;
      if (!g.mag && d < h.magnet) g.mag = true;
      if (g.mag && !h.dead) {
        g.sp = Math.min(900, g.sp + 1400 * dt);
        const s = Math.max(g.sp, 120);
        g.x += (dx / d) * s * dt; g.y += (dy / d) * s * dt;
      }
      if (d < h.r + 8 && !h.dead) {
        if (g.fish) {
          h.hp = Math.min(h.maxHp, h.hp + 25);
          G.texts.push({ x: h.x, y: h.y - 30, txt: '+25 ❤', life: 0.9, color: '#7dff9b' });
        } else addXP(g.v);
        gems[i] = gems[gems.length - 1]; gems.pop();
      }
    }

    updateFx(dt);

    if (G.endTimer > 0) {
      G.endTimer -= dt;
      if (G.won && Math.random() < 0.5) burst(h.x + rand(-200, 200), h.y + rand(-200, 200), CAT_TYPES[(Math.random() * 8) | 0].magic, 200, 0.8, 3);
      if (G.endTimer <= 0) { endRun(G.won); return; }
    }

    if (G.pendingLevels > 0 && !h.dead && !G.won) openLevelUp();
  }

  function updateBullets(dt) {
    const bullets = G.bullets;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      let remove = b.life <= 0;

      if (b.kind === 'bomb') { // lobbed: flies in an arc, ignores enemies until it lands
        b.tt += dt;
        const p = Math.min(1, b.tt / b.dur);
        b.x = b.sx + (b.tx - b.sx) * p; b.y = b.sy + (b.ty - b.sy) * p;
        b.z = Math.sin(p * Math.PI) * (40 + b.dur * 50);
        b.spin += dt * 10;
        if (p >= 1) {
          G.zones.push({ kind: 'poison', x: b.x, y: b.y, r: b.zr, life: b.zdur, max: b.zdur, tick: 0, dmg: b.dmg, color: b.color });
          for (let k = 0; k < 16; k++) burst(b.x, b.y, k % 2 ? '#c9ffcb' : b.color, 200, 0.5, 3);
          remove = true;
        }
        if (remove) { bullets[i] = bullets[bullets.length - 1]; bullets.pop(); }
        continue;
      }

      if (b.kind === 'star' && !remove) { // homing
        if (!b.target || b.target.dead) b.target = nearestEnemy(b.x, b.y, 420);
        const sp = Math.hypot(b.vx, b.vy);
        const nsp = Math.min(520, sp + 600 * dt);
        let a = Math.atan2(b.vy, b.vx);
        if (b.target) {
          const want = Math.atan2(b.target.y - b.y, b.target.x - b.x);
          let da = want - a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
          a += clamp(da, -7 * dt, 7 * dt);
        }
        b.vx = Math.cos(a) * nsp; b.vy = Math.sin(a) * nsp;
        b.spin += dt * 9;
        if (Math.random() < 0.5) burst(b.x, b.y, b.color, 30, 0.3, 2);
      }

      if (b.kind === 'yarn') { // boomerang: out, then back to its cat
        b.spin += dt * 14;
        if (!b.back) {
          b.dist += Math.hypot(b.vx, b.vy) * dt;
          const f = Math.pow(0.25, dt); b.vx *= f; b.vy *= f;
          if (b.dist >= b.maxDist || Math.hypot(b.vx, b.vy) < 70) { b.back = true; b.hitT.clear(); }
        } else {
          const o = b.owner, dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy) || 1;
          const sp = Math.min(560, Math.hypot(b.vx, b.vy) + 900 * dt);
          b.vx += ((dx / d) * sp - b.vx) * Math.min(1, dt * 6); b.vy += ((dy / d) * sp - b.vy) * Math.min(1, dt * 6);
          if (d < 16 || !G.cats.includes(o)) remove = true;
        }
      }

      if (b.kind === 'fire') {
        b.spin += dt * 12;
        if (Math.random() < 0.8) burst(b.x, b.y, Math.random() < 0.5 ? '#ffd166' : b.color, 40, 0.3, 3);
      }

      b.x += b.vx * dt; b.y += b.vy * dt;

      if (!remove) {
        forNear(b.x, b.y, b.r + MAX_ENEMY_R, (e) => {
          const dx = e.x - b.x, dy = e.y - b.y, rr = e.r + b.r;
          if (dx * dx + dy * dy > rr * rr) return false;
          const sp = Math.hypot(b.vx, b.vy) || 1, nx = b.vx / sp, ny = b.vy / sp;
          if (b.kind === 'yarn') {
            const last = b.hitT.get(e);
            if (last !== undefined && G.t - last < 0.45) return false;
            b.hitT.set(e, G.t);
            damageEnemy(e, b.dmg * rand(0.9, 1.1), nx * 150, ny * 150, '#ffc2da');
            return false;
          }
          if (b.hit.includes(e)) return false;
          b.hit.push(e);
          if (b.kind === 'fire') { explode(b.x, b.y, b.aoe, b.dmg, b.color); remove = true; b.exploded = true; return true; }
          if (b.kind === 'shard') {
            damageEnemy(e, b.dmg, nx * 70, ny * 70, '#bff6ff', b.slow);
            for (let k = 0; k < 4; k++) burst(b.x, b.y, '#e6fbff', 140, 0.25, 2);
            if (b.pierce-- <= 0) { remove = true; return true; }
            return false;
          }
          // star
          damageEnemy(e, b.dmg, nx * 60, ny * 60, '#f0d6ff');
          for (let k = 0; k < 5; k++) burst(b.x, b.y, b.color, 140, 0.3, 2.5);
          remove = true; return true;
        });
      }
      if (b.kind === 'fire' && remove && !b.exploded) explode(b.x, b.y, b.aoe * 0.8, b.dmg * 0.8, b.color);
      if (remove) { bullets[i] = bullets[bullets.length - 1]; bullets.pop(); }
    }
  }

  function updateZones(dt) {
    const zs = G.zones;
    for (let i = zs.length - 1; i >= 0; i--) {
      const z = zs[i];
      z.life -= dt;
      if (z.kind === 'poison') {
        z.tick -= dt;
        if (z.tick <= 0) {
          z.tick = 0.3;
          forNear(z.x, z.y, z.r + MAX_ENEMY_R, (e) => {
            const dx = e.x - z.x, dy = e.y - z.y;
            if (dx * dx + dy * dy < (z.r + e.r * 0.6) ** 2) damageEnemy(e, z.dmg, 0, 0, '#a8ffae', 0.25);
            return false;
          });
        }
        if (Math.random() < dt * 14) {
          const a = rand(0, TAU), r = Math.sqrt(Math.random()) * z.r;
          G.particles.push({ x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r * 0.7, vx: rand(-8, 8), vy: rand(-30, -14), life: 0.8, max: 0.8, color: '#9dffa4', size: rand(2, 4) });
        }
      }
      if (z.life <= 0) { zs[i] = zs[zs.length - 1]; zs.pop(); }
    }
  }

  function updateBoss(e, dt, nx, ny) {
    e.atk -= dt; e.summon -= dt; e.dash = Math.max(0, e.dash - dt);
    if (e.atk <= 0) {
      const n = G.enraged ? 22 : 14;
      const off = rand(0, TAU);
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * TAU;
        G.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 165, vy: Math.sin(a) * 165, r: 7, dmg: 12, life: 5 });
      }
      e.atk = G.enraged ? 2.1 : 3.3;
      for (let i = 0; i < 16; i++) burst(e.x, e.y, '#ff4d6d', 260, 0.4, 3);
    }
    if (e.summon <= 0) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        spawnEnemy('mouse', e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
      }
      e.summon = G.enraged ? 6 : 9;
    }
    if (Math.random() < dt * 0.18) e.dash = 0.45; // occasional lunge
    void nx; void ny;
  }

  function updateFx(dt) {
    const ps = G.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92;
      if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); }
    }
    const ts = G.texts;
    for (let i = ts.length - 1; i >= 0; i--) {
      const t = ts[i]; t.life -= dt; t.y -= 38 * dt;
      if (t.life <= 0) { ts[i] = ts[ts.length - 1]; ts.pop(); }
    }
    for (const list of [G.bolts, G.beams, G.slashes]) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].life -= dt;
        if (list[i].life <= 0) { list[i] = list[list.length - 1]; list.pop(); }
      }
    }
    G.shake = Math.max(0, G.shake - dt * 30);
    G.hurtFlash = Math.max(0, G.hurtFlash - dt);
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------
  function drawBackground(camX, camY) {
    ctx.fillStyle = '#1d1633';
    ctx.fillRect(camX - W / 2 - 20, camY - H / 2 - 20, W + 40, H + 40);
    const S = 96;
    const x0 = Math.floor((camX - W / 2) / S) - 1, x1 = Math.floor((camX + W / 2) / S) + 1;
    const y0 = Math.floor((camY - H / 2) / S) - 1, y1 = Math.floor((camY + H / 2) / S) + 1;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const x = cx * S, y = cy * S;
        if (((cx + cy) & 1) === 0) { ctx.fillStyle = 'rgba(255,255,255,0.018)'; ctx.fillRect(x, y, S, S); }
        const hv = hash(cx, cy);
        const ox = x + 20 + hash(cy, cx) * 56, oy = y + 20 + hash(cx + 7, cy - 3) * 56;
        if (hv < 0.16) { // grass tuft
          ctx.strokeStyle = 'rgba(126,224,129,0.22)'; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(ox - 5, oy); ctx.lineTo(ox - 7, oy - 8);
          ctx.moveTo(ox, oy); ctx.lineTo(ox, oy - 11);
          ctx.moveTo(ox + 5, oy); ctx.lineTo(ox + 8, oy - 7); ctx.stroke();
        } else if (hv < 0.24) { // stone
          ctx.fillStyle = 'rgba(255,255,255,0.06)'; ell(ox, oy, 9, 6);
          ctx.fillStyle = 'rgba(255,255,255,0.04)'; ell(ox - 2, oy - 2, 5, 3);
        } else if (hv < 0.28) { // glowing mushroom
          ctx.fillStyle = 'rgba(230,220,255,0.25)'; ctx.fillRect(ox - 1.5, oy - 6, 3, 7);
          ctx.fillStyle = 'rgba(155,140,255,0.45)'; ell(ox, oy - 7, 7, 4);
        } else if (hv < 0.31) { // rune circle
          ctx.strokeStyle = 'rgba(255,209,102,0.08)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(ox, oy, 16, 0, TAU); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(ox - 9, oy + 6); ctx.lineTo(ox, oy - 10); ctx.lineTo(ox + 9, oy + 6); ctx.closePath(); ctx.stroke();
        }
      }
    }
  }

  function drawHero(h) {
    if (h.dead) return;
    ctx.save(); ctx.translate(h.x, h.y);
    if (h.inv > 0 && Math.floor(h.inv * 20) % 2 === 0) ctx.globalAlpha = 0.45;
    const bob = h.moving ? Math.sin(G.t * 14) * 1.5 : Math.sin(G.t * 3) * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(0, 15, 14, 5);
    ctx.scale(h.face, 1);
    // staff
    ctx.strokeStyle = '#a0703c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(9, 13); ctx.lineTo(13, -14 + bob); ctx.stroke();
    ctx.fillStyle = 'rgba(94,231,255,.35)'; circle(13, -16 + bob, 7);
    ctx.fillStyle = '#9ff4ff'; circle(13, -16 + bob, 3.5);
    // robe
    ctx.fillStyle = '#3b5bdb';
    ctx.beginPath(); ctx.moveTo(-11, 14); ctx.lineTo(11, 14); ctx.lineTo(7, -3 + bob); ctx.lineTo(-7, -3 + bob); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd166'; ctx.fillRect(-9, 5 + bob * 0.5, 18, 2.5);
    // head
    ctx.fillStyle = '#ffd9b3'; circle(0, -9 + bob, 8);
    ctx.fillStyle = '#2a1d3d'; circle(3.5, -9 + bob, 1.5);
    ctx.fillStyle = 'rgba(255,120,120,.5)'; circle(5, -6 + bob, 1.8);
    // hat
    ctx.fillStyle = '#5f3dc4';
    ctx.beginPath(); ctx.moveTo(-11, -13 + bob); ctx.lineTo(10, -13 + bob); ctx.quadraticCurveTo(0, -24 + bob, -7, -35 + bob); ctx.closePath(); ctx.fill();
    ell(0, -13 + bob, 13, 3.2);
    ctx.fillStyle = '#ffd166'; star(-2, -21 + bob, 3.2);
    ctx.restore();

    // hp bar under hero
    const w = 34, pct = h.hp / h.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(h.x - w / 2, h.y + 22, w, 4);
    ctx.fillStyle = pct > 0.35 ? '#7dff9b' : '#ff4d6d'; ctx.fillRect(h.x - w / 2, h.y + 22, w * pct, 4);
  }

  // Full-body cat, side view. Walks with leg cycles, swishes its tail, raises a paw to cast.
  function drawCatBody(c, sc, gt) {
    const def = c.def, s = 9 * sc, t = gt === undefined ? G.t : gt;
    const bounce = c.moving ? -Math.abs(Math.sin(c.walk)) * s * 0.16 : Math.sin(t * 2.2 + c.bob) * s * 0.04;
    ctx.save(); ctx.translate(c.x, c.y);
    // shadow + magic ring on the ground
    ctx.fillStyle = 'rgba(0,0,0,.32)'; ell(0, s * 1.05, s * 1.3, s * 0.34);
    if (c.glow > 0.02) {
      ctx.strokeStyle = def.magic; ctx.globalAlpha = c.glow * 0.8; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, s * 1.05, s * (1.4 + (1 - c.glow) * 0.8), s * (0.42 + (1 - c.glow) * 0.25), 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.scale(c.face, 1);
    const sway = Math.sin(t * 3 + c.bob) * s * 0.35;
    const outline = 'rgba(20,10,35,.45)';
    // tail
    ctx.strokeStyle = def.fur; ctx.lineWidth = s * 0.3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.85, bounce);
    ctx.quadraticCurveTo(-s * 1.75, -s * 0.2 + bounce, -s * 1.55 + sway * 0.4, -s * 1.25 + bounce + sway * 0.3); ctx.stroke();
    // legs
    const swing = c.moving ? s * 0.36 : 0;
    const leg = (x, ph, col) => {
      const o = Math.sin(c.walk + ph) * swing, lift = c.moving ? Math.max(0, -Math.cos(c.walk + ph)) * s * 0.15 : 0;
      ctx.fillStyle = col; ctx.fillRect(x + o - s * 0.13, s * 0.25, s * 0.27, s * 0.78 - lift);
      ell(x + o, s * 1.02 - lift, s * 0.18, s * 0.1);
    };
    leg(-s * 0.5, Math.PI, def.stripe); leg(s * 0.5, 0, def.stripe);
    // body
    ctx.fillStyle = def.fur; ctx.strokeStyle = outline; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, s * 0.12 + bounce, s * 1.02, s * 0.6, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = def.stripe;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.ellipse(k * s * 0.38, -s * 0.36 + bounce, s * 0.1, s * 0.2, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ell(s * 0.1, s * 0.38 + bounce, s * 0.6, s * 0.2);
    leg(-s * 0.68, 0, def.fur); leg(s * 0.3, Math.PI, def.fur);
    // head
    const hx = s * 0.88, hy = -s * 0.5 + bounce * 1.2;
    ctx.fillStyle = def.fur;
    ctx.beginPath();
    ctx.moveTo(hx - s * 0.52, hy - s * 0.15); ctx.lineTo(hx - s * 0.42, hy - s * 0.92); ctx.lineTo(hx - s * 0.05, hy - s * 0.5);
    ctx.moveTo(hx + s * 0.55, hy - s * 0.15); ctx.lineTo(hx + s * 0.5, hy - s * 0.92); ctx.lineTo(hx + s * 0.12, hy - s * 0.52);
    ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy, s * 0.6, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,160,190,.7)';
    ctx.beginPath(); ctx.moveTo(hx + s * 0.42, hy - s * 0.35); ctx.lineTo(hx + s * 0.44, hy - s * 0.72); ctx.lineTo(hx + s * 0.2, hy - s * 0.5); ctx.fill();
    // eyes (3/4 view)
    const blink = Math.sin(t * 1.3 + c.bob * 3) > 0.985;
    const eyeCol = def.id === 'shadow' ? def.magic : '#1a1026';
    ctx.fillStyle = eyeCol;
    if (blink) { ctx.fillRect(hx - s * 0.12, hy - s * 0.02, s * 0.2, s * 0.06); ctx.fillRect(hx + s * 0.22, hy - s * 0.02, s * 0.2, s * 0.06); }
    else {
      ell(hx - s * 0.02, hy, s * 0.1, s * 0.16); ell(hx + s * 0.32, hy, s * 0.1, s * 0.16);
      ctx.fillStyle = '#fff'; circle(hx + s * 0.01, hy - s * 0.06, s * 0.04); circle(hx + s * 0.35, hy - s * 0.06, s * 0.04);
    }
    ctx.fillStyle = '#ff8fab';
    ctx.beginPath(); ctx.moveTo(hx + s * 0.42, hy + s * 0.18); ctx.lineTo(hx + s * 0.58, hy + s * 0.18); ctx.lineTo(hx + s * 0.5, hy + s * 0.28); ctx.fill();
    ctx.strokeStyle = 'rgba(26,16,38,.5)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(hx + s * 0.55, hy + s * 0.25); ctx.lineTo(hx + s * 1.0, hy + s * 0.15);
    ctx.moveTo(hx + s * 0.55, hy + s * 0.3); ctx.lineTo(hx + s * 0.98, hy + s * 0.36); ctx.stroke();
    // wizard hat, leaning back
    ctx.fillStyle = def.hat;
    ctx.beginPath(); ctx.moveTo(hx - s * 0.42, hy - s * 0.45); ctx.lineTo(hx + s * 0.42, hy - s * 0.5);
    ctx.quadraticCurveTo(hx - s * 0.05, hy - s * 1.1, hx - s * 0.55 - sway * 0.15, hy - s * 1.6); ctx.closePath(); ctx.fill();
    ell(hx, hy - s * 0.48, s * 0.62, s * 0.13);
    ctx.fillStyle = def.magic; star(hx - s * 0.1, hy - s * 0.82, s * (0.15 + c.lvl * 0.025));
    // casting paw with a glowing orb
    if (c.cast > 0) {
      const p = Math.min(1, c.cast / 0.14);
      const px = s * 1.15 + p * s * 0.35, py = -s * 0.05 - p * s * 0.45 + bounce;
      ctx.strokeStyle = def.fur; ctx.lineWidth = s * 0.26;
      ctx.beginPath(); ctx.moveTo(s * 0.55, s * 0.05 + bounce); ctx.lineTo(px, py); ctx.stroke();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = def.magic; ctx.globalAlpha = 0.5 * p; circle(px + s * 0.1, py, s * 0.55);
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; circle(px + s * 0.1, py, s * 0.16);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawCat(c) { drawCatBody(c, 1); }

  function drawZone(z) {
    const p = z.life / z.max;
    if (z.kind === 'poison') {
      const fade = Math.min(1, z.life / 0.5, (z.max - z.life) / 0.2);
      ctx.globalAlpha = 0.32 * fade; ctx.fillStyle = z.color;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.72, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.25 * fade; ctx.fillStyle = '#d8ffd9';
      for (let k = 0; k < 5; k++) {
        const a = G.t * 0.8 + k * 1.26, rr = z.r * 0.5;
        circle(z.x + Math.cos(a) * rr, z.y + Math.sin(a) * rr * 0.7, z.r * 0.28);
      }
      ctx.globalAlpha = 0.6 * fade; ctx.strokeStyle = z.color; ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]); ctx.lineDashOffset = G.t * 20;
      ctx.beginPath(); ctx.ellipse(z.x, z.y, z.r, z.r * 0.72, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else if (z.kind === 'blast') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = p * 0.6; ctx.fillStyle = '#ff9a3d'; circle(z.x, z.y, z.r * (1.1 - p * 0.4));
      ctx.globalAlpha = p; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 4 * p + 1;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (1.15 - p * 0.35), 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawProjectile(b) {
    if (b.kind === 'fire') {
      ctx.globalAlpha = 0.4; ctx.fillStyle = b.color; circle(b.x, b.y, b.r * 2.4);
      ctx.globalAlpha = 1; ctx.fillStyle = '#ff9a3d'; circle(b.x, b.y, b.r * 1.2);
      ctx.fillStyle = '#ffe08a'; circle(b.x, b.y, b.r * 0.7);
      ctx.fillStyle = '#fff'; circle(b.x, b.y, b.r * 0.3);
    } else if (b.kind === 'star') {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
      ctx.globalAlpha = 0.35; ctx.fillStyle = b.color; circle(0, 0, b.r * 2.2);
      ctx.globalAlpha = 1; star(0, 0, b.r * 1.5);
      ctx.fillStyle = '#fff'; star(0, 0, b.r * 0.7);
      ctx.restore();
    } else if (b.kind === 'shard') {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.globalAlpha = 0.35; ctx.fillStyle = b.color; ell(-4, 0, 14, 5);
      ctx.globalAlpha = 1; ctx.fillStyle = '#bff6ff';
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-2, -3.5); ctx.lineTo(-10, 0); ctx.lineTo(-2, 3.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-2, -1.5); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  function drawYarn(b) {
    const o = b.owner;
    ctx.strokeStyle = 'rgba(255,111,168,.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(o.x, o.y);
    ctx.quadraticCurveTo((o.x + b.x) / 2 + 20 * Math.sin(G.t * 5), (o.y + b.y) / 2 + 20, b.x, b.y); ctx.stroke();
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ell(0, b.r + 3, b.r, b.r * 0.3);
    ctx.fillStyle = '#ff7fb3'; circle(0, 0, b.r);
    ctx.strokeStyle = '#ffd1e4'; ctx.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath(); ctx.ellipse(0, 0, b.r * 0.92, b.r * 0.35, k * 1.05, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }

  function drawBomb(b) {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(b.x, b.y + 4, 7 - b.z * 0.03, 3);
    ctx.save(); ctx.translate(b.x, b.y - b.z); ctx.rotate(b.spin);
    ctx.fillStyle = '#3f8f48'; circle(0, 0, 7);
    ctx.fillStyle = '#7ee081'; ell(-2, -2, 4, 3);
    ctx.fillStyle = '#b9ffbd'; ctx.beginPath(); ctx.ellipse(3, -7, 4, 2, 0.6, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawBeam(bm) {
    const p = bm.life / bm.max, w = bm.w * (0.35 + p * 0.65);
    ctx.lineCap = 'round';
    ctx.globalAlpha = p * 0.45; ctx.strokeStyle = '#ffb300'; ctx.lineWidth = w * 1.9;
    ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
    ctx.globalAlpha = p; ctx.strokeStyle = bm.color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = w * 0.35;
    ctx.beginPath(); ctx.moveTo(bm.x1, bm.y1); ctx.lineTo(bm.x2, bm.y2); ctx.stroke();
    ctx.fillStyle = '#fff'; circle(bm.x1, bm.y1, w * 0.8);
    ctx.globalAlpha = 1;
  }

  function drawSlash(sl) {
    const p = sl.life / sl.max, grow = 1 - p;
    ctx.lineCap = 'round';
    const arcs = sl.all ? [0, TAU / 3, (2 * TAU) / 3] : [0];
    for (const off of arcs) {
      for (let k = -1; k <= 1; k++) {
        const r = sl.r * (0.62 + k * 0.14 + grow * 0.15);
        const a0 = sl.a + off - 1.0 + grow * 0.5, a1 = sl.a + off + 1.0 - (1 - grow) * 0.2;
        ctx.globalAlpha = p; ctx.strokeStyle = sl.color; ctx.lineWidth = 6 * p + 1;
        ctx.beginPath(); ctx.arc(sl.x, sl.y, r, a0, a1); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * p + 0.5;
        ctx.beginPath(); ctx.arc(sl.x, sl.y, r, a0 + 0.2, a1 - 0.2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawMouse(e) {
    const s = e.r, dir = G.hero.x > e.x ? 1 : -1;
    ctx.save(); ctx.translate(e.x, e.y + Math.sin(G.t * 12 + e.wob) * 1.5); ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ell(0, s * 0.85, s, s * 0.3);
    ctx.strokeStyle = '#d98aa0'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 0.2);
    ctx.quadraticCurveTo(-s * 1.7, -s * 0.2 + Math.sin(G.t * 8 + e.wob) * s * 0.5, -s * 2, s * 0.4); ctx.stroke();
    const f = e.flash > 0;
    ctx.fillStyle = f ? '#fff' : e.slow > 0 ? '#9fc6e0' : '#8e9aae'; ell(0, 0, s * 1.05, s * 0.8);
    ctx.fillStyle = f ? '#fff' : 'rgba(110,170,110,.55)'; ell(-s * 0.3, s * 0.1, s * 0.3, s * 0.22); // zombie patch
    ctx.fillStyle = f ? '#fff' : '#b9c3d2'; circle(s * 0.3, -s * 0.65, s * 0.4);
    ctx.fillStyle = '#d98aa0'; circle(s * 0.3, -s * 0.65, s * 0.2);
    ctx.fillStyle = '#ff3b5c'; circle(s * 0.62, -s * 0.15, s * 0.15);
    ctx.fillStyle = '#d98aa0'; circle(s * 1.05, s * 0.05, s * 0.14);
    ctx.restore();
  }

  function drawBrute(e) {
    const s = e.r, dir = G.hero.x > e.x ? 1 : -1;
    ctx.save(); ctx.translate(e.x, e.y + Math.sin(G.t * 6 + e.wob) * 1.5); ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ell(0, s * 0.85, s * 1.1, s * 0.3);
    ctx.strokeStyle = '#b8788a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 0.3);
    ctx.quadraticCurveTo(-s * 1.6, s * 0.1 + Math.sin(G.t * 5 + e.wob) * s * 0.3, -s * 1.8, s * 0.6); ctx.stroke();
    const f = e.flash > 0;
    ctx.fillStyle = f ? '#fff' : e.slow > 0 ? '#8fb3c9' : '#6e4b3a'; ell(0, 0, s * 1.05, s * 0.85);
    // armor
    ctx.fillStyle = f ? '#fff' : '#8d96a3';
    ctx.beginPath(); ctx.ellipse(-s * 0.1, -s * 0.15, s * 0.9, s * 0.62, 0, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#b5bdc8';
    for (let k = -2; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(k * s * 0.35, -s * 0.7); ctx.lineTo(k * s * 0.35 + s * 0.17, -s * 1.05); ctx.lineTo(k * s * 0.35 + s * 0.34, -s * 0.7); ctx.fill(); }
    ctx.fillStyle = '#5a3c2e'; circle(s * 0.45, -s * 0.7, s * 0.28);
    ctx.fillStyle = '#ff2d4f'; circle(s * 0.62, -s * 0.12, s * 0.13);
    ctx.fillStyle = '#fff3d6'; ctx.fillRect(s * 0.78, s * 0.15, s * 0.1, s * 0.28);
    ctx.fillStyle = '#c98a9a'; circle(s * 1.02, 0, s * 0.14);
    ctx.restore();
    if (e.hp < e.maxHp) {
      const w = s * 2;
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(e.x - w / 2, e.y - s - 10, w, 4);
      ctx.fillStyle = '#ff8a3d'; ctx.fillRect(e.x - w / 2, e.y - s - 10, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function drawBoss(e) {
    const s = e.r, dir = G.hero.x > e.x ? 1 : -1;
    ctx.save(); ctx.translate(e.x, e.y + Math.sin(G.t * 4) * 3);
    // aura
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25 + Math.sin(G.t * 6) * 0.08;
    ctx.fillStyle = G.enraged ? '#ff2d4f' : '#7b4dff'; circle(0, 0, s * 1.5);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ell(0, s * 0.9, s * 1.2, s * 0.3);
    ctx.strokeStyle = '#b8788a'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.9, s * 0.3);
    ctx.quadraticCurveTo(-s * 1.8, -s * 0.3 + Math.sin(G.t * 3) * s * 0.3, -s * 1.6, s * 0.8); ctx.stroke();
    const f = e.flash > 0;
    // cloak
    ctx.fillStyle = f ? '#fff' : '#4b1d6b';
    ctx.beginPath(); ctx.moveTo(-s * 1.1, s * 0.8); ctx.quadraticCurveTo(-s * 1.2, -s * 0.4, 0, -s * 0.6);
    ctx.quadraticCurveTo(s * 1.2, -s * 0.4, s * 1.1, s * 0.8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = f ? '#fff' : '#5c5470'; ell(s * 0.1, -s * 0.05, s * 0.85, s * 0.7);
    ctx.fillStyle = f ? '#fff' : '#77708a'; circle(s * 0.15, -s * 0.72, s * 0.32);
    ctx.fillStyle = '#c98a9a'; circle(s * 0.15, -s * 0.72, s * 0.17);
    ctx.fillStyle = G.enraged ? '#ffea00' : '#ff2d4f'; circle(s * 0.55, -s * 0.15, s * 0.11);
    ctx.fillStyle = '#c98a9a'; circle(s * 0.95, s * 0.05, s * 0.12);
    // crown
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.moveTo(-s * 0.45, -s * 0.55);
    ctx.lineTo(-s * 0.5, -s * 1.05); ctx.lineTo(-s * 0.25, -s * 0.8); ctx.lineTo(0, -s * 1.15);
    ctx.lineTo(s * 0.25, -s * 0.8); ctx.lineTo(s * 0.5, -s * 1.05); ctx.lineTo(s * 0.45, -s * 0.55); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff4d6d'; circle(0, -s * 0.72, s * 0.08);
    ctx.fillStyle = '#5ee7ff'; circle(-s * 0.3, -s * 0.66, s * 0.06); circle(s * 0.3, -s * 0.66, s * 0.06);
    ctx.restore();
  }

  function drawGem(g) {
    if (g.fish) {
      ctx.save(); ctx.translate(g.x, g.y + Math.sin(G.t * 4 + g.x) * 2);
      ctx.fillStyle = '#ff9f5a'; ell(0, 0, 9, 5.5);
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-13, -5); ctx.lineTo(-13, 5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#1a1026'; circle(4.5, -1, 1.3);
      ctx.restore();
      return;
    }
    const s = g.v >= 20 ? 8 : g.v >= 4 ? 6.5 : 5;
    const col = g.v >= 20 ? '#e08cff' : g.v >= 4 ? '#7dff9b' : '#5ee7ff';
    const y = g.y + Math.sin(G.t * 5 + g.x * 0.1) * 1.5;
    ctx.fillStyle = col; ctx.globalAlpha = 0.25; circle(g.x, y, s * 1.6); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.moveTo(g.x, y - s); ctx.lineTo(g.x + s * 0.7, y); ctx.lineTo(g.x, y + s); ctx.lineTo(g.x - s * 0.7, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.moveTo(g.x, y - s); ctx.lineTo(g.x + s * 0.35, y - s * 0.1); ctx.lineTo(g.x, y); ctx.closePath(); ctx.fill();
  }

  function inView(x, y, r, camX, camY) {
    return x + r > camX - W / 2 && x - r < camX + W / 2 && y + r > camY - H / 2 && y - r < camY + H / 2;
  }

  function draw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const h = G.hero;
    const camX = h.x, camY = h.y;
    const sx = G.shake > 0 ? rand(-G.shake, G.shake) : 0, sy = G.shake > 0 ? rand(-G.shake, G.shake) : 0;
    ctx.save();
    ctx.translate(W / 2 - camX + sx, H / 2 - camY + sy);

    drawBackground(camX, camY);

    for (const g of G.gems) if (inView(g.x, g.y, 12, camX, camY)) drawGem(g);

    // ground effects: poison clouds, explosions, a soft rune under the hero
    for (const z of G.zones) if (inView(z.x, z.y, z.r, camX, camY)) drawZone(z);
    if (!h.dead) {
      ctx.strokeStyle = 'rgba(155,140,255,0.18)'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]); ctx.lineDashOffset = -G.t * 20;
      ctx.beginPath(); ctx.ellipse(h.x, h.y + 14, 26, 9, 0, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const e of G.enemies) {
      if (!inView(e.x, e.y, e.r * 2, camX, camY)) continue;
      if (e.type === 'mouse') drawMouse(e);
      else if (e.type === 'brute') drawBrute(e);
    }
    if (G.boss && !G.boss.dead) drawBoss(G.boss);

    for (const b of G.ebullets) {
      if (!inView(b.x, b.y, 12, camX, camY)) continue;
      ctx.fillStyle = 'rgba(255,45,79,.35)'; circle(b.x, b.y, b.r * 1.8);
      ctx.fillStyle = '#ff6b85'; circle(b.x, b.y, b.r);
      ctx.fillStyle = '#ffe0e6'; circle(b.x, b.y, b.r * 0.45);
    }

    // hero and cats sorted by depth so cats can walk in front of and behind the hero
    const actors = h.dead ? [] : G.cats.slice();
    actors.sort((a, b) => a.y - b.y);
    let heroDrawn = false;
    for (const c of actors) {
      if (!heroDrawn && c.y > h.y) { drawHero(h); heroDrawn = true; }
      drawCat(c);
    }
    if (!heroDrawn) drawHero(h);
    for (const b of G.bullets) {
      if (!inView(b.x, b.y, 60, camX, camY)) continue;
      if (b.kind === 'yarn') drawYarn(b); else if (b.kind === 'bomb') drawBomb(b);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.bullets) if (b.kind !== 'yarn' && b.kind !== 'bomb' && inView(b.x, b.y, 30, camX, camY)) drawProjectile(b);
    for (const bm of G.beams) drawBeam(bm);
    for (const sl of G.slashes) drawSlash(sl);
    ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (const bo of G.bolts) {
      ctx.strokeStyle = bo.color || '#bfe9ff';
      ctx.globalAlpha = clamp(bo.life / 0.18, 0, 1);
      ctx.beginPath(); ctx.moveTo(bo.x1, bo.y1);
      for (let k = 1; k < 5; k++) {
        const t = k / 5;
        ctx.lineTo(bo.x1 + (bo.x2 - bo.x1) * t + rand(-8, 8), bo.y1 + (bo.y2 - bo.y1) * t + rand(-8, 8));
      }
      ctx.lineTo(bo.x2, bo.y2); ctx.stroke();
    }
    for (const p of G.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    ctx.font = '800 13px Rubik, system-ui, sans-serif'; ctx.textAlign = 'center';
    for (const t of G.texts) {
      ctx.globalAlpha = clamp(t.life / 0.4, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(t.txt, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color; ctx.fillText(t.txt, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // vignette + hurt flash
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, G.hurtFlash > 0 ? `rgba(200,20,50,${0.25 + G.hurtFlash})` : 'rgba(5,2,15,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // joystick
    if (state === 'play' && joy.active) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; circle(joy.ox, joy.oy, joy.max);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(joy.ox, joy.oy, joy.max, 0, TAU); ctx.stroke();
      ctx.fillStyle = 'rgba(255,209,102,0.85)';
      circle(joy.ox + clamp(joy.vx, -1, 1) * joy.max * 0.8, joy.oy + clamp(joy.vy, -1, 1) * joy.max * 0.8, 22);
    }
  }

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------
  function updateHud() {
    const h = G.hero;
    ui.xpfill.style.width = (100 * G.xp / G.xpNext).toFixed(1) + '%';
    ui.lvl.textContent = 'Ур. ' + G.level;
    ui.hpfill.style.width = (100 * h.hp / h.maxHp).toFixed(1) + '%';
    ui.hptext.textContent = Math.ceil(h.hp) + ' / ' + Math.round(h.maxHp);
    ui.timer.textContent = fmtTime(G.t);
    ui.runfill.style.width = Math.min(100, (100 * G.t) / RUN_TIME).toFixed(1) + '%';
    ui.kills.textContent = '☠ ' + G.kills;
    ui.catcount.textContent = '🐱 × ' + G.cats.length;
    if (G.boss && !G.boss.dead) ui.bossfill.style.width = Math.max(0, (100 * G.boss.hp) / G.boss.maxHp).toFixed(1) + '%';
  }

  // ------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state === 'play') {
      update(dt);
      updateHud();
    } else if (state === 'menu') {
      // idle showcase: the squad spinning behind the menu
      G.t += dt;
      updateCats(dt, false);
      updateFx(dt);
    }
    if (bannerTimer > 0 && state === 'play') {
      bannerTimer -= dt;
      if (bannerTimer <= 0) bannerEl.classList.remove('show');
    } else if (state === 'menu' || state === 'over') {
      bannerEl.classList.remove('show'); bannerTimer = 0;
    }
    draw();
    requestAnimationFrame(frame);
  }

  // fuller squad spinning behind the lobby
  function showcase() {
    for (const def of CAT_TYPES) if (!G.cats.some((c) => c.def === def) && G.cats.length < 6) addCat(def, false);
  }

  // Bridge used by the lobby (lobby.js)
  window.MeowSquad = {
    CAT_TYPES, ITEMS, catPortrait, fmtTime, sfx: Sfx,
    startRun,
    get leader() { return leaderId; },
    setLeader(id) {
      leaderId = id;
      try { localStorage.setItem('meowsquad-leader', id); } catch (_) { /* ignore */ }
      if (state === 'menu') { newGame(); showcase(); }
    },
  };

  // boot
  newGame();
  showcase();
  renderBest();
  if (window.MeowLobby) window.MeowLobby.init(window.MeowSquad);
  requestAnimationFrame(frame);
})();
