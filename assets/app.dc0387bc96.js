const audio = document.getElementById('audio');
const gate = document.getElementById('gate');
const gateLine = document.getElementById('gateLine');
const gateText = document.getElementById('gateText');
const gateOk = document.getElementById('gateOk');
const bandsBox = document.getElementById('bands');
const root = document.documentElement;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const flash = document.getElementById('flash');
const avatarOrbit = document.getElementById('avatarOrbit');
const bgVideo = document.querySelector('.bg-video');

const playBtn = document.getElementById('playBtn');
const coverBtn = document.getElementById('coverBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const repeatOne = document.getElementById('repeatOne');
const muteBtn = document.getElementById('muteBtn');
const playlistToggle = document.getElementById('playlistToggle');
const playlistPanel = document.getElementById('playlistPanel');
const playlistItems = document.getElementById('playlistItems');
const queueMode = document.getElementById('queueMode');
const seek = document.getElementById('seek');
const seekFill = document.getElementById('seekFill');
const seekKnob = document.getElementById('seekKnob');
const timeElapsed = document.getElementById('timeElapsed');
const timeRemaining = document.getElementById('timeRemaining');
const volumeControl = document.getElementById('volumeControl');
const volumePopover = document.getElementById('volumePopover');
const volumeSlider = document.getElementById('volumeSlider');
const volumeFillV = document.getElementById('volumeFillV');
const volumeKnobV = document.getElementById('volumeKnobV');
const volumePercent = document.getElementById('volumePercent');
const volumeMuteBtn = document.getElementById('volumeMuteBtn');
const islandShell = document.getElementById('islandShell');
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const trackCover = document.getElementById('trackCover');
const islandPlayer = document.getElementById('islandPlayer');

const PLAYLIST = [
  {
    title: 'Loving Machine',
    artist: 'TV Girl • instrumental + slowed',
    src: 'media/loving-machine.mp3',
    cover: 'images/covers/loving-machine.jpg'
  },
  {
    title: 'Key',
    artist: 'C418 • But You Feel Lost In Life',
    src: 'media/key-lost-in-life.mp3',
    cover: 'images/covers/key-lost-in-life.jpg'
  },
  {
    title: 'simulation swarm',
    artist: 'big thief • sped up / nightcore',
    src: 'media/simulation-swarm.mp3',
    cover: 'images/covers/simulation-swarm.jpg'
  },
  {
    title: 'No One Noticed',
    artist: 'The Marías • slowed & reverb',
    src: 'media/no-one-noticed.mp3',
    cover: 'images/covers/no-one-noticed.jpg'
  }
];

const STATE_KEY = 'sacred_player_state_v6';
const LEGACY_STATE_KEY = 'sacred_player_state_v5';
const VOLUME_KEY = 'sacred_volume_v6';
const LEGACY_VOLUME_KEY = 'sacred_volume_v5';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M8 5.7v12.6c0 .8.9 1.3 1.6.8l9-6.3a1 1 0 0 0 0-1.6l-9-6.3c-.7-.5-1.6 0-1.6.8Z"/></svg>';
const PAUSE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z"/></svg>';
const VOL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="M16 9.5a4 4 0 0 1 0 5"/><path d="M18.5 7a7 7 0 0 1 0 10"/></svg>';
const MUTE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="fill" d="M4 10v4h4l5 4V6L8 10H4Z"/><path d="m16 9 5 5M21 9l-5 5"/></svg>';

function clamp(v, min, max) { return Math.min(Math.max(v, min), max); }
function mmss(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STATE_KEY) || localStorage.getItem(LEGACY_STATE_KEY) || '{}');
    return {
      track: Number.isInteger(raw.track) ? clamp(raw.track, 0, PLAYLIST.length - 1) : 0,
      time: Number.isFinite(raw.time) && raw.time >= 0 ? raw.time : 0,
      shuffle: !!raw.shuffle,
      repeat: [0,1,2].includes(raw.repeat) ? raw.repeat : 0
    };
  } catch {
    return { track: 0, time: 0, shuffle: false, repeat: 0 };
  }
}
function saveState() {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify({
      track: trackIndex,
      time: Number.isFinite(audio.currentTime) ? Math.max(0, audio.currentTime) : 0,
      shuffle: shuffleMode,
      repeat: repeatMode
    }));
  } catch {}
}

const restored = readState();
let trackIndex = restored.track;
let pendingSeek = restored.time;
let restoreSeekPending = pendingSeek > 0;
let shuffleMode = restored.shuffle;
let repeatMode = restored.repeat;
let shuffleOrder = [];
let shuffleCursor = 0;
let shuffleHistory = [trackIndex];
let historyCursor = 0;
let entered = false;
let audioUnlocked = false;
let bass = 0;
let fadeId = 0;
let lastStateSave = 0;
let target = Number.parseFloat(localStorage.getItem(VOLUME_KEY) ?? localStorage.getItem(LEGACY_VOLUME_KEY));
target = Number.isFinite(target) ? clamp(target, .08, 1) : .35;
audio.volume = target;

/* Keep the muted decorative background video alive across autoplay quirks,
   tab restores, browser power-saving and transient media stalls. */
let bgLastTime = -1;
let bgStallTicks = 0;
function ensureBackgroundVideoPlaying() {
  if (!bgVideo) return;
  bgVideo.muted = true;
  bgVideo.defaultMuted = true;
  bgVideo.loop = true;
  bgVideo.playsInline = true;
  bgVideo.setAttribute('muted', '');
  bgVideo.setAttribute('playsinline', '');
  bgVideo.setAttribute('webkit-playsinline', '');
  try {
    const promise = bgVideo.play();
    if (promise && typeof promise.catch === 'function') promise.catch(() => {});
  } catch {}
}
function recoverBackgroundVideo() {
  if (!bgVideo || document.hidden) return;
  if (bgVideo.readyState >= 2 && Number.isFinite(bgVideo.duration) && bgVideo.duration > 0) {
    try {
      const next = (bgVideo.currentTime + 0.04) % bgVideo.duration;
      bgVideo.currentTime = next;
    } catch {}
  }
  ensureBackgroundVideoPlaying();
}
if (bgVideo) {
  bgVideo.muted = true;
  bgVideo.defaultMuted = true;
  bgVideo.loop = true;
  bgVideo.playsInline = true;
  bgVideo.autoplay = true;
  bgVideo.disablePictureInPicture = true;
  try { bgVideo.disableRemotePlayback = true; } catch {}

  ['loadeddata', 'canplay', 'canplaythrough'].forEach(type => {
    bgVideo.addEventListener(type, ensureBackgroundVideoPlaying, { passive: true });
  });
  bgVideo.addEventListener('playing', () => {
    bgStallTicks = 0;
    bgLastTime = bgVideo.currentTime;
  }, { passive: true });
  bgVideo.addEventListener('stalled', () => setTimeout(ensureBackgroundVideoPlaying, 80), { passive: true });
  bgVideo.addEventListener('waiting', () => setTimeout(ensureBackgroundVideoPlaying, 120), { passive: true });

  window.addEventListener('pageshow', ensureBackgroundVideoPlaying, { passive: true });
  window.addEventListener('focus', ensureBackgroundVideoPlaying, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(ensureBackgroundVideoPlaying, 30);
  });
  document.addEventListener('pointerdown', ensureBackgroundVideoPlaying, { passive: true });

  setInterval(() => {
    if (document.hidden || !bgVideo) return;
    const t = bgVideo.currentTime;
    if (bgVideo.paused || bgVideo.ended) {
      ensureBackgroundVideoPlaying();
      bgStallTicks = 0;
    } else if (bgVideo.readyState >= 2 && bgLastTime >= 0 && Math.abs(t - bgLastTime) < 0.015) {
      bgStallTicks += 1;
      if (bgStallTicks >= 2) {
        recoverBackgroundVideo();
        bgStallTicks = 0;
      }
    } else {
      bgStallTicks = 0;
    }
    bgLastTime = t;
  }, 1200);

  ensureBackgroundVideoPlaying();
}

function setPlayIcon() {
  const playing = !audio.paused && !audio.ended;
  playBtn.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
  document.body.classList.toggle('playing', playing);
}
function setMuteIcon() {
  const icon = audio.muted || target === 0 ? MUTE_ICON : VOL_ICON;
  muteBtn.innerHTML = icon;
  volumeMuteBtn.innerHTML = icon;
  muteBtn.classList.toggle('active', audio.muted || target === 0 || volumePopover.classList.contains('open'));
}
function drawVolume() {
  const v = audio.muted ? 0 : target;
  const pct = Math.round(v * 100);
  volumeFillV.style.height = `${pct}%`;
  volumeKnobV.style.bottom = `${pct}%`;
  volumeSlider.setAttribute('aria-valuenow', String(pct));
  volumePercent.textContent = String(pct);
  setMuteIcon();
}
function drawSeek() {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  const pct = duration > 0 ? clamp(current / duration, 0, 1) : 0;
  seekFill.style.width = `${pct * 100}%`;
  seekKnob.style.left = `${pct * 100}%`;
  seek.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
  timeElapsed.textContent = mmss(current);
  timeRemaining.textContent = `-${mmss(Math.max(0, duration - current))}`;
}
function setVolume(value) {
  cancelAnimationFrame(fadeId);
  fadeId = 0;
  target = clamp(value, 0, 1);
  audio.volume = target;
  if (target > 0) audio.muted = false;
  localStorage.setItem(VOLUME_KEY, String(target));
  drawVolume();
}
function fadeIn(ms = 900) {
  const to = target;
  const start = performance.now();
  audio.volume = 0;
  function tick(now) {
    const t = clamp((now - start) / ms, 0, 1);
    audio.volume = to * (1 - Math.pow(1 - t, 2));
    if (t < 1) fadeId = requestAnimationFrame(tick);
    else { audio.volume = to; fadeId = 0; }
  }
  fadeId = requestAnimationFrame(tick);
}
function shuffleArray(input) {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function buildShuffleOrder(current = trackIndex) {
  const rest = [];
  for (let i = 0; i < PLAYLIST.length; i++) if (i !== current) rest.push(i);
  shuffleOrder = [current, ...shuffleArray(rest)];
  shuffleCursor = 0;
}
function updateModeUI() {
  shuffleBtn.classList.toggle('active', shuffleMode);
  repeatBtn.classList.toggle('active', repeatMode !== 0);
  repeatBtn.classList.toggle('one', repeatMode === 2);
  repeatOne.setAttribute('aria-hidden', repeatMode === 2 ? 'false' : 'true');
  const repeatText = repeatMode === 0 ? 'repeat off' : repeatMode === 1 ? 'repeat all' : 'repeat one';
  queueMode.textContent = `${PLAYLIST.length} tracks • ${shuffleMode ? 'shuffle' : 'ordered'} • ${repeatText}`;
}
function updateTrackMeta() {
  const track = PLAYLIST[trackIndex];
  trackTitle.textContent = track.title;
  trackArtist.textContent = track.artist;
  if (trackCover.getAttribute('src') !== track.cover) {
    islandShell.classList.add('track-swap');
    setTimeout(() => {
      trackCover.src = track.cover;
      requestAnimationFrame(() => islandShell.classList.remove('track-swap'));
    }, 105);
  }
}
function renderPlaylist() {
  playlistItems.innerHTML = '';
  PLAYLIST.forEach((track, idx) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `playlist-item${idx === trackIndex ? ' active' : ''}`;

    const img = document.createElement('img');
    img.className = 'playlist-thumb';
    img.src = track.cover;
    img.alt = '';
    img.draggable = false;

    const main = document.createElement('span');
    main.className = 'playlist-item-main';
    const title = document.createElement('span');
    title.className = 'playlist-item-title';
    title.textContent = track.title;
    const artist = document.createElement('span');
    artist.className = 'playlist-item-artist';
    artist.textContent = track.artist;
    main.append(title, artist);

    const status = document.createElement('span');
    status.className = 'playlist-item-status';
    status.textContent = idx === trackIndex ? (!audio.paused ? 'playing' : 'loaded') : String(idx + 1).padStart(2, '0');

    item.append(img, main, status);
    item.addEventListener('click', () => {
      const shouldPlay = entered && (!audio.paused || audioUnlocked);
      setTrack(idx, { autoplay: shouldPlay, resetPosition: true, addHistory: true });
      togglePlaylist(false);
    });
    playlistItems.appendChild(item);
  });
}
function setTrack(index, { autoplay = false, resetPosition = true, addHistory = true, fromRestore = false, syncShuffle = true } = {}) {
  trackIndex = (index + PLAYLIST.length) % PLAYLIST.length;
  if (shuffleMode && syncShuffle) buildShuffleOrder(trackIndex);
  if (addHistory) {
    if (historyCursor < shuffleHistory.length - 1) shuffleHistory = shuffleHistory.slice(0, historyCursor + 1);
    if (shuffleHistory[shuffleHistory.length - 1] !== trackIndex) shuffleHistory.push(trackIndex);
    historyCursor = shuffleHistory.length - 1;
  }
  updateTrackMeta();
  const track = PLAYLIST[trackIndex];
  restoreSeekPending = fromRestore && pendingSeek > 0;
  if (!fromRestore) pendingSeek = 0;
  audio.src = track.src;
  audio.load();
  if (resetPosition && !fromRestore) {
    try { audio.currentTime = 0; } catch {}
  }
  drawSeek();
  renderPlaylist();
  updateModeUI();
  if (!fromRestore) saveState();
  if (autoplay && entered) {
    audio.play().then(() => {
      audioUnlocked = true;
      audio.muted = false;
      audio.volume = target;
      setPlayIcon();
      drawVolume();
      renderPlaylist();
    }).catch(() => setPlayIcon());
  } else {
    setPlayIcon();
  }
}
function nextShuffle(ended) {
  if (!shuffleOrder.length) buildShuffleOrder(trackIndex);
  if (repeatMode === 2 && ended) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  if (shuffleCursor < shuffleOrder.length - 1) {
    shuffleCursor += 1;
    setTrack(shuffleOrder[shuffleCursor], { autoplay: entered, resetPosition: true, addHistory: true, syncShuffle: false });
    return;
  }
  if (repeatMode === 1 || !ended) {
    buildShuffleOrder(trackIndex);
    shuffleCursor = shuffleOrder.length > 1 ? 1 : 0;
    setTrack(shuffleOrder[shuffleCursor], { autoplay: entered, resetPosition: true, addHistory: true, syncShuffle: false });
    return;
  }
  audio.pause();
  audio.currentTime = 0;
  drawSeek();
}
function nextOrdered(direction, ended) {
  if (repeatMode === 2 && ended) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  let next = trackIndex + direction;
  if (next >= PLAYLIST.length) {
    if (repeatMode === 1 || !ended) next = 0;
    else {
      audio.pause();
      audio.currentTime = 0;
      drawSeek();
      return;
    }
  }
  if (next < 0) next = PLAYLIST.length - 1;
  setTrack(next, { autoplay: entered, resetPosition: true, addHistory: true });
}
function nextTrack(direction = 1, ended = false) {
  if (PLAYLIST.length <= 1) return;
  if (direction < 0 && !ended && audio.currentTime > 3) {
    audio.currentTime = 0;
    drawSeek();
    saveState();
    return;
  }
  if (shuffleMode) {
    if (direction < 0 && historyCursor > 0) {
      historyCursor -= 1;
      setTrack(shuffleHistory[historyCursor], { autoplay: entered, resetPosition: true, addHistory: false, syncShuffle: false });
    } else if (direction > 0) {
      nextShuffle(ended);
    }
  } else {
    nextOrdered(direction, ended);
  }
}
function togglePlaylist(force) {
  const open = typeof force === 'boolean' ? force : !playlistPanel.classList.contains('open');
  if (open && volumePopover.classList.contains('open')) toggleVolumePopover(false);
  playlistPanel.classList.toggle('open', open);
  playlistToggle.classList.toggle('active', open);
  playlistToggle.setAttribute('aria-expanded', String(open));
  playlistPanel.setAttribute('aria-hidden', String(!open));
}

async function startAudio() {
  try {
    audio.muted = false;
    if (!audioUnlocked) audio.volume = 0;
    await audio.play();
    if (!audioUnlocked) fadeIn(900);
    audioUnlocked = true;
    setPlayIcon();
    drawVolume();
    renderPlaylist();
    return true;
  } catch (err) {
    audio.volume = target;
    setPlayIcon();
    return false;
  }
}
function togglePlayback() {
  if (audio.paused) startAudio();
  else audio.pause();
}

playBtn.addEventListener('click', togglePlayback);
coverBtn.addEventListener('click', togglePlayback);
prevBtn.addEventListener('click', () => nextTrack(-1, false));
nextBtn.addEventListener('click', () => nextTrack(1, false));
shuffleBtn.addEventListener('click', () => {
  shuffleMode = !shuffleMode;
  if (shuffleMode) buildShuffleOrder(trackIndex);
  else { shuffleOrder = []; shuffleCursor = 0; }
  updateModeUI();
  saveState();
});
repeatBtn.addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3;
  updateModeUI();
  saveState();
});
function toggleVolumePopover(force) {
  const open = typeof force === 'boolean' ? force : !volumePopover.classList.contains('open');
  if (open && playlistPanel.classList.contains('open')) togglePlaylist(false);
  volumePopover.classList.toggle('open', open);
  volumeControl.classList.toggle('open', open);
  volumePopover.setAttribute('aria-hidden', String(!open));
  setMuteIcon();
}
muteBtn.addEventListener('click', e => {
  e.stopPropagation();
  toggleVolumePopover();
});
volumeMuteBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  drawVolume();
});
muteBtn.addEventListener('wheel', e => {
  e.preventDefault();
  setVolume(target + (e.deltaY < 0 ? .05 : -.05));
}, { passive:false });
playlistToggle.addEventListener('click', () => togglePlaylist());
audio.addEventListener('play', () => { setPlayIcon(); renderPlaylist(); });
audio.addEventListener('pause', () => { setPlayIcon(); renderPlaylist(); saveState(); });
audio.addEventListener('ended', () => nextTrack(1, true));
audio.addEventListener('loadedmetadata', () => {
  if (restoreSeekPending && Number.isFinite(audio.duration) && audio.duration > 0) {
    const safeTime = clamp(pendingSeek, 0, Math.max(0, audio.duration - .25));
    try { audio.currentTime = safeTime; } catch {}
    restoreSeekPending = false;
    pendingSeek = 0;
  }
  drawSeek();
});
audio.addEventListener('timeupdate', () => {
  drawSeek();
  const now = performance.now();
  if (now - lastStateSave > 900) {
    lastStateSave = now;
    saveState();
  }
});
audio.addEventListener('error', () => {
  playBtn.disabled = true;
  setPlayIcon();
});

function draggable(el, onMove) {
  const ratio = x => {
    const r = el.getBoundingClientRect();
    return clamp((x - r.left) / r.width, 0, 1);
  };
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
  saveState();
});
function volumeRatioFromY(clientY) {
  const r = volumeSlider.getBoundingClientRect();
  return clamp(1 - ((clientY - r.top) / r.height), 0, 1);
}
volumeSlider.addEventListener('pointerdown', e => {
  volumeSlider.setPointerCapture(e.pointerId);
  setVolume(volumeRatioFromY(e.clientY));
  e.preventDefault();
});
volumeSlider.addEventListener('pointermove', e => {
  if (volumeSlider.hasPointerCapture(e.pointerId)) setVolume(volumeRatioFromY(e.clientY));
});
volumeSlider.addEventListener('pointerup', e => {
  if (volumeSlider.hasPointerCapture(e.pointerId)) volumeSlider.releasePointerCapture(e.pointerId);
});
volumeSlider.addEventListener('pointercancel', e => {
  if (volumeSlider.hasPointerCapture(e.pointerId)) volumeSlider.releasePointerCapture(e.pointerId);
});
volumeSlider.addEventListener('keydown', e => {
  if (e.key === 'ArrowUp') setVolume(target + .05);
  else if (e.key === 'ArrowDown') setVolume(target - .05);
  else return;
  e.preventDefault();
});
seek.addEventListener('keydown', e => {
  if (!audio.duration) return;
  if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
  else if (e.key === 'ArrowLeft') audio.currentTime = Math.max(audio.currentTime - 5, 0);
  else return;
  e.preventDefault();
  drawSeek();
  saveState();
});


window.addEventListener('beforeunload', saveState);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
document.addEventListener('click', e => {
  if (playlistPanel.classList.contains('open') && !islandPlayer.contains(e.target)) togglePlaylist(false);
  if (volumePopover.classList.contains('open') && !volumeControl.contains(e.target)) toggleVolumePopover(false);
});

setTrack(trackIndex, { autoplay: false, resetPosition: false, addHistory: false, fromRestore: true, syncShuffle: false });
if (shuffleMode) buildShuffleOrder(trackIndex);
updateModeUI();
drawVolume();
setPlayIcon();

/* gate */
const BANDS = 14;
for (let i = 0; i < BANDS; i++) {
  const b = document.createElement('b');
  b.style.top = `${i * 100 / BANDS}%`;
  b.style.height = `${100 / BANDS + .3}%`;
  b.style.setProperty('--x', `${(Math.random() < .5 ? -1 : 1) * (40 + Math.random() * 80)}%`);
  b.style.transitionDelay = `${i * 16}ms`;
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
  if (ready || !audio.buffered.length || !audio.duration) return;
  const k = audio.buffered.end(audio.buffered.length - 1) / audio.duration;
  if (k >= .995) done();
  else gateText.textContent = `loading ${Math.round(k * 100)}% `;
}
audio.addEventListener('progress', progress);
audio.addEventListener('canplaythrough', done);
audio.addEventListener('error', done);
pollId = setInterval(progress, 400);
setTimeout(done, 9000);

if (fine) {
  window.addEventListener('pointermove', e => {
    if (entered) return;
    const dx = (e.clientX - innerWidth / 2) / innerWidth;
    const dy = (e.clientY - innerHeight / 2) / innerHeight;
    gateLine.style.transform = `translate(${dx * 24}px,${dy * 16}px)`;
  });
}
async function typeIn() {
  gate.classList.add('typing');
  gateText.textContent = '';
  const word = 'connect';
  for (let i = 1; i <= word.length; i++) {
    gateText.textContent = word.slice(0, i);
    await sleep(42);
  }
  await sleep(190);
  gateOk.textContent = ' ok';
  await sleep(300);
  document.body.classList.add('entered');
  gate.classList.add('gone');
  setTimeout(() => gate.remove(), 1100);
  revealText();
}
function enter() {
  if (entered) return;
  entered = true;
  ensureBackgroundVideoPlaying();
  startAudio();
  startViz();
  typeIn();
}
gate.addEventListener('click', enter);

/* link cipher */
const NOISE = '!<>-_\\/[]{}=+*^?#%$&@';
const running = new WeakMap();
const cipherable = fine;
const noiseChar = () => NOISE[(Math.random() * NOISE.length) | 0];
function cipher(text) {
  let out = '';
  for (const c of text) out += c === ' ' ? ' ' : noiseChar();
  return out;
}
function stop(el) {
  const id = running.get(el);
  if (id) cancelAnimationFrame(id);
  running.delete(el);
}
function encode(el) { stop(el); el.textContent = cipher(el.dataset.text); }
function decode(el) {
  stop(el);
  const text = el.dataset.text;
  const start = performance.now();
  const step = 36, hold = 130;
  function tick(now) {
    const t = now - start;
    let out = '';
    for (let i = 0; i < text.length; i++) out += t - i * step > hold ? text[i] : noiseChar();
    el.textContent = out;
    if (t < text.length * step + hold) running.set(el, requestAnimationFrame(tick));
    else { el.textContent = text; running.delete(el); }
  }
  running.set(el, requestAnimationFrame(tick));
}
function churn(el, delay) {
  stop(el);
  const start = performance.now() + delay;
  function tick(now) {
    if (now > start) el.textContent = cipher(el.dataset.text);
    if (now - start < 390) running.set(el, requestAnimationFrame(tick));
    else encode(el);
  }
  running.set(el, requestAnimationFrame(tick));
}
if (cipherable) {
  document.querySelectorAll('.t').forEach(encode);
  document.querySelectorAll('.links a').forEach(a => {
    const t = a.querySelector('.t');
    a.addEventListener('pointerenter', () => decode(t));
    a.addEventListener('pointerleave', () => encode(t));
    a.addEventListener('focus', () => decode(t));
    a.addEventListener('blur', () => encode(t));
  });
}
function revealText() {
  if (!cipherable) return;
  document.querySelectorAll('.t').forEach((el, i) => churn(el, 220 + i * 85));
}
if (fine) {
  document.querySelectorAll('.links a').forEach(a => {
    a.addEventListener('pointermove', e => {
      const r = a.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      a.style.transform = `translate(${dx * .12}px,${dy * .18}px)`;
    });
    a.addEventListener('pointerleave', () => { a.style.transform = ''; });
  });
  if (avatarOrbit) {
    window.addEventListener('pointermove', e => {
      if (!entered) return;
      const dx = (e.clientX - innerWidth / 2) / (innerWidth / 2);
      const dy = (e.clientY - innerHeight / 2) / (innerHeight / 2);
      avatarOrbit.style.translate = `${dx * 7}px ${dy * 5}px`;
    });
    window.addEventListener('pointerleave', () => { avatarOrbit.style.translate = ''; });
  }
}
document.querySelectorAll('.links a').forEach(a => {
  a.addEventListener('click', () => {
    flash.classList.remove('on');
    void flash.offsetWidth;
    flash.classList.add('on');
  });
});

/* subtle background vocabulary + cursor trail */
if (fine) {
  const canvas = document.getElementById('trail');
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, symbols = [];
  let mx = -999, my = -999, px = -999, py = -999, known = false;
  const points = [], ripples = [];
  const WORDS = [
    'bankroll.su','forum','market','loader','injector','silent aim','kernel driver','spoofer','ud cheat',
    'aimbot','rage','legit','resolver','antiaim','triggerbot','backtrack','chams','esp','radar','skeleton',
    'undetected','bypass','hwid','eac','battleye','vanguard','manual map','mapper','driver','kernel',
    'syscall','hook','shellcode','offsets','pattern scan','entity list','view matrix','memory read','memory write',
    'dma','fpga','pcie','pcileech','leechcore','kmbox','cr3','dtb','private build','closed source','invite',
    'subscription','lifetime','release','hotfix','auth','session','config','owner','staff','thread'
  ];
  const CHAR_W = 6.1;
  const rectangles = [];
  function mask(word) {
    return [...word].map(c => c === ' ' ? ' ' : noiseChar());
  }
  function overlaps(r) {
    return rectangles.some(o => !(r.x2 + 12 < o.x1 || r.x1 - 12 > o.x2 || r.y2 + 8 < o.y1 || r.y1 - 8 > o.y2));
  }
  function place(width, height, isLong) {
    for (let tries = 0; tries < 45; tries++) {
      let x;
      if (isLong && w > 780) {
        const left = Math.random() < .5;
        x = left ? 14 + Math.random() * Math.max(1, w * .26 - width) : w * .74 + Math.random() * Math.max(1, w * .25 - width - 14);
      } else {
        x = 14 + Math.random() * Math.max(1, w - width - 28);
      }
      const y = 18 + Math.random() * Math.max(1, h - 36);
      const cx = x + width / 2;
      const centerClear = Math.abs(cx - w / 2) < Math.min(w * .24, 260) && Math.abs(y - h / 2) < Math.min(h * .27, 230);
      const islandClear = y > h - 175 && Math.abs(cx - w / 2) < 330;
      const r = {x1:x,y1:y-height/2,x2:x+width,y2:y+height/2};
      if (!centerClear && !islandClear && !overlaps(r)) {
        rectangles.push(r);
        return {x,y};
      }
    }
    return null;
  }
  function seed() {
    rectangles.length = 0;
    symbols = [];
    const area = w * h;
    const wordCount = clamp(Math.round(area / 90000), 15, 22);
    const charCount = clamp(Math.round(area / 300000), 1, 4);
    const bag = shuffleArray(WORDS);
    for (let i = 0; i < wordCount; i++) {
      const word = bag[i % bag.length];
      const size = 10 + ((Math.random() * 3) | 0);
      const width = word.length * CHAR_W * size / 11;
      const spot = place(width, size + 4, word.length > 11);
      if (spot) symbols.push({word,mask:mask(word),x:spot.x,y:spot.y,size,baseReveal:0});
    }
    for (let i = 0; i < charCount; i++) {
      const spot = place(9, 13, false);
      if (spot) symbols.push({word:'#',mask:mask('#'),x:spot.x,y:spot.y,size:11,baseReveal:0});
    }
  }
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    w = document.documentElement.clientWidth;
    h = document.documentElement.clientHeight;
    canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    seed();
  }
  resize();
  addEventListener('resize', resize);
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    mx = e.clientX; my = e.clientY; known = true;
    points.push({x:mx,y:my,born:performance.now()});
  });
  document.addEventListener('pointerleave', () => { known = false; });
  const REACH = 245, LIFE = 310, RIPPLE_LIFE = 760;
  let lastRipple = 0;
  function frame(now) {
    ctx.clearRect(0,0,w,h);
    ctx.globalCompositeOperation = 'lighter';
    const speed = known && px > -900 ? Math.hypot(mx-px,my-py) : 0;
    px = mx; py = my;
    ctx.textBaseline = 'middle';
    let activeFont = 0;
    for (const s of symbols) {
      let hot = 0;
      if (known) {
        const d = Math.hypot(s.x-mx,s.y-my);
        if (d < REACH) hot = 1 - d/REACH;
      }
      const len = s.mask.length;
      const hoverOpen = Math.max(0, Math.floor((hot-.20)/.80*(len+1)));
      const open = Math.max(s.baseReveal || 0, hoverOpen);
      if (open < len && Math.random() < .006 + hot*.065) {
        const i = open + ((Math.random()*Math.max(1,len-open))|0);
        if (s.mask[i] !== ' ') s.mask[i] = noiseChar();
      }
      let out='';
      for (let i=0;i<len;i++) out += i<open ? s.word[i] : s.mask[i];
      if (activeFont !== s.size) { ctx.font = `${s.size}px "JetBrains Mono",monospace`; activeFont=s.size; }
      ctx.fillStyle = `rgba(220,220,220,${.145 + hot*hot*.34})`;
      ctx.fillText(out,s.x,s.y);
    }
    if (known && speed > 7 && now-lastRipple > 220) {
      ripples.push({x:mx,y:my,born:now}); lastRipple=now;
    }
    while (ripples.length && now-ripples[0].born>RIPPLE_LIFE) ripples.shift();
    for (const r of ripples) {
      const age=(now-r.born)/RIPPLE_LIFE;
      ctx.strokeStyle=`rgba(214,214,214,${(1-age)*(1-age)*.09})`;
      ctx.lineWidth=1;
      ctx.beginPath(); ctx.arc(r.x,r.y,12+age*165,0,Math.PI*2); ctx.stroke();
    }
    while (points.length && now-points[0].born>LIFE) points.shift();
    if (points.length>1) {
      ctx.beginPath();
      points.forEach((p,i)=> i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y));
      ctx.strokeStyle='rgba(214,214,214,.20)'; ctx.lineWidth=1.25; ctx.lineCap='round'; ctx.stroke();
    }
    for (const p of points) {
      const age=(now-p.born)/LIFE;
      const a=(1-age)*(1-age)*.30;
      const r=4+(1-age)*8;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
      g.addColorStop(0,`rgba(214,214,214,${a})`); g.addColorStop(1,'rgba(214,214,214,0)');
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2); ctx.fill();
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
  const H = 70, BARS = 54;
  let w = 0;
  function resize() {
    const dpr = Math.min(devicePixelRatio || 1,2);
    w = document.documentElement.clientWidth;
    canvas.style.width=`${w}px`; canvas.style.height=`${H}px`;
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(H*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  resize(); addEventListener('resize',resize);
  function frame(now) {
    const active=!audio.paused&&!audio.ended;
    const t=active?audio.currentTime:now/1000;
    const pulse=active?.12+.10*(.5+.5*Math.sin(t*5.1)):0;
    bass+=(pulse-bass)*.12;
    root.style.setProperty('--pulse',bass.toFixed(3));
    ctx.clearRect(0,0,w,H);
    const step=w/BARS,bw=Math.max(2,step*.28);
    for(let i=0;i<BARS;i++){
      const wave=(Math.sin(t*4.1+i*.61)*.5+.5)*(Math.sin(t*2.05-i*.25)*.5+.5);
      const v=active?Math.min(1,.08+wave*.44):.015;
      const bh=Math.max(1,v*v*(H-6));
      const x=i*step+(step-bw)/2;
      const g=ctx.createLinearGradient(0,H,0,H-bh);
      g.addColorStop(0,`rgba(214,214,214,${.06+v*.13})`); g.addColorStop(1,'rgba(214,214,214,0)');
      ctx.fillStyle=g; ctx.fillRect(x,H-bh,bw,bh);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

const resumeAudioOnce = () => { if (entered && audio.paused && !audioUnlocked) startAudio(); };
document.addEventListener('pointerdown', resumeAudioOnce, {passive:true});
console.log('%csacred','color:#d4d4d4;font-family:monospace;font-size:36px;font-weight:900;letter-spacing:2px');
console.log('%cmade by #high • release v10','color:#666;font-family:monospace;font-size:10px');
document.addEventListener('contextmenu',e=>e.preventDefault(),{capture:true});
document.addEventListener('dragstart',e=>e.preventDefault(),{capture:true});
document.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&(k==='s'||k==='u')){e.preventDefault();e.stopPropagation();}
  if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(k==='c'||k==='i'||k==='j')){e.preventDefault();e.stopPropagation();}
},{capture:true});
