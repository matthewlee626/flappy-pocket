'use client';
import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX, RotateCcw, Trophy } from 'lucide-react';

type Mode = 'ready' | 'playing' | 'paused' | 'over';
type Pipe = { x: number; gap: number; scored: boolean };
const W = 288, H = 512, FLOOR = 440, BIRD_X = 76, GAP = 112;
export default function Home() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef({ mode: 'ready' as Mode, y: 215, vy: 0, score: 0, pipes: [] as Pipe[], distance: 0, clock: 0, deadAt: 0 });
  const [mode, setMode] = useState<Mode>('ready');
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [muted, setMuted] = useState(false);
  const muteRef = useRef(false);
  const audio = useRef<AudioContext | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const changeMode = (next: Mode) => { engine.current.mode = next; setMode(next); };
  function tone(frequency: number, duration = .08) {
    if (muteRef.current) return;
    try {
      audio.current ??= new AudioContext();
      void audio.current.resume();
      const ctx = audio.current, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.setValueAtTime(frequency, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(frequency * .65, ctx.currentTime + duration);
      g.gain.setValueAtTime(.035, ctx.currentTime); g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
      o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + duration);
    } catch { /* Audio is optional. */ }
  }
  function flap() {
    const s = engine.current;
    if (!loaded || assetError) return;
    if (s.mode === 'over' && performance.now() - s.deadAt < 500) return;
    if (s.mode === 'paused') { changeMode('playing'); return; }
    if (s.mode === 'ready' || s.mode === 'over') {
      Object.assign(s, { y: 215, vy: 0, score: 0, pipes: [{ x: 340, gap: 210, scored: false }], distance: 0 });
      setScore(0); changeMode('playing');
    }
    s.vy = -285; tone(640);
  }
  const actions = useRef({ flap, pause: () => {} });
  actions.current = { flap, pause: () => { if (engine.current.mode === 'playing') changeMode('paused'); else if (engine.current.mode === 'paused') changeMode('playing'); } };
  useEffect(() => {
    try { const saved = Number(localStorage.getItem('flappy-pocket-best')); if (Number.isFinite(saved) && saved > 0) setBest(saved); } catch {}
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('button, a')) return;
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (!e.repeat) actions.current.flap(); }
      if (e.code === 'KeyP' || e.code === 'Escape') actions.current.pause();
    };
    const hide = () => { if (document.hidden && engine.current.mode === 'playing') changeMode('paused'); };
    window.addEventListener('keydown', key); document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('visibilitychange', hide); };
  }, []);
  useEffect(() => {
    type Tool = { name: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean }; execute: (input: unknown) => unknown };
    const context = (document as Document & { modelContext?: { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      { name: 'get_game_state', description: 'Read the current Flappy Bird game status and score.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => ({ mode: engine.current.mode, score: engine.current.score }) },
      { name: 'set_game_paused', description: 'Pause or resume an already started game.', inputSchema: { type: 'object', properties: { paused: { type: 'boolean' } }, required: ['paused'], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: (input: unknown) => {
        if (!input || typeof input !== 'object' || !('paused' in input) || typeof input.paused !== 'boolean') throw new Error('paused must be a boolean');
        if (!['playing', 'paused'].includes(engine.current.mode)) throw new Error('Start a game first');
        changeMode(input.paused ? 'paused' : 'playing');
        return { mode: engine.current.mode, score: engine.current.score };
      } },
    ];
    for (const tool of tools) { try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch {} }
    return () => lifecycle.abort();
  }, []);
  useEffect(() => {
    let raf = 0, disposed = false;
    const files = ['background-day', 'base', 'pipe-green', 'yellowbird-upflap', 'yellowbird-midflap', 'yellowbird-downflap'];
    const images = files.map(name => { const img = new Image(); img.src = `/assets/${name}.png`; return img; });
    Promise.all(images.map(img => img.decode())).then(() => {
      if (disposed) return;
      setLoaded(true);
      const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      let previous = 0, accumulator = 0;
      const die = () => {
        const s = engine.current; s.deadAt = performance.now(); changeMode('over'); tone(160, .2);
        setBest(old => { const value = Math.max(old, s.score); try { localStorage.setItem('flappy-pocket-best', String(value)); } catch {} return value; });
      };
      const update = (dt: number) => {
        const s = engine.current;
        if (s.mode === 'paused' || s.mode === 'over') return;
        s.clock += dt; s.distance += dt * 94;
        if (s.mode === 'ready') { s.y = 215 + Math.sin(s.clock * 4) * 5; return; }
        s.vy += 920 * dt; s.y += s.vy * dt;
        for (const p of s.pipes) p.x -= 94 * dt;
        const last = s.pipes[s.pipes.length - 1];
        if (last && last.x < W - 150) s.pipes.push({ x: last.x + 168, gap: 132 + Math.random() * 168, scored: false });
        s.pipes = s.pipes.filter(p => p.x > -60);
        const hit = s.pipes.some(p => BIRD_X + 11 > p.x && BIRD_X - 11 < p.x + 52 && (s.y - 9 < p.gap - GAP / 2 || s.y + 9 > p.gap + GAP / 2));
        if (s.y + 10 >= FLOOR || s.y - 10 <= 0 || hit) { die(); return; }
        for (const p of s.pipes) if (!p.scored && p.x + 52 < BIRD_X - 11) { p.scored = true; s.score++; setScore(s.score); tone(1000, .12); }
      };
      const draw = (now: number) => {
        if (disposed) return;
        accumulator += Math.min((now - (previous || now)) / 1000, .05); previous = now;
        while (accumulator >= 1 / 120) { update(1 / 120); accumulator -= 1 / 120; }
        const s = engine.current;
        ctx.drawImage(images[0], 0, 0, W, H);
        for (const p of s.pipes) {
          const x = Math.round(p.x), top = Math.round(p.gap - GAP / 2), bottom = Math.round(p.gap + GAP / 2);
          ctx.save(); ctx.translate(x, top); ctx.scale(1, -1); ctx.drawImage(images[2], 0, 0); ctx.restore();
          ctx.drawImage(images[2], x, bottom);
        }
        ctx.save(); ctx.translate(BIRD_X, s.y); ctx.rotate(s.mode === 'ready' ? -.08 : Math.max(-.4, Math.min(1.3, s.vy / 400)));
        ctx.drawImage(images[3 + Math.floor(s.clock * 10) % 3], -17, -12); ctx.restore();
        const scroll = Math.floor(s.distance) % 24;
        ctx.drawImage(images[1], -scroll, FLOOR);
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
    }).catch(() => { if (!disposed) setAssetError(true); });
    return () => { disposed = true; cancelAnimationFrame(raf); };
  }, []);
  return (
    <main className="arcade">
      <div className="game-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Flappy Pocket home"><img src="/assets/yellowbird-midflap.png" alt="" /> <span>FLAPPY<span className="brand-sub">POCKET ARCADE</span></span></a>
          <div className="best"><Trophy size={15} /><span>BEST</span><strong>{best.toString().padStart(2, '0')}</strong></div>
        </header>
        <section className="game" aria-label="Flappy Bird game">
          <canvas ref={canvas} width={W} height={H} aria-label="Tap or press Space to fly through the pipes" />
          <div className="touch-surface" role="button" tabIndex={0} aria-label={mode === 'over' ? 'Play again' : 'Flap'} onPointerDown={e => { e.preventDefault(); actions.current.flap(); }} onKeyDown={e => { if (e.code === 'Enter') { e.preventDefault(); actions.current.flap(); } }} />
          {mode === 'playing' && <div className="live-score" aria-live="polite">{score}</div>}
          {mode === 'ready' && <div className="intro overlay"><span className="eyebrow">ONE MORE TRY?</span><h1>flappy<span>bird</span></h1><div className="ready-label">GET READY!</div><p>Small bird. Big ambition.</p><button onClick={flap} disabled={!loaded}>{assetError ? 'Could not load game' : loaded ? 'LET’S FLY' : 'LOADING…'}<Play size={17} fill="currentColor" /></button><span className="tap-hint">TAP ANYWHERE TO FLAP</span></div>}
          {mode === 'paused' && <div className="overlay result"><span className="eyebrow">TAKE A BREATHER</span><h2>Paused</h2><button onClick={() => actions.current.pause()}><Play size={17} /> RESUME</button></div>}
          {mode === 'over' && <div className="overlay result"><span className="eyebrow">SO CLOSE. GO AGAIN.</span><h2>Game over</h2><div className="scorecard"><div><span>SCORE</span><strong>{score}</strong></div><div><span>BEST</span><strong>{best}</strong></div></div><button onClick={flap}><RotateCcw size={17} /> TRY AGAIN</button></div>}
          <div className="ground-label">KEEP YOUR HEAD IN THE CLOUDS</div>
        </section>
        <footer className="controls"><span><kbd>SPACE</kbd> or tap to flap</span><div><button aria-label={muted ? 'Enable sound' : 'Mute sound'} onClick={() => { muteRef.current = !muted; setMuted(!muted); }}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button><button aria-label={mode === 'paused' ? 'Resume game' : 'Pause game'} disabled={mode === 'ready' || mode === 'over'} onClick={() => actions.current.pause()}>{mode === 'paused' ? <Play size={18} /> : <Pause size={18} />}</button></div></footer>
        <p className="credit">A little nostalgia. A lot of “one more.” <a href="https://github.com/samuelcust/flappy-bird-assets" target="_blank" rel="noreferrer">Asset credits ↗</a></p>
      </div>
    </main>
  );
}
