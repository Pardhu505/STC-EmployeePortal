// ModakQuest.js
// Full-screen Ganesh Chaturthi runner game.
//  - Baby Ganesha animates from a 12-frame sprite strip (real crawl/run cycle)
//  - Jump + slide, gravity, running dust, collection particles, floating petals
//  - Mooshika runs along the bridge, modaks glow, obstacles must be avoided
//  - Parallax scrolling scene, level changes (speed + colour grade)
//  - Score / modak counter / best score, pause, start + game-over screens
//  - Keyboard (Space, Up, Down, P) and touch (tap = jump, swipe down = slide)
//
// Assets (public/festive/):
//   ganesha_run_strip.png  (12 frames, 105x150 each)
//   game_bg.jpg, mooshika_game.png

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

const FRAME_W = 139, FRAME_H = 150, FRAME_COUNT = 12;
const BEST_KEY = 'modakQuestBest';
const BUILD = 'lb-v2';   // console marker: confirms this build is deployed

export default function ModakQuest({ onClose }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);

  const { user } = useAuth();
  const [phase, setPhase] = useState('start');   // start | playing | paused | over
  const [hud, setHud] = useState({ score: 0, modaks: 0, level: 1 });
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [boardState, setBoardState] = useState('idle'); // idle|loading|ok|err|noauth
  const [boardErr, setBoardErr] = useState('');

  const authHeader = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${btoa(JSON.stringify(user))}`,
  }), [user]);

  const loadBoard = useCallback(async () => {
    if (!user) { setBoardState('noauth'); return; }
    setBoardState('loading');
    try {
      const url = `${API_BASE_URL}/api/game/leaderboard?limit=10`;
      const r = await fetch(url, { headers: authHeader() });
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        console.error('[ModakQuest] leaderboard HTTP', r.status, url, txt.slice(0, 200));
        setBoardErr(`HTTP ${r.status}`);
        setBoardState('err');
        return;
      }
      const d = await r.json();
      setBoard(Array.isArray(d.leaderboard) ? d.leaderboard : []);
      setMyRank(d.my_rank || null);
      if (d.my_best && d.my_best > 0) setBest(d.my_best);
      setBoardState('ok');
    } catch (e) {
      console.error('[ModakQuest] leaderboard fetch failed:', e);
      setBoardErr(e.message || 'network error');
      setBoardState('err');
    }
  }, [user, authHeader]);

  const submitScore = useCallback(async (score, modaks) => {
    if (!user) return;
    try {
      await fetch(`${API_BASE_URL}/api/game/score`, {
        method: 'POST', headers: authHeader(),
        body: JSON.stringify({ score, modaks }),
      });
    } catch (e) { /* offline is fine - local best still shows */ }
  }, [user, authHeader]);

  useEffect(() => { console.log('[ModakQuest] build', BUILD, 'user?', !!user); }, [user]);
  useEffect(() => { loadBoard(); }, [loadBoard]);

  useEffect(() => {
    try { setBest(parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0); } catch (e) {}
  }, []);

  /* ---------------- game world ---------------- */
  const makeState = useCallback(() => ({
    t: 0, speed: 6.2, score: 0, modaks: 0, level: 1,
    groundFrac: 0.655,
    g: { x: 0, y: 0, vy: 0, w: 133, h: 144, onGround: true, sliding: false, slideT: 0, frame: 0, frameT: 0, jumps: 0 },
    mk: { x: -260, y: 0, w: 62, h: 62, bob: 0 },
    items: [], obstacles: [], parts: [], petals: [], dust: [],
    bgX: 0, spawnT: 0, obsT: 90, over: false, flash: 0,
  }), []);

  const resize = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [resize]);

  /* ---------------- input ---------------- */
  const MAX_JUMPS = 3;                     // ground jump + double + triple
  const jump = useCallback(() => {
    const s = stateRef.current; if (!s || s.over) return;
    const g = s.g;
    if (g.jumps >= MAX_JUMPS) return;
    // each extra jump is slightly gentler so the chain stays controllable
    const power = [-15.4, -13.2, -11.6][g.jumps] || -11.6;
    g.vy = power;
    g.jumps++;
    g.onGround = false;
    g.sliding = false;
    // puff of dust at each mid-air jump
    if (g.jumps > 1) {
      const W = canvasRef.current ? canvasRef.current.clientWidth : 800;
      const gy0 = 0;
      for (let k = 0; k < 8; k++) {
        const a = Math.random() * Math.PI * 2;
        s.parts.push({ x: W * 0.17, y: (canvasRef.current ? canvasRef.current.clientHeight : 500) * s.groundFrac + g.y - 20,
                       vx: Math.cos(a) * 2, vy: Math.sin(a) * 2 + 1, a: .9, r: 2 + Math.random() * 3 });
      }
      void gy0;
    }
  }, []);
  const slide = useCallback(() => {
    const s = stateRef.current; if (!s || s.over) return;
    if (s.g.onGround) { s.g.sliding = true; s.g.slideT = 38; }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'KeyP'].includes(e.code)) e.preventDefault();
      if (phase !== 'playing') return;
      if (e.code === 'Space' || e.code === 'ArrowUp') jump();
      if (e.code === 'ArrowDown') slide();
      if (e.code === 'KeyP') setPhase('paused');
    };
    window.addEventListener('keydown', onKey, { passive: false });
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, jump, slide]);

  useEffect(() => {
    const cv = canvasRef.current; if (!cv) return;
    let sy = 0;
    const ts = (e) => { sy = e.touches[0].clientY; };
    const te = (e) => {
      if (phase !== 'playing') return;
      const dy = (e.changedTouches[0].clientY - sy);
      if (dy > 45) slide(); else jump();
    };
    cv.addEventListener('touchstart', ts, { passive: true });
    cv.addEventListener('touchend', te, { passive: true });
    return () => { cv.removeEventListener('touchstart', ts); cv.removeEventListener('touchend', te); };
  }, [phase, jump, slide]);

  /* ---------------- images ---------------- */
  const imgs = useRef({ ready: false });
  useEffect(() => {
    const load = (src) => new Promise((res) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
    });
    Promise.all([
      load('/festive/ganesha_run_strip.png'),
      load('/festive/game_bg.jpg'),
      load('/festive/mooshika_game.png'),
    ]).then(([strip, bg, mk]) => {
      imgs.current = { strip, bg, mk, ready: true };
    });
  }, []);

  /* ---------------- main loop ---------------- */
  useEffect(() => {
    if (phase !== 'playing') return;
    if (!stateRef.current) stateRef.current = makeState();
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    // older browsers lack roundRect - fall back to plain rect
    if (!ctx.roundRect) {
      ctx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); return this; };
    }

    const step = () => {
      const s = stateRef.current;
      const W = cv.clientWidth, H = cv.clientHeight;
      const groundY = H * s.groundFrac;
      s.t++;

      /* ---- level pacing ---- */
      const lvl = Math.min(5, 1 + Math.floor(s.score / 600));
      if (lvl !== s.level) { s.level = lvl; s.flash = 26; }
      s.speed = 6.2 + (s.level - 1) * 1.15;

      /* ---- ganesha physics ---- */
      const g = s.g;
      g.vy += 0.78;                     // gravity
      g.y += g.vy;
      if (g.y >= 0) { g.y = 0; g.vy = 0; g.onGround = true; g.jumps = 0; }
      if (g.sliding && --g.slideT <= 0) g.sliding = false;

      // frame animation, faster with speed; freeze mid-air
      if (g.onGround && !g.sliding) {
        g.frameT += s.speed * 0.022;
        if (g.frameT >= 1) { g.frameT = 0; g.frame = (g.frame + 1) % FRAME_COUNT; }
      } else if (!g.onGround) {
        g.frame = 3;                    // airborne pose
      }

      const gx = W * 0.17;
      const gh = g.sliding ? g.h * 0.62 : g.h;
      const gw = g.sliding ? g.w * 1.15 : g.w;
      const gy = groundY - gh + g.y;

      /* ---- running dust ---- */
      if (g.onGround && s.t % 5 === 0) {
        s.dust.push({ x: gx - 6, y: groundY - 4, r: 3 + Math.random() * 5, a: .55, vx: -s.speed * .5 - Math.random() });
      }
      s.dust = s.dust.filter(d => { d.x += d.vx; d.a -= .022; d.r += .35; return d.a > 0; });

      /* ---- petals ---- */
      if (s.t % 26 === 0) {
        s.petals.push({ x: W + 20, y: Math.random() * H * .55, r: 4 + Math.random() * 4,
                        vx: -(s.speed * .35 + Math.random()), vy: .5 + Math.random() * .7, sw: Math.random() * 6 });
      }
      s.petals = s.petals.filter(p => { p.x += p.vx; p.y += p.vy + Math.sin((s.t + p.sw * 9) / 26) * .4; return p.x > -30 && p.y < H + 20; });

      /* ---- spawn modaks & obstacles ---- */
      if (--s.spawnT <= 0) {
        s.spawnT = 46 + Math.random() * 40;
        const n = 1 + Math.floor(Math.random() * 4);
        const high = Math.random() < .4;
        for (let i = 0; i < n; i++) {
          s.items.push({ x: W + 40 + i * 46, y: groundY - (high ? 150 + Math.random() * 40 : 60), r: 17, got: false, ph: Math.random() * 6 });
        }
      }
      if (--s.obsT <= 0) {
        s.obsT = 95 + Math.random() * 85 - s.level * 6;
        const flying = Math.random() < .32;
        s.obstacles.push(flying
          ? { x: W + 40, y: groundY - 132, w: 54, h: 44, fly: true }
          : { x: W + 40, y: groundY - 52, w: 46, h: 52, fly: false });
      }

      /* ---- move + collide ---- */
      const hitBox = { x: gx - gw * .30, y: gy + 8, w: gw * .60, h: gh - 12 };
      s.items = s.items.filter(it => {
        it.x -= s.speed;
        if (!it.got) {
          const dx = it.x - (hitBox.x + hitBox.w / 2);
          const dy = it.y - (hitBox.y + hitBox.h / 2);
          if (Math.hypot(dx, dy) < it.r + 40) {
            it.got = true; s.modaks++; s.score += 25;
            for (let k = 0; k < 14; k++) {
              const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3.4;
              s.parts.push({ x: it.x, y: it.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: 1, r: 2 + Math.random() * 3 });
            }
          }
        }
        return it.x > -50 && !it.got;
      });
      s.parts = s.parts.filter(p => { p.x += p.vx; p.y += p.vy; p.vy += .12; p.a -= .035; return p.a > 0; });

      for (const o of s.obstacles) {
        o.x -= s.speed;
        const ob = { x: o.x - o.w / 2, y: o.y, w: o.w, h: o.h };
        if (hitBox.x < ob.x + ob.w && hitBox.x + hitBox.w > ob.x &&
            hitBox.y < ob.y + ob.h && hitBox.y + hitBox.h > ob.y) {
          s.over = true;
        }
      }
      s.obstacles = s.obstacles.filter(o => o.x > -80);

      /* ---- mooshika trails along ---- */
      s.mk.bob += .22;
      s.mk.x += (W * 0.055 - s.mk.x) * 0.012;

      s.score += 0.32;
      s.bgX = (s.bgX - s.speed * 0.55) % 100000;

      /* ================= DRAW ================= */
      const I = imgs.current;
      ctx.clearRect(0, 0, W, H);

      // parallax background (cover, tiled horizontally)
      if (I.bg) {
        const bh = H, bw = I.bg.width * (H / I.bg.height);
        let off = s.bgX % (bw * 2); if (off > 0) off -= bw * 2;
        // draw pairs: normal + horizontally mirrored, so tile edges always match
        for (let x = off, i = 0; x < W; x += bw, i++) {
          const flip = i % 2 === 1;
          ctx.save();
          if (flip) { ctx.translate(x + bw, 0); ctx.scale(-1, 1); ctx.drawImage(I.bg, 0, 0, bw, bh); }
          else { ctx.drawImage(I.bg, x, 0, bw, bh); }
          ctx.restore();
        }
      } else {
        const grd = ctx.createLinearGradient(0, 0, 0, H);
        grd.addColorStop(0, '#ffd9a0'); grd.addColorStop(1, '#8fd3e8');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#d9c08a'; ctx.fillRect(0, groundY, W, H - groundY);
      }

      // level colour grade
      const tints = [null, 'rgba(255,170,60,.10)', 'rgba(255,110,80,.14)', 'rgba(90,70,160,.20)', 'rgba(20,30,80,.28)'];
      const tn = tints[s.level - 1];
      if (tn) { ctx.fillStyle = tn; ctx.fillRect(0, 0, W, H); }

      // petals
      for (const p of s.petals) {
        ctx.globalAlpha = .8; ctx.fillStyle = '#ff8fb1';
        ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * .6, p.x / 40, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // dust
      for (const d of s.dust) {
        ctx.globalAlpha = d.a; ctx.fillStyle = '#fff6e0';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // mooshika
      if (I.mk) {
        const my = groundY - 58 + Math.sin(s.mk.bob) * 3;
        ctx.drawImage(I.mk, s.mk.x, my, 58, 58);
      }

      // modaks (glowing)
      for (const it of s.items) {
        const pulse = 1 + Math.sin(s.t / 9 + it.ph) * .10;
        ctx.save();
        ctx.shadowColor = '#ffcf4d'; ctx.shadowBlur = 22;
        ctx.fillStyle = '#f6c24b';
        ctx.beginPath();
        ctx.ellipse(it.x, it.y, it.r * pulse, it.r * 1.15 * pulse, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#ffe9a8';
        ctx.beginPath(); ctx.ellipse(it.x - 4, it.y - 5, 4.5, 5.5, 0, 0, 7); ctx.fill();
        ctx.restore();
      }

      // obstacles
      for (const o of s.obstacles) {
        ctx.save();
        ctx.fillStyle = o.fly ? '#c0392b' : '#7c6a55';
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
        const x = o.x - o.w / 2;
        ctx.beginPath(); ctx.roundRect(x, o.y, o.w, o.h, 8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,215,120,.75)';
        ctx.fillRect(x + 6, o.y + o.h / 2 - 3, o.w - 12, 6);
        ctx.restore();
      }

      // ganesha
      if (I.strip) {
        ctx.save();
        if (g.sliding) { ctx.translate(gx, gy + gh); ctx.rotate(-0.42); ctx.translate(-gx, -(gy + gh)); }
        ctx.drawImage(I.strip, g.frame * FRAME_W, 0, FRAME_W, FRAME_H, gx - gw / 2, gy, gw, gh);
        ctx.restore();
      } else {
        ctx.fillStyle = '#e8a33d';
        ctx.beginPath(); ctx.roundRect(gx - gw / 2, gy, gw, gh, 14); ctx.fill();
      }

      // collection sparkles
      for (const p of s.parts) {
        ctx.globalAlpha = p.a; ctx.fillStyle = '#ffd970';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;

      // level-up flash
      if (s.flash > 0) {
        ctx.globalAlpha = s.flash / 26 * .5; ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; s.flash--;
      }

      if (s.t % 6 === 0) {
        setHud({ score: Math.floor(s.score), modaks: s.modaks, level: s.level });
      }

      if (s.over) {
        const fin = Math.floor(s.score);
        setHud({ score: fin, modaks: s.modaks, level: s.level });
        try {
          const b = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
          if (fin > b) { localStorage.setItem(BEST_KEY, String(fin)); setBest(fin); }
        } catch (e) {}
        setPhase('over');
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, makeState]);

  useEffect(() => {
    if (phase !== 'over') return;
    (async () => {
      await submitScore(hud.score, hud.modaks);
      await loadBoard();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => { stateRef.current = makeState(); resize(); setPhase('playing'); };

  const Leaderboard = ({ compact }) => (
    <div className="mq-lb">
      <div className="mq-lb-h">🏆 Leaderboard</div>
      {(boardState === 'idle' || boardState === 'loading') && <div className="mq-lb-msg">Loading scores…</div>}
      {boardState === 'noauth' && <div className="mq-lb-msg">Sign in to see the leaderboard.</div>}
      {boardState === 'err' && (
        <div className="mq-lb-msg">
          Couldn't load scores{boardErr ? ` (${boardErr})` : ''}.
          <button className="mq-lb-retry" onClick={loadBoard}>Retry</button>
        </div>
      )}
      {boardState === 'ok' && board.length === 0 && (
        <div className="mq-lb-msg">No scores yet — be the first! 🎉</div>
      )}
      {board.length > 0 && (
        <table className="mq-lb-t">
          <thead><tr><th>#</th><th>Player</th><th>Modaks</th><th>Score</th></tr></thead>
          <tbody>
            {(compact ? board.slice(0, 5) : board).map((r) => (
              <tr key={r.rank} className={r.me ? 'mq-me' : ''}>
                <td>{r.rank <= 3 ? ['🥇','🥈','🥉'][r.rank-1] : r.rank}</td>
                <td className="mq-nm">{r.name}{r.me && <span className="mq-you">you</span>}</td>
                <td>{r.modaks}</td>
                <td><b>{r.score}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {myRank && <div className="mq-lb-me">Your rank: <b>#{myRank}</b></div>}
    </div>
  );

  return (
    <div className="mq-root">
      <style>{CSS}</style>
      <div className="mq-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="mq-canvas" />

        {/* HUD */}
        {phase === 'playing' && (
          <>
            <div className="mq-hud mq-hud-l">
              <span className="mq-chip">🍬 {hud.modaks}</span>
              <span className="mq-chip">⭐ {hud.score}</span>
              <span className="mq-chip">🎚 Lv {hud.level}</span>
            </div>
            <div className="mq-hud mq-hud-r">
              <button className="mq-icon" onClick={() => setPhase('paused')}>❚❚</button>
              <button className="mq-icon" onClick={onClose}>✕</button>
            </div>
            <div className="mq-help">SPACE / ↑ jump (tap up to 3× for double &amp; triple jump) &nbsp;·&nbsp; ↓ slide &nbsp;·&nbsp; tap / swipe down on mobile</div>
          </>
        )}

        {/* START */}
        {phase === 'start' && (
          <div className="mq-overlay">
            <div className="mq-card">
              <div className="mq-title">Modak Quest</div>
              <div className="mq-sub">Run • Collect • Spread Happiness</div>
              <p className="mq-p">Help little Ganesha collect modaks, dodge obstacles,
                 and see how high you can score this Ganesh Chaturthi!</p>
              <div className="mq-keys">
                <span><b>SPACE / ↑</b> Jump ×3</span><span><b>↓</b> Slide</span><span><b>P</b> Pause</span>
              </div>
              {best > 0 && <div className="mq-best">🏆 Your Best: {best}</div>}
              <Leaderboard />
              <button className="mq-btn" onClick={start}>🎮 Start the Celebration</button>
              <button className="mq-link" onClick={onClose}>Back to Portal</button>
            </div>
          </div>
        )}

        {/* PAUSED */}
        {phase === 'paused' && (
          <div className="mq-overlay">
            <div className="mq-card">
              <div className="mq-title">Paused</div>
              <button className="mq-btn" onClick={() => setPhase('playing')}>▶ Resume</button>
              <button className="mq-link" onClick={onClose}>Exit Game</button>
            </div>
          </div>
        )}

        {/* GAME OVER */}
        {phase === 'over' && (
          <div className="mq-overlay">
            <div className="mq-card">
              <div className="mq-om">॥ ॐ ॥</div>
              <div className="mq-title">Ganpati Bappa Morya!</div>
              <div className="mq-scoreRow">
                <div><span>{hud.modaks}</span><small>Modaks</small></div>
                <div><span>{hud.score}</span><small>Score</small></div>
                <div><span>{best}</span><small>Best</small></div>
              </div>
              <Leaderboard compact />
              <p className="mq-p">Every modak collected is a wish for a happier tomorrow. 🙏</p>
              <button className="mq-btn" onClick={start}>↻ Play Again</button>
              <button className="mq-link" onClick={onClose}>Back to Portal</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.mq-root{position:fixed;inset:0;z-index:10050;background:#1b0e05;
  font-family:'Inter','Segoe UI',Tahoma,sans-serif;}
.mq-wrap{position:absolute;inset:0;overflow:hidden;}
.mq-canvas{display:block;width:100%;height:100%;touch-action:none;}
.mq-hud{position:absolute;top:14px;display:flex;gap:8px;align-items:center;}
.mq-hud-l{left:14px;} .mq-hud-r{right:14px;}
.mq-chip{background:rgba(30,15,5,.62);color:#ffe9b8;font-weight:800;font-size:14px;
  padding:7px 14px;border-radius:999px;border:1px solid rgba(255,210,120,.45);backdrop-filter:blur(4px);}
.mq-icon{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,210,120,.45);
  background:rgba(30,15,5,.62);color:#ffe9b8;font-size:14px;cursor:pointer;font-weight:700;}
.mq-icon:hover{background:rgba(60,30,10,.8);}
.mq-help{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);
  background:rgba(30,15,5,.55);color:#ffe9b8;font-size:12px;padding:7px 16px;border-radius:999px;
  border:1px solid rgba(255,210,120,.3);white-space:nowrap;}
.mq-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(20,8,0,.66);backdrop-filter:blur(5px);padding:16px;}
.mq-card{width:min(520px,94vw);text-align:center;padding:28px 24px;border-radius:22px;
  background:linear-gradient(160deg,#fff6e6,#ffe3b8);border:3px solid #e8a33d;
  box-shadow:0 24px 60px rgba(0,0,0,.5);animation:mqPop .45s cubic-bezier(.2,1.1,.35,1) both;}
@keyframes mqPop{from{opacity:0;transform:scale(.88) translateY(14px)}to{opacity:1;transform:none}}
.mq-om{font-size:26px;color:#c0392b;}
.mq-title{font-size:clamp(24px,5vw,34px);font-weight:800;color:#a8321f;margin:4px 0 2px;}
.mq-sub{font-size:14px;font-weight:700;color:#c98a2e;letter-spacing:.6px;text-transform:uppercase;}
.mq-p{color:#6b4a16;font-size:14px;line-height:1.6;margin:14px auto;max-width:400px;}
.mq-keys{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin:12px 0;
  color:#8a5a1f;font-size:13px;}
.mq-keys b{color:#a8321f;}
.mq-best{color:#a8321f;font-weight:800;margin:8px 0;}
.mq-scoreRow{display:flex;justify-content:center;gap:26px;margin:18px 0 6px;}
.mq-scoreRow div{display:flex;flex-direction:column;}
.mq-scoreRow span{font-size:30px;font-weight:800;color:#a8321f;line-height:1;}
.mq-scoreRow small{font-size:11px;color:#8a5a1f;text-transform:uppercase;letter-spacing:.6px;margin-top:4px;}
.mq-lb{margin:16px auto 4px;max-width:420px;text-align:left;
  background:rgba(255,255,255,.55);border:1px solid #e8c58d;border-radius:14px;padding:12px 14px;}
.mq-lb-h{font-size:13px;font-weight:800;color:#a8321f;text-transform:uppercase;
  letter-spacing:.6px;text-align:center;margin-bottom:8px;}
.mq-lb-msg{font-size:12.5px;color:#8a5a1f;text-align:center;padding:6px 0;}
.mq-lb-t{width:100%;border-collapse:collapse;font-size:13px;color:#6b4a16;}
.mq-lb-t th{font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:#b58438;
  font-weight:700;padding:4px 6px;border-bottom:1px solid #e8c58d;text-align:left;}
.mq-lb-t th:first-child,.mq-lb-t td:first-child{width:34px;text-align:center;}
.mq-lb-t th:nth-child(3),.mq-lb-t td:nth-child(3),
.mq-lb-t th:last-child,.mq-lb-t td:last-child{text-align:right;width:62px;}
.mq-lb-t td{padding:5px 6px;border-bottom:1px solid rgba(232,197,141,.45);}
.mq-lb-t tr:last-child td{border-bottom:none;}
.mq-lb-t .mq-nm{font-weight:600;}
.mq-lb-t tr.mq-me{background:rgba(232,163,61,.22);}
.mq-you{margin-left:6px;font-size:9.5px;background:#c0392b;color:#fff;
  padding:1px 6px;border-radius:999px;vertical-align:middle;}
.mq-lb-retry{margin-left:8px;cursor:pointer;border:1px solid #c0392b;background:#fff;
  color:#c0392b;border-radius:999px;padding:2px 12px;font-size:11px;font-weight:700;}
.mq-lb-me{margin-top:8px;text-align:center;font-size:12px;color:#a8321f;}
.mq-btn{margin-top:14px;cursor:pointer;border:none;border-radius:999px;padding:13px 34px;
  font-size:16px;font-weight:800;color:#fff;background:linear-gradient(135deg,#c0392b,#e8a33d);
  box-shadow:0 8px 20px rgba(0,0,0,.28);}
.mq-btn:hover{filter:brightness(1.08);}
.mq-link{display:block;margin:12px auto 0;background:none;border:none;cursor:pointer;
  color:#8a5a1f;font-size:13px;font-weight:700;text-decoration:underline;}
@media(max-width:640px){.mq-help{font-size:10px;padding:6px 10px;} .mq-chip{font-size:12px;padding:6px 10px;}}
`;
