const audio    = document.getElementById('audio');
  const gate     = document.getElementById('gate');
  const btn      = document.getElementById('playBtn');
  const muteBtn  = document.getElementById('muteBtn');
  const seek     = document.getElementById('seek');
  const seekFill = document.getElementById('seekFill');
  const seekKnob = document.getElementById('seekKnob');
  const timeEl   = document.getElementById('time');
  const volEl    = document.getElementById('vol');
  const volFill  = document.getElementById('volFill');
  const root     = document.documentElement;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let bass = 0;
  const savedVol = parseFloat(localStorage.getItem('binware_vol_v2'));
  let target = Number.isFinite(savedVol) ? Math.min(Math.max(savedVol, 0.08), 1) : 0.35;
  audio.volume = target;
  function drawVolume() {
    const v = audio.muted ? 0 : target;
    volFill.style.width = (v * 100) + '%';
    volEl.setAttribute('aria-valuenow', Math.round(v * 100));
    muteBtn.textContent = audio.muted || v === 0 ? 'off' : 'vol';
  }
  let fadeId = 0;
  function setVolume(v) {
    cancelAnimationFrame(fadeId);          // рука человека главнее плавности
    fadeId = 0;
    target = Math.min(Math.max(v, 0), 1);
    audio.volume = target;
    if (target > 0) audio.muted = false;
    localStorage.setItem('binware_vol_v2', String(target));
    drawVolume();
  }
  /** Плавный ввод звука: резкий старт на полной громкости бьёт по ушам. */
  function fadeIn(ms) {
    const to = target;
    const start = performance.now();
    audio.volume = 0;
    function step(now) {
      const k = Math.min((now - start) / ms, 1);
      audio.volume = to * k * k;           // тише в начале, ровнее на слух
      if (k < 1) fadeId = requestAnimationFrame(step);
      else { audio.volume = to; fadeId = 0; }
    }
    fadeId = requestAnimationFrame(step);
  }
  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    drawVolume();
  });
  drawVolume();
  const bandsBox = document.getElementById('bands');
  const gateLine = document.getElementById('gateLine');
  const gateText = document.getElementById('gateText');
  const gateOk   = document.getElementById('gateOk');
  const BANDS = 14;
  for (let i = 0; i < BANDS; i++) {
    const b = document.createElement('b');
    b.style.top = (i * 100 / BANDS) + '%';
    b.style.height = (100 / BANDS + 0.3) + '%';
    b.style.setProperty('--x', ((Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 80)) + '%');
    b.style.transitionDelay = (i * 16) + 'ms';
    bandsBox.appendChild(b);
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let ready = false;
  let pollId = 0;
  function done() {
    if (ready) return;
    ready = true;
    clearInterval(pollId);
    gateText.textContent = '';
  }
  function progress() {
    if (ready) return;
    if (!audio.duration || !audio.buffered.length) return;
    const k = audio.buffered.end(audio.buffered.length - 1) / audio.duration;
    if (k >= 0.995) { done(); return; }
    gateText.textContent = 'loading ' + Math.round(k * 100) + '% ';
  }
  audio.addEventListener('progress', progress);
  audio.addEventListener('canplaythrough', done);
  audio.addEventListener('error', done);        // файла нет — не держим человека
  pollId = setInterval(progress, 400);
  setTimeout(done, 9000);                       // сеть молчит — тоже не держим
  if (fine) {
    window.addEventListener('pointermove', e => {
      if (entered) return;
      const dx = (e.clientX - window.innerWidth / 2) / window.innerWidth;
      const dy = (e.clientY - window.innerHeight / 2) / window.innerHeight;
      gateLine.style.transform = `translate(${dx * 26}px, ${dy * 18}px)`;
    });
  }
  let entered = false;
  let audioUnlocked = false;
  async function startAudio() {
    try {
      audio.muted = false;
      audio.volume = 0;
      await audio.play();
      audioUnlocked = true;
      fadeIn(1800);
      return true;
    } catch (e) {
      console.warn('audio playback blocked:', e);
      audio.volume = target;
      btn.textContent = 'play';
      return false;
    }
  }
  function enter() {
    if (entered) return;
    entered = true;
    startAudio();
    startViz();
    typeIn();
  }
  /** Набор строки, как в терминале: connect — пауза — ok. */
  async function typeIn() {
    gate.classList.add('typing');
    gateText.textContent = '';
    const word = 'connect';
    for (let i = 1; i <= word.length; i++) {
      gateText.textContent = word.slice(0, i);
      await sleep(44);
    }
    await sleep(210);
    gateOk.textContent = ' ok';
    await sleep(320);
    openGate();
  }
  /** Экран рвётся на полосы, содержимое проступает. */
  function openGate() {
    document.body.classList.add('entered');
    gate.classList.add('gone');
    setTimeout(() => gate.remove(), 1200);
    revealText();
  }
  gate.addEventListener('click', enter);
  const NOISE = '!<>-_\\/[]{}=+*^?#%$&@';
  const cipherable = fine;
  function noiseChar() { return NOISE[(Math.random() * NOISE.length) | 0]; }
  function cipher(text) {
    let out = '';
    for (let i = 0; i < text.length; i++) out += text[i] === ' ' ? ' ' : noiseChar();
    return out;
  }
  const running = new WeakMap();
  function stop(el) {
    const id = running.get(el);
    if (id) cancelAnimationFrame(id);
    running.delete(el);
  }
  function decode(el) {
    stop(el);
    const text = el.dataset.text;
    const start = performance.now();
    const step = 38, hold = 140;
    const total = text.length * step + hold;
    function tick(now) {
      const t = now - start;
      let out = '';
      for (let i = 0; i < text.length; i++) {
        out += t - i * step > hold ? text[i] : noiseChar();
      }
      el.textContent = out;
      if (t < total) running.set(el, requestAnimationFrame(tick));
      else { el.textContent = text; running.delete(el); }
    }
    running.set(el, requestAnimationFrame(tick));
  }
  function encode(el) {
    stop(el);
    el.textContent = cipher(el.dataset.text);
  }
  /** Короткая рябь при появлении: строка оживает, но себя не выдаёт. */
  function churn(el, delay) {
    stop(el);
    const start = performance.now() + delay;
    function tick(now) {
      const t = now - start;
      if (t > 0) el.textContent = cipher(el.dataset.text);
      if (t < 420) running.set(el, requestAnimationFrame(tick));
      else encode(el);
    }
    running.set(el, requestAnimationFrame(tick));
  }
  if (cipherable) {
    document.querySelectorAll('.t').forEach(encode);
    document.querySelectorAll('.links a').forEach(a => {
      const t = a.querySelector('.t');
      if (!t) return;
      a.addEventListener('pointerenter', () => decode(t));
      a.addEventListener('pointerleave', () => encode(t));
      a.addEventListener('focus', () => decode(t));
      a.addEventListener('blur',  () => encode(t));
    });
  }
  function revealText() {
    if (!cipherable) return;
    document.querySelectorAll('.t').forEach((el, i) => churn(el, 240 + i * 90));
  }
  if (fine) {
    document.querySelectorAll('.links a').forEach(a => {
      a.addEventListener('pointermove', e => {
        const r = a.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        a.style.transform = `translate(${dx * 0.14}px, ${dy * 0.32}px)`;
      });
      a.addEventListener('pointerleave', () => { a.style.transform = ''; });
    });
  }
  const flash = document.getElementById('flash');
  document.querySelectorAll('.links a').forEach(a => {
    a.addEventListener('click', () => {
      flash.classList.remove('on');
      void flash.offsetWidth;              // перезапуск анимации
      flash.classList.add('on');
    });
  });
  document.querySelectorAll('[data-unavailable]').forEach(a => {
    let timer = 0;
    a.addEventListener('click', e => {
      e.preventDefault();
      const status = a.querySelector('.link-status');
      if (!status) return;
      status.classList.add('on');
      clearTimeout(timer);
      timer = setTimeout(() => status.classList.remove('on'), 1300);
    });
  });
  const copiedEl = document.getElementById('copied');
  const DISCORD_ID = 'fameua';
  let copiedTimer = 0;
  document.getElementById('discord').addEventListener('click', async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(DISCORD_ID);
      ok = true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = DISCORD_ID;
      ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none;user-select:text;-webkit-user-select:text';
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
    }
    copiedEl.textContent = ok ? 'copied' : DISCORD_ID;
    copiedEl.classList.add('on');
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => copiedEl.classList.remove('on'), 1500);
  });
  audio.addEventListener('error', () => {
    btn.disabled = true;
    btn.textContent = '—';
  });
  function toggle() {
    if (audio.paused) startAudio();
    else audio.pause();
  }
  btn.addEventListener('click', toggle);
  audio.addEventListener('play',  () => btn.textContent = 'pause');
  audio.addEventListener('pause', () => btn.textContent = 'play');
  function mmss(sec) {
    if (!Number.isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }
  function drawSeek() {
    const pct = audio.duration ? audio.currentTime / audio.duration : 0;
    seekFill.style.width = (pct * 100) + '%';
    seekKnob.style.left = (pct * 100) + '%';
    seek.setAttribute('aria-valuenow', Math.round(pct * 100));
    timeEl.textContent = mmss(audio.currentTime) + ' / ' + mmss(audio.duration);
  }
  audio.addEventListener('timeupdate', drawSeek);
  audio.addEventListener('loadedmetadata', drawSeek);
  function draggable(el, onMove) {
    function ratio(clientX) {
      const r = el.getBoundingClientRect();
      return Math.min(Math.max((clientX - r.left) / r.width, 0), 1);
    }
    el.addEventListener('pointerdown', e => {
      el.setPointerCapture(e.pointerId);
      el.classList.add('drag');
      onMove(ratio(e.clientX));
      e.preventDefault();
    });
    el.addEventListener('pointermove', e => {
      if (el.hasPointerCapture(e.pointerId)) onMove(ratio(e.clientX));
    });
    const release = e => {
      el.classList.remove('drag');
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
  }
  draggable(seek, r => {
    if (!audio.duration) return;
    audio.currentTime = r * audio.duration;
    drawSeek();
  });
  draggable(volEl, r => setVolume(r));
  seek.addEventListener('keydown', e => {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
    else if (e.key === 'ArrowLeft') audio.currentTime = Math.max(audio.currentTime - 5, 0);
    else return;
    e.preventDefault();
    drawSeek();
  });
  volEl.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') setVolume(target + 0.05);
    else if (e.key === 'ArrowLeft') setVolume(target - 0.05);
    else return;
    e.preventDefault();
  });
  const SPELL = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
                 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let spellPos = 0;
  document.addEventListener('keydown', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    spellPos = key === SPELL[spellPos] ? spellPos + 1 : (key === SPELL[0] ? 1 : 0);
    if (spellPos === SPELL.length) {
      spellPos = 0;
      root.classList.toggle('konami');
    }
    if (!entered) { enter(); return; }
    if (e.target !== document.body) return;      // у полей и полос свои клавиши
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    switch (e.key) {
      case ' ':          toggle(); break;
      case 'ArrowRight': if (audio.duration) audio.currentTime = Math.min(audio.currentTime + 5, audio.duration); break;
      case 'ArrowLeft':  if (audio.duration) audio.currentTime = Math.max(audio.currentTime - 5, 0); break;
      case 'ArrowUp':    setVolume(target + 0.05); break;
      case 'ArrowDown':  setVolume(target - 0.05); break;
      case 'm': case 'M': case 'ь': audio.muted = !audio.muted; drawVolume(); break;
      default: return;
    }
    e.preventDefault();
    drawSeek();
  });
  const TITLE = document.title;
  (() => {
    const STEP   = 90;
    const DECODE = TITLE.length;   // кадров на проявление, по букве за кадр
    const HOLD   = 26;             // кадров с открытым именем
    const HIDE   = 5;              // кадров на схлопывание обратно
    const CHURN  = 16;             // кадров под шифром
    const CYCLE  = DECODE + HOLD + HIDE + CHURN;
    /** Первые `open` букв настоящие, остальные — мусор. */
    function veil(open) {
      let out = '';
      for (let i = 0; i < TITLE.length; i++) {
        out += i < open ? TITLE[i] : NOISE[(Math.random() * NOISE.length) | 0];
      }
      return out;
    }
    let step = 0;
    setInterval(() => {
      const s = step++ % CYCLE;
      if (s < DECODE) {
        document.title = veil(s + 1);
      } else if (s < DECODE + HOLD) {
        document.title = TITLE;
      } else if (s < DECODE + HOLD + HIDE) {
        const k = (s - DECODE - HOLD + 1) / HIDE;
        document.title = veil(Math.round(TITLE.length * (1 - k)));
      } else {
        document.title = veil(0);
      }
    }, STEP);
  })();
  if (fine) {
    const canvas = document.getElementById('trail');
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = document.documentElement.clientWidth;
      h = document.documentElement.clientHeight;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }
    let mx = -999, my = -999, known = false;
    let px = -999, py = -999;              // где мышь была кадр назад
    const points = [];                     // хвост
    const ripples = [];                    // круги от движения
    const bands = [];                      // полосы помех
    let symbols = [];                      // поле слов и знаков
    const WORDS = [
      'dma', 'dma 75t', 'dma 35t', '75t', 'fireware', 'captaindma', 'screamer',
      'squirrel', 'enigma x1', 'pcileech', 'leechcore', 'memprocfs', 'fpga',
      'pcie', 'kmbox', 'kmbox net', 'makcu', 'arduino', 'leonardo', 'iommu',
      'dtb', 'cr3', 'vmm', 'firmware',
      'memorywrite', 'memoryread', 'basemodule', 'entitylist', 'worldtoscreen',
      'viewmatrix', 'offsets', 'pointerchain', 'scatterread', 'kernel',
      'usermode', 'virtualaddr', 'physicaladdr', 'pagetable', 'hook',
      'shellcode', 'reclass', 'sdkdump', 'dumper', 'handle', 'syscall',
      'ntapi', 'peb', 'teb', 'module', 'thread',
      'aimbot', 'vectoraimbot', 'deviceaimbot', 'silentaim', 'triggerbot',
      'esp', 'wallhack', 'radar', 'skeleton', 'boxesp', 'lootesp', 'chams',
      'norecoil', 'nospread', 'aimassist', 'fovcircle', 'prediction', 'boneid',
      'humanizer', 'smoothing', 'snaplines', 'distance', 'visibility',
      'target', 'lock', 'flick', 'tracking',
      'anticheat', 'eac', 'battleye', 'vanguard', 'ricochet', 'faceit', 'hwid',
      'spoofer', 'hwidlock', 'banwave', 'detection', 'undetected', 'detected',
      'heuristics', 'telemetry', 'integrity', 'manualmap', 'bypass', 'cloak',
      'mask', 'signature', 'scan',
      'blurred', 'ambient', 'elusive', 'aptepuя', 'fameua', 'erlown', 'aptepuz', 'private',
      'beta', 'closed', 'invite', 'whitelist',
      'ghost', 'phantom', 'silent', 'void', 'static', 'noise', 'shadow',
      'ether', 'drift', 'nemesis', 'oracle', 'cipher', 'vector', 'daemon',
      'entropy', 'latency', 'packet', 'socket', 'payload', 'inject', 'loader',
      'config', 'preset', 'session',
    ];
    const CHAR_W = 6.4;   // ширина знака при 11px в моноширинном шрифте
    /** Шифр той же длины: пробелы остаются пробелами, иначе слова слипнутся. */
    function mask(word) {
      const out = [];
      for (let i = 0; i < word.length; i++) {
        out.push(word[i] === ' ' ? ' ' : NOISE[(Math.random() * NOISE.length) | 0]);
      }
      return out;
    }
    /**
     * Подбирает место. Центр отдан ссылкам: фон туда не лезет, иначе начинает
     * спорить с главным. Длинные слова прижимаются к краям — посреди экрана
     * они читались бы как строка текста, а не как фон.
     */
    function place(width, long) {
      for (let tries = 0; tries < 16; tries++) {
        const span = Math.max(1, w - width - 28);
        let x;
        if (long && w > 720) {
          x = Math.random() < 0.5
            ? 14 + Math.random() * (w * 0.26)
            : w * 0.74 + Math.random() * Math.max(1, w * 0.26 - width - 14);
        } else {
          x = 14 + Math.random() * span;
        }
        const y = 26 + Math.random() * Math.max(1, h - 52);
        const cx = x + width / 2;
        const holdW = Math.min(w * 0.52, 470);
        const holdH = Math.min(h * 0.55, 340);
        const clear = Math.abs(cx - w / 2) > holdW / 2 || Math.abs(y - h / 2) > holdH / 2;
        if (clear && x >= 10 && x + width <= w - 10) return { x, y };
      }
      return null;
    }
    function seed() {
      const area = w * h;
      const words = Math.max(24, Math.min(Math.round(area / 26000), 70));
      const chars = Math.max(24, Math.min(Math.round(area / 24000), 80));
      const bag = WORDS.slice();
      symbols = [];
      for (let i = 0; i < words; i++) {
        if (!bag.length) bag.push(...WORDS);
        const word = bag.splice((Math.random() * bag.length) | 0, 1)[0];
        const size = 11 + ((Math.random() * 3) | 0);
        const spot = place(word.length * CHAR_W * (size / 11), word.length > 10);
        if (spot) symbols.push({ word, mask: mask(word), x: spot.x, y: spot.y, size });
      }
      for (let i = 0; i < chars; i++) {
        const spot = place(10, false);
        if (spot) symbols.push({ word: null, mask: mask('#'), x: spot.x, y: spot.y, size: 13 });
      }
      symbols.sort((a, b) => a.size - b.size);
    }
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY; known = true;
      points.push({ x: mx, y: my, born: performance.now() });
    });
    gate.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') { mx = e.clientX; my = e.clientY; known = true; }
    });
    document.addEventListener('pointerleave', () => { known = false; });
    const LIFE = 300;        // сколько живёт точка следа, мс
    const REACH = 300;       // радиус, в котором курсор вообще на что-то влияет
    const GRID = 34;         // шаг сетки точек
    const RIPPLE_LIFE = 900;
    const BAND_LIFE = 130;
    let lastRipple = 0;
    function frame(now) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      const speed = known && px > -900 ? Math.hypot(mx - px, my - py) : 0;
      px = mx; py = my;
      if (known) {
        const x0 = Math.max(0, Math.floor((mx - REACH) / GRID) * GRID);
        const x1 = Math.min(w, mx + REACH);
        const y0 = Math.max(0, Math.floor((my - REACH) / GRID) * GRID);
        const y1 = Math.min(h, my + REACH);
        for (let gx = x0; gx <= x1; gx += GRID) {
          for (let gy = y0; gy <= y1; gy += GRID) {
            const dx = gx - mx, dy = gy - my;
            const d = Math.hypot(dx, dy) || 1;
            if (d > REACH) continue;
            const k = 1 - d / REACH;                // 1 под курсором, 0 на краю
            const push = k * k * 16;                // ближние расступаются сильнее
            const a = k * k * (0.3 + bass * 0.25);
            ctx.fillStyle = `rgba(200, 16, 46, ${a})`;
            ctx.fillRect(gx + (dx / d) * push - 1, gy + (dy / d) * push - 1, 2, 2);
          }
        }
      }
      ctx.textBaseline = 'middle';
      let font = 0;
      for (const s of symbols) {
        let hot = 0;
        if (known) {
          const d = Math.hypot(s.x - mx, s.y - my);
          if (d < REACH) hot = 1 - d / REACH;
        }
        const len = s.mask.length;
        const open = s.word
          ? Math.max(0, Math.floor((hot - 0.25) / 0.75 * (len + 1)))
          : 0;
        if (open < len && Math.random() < 0.002 + hot * 0.07) {
          const i = open + ((Math.random() * (len - open)) | 0);
          if (s.mask[i] !== ' ') s.mask[i] = NOISE[(Math.random() * NOISE.length) | 0];
        }
        let out = '';
        for (let i = 0; i < len; i++) out += i < open ? s.word[i] : s.mask[i];
        const a = 0.045 + bass * 0.035 + hot * hot * 0.6;
        if (font !== s.size) { ctx.font = s.size + 'px "JetBrains Mono", monospace'; font = s.size; }
        ctx.fillStyle = `rgba(200, 16, 46, ${a})`;
        ctx.fillText(out, s.x, s.y);
      }
      if (known && speed > 6 && now - lastRipple > 190) {
        ripples.push({ x: mx, y: my, born: now });
        lastRipple = now;
      }
      while (ripples.length && now - ripples[0].born > RIPPLE_LIFE) ripples.shift();
      for (const r of ripples) {
        const age = (now - r.born) / RIPPLE_LIFE;
        const rad = 12 + age * 240 * (1 + bass * 0.3);
        ctx.strokeStyle = `rgba(200, 16, 46, ${(1 - age) * (1 - age) * 0.16})`;
        ctx.lineWidth = 1 + (1 - age) * 1.2;
        ctx.beginPath();
        ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (known && Math.random() < 0.02 + Math.min(speed / 90, 0.06) + bass * 0.05) {
        bands.push({
          y: my + (Math.random() - 0.5) * REACH * 0.8,
          h: 2 + Math.random() * 7,
          dx: (Math.random() - 0.5) * 42,
          born: now,
        });
      }
      while (bands.length && now - bands[0].born > BAND_LIFE) bands.shift();
      for (const b of bands) {
        const k = 1 - (now - b.born) / BAND_LIFE;
        ctx.fillStyle = `rgba(200, 16, 46, ${k * 0.1})`;
        ctx.fillRect(mx - REACH / 2 + b.dx, b.y, REACH, b.h);
      }
      if (known) {
        const R = 190 * (1 + bass * 0.45);          // вспыхивает на ударе
        const a = 0.20 + bass * 0.18;
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, R);
        glow.addColorStop(0,   `rgba(200, 16, 46, ${a})`);
        glow.addColorStop(.45, `rgba(200, 16, 46, ${a * 0.35})`);
        glow.addColorStop(1,   'rgba(200, 16, 46, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(mx, my, R, 0, Math.PI * 2);
        ctx.fill();
      }
      while (points.length && now - points[0].born > LIFE) points.shift();
      for (const p of points) {
        const age = (now - p.born) / LIFE;
        const a = (1 - age) * (1 - age) * 0.55;
        const r = (1.5 + (1 - age) * 5) * 3;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(200, 16, 46, ${a})`);
        g.addColorStop(1, 'rgba(200, 16, 46, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  } else {
    document.getElementById('trail').remove();
  }
  let vizStarted = false;
  function startViz() {
    if (vizStarted) return;
    vizStarted = true;
    const canvas = document.getElementById('viz');
    const ctx = canvas.getContext('2d');
    const H = 96;
    const BARS = 56;
    let w = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = document.documentElement.clientWidth;
      canvas.style.width = w + 'px';
      canvas.style.height = H + 'px';
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);
    function frame(now) {
      const active = !audio.paused && !audio.ended;
      const t = active ? audio.currentTime : now / 1000;
      const pulse = active ? (0.18 + 0.16 * (0.5 + 0.5 * Math.sin(t * 5.1))) : 0;
      bass += (pulse - bass) * 0.12;
      root.style.setProperty('--pulse', bass.toFixed(3));
      ctx.clearRect(0, 0, w, H);
      const step = w / BARS;
      const bw = Math.max(2, step * 0.42);
      for (let i = 0; i < BARS; i++) {
        const wave = Math.sin(t * 4.2 + i * 0.62) * 0.5 + 0.5;
        const wave2 = Math.sin(t * 2.15 - i * 0.27) * 0.5 + 0.5;
        const v = active ? Math.min(1, 0.12 + wave * wave2 * 0.7) : 0.03;
        const bh = Math.max(1, v * v * (H - 8));
        const x = i * step + (step - bw) / 2;
        const g = ctx.createLinearGradient(0, H, 0, H - bh);
        g.addColorStop(0, `rgba(200, 16, 46, ${0.15 + v * 0.5})`);
        g.addColorStop(1, 'rgba(200, 16, 46, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(x, H - bh, bw, bh);
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  (async () => {
    const el = document.getElementById('visits');
    const BASE = 2709;
    const COOLDOWN = 24 * 60 * 60 * 1000;
    const key = 'binware_profile_view_v1';
    const last = Number(localStorage.getItem(key) || 0);
    const fresh = Date.now() - last >= COOLDOWN;
    el.textContent = BASE.toLocaleString('ru-RU');
    try {
      const res = await fetch('counter.php', {
        method: fresh ? 'POST' : 'GET',
        cache: 'no-store',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const value = Number(data.views);
      if (!Number.isFinite(value)) throw new Error('bad counter payload');
      el.textContent = value.toLocaleString('ru-RU');
      if (fresh && data.counted !== false) localStorage.setItem(key, String(Date.now()));
    } catch (e) {
      console.warn('счётчик недоступен:', e);
    }
  })();

  const resumeAudioOnce = () => {
    if (entered && audio.paused && !audioUnlocked) startAudio();
  };
  document.addEventListener('pointerdown', resumeAudioOnce, { passive: true });
  console.log(
    '%captepuя',
    'color:#e31336; font-family:monospace; font-size:42px; font-weight:900; line-height:1.15; letter-spacing:2px; text-shadow:0 0 14px rgba(227,19,54,.35)'
  );
  console.log(
    '%cbinware.ru',
    'color:#e31336; font-family:monospace; font-size:13px; font-weight:700; letter-spacing:1px'
  );
  console.log('%cну и что ты тут забыл', 'color:#6a6a6a; font-family:monospace; font-size:11px');
  document.addEventListener('contextmenu', e => e.preventDefault(), { capture: true });
  document.addEventListener('dragstart', e => e.preventDefault(), { capture: true });
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 's' || k === 'u')) {
      e.preventDefault();
      e.stopPropagation();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === 'c' || k === 'i' || k === 'j')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { capture: true });
