// The live-action opener: a pre-rendered movie in a fullscreen <video> over the game, with HTML captions under the
// picture. The in-engine "Doorbuster" (intro.js) stays as the fallback when it can't play.
//
// main.js drives it: preload(), start(), play() (from the user's tap or key), then polls waiting / ended / failed
// each frame, and release() puts everything away. The files stream from the network: sw.js never caches them.

const FILM = 'assets/film/opener-v2';
const TYPE = 'video/mp4; codecs="avc1.640028, mp4a.40.2"';
export const STALL_MS = 8000; // no first frame by then: use the in-engine opener
// The speakers' colours, as in the in-engine opener (intro.js); Pam is amber, and Dale (only in the movie) is orange.
// Anyone else gets the caption colour.
export const SPEAKERS = { 'PAM (PA)': '#ffd89a', DALE: '#ffa630', BIKER: '#ff7a50', 'MALL COP': '#6aa0ff', SKATER: '#50e890', 'MALL GOTH': '#d070ff' };
const TEXT = '#f2ecdc';

/** A WebVTT cue's raw text -> { speaker, text, italic } (<v NAME> is the speaker, <i> a time caption). */
export function parseCue(raw) {
  const v = /<v(?:\.[^\s>]*)?\s+([^>]+)>/.exec(raw);
  return { speaker: v ? v[1].trim() : '', text: raw.replace(/<[^>]*>/g, '').trim(), italic: /<i[\s.>]/.test(raw) };
}

/** Where the black under the picture begins, in a w x h window: a 2.39:1 picture inside a contained 16:9 frame. */
export const pictureBottom = (w, h) => h / 2 + Math.min(w / 1280, h / 720) * (1280 / 2.39) / 2;

const CSS = `
#movie { position: fixed; inset: 0; z-index: 30; background: #000; overflow: hidden; user-select: none; -webkit-user-select: none; font-family: "Trebuchet MS", Verdana, sans-serif; }
#movie video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; pointer-events: none; }
#movie-cap { position: absolute; left: 0; right: 0; padding: 0 max(12px, env(safe-area-inset-right)) 0 max(12px, env(safe-area-inset-left)); text-align: center; color: ${TEXT}; font-size: clamp(15px, 2.6vmin, 24px); line-height: 1.25; text-shadow: 0 0 6px #000; pointer-events: none; }
#movie-cap b { margin-right: 0.5em; font-size: 0.75em; letter-spacing: 0.12em; }
@media (orientation: portrait) { #movie-cap b { display: block; margin: 0 0 2px; } }
#movie-hint { position: absolute; top: max(10px, env(safe-area-inset-top)); right: max(14px, env(safe-area-inset-right)); color: #cfc8dc; font-size: clamp(11px, 1.9vmin, 17px); text-shadow: 0 0 6px #000; opacity: 0; pointer-events: none; animation: mhint 1s 1.2s forwards; }
@keyframes mhint { to { opacity: 0.62; } }
#movie-sound { position: absolute; top: max(36px, calc(env(safe-area-inset-top) + 30px)); left: 50%; transform: translateX(-50%); padding: 10px 18px; border: 2px solid #ffd89a; border-radius: 22px; background: rgba(0,0,0,0.7); color: #ffd89a; font: bold 15px "Trebuchet MS", Verdana, sans-serif; cursor: pointer; }
#movie-sound[hidden] { display: none; }
`;

export class Movie {
  constructor(doc = globalThis.document, win = globalThis.window) {
    this.doc = doc;
    this.win = win;
    this.el = null;     // the <video>, from preload() until release()
    this.root = null;   // the overlay, from start() until release()
    this.styled = false;
    this.timer = null;
    this.reset();
    if (doc && doc.addEventListener) {
      // a phone call or a tab switch pauses a video: carry on when the page is back
      doc.addEventListener('visibilitychange', () => { if (!doc.hidden && this.active && !this.waiting && !this.ended && this.el.paused) this.el.play().catch(() => {}); });
      win.addEventListener('resize', () => this.layout());
    }
  }

  reset() { this.waiting = false; this.ended = false; this.failed = false; this.since = 0; }

  get active() { return !!this.root; }

  /** Seconds since play(). */
  age() { return this.since ? (performance.now() - this.since) / 1000 : 0; }

  /** Create the video early so it is buffering while the menus are up. False if this browser can't play it. */
  preload() {
    if (this.el) return true;
    let el;
    try {
      el = this.doc.createElement('video');
      if (!el.canPlayType || !el.canPlayType(TYPE)) return false;
    } catch { return false; }
    el.id = 'movie-video';
    for (const a of ['playsinline', 'webkit-playsinline']) el.setAttribute(a, '');
    el.preload = 'auto';
    el.poster = `${FILM}.jpg`;
    const track = this.doc.createElement('track');
    track.kind = 'captions'; track.srclang = 'en'; track.src = `${FILM}.vtt`;
    el.appendChild(track);
    const on = (target, type, fn) => target.addEventListener(type, () => { if (this.el === el) fn(); });
    const firstFrame = () => this.clearStall();
    on(el, 'playing', firstFrame);
    on(el, 'ended', () => { this.ended = true; });
    on(el, 'error', () => { this.failed = true; });
    this.el = el;
    if (track.track) {
      track.track.mode = 'hidden'; // cues load and fire, and we draw them ourselves
      on(track.track, 'cuechange', () => this.caption(track.track.activeCues));
    }
    el.src = `${FILM}.mp4`;
    return true;
  }

  /** Take over for a showing, waiting for play(). False: use the in-engine opener instead. */
  start() {
    if (this.failed) { this.release(); return false; } // the preload already broke (the next one tries again)
    if (!this.preload()) return false;
    const d = this.doc;
    if (!this.styled) {
      const style = d.createElement('style');
      style.textContent = CSS;
      d.head.appendChild(style);
      this.styled = true;
    }
    const make = (tag, id, text = '') => { const n = d.createElement(tag); n.id = id; n.textContent = text; return n; };
    this.root = make('div', 'movie');
    this.cap = make('div', 'movie-cap');
    this.sound = make('button', 'movie-sound', 'tap for sound');
    this.sound.hidden = true;
    this.sound.addEventListener('click', () => this.unmute());
    for (const n of [this.el, this.cap, make('div', 'movie-hint', 'tap or press any button to skip'), this.sound]) this.root.appendChild(n);
    this.waiting = true;
    return true;
  }

  /** Call straight from a tap or key handler, so phones allow the sound. muted: the game's own sound is off. */
  play(muted = false) {
    if (!this.active || !this.waiting) return;
    this.waiting = false;
    this.since = performance.now();
    this.doc.body.appendChild(this.root);
    this.layout();
    const el = this.el;
    const live = () => this.el === el && this.active;
    this.timer = setTimeout(() => { if (live()) this.failed = true; }, STALL_MS);
    el.muted = muted;
    const refused = () => { if (live()) this.failed = true; };
    Promise.resolve(el.play()).catch(() => {
      if (!live()) return;
      if (el.muted) { refused(); return; }
      el.muted = true; // sound was refused (no gesture, e.g. a gamepad): play silent and offer it
      this.sound.hidden = false;
      Promise.resolve(el.play()).catch(refused);
    });
  }

  unmute() {
    if (!this.active) return;
    this.el.muted = false;
    this.sound.hidden = true;
    if (this.el.paused && !this.ended) this.el.play().catch(() => {});
  }

  caption(cues) {
    if (!this.cap) return;
    const lines = Array.from(cues || [], (c) => {
      const { speaker, text, italic } = parseCue(c.text);
      const line = this.doc.createElement('div');
      if (italic) line.style.fontStyle = 'italic';
      if (speaker) {
        const name = this.doc.createElement('b');
        name.textContent = speaker;
        name.style.color = SPEAKERS[speaker] || TEXT;
        line.appendChild(name);
      }
      const body = this.doc.createElement('span');
      body.textContent = text;
      line.appendChild(body);
      return line;
    });
    this.cap.replaceChildren(...lines);
  }

  layout() {
    if (this.cap) this.cap.style.top = `${Math.round(pictureBottom(this.win.innerWidth, this.win.innerHeight)) + 5}px`;
  }

  clearStall() { clearTimeout(this.timer); this.timer = null; }

  /** Take the movie off the screen and let the browser drop its buffers. */
  release() {
    this.clearStall();
    const el = this.el;
    this.el = null; // (first: nothing the element fires from here on counts)
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
    }
    if (this.root) this.root.remove();
    this.root = this.cap = this.sound = null;
    this.reset();
  }
}
