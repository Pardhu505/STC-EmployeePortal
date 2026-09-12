// ModakQuest.js
// Ganesh Chaturthi adventure: a staged runner (Mario-style progression) that
// ends with Ganesha entering the grand Mandapa.
//
//  * 5 themed stages, each with a distance goal, rising speed and difficulty
//  * 3 lives (hearts) with brief invulnerability - one mistake isn't the end
//  * Stage-complete screens between levels, with modaks/score earned
//  * FINALE: the decorated Mandapa scrolls in and Ganesha runs inside
//  * Org leaderboard: best score per player, champion shown on the start screen
//
// Assets in public/festive/: ganesha_run_strip.png, game_bg.jpg,
//                           mooshika_game.png, scene_male.jpg, scene_female.jpg

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

const FRAME_W = 151, FRAME_H = 150, FRAME_COUNT = 12;   // 0-11 walk cycle
const SLIDE_FRAME = 12;                                  // crouched pose
const BEST_KEY = 'modakQuestBest';
const BUILD = 'stages-v1';
const MAX_JUMPS = 3;
const START_LIVES = 3;

// Each stage: distance to clear, pace, spawn gaps and a colour grade.
const STAGES = [
  { name: 'Riverside Ghats',   dist: 1000, speed: 6.0, obs: 108, sky: null,
    types: ['ground','fly'] },
  { name: 'Festival Bazaar',   dist: 1350, speed: 7.0, obs: 96,
    sky: 'linear|rgba(255,186,80,.22)|rgba(255,126,60,.10)', types: ['ground','fly','mover'] },
  { name: 'Sunset Bridge',     dist: 1750, speed: 8.0, obs: 86,
    sky: 'linear|rgba(255,120,70,.30)|rgba(120,60,120,.18)', types: ['ground','fly','fire'] },
  { name: 'Twilight Ghats',    dist: 2200, speed: 9.0, obs: 78,
    sky: 'linear|rgba(80,60,160,.34)|rgba(30,30,90,.26)', types: ['ground','fly','mover','fire'] },
  { name: 'Mandapa Approach',  dist: 2700, speed: 10.0, obs: 70,
    sky: 'linear|rgba(18,24,70,.44)|rgba(40,20,70,.34)', types: ['ground','fly','mover','fire'] },
];
const GATE_LEAD = 520;            // how early the Mandapa appears at the end

export default function ModakQuest({ onClose }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const stateRef = useRef(null);
  const rafRef = useRef(null);

  const { user } = useAuth();
  const [phase, setPhase] = useState('start');  // start|playing|paused|stage|over|win
  const [hud, setHud] = useState({ score: 0, modaks: 0, stage: 0, lives: START_LIVES, prog: 0 });
  const [best, setBest] = useState(0);
  const [board, setBoard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [champion, setChampion] = useState(null);
  const [boardState, setBoardState] = useState('idle');
  const [boardErr, setBoardErr] = useState('');

  /* ------------------------- leaderboard ------------------------- */
  const authHeader = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${btoa(JSON.stringify(user))}`,
  }), [user]);

  const loadBoard = useCallback(async () => {
    if (!user) { setBoardState('noauth'); return; }
    setBoardState('loading');
    try {
      const r = await fetch(`${API_BASE_URL}/api/game/leaderboard?limit=500`, { headers: authHeader() });
      if (!r.ok) { setBoardErr(`HTTP ${r.status}`); setBoardState('err'); return; }
      const d = await r.json();
      setBoard(Array.isArray(d.leaderboard) ? d.leaderboard : []);
      setMyRank(d.my_rank || null);
      setTotalPlayers(d.total || 0);
      setChampion(d.champion || null);
      if (d.my_best > 0) setBest(d.my_best);
      setBoardState('ok');
    } catch (e) { setBoardErr(e.message || 'network'); setBoardState('err'); }
  }, [user, authHeader]);

  const submitScore = useCallback(async (score, modaks) => {
    if (!user) return;
    try {
      await fetch(`${API_BASE_URL}/api/game/score`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify({ score, modaks }),
      });
    } catch (e) { /* offline is fine */ }
  }, [user, authHeader]);

  useEffect(() => { console.log('[ModakQuest] build', BUILD); }, []);
  useEffect(() => { loadBoard(); }, [loadBoard]);

  useEffect(() => {
    if (phase !== 'over' && phase !== 'win') return;
    (async () => {
      try {
        const b = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
        if (hud.score > b) localStorage.setItem(BEST_KEY, String(hud.score));
      } catch (e) {}
      await submitScore(hud.score, hud.modaks);
      await loadBoard();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  /* ------------------------- world ------------------------- */
  const makeState = useCallback((stageIdx = 0, carry = null) => {
    const st = STAGES[stageIdx];
    return {
      t: 0, stage: stageIdx, dist: 0, goal: st.dist,
      speed: st.speed, sky: st.sky,
      score: carry ? carry.score : 0,
      modaks: carry ? carry.modaks : 0,
      lives: carry ? carry.lives : START_LIVES,
      groundFrac: 0.655,
      g: { y: 0, vy: 0, w: 145, h: 144, onGround: true, sliding: false, slideT: 0,
           frame: 0, frameT: 0, jumps: 0, inv: 0 },
      mk: { x: -260, bob: 0 },
      items: [], obstacles: [], parts: [], petals: [], dust: [],
      bgX: 0, spawnT: 30, obsT: 90, flash: 0,
      gate: null, done: false, dead: false,
      cut: null,   // entry cutscene: { t, gx, sitting }
    };
  }, []);

  const resize = useCallback(() => {
    const cv = canvasRef.current, wrap = wrapRef.current;
    if (!cv || !wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = wrap.clientWidth * dpr; cv.height = wrap.clientHeight * dpr;
    cv.style.width = wrap.clientWidth + 'px'; cv.style.height = wrap.clientHeight + 'px';
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);
  useEffect(() => { resize(); window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize); }, [resize]);

  /* ------------------------- input ------------------------- */
  const jump = useCallback(() => {
    const s = stateRef.current; if (!s || s.dead || s.done) return;
    const g = s.g; if (g.jumps >= MAX_JUMPS) return;
    g.vy = [-15.4, -13.2, -11.6][g.jumps] || -11.6;
    g.jumps++; g.onGround = false; g.sliding = false;
  }, []);
  const slide = useCallback(() => {
    const s = stateRef.current; if (!s || s.dead || s.done) return;
    if (s.g.onGround) { s.g.sliding = true; s.g.slideT = 38; }
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (['Space','ArrowUp','ArrowDown','KeyP'].includes(e.code)) e.preventDefault();
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
      (e.changedTouches[0].clientY - sy > 45) ? slide() : jump();
    };
    cv.addEventListener('touchstart', ts, { passive: true });
    cv.addEventListener('touchend', te, { passive: true });
    return () => { cv.removeEventListener('touchstart', ts); cv.removeEventListener('touchend', te); };
  }, [phase, jump, slide]);

  /* ------------------------- images ------------------------- */
  const imgs = useRef({});
  useEffect(() => {
    const load = (src) => new Promise((res) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src;
    });
    Promise.all([load('/festive/ganesha_run_strip.png'), load('/festive/game_bg.jpg'),
                 load('/festive/mooshika_game.png'), load('/festive/mandapam.png')])
      .then(([strip, bg, mk, mandapam]) => { imgs.current = { strip, bg, mk, mandapam }; });
  }, []);

  /* ------------------------- loop ------------------------- */
  useEffect(() => {
    if (phase !== 'playing') return;
    if (!stateRef.current) stateRef.current = makeState(0);
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx.roundRect) ctx.roundRect = function (x,y,w,h){ this.rect(x,y,w,h); return this; };

    const step = () => {
      const s = stateRef.current;
      const W = cv.clientWidth, H = cv.clientHeight, groundY = H * s.groundFrac;
      s.t++;
      s.dist += s.speed / 12;                       // "metres" travelled

      /* ---- the Mandapa appears near the end of every stage ---- */
      if (!s.gate && s.dist >= s.goal - GATE_LEAD / 12) {
        s.gate = { x: W + 160 };
      }
      if (s.gate) s.gate.x -= s.speed;

      /* ---- physics ---- */
      const g = s.g;
      g.vy += 0.78; g.y += g.vy;
      if (g.y >= 0) { g.y = 0; g.vy = 0; g.onGround = true; g.jumps = 0; }
      if (g.sliding && --g.slideT <= 0) g.sliding = false;
      if (g.inv > 0) g.inv--;

      if (s.cut && s.cut.sitting) g.frame = SLIDE_FRAME;   // seated inside the Mandapam
      else if (g.sliding) g.frame = SLIDE_FRAME;
      else if (g.onGround) {
        g.frameT += s.speed * 0.022;
        if (g.frameT >= 1) { g.frameT = 0; g.frame = (g.frame + 1) % FRAME_COUNT; }
      } else g.frame = 6;

      const gx = s.cut ? W*0.17 + Math.min(1, s.cut.t/70) * (W*0.16) : W * 0.17;
      const gh = g.sliding ? g.h * 0.62 : g.h;
      const gw = g.sliding ? g.w * 1.12 : g.w;
      const gy = groundY - gh + g.y;

      /* ---- effects ---- */
      if (g.onGround && s.t % 5 === 0)
        s.dust.push({ x: gx - 6, y: groundY - 4, r: 3 + Math.random()*5, a: .55, vx: -s.speed*.5 });
      s.dust = s.dust.filter(d => { d.x += d.vx; d.a -= .022; d.r += .35; return d.a > 0; });
      if (s.t % 26 === 0)
        s.petals.push({ x: W+20, y: Math.random()*H*.55, r: 4+Math.random()*4,
                        vx: -(s.speed*.35+Math.random()), vy: .5+Math.random()*.7, sw: Math.random()*6 });
      s.petals = s.petals.filter(p => { p.x += p.vx; p.y += p.vy + Math.sin((s.t+p.sw*9)/26)*.4;
                                        return p.x > -30 && p.y < H+20; });

      /* ---- spawning (stops once the gate is in view) ---- */
      if (!s.gate && !s.cut) {
        if (--s.spawnT <= 0) {
          s.spawnT = 46 + Math.random()*40;
          const n = 1 + Math.floor(Math.random()*4);
          const high = Math.random() < .4;
          for (let i = 0; i < n; i++)
            s.items.push({ x: W+40+i*46, y: groundY-(high?150+Math.random()*40:60),
                           r: 17, got: false, ph: Math.random()*6 });
        }
        if (--s.obsT <= 0) {
          s.obsT = STAGES[s.stage].obs + Math.random()*70;
          const types = STAGES[s.stage].types;
          const kind = types[Math.floor(Math.random()*types.length)];
          if (kind === 'fly')
            s.obstacles.push({ kind, x: W+40, y: groundY-132, w: 54, h: 44 });
          else if (kind === 'fire')
            s.obstacles.push({ kind, x: W+40, y: groundY-62, w: 44, h: 62, ph: Math.random()*6 });
          else if (kind === 'mover')
            s.obstacles.push({ kind, x: W+40, y: groundY-150, w: 52, h: 52,
                               base: groundY-150, amp: 62, ph: Math.random()*6 });
          else
            s.obstacles.push({ kind: 'ground', x: W+40, y: groundY-52, w: 46, h: 52 });
        }
      }

      /* ---- collect / collide ---- */
      const hb = { x: gx-gw*.30, y: gy+8, w: gw*.60, h: gh-12 };
      s.items = s.items.filter(it => {
        it.x -= s.speed;
        if (!it.got) {
          const dx = it.x-(hb.x+hb.w/2), dy = it.y-(hb.y+hb.h/2);
          if (Math.hypot(dx,dy) < it.r+40) {
            it.got = true; s.modaks++; s.score += 25;
            for (let k=0;k<14;k++){ const a=Math.random()*Math.PI*2, sp=1+Math.random()*3.4;
              s.parts.push({x:it.x,y:it.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,a:1,r:2+Math.random()*3}); }
          }
        }
        return it.x > -50 && !it.got;
      });
      s.parts = s.parts.filter(p => { p.x+=p.vx; p.y+=p.vy; p.vy+=.12; p.a-=.035; return p.a>0; });

      for (const o of s.obstacles) {
        o.x -= s.speed;
        if (o.kind === 'mover') o.y = o.base + Math.sin(s.t/26 + o.ph) * o.amp;
        if (g.inv > 0 || s.cut) continue;
        const ob = { x:o.x-o.w/2, y:o.y, w:o.w, h:o.h };
        if (hb.x < ob.x+ob.w && hb.x+hb.w > ob.x && hb.y < ob.y+ob.h && hb.y+hb.h > ob.y) {
          s.lives--; g.inv = 95; s.flash = 18;
          for (let k=0;k<18;k++){ const a=Math.random()*Math.PI*2;
            s.parts.push({x:gx,y:gy+gh/2,vx:Math.cos(a)*3,vy:Math.sin(a)*3,a:1,r:2+Math.random()*3}); }
          if (s.lives <= 0) s.dead = true;
        }
      }
      s.obstacles = s.obstacles.filter(o => o.x > -80);

      s.mk.bob += .22; s.mk.x += (W*0.055 - s.mk.x)*0.012;
      s.score += 0.32;
      s.bgX = (s.bgX - s.speed*0.55) % 100000;

      /* ================= draw ================= */
      const I = imgs.current;
      ctx.clearRect(0,0,W,H);
      if (I.bg) {
        const bh = H, bw = I.bg.width*(H/I.bg.height);
        let off = s.bgX % (bw*2); if (off > 0) off -= bw*2;
        for (let x = off, i = 0; x < W; x += bw, i++) {
          ctx.save();
          if (i % 2) { ctx.translate(x+bw,0); ctx.scale(-1,1); ctx.drawImage(I.bg,0,0,bw,bh); }
          else ctx.drawImage(I.bg,x,0,bw,bh);
          ctx.restore();
        }
      } else { ctx.fillStyle = '#8fd3e8'; ctx.fillRect(0,0,W,H); }
      if (s.sky) {
        const [, c1, c2] = s.sky.split('|');
        const sg = ctx.createLinearGradient(0,0,0,H);
        sg.addColorStop(0, c1); sg.addColorStop(1, c2);
        ctx.fillStyle = sg; ctx.fillRect(0,0,W,H);
      }

      for (const p of s.petals) { ctx.globalAlpha=.8; ctx.fillStyle='#ff8fb1';
        ctx.beginPath(); ctx.ellipse(p.x,p.y,p.r,p.r*.6,p.x/40,0,7); ctx.fill(); }
      ctx.globalAlpha = 1;
      for (const d of s.dust) { ctx.globalAlpha=d.a; ctx.fillStyle='#fff6e0';
        ctx.beginPath(); ctx.arc(d.x,d.y,d.r,0,7); ctx.fill(); }
      ctx.globalAlpha = 1;

      /* ---- the Mandapa gate ---- */
      if (s.gate) {
        if (I.mandapam) {
          const mh = Math.min(groundY*1.02, H*0.86);
          const mw = I.mandapam.width * (mh / I.mandapam.height);
          ctx.save(); ctx.shadowColor='rgba(255,200,90,.55)'; ctx.shadowBlur=40;
          ctx.drawImage(I.mandapam, s.gate.x, groundY - mh + 12, mw, mh);
          ctx.restore();
        } else drawMandapa(ctx, s.gate.x, groundY, H);
      }

      if (I.mk) ctx.drawImage(I.mk, s.mk.x, groundY-58+Math.sin(s.mk.bob)*3, 58, 58);

      for (const it of s.items) {
        const pulse = 1+Math.sin(s.t/9+it.ph)*.10;
        ctx.save(); ctx.shadowColor='#ffcf4d'; ctx.shadowBlur=22; ctx.fillStyle='#f6c24b';
        ctx.beginPath(); ctx.ellipse(it.x,it.y,it.r*pulse,it.r*1.15*pulse,0,0,7); ctx.fill();
        ctx.fillStyle='#ffe9a8'; ctx.beginPath(); ctx.ellipse(it.x-4,it.y-5,4.5,5.5,0,0,7); ctx.fill();
        ctx.restore();
      }
      for (const o of s.obstacles) {
        const x = o.x - o.w/2;
        ctx.save();
        if (o.kind === 'fire') {
          // animated flame
          const fl = 1 + Math.sin(s.t/5 + o.ph)*0.18;
          ctx.shadowColor = '#ff7a18'; ctx.shadowBlur = 26;
          ctx.fillStyle = '#e8511a';
          ctx.beginPath();
          ctx.moveTo(x+o.w/2, o.y - 10*fl);
          ctx.quadraticCurveTo(x+o.w, o.y+o.h*0.45, x+o.w*0.72, o.y+o.h);
          ctx.lineTo(x+o.w*0.28, o.y+o.h);
          ctx.quadraticCurveTo(x, o.y+o.h*0.45, x+o.w/2, o.y-10*fl);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffb300';
          ctx.beginPath();
          ctx.moveTo(x+o.w/2, o.y + o.h*0.18*fl);
          ctx.quadraticCurveTo(x+o.w*0.82, o.y+o.h*0.62, x+o.w*0.62, o.y+o.h);
          ctx.lineTo(x+o.w*0.38, o.y+o.h);
          ctx.quadraticCurveTo(x+o.w*0.18, o.y+o.h*0.62, x+o.w/2, o.y+o.h*0.18*fl);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#ffe082';
          ctx.beginPath(); ctx.ellipse(x+o.w/2, o.y+o.h*0.78, o.w*0.16, o.h*0.16, 0,0,7); ctx.fill();
        } else if (o.kind === 'mover') {
          ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 10;
          ctx.fillStyle = '#6d4c41';
          ctx.beginPath(); ctx.roundRect(x,o.y,o.w,o.h,10); ctx.fill();
          ctx.strokeStyle='#ffd54f'; ctx.lineWidth=3; ctx.stroke();
          ctx.fillStyle='#ffd54f';
          ctx.beginPath(); ctx.arc(x+o.w/2,o.y+o.h/2,7,0,7); ctx.fill();
        } else {
          ctx.fillStyle = o.kind === 'fly' ? '#c0392b' : '#7c6a55';
          ctx.strokeStyle='rgba(255,255,255,.35)'; ctx.lineWidth=2;
          ctx.beginPath(); ctx.roundRect(x,o.y,o.w,o.h,8); ctx.fill(); ctx.stroke();
          ctx.fillStyle='rgba(255,215,120,.75)'; ctx.fillRect(x+6,o.y+o.h/2-3,o.w-12,6);
        }
        ctx.restore();
      }

      // Ganesha (blinks while invulnerable)
      const blink = g.inv > 0 && Math.floor(s.t/4) % 2 === 0;
      if (I.strip && !blink) {
        ctx.drawImage(I.strip, g.frame*FRAME_W, 0, FRAME_W, FRAME_H, gx-gw/2, gy, gw, gh);
      }
      for (const p of s.parts) { ctx.globalAlpha=p.a; ctx.fillStyle='#ffd970';
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,7); ctx.fill(); }
      ctx.globalAlpha = 1;
      if (s.cut && s.cut.sitting) {
        const k = Math.min(1, (s.cut.t-0)/40);
        const cgr = ctx.createRadialGradient(gx+30, groundY-80, 8, gx+30, groundY-80, 210);
        cgr.addColorStop(0, `rgba(255,220,130,${0.34*k})`);
        cgr.addColorStop(1, 'rgba(255,220,130,0)');
        ctx.fillStyle = cgr; ctx.fillRect(gx-190, groundY-290, 440, 330);
        ctx.globalAlpha = k; ctx.textAlign = 'center';
        ctx.font = 'bold 22px Inter, sans-serif'; ctx.fillStyle = '#fff3d6';
        ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = 10;
        ctx.fillText('गणपति बाप्पा मोरया!', W/2, groundY + 56);
        ctx.font = '600 14px Inter, sans-serif';
        ctx.fillText('Ganesha is seated in the Mandapam', W/2, groundY + 80);
        ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      }
      if (s.flash > 0) { ctx.globalAlpha=s.flash/18*.45; ctx.fillStyle='#fff';
        ctx.fillRect(0,0,W,H); ctx.globalAlpha=1; s.flash--; }

      if (s.t % 5 === 0) setHud({ score: Math.floor(s.score), modaks: s.modaks,
        stage: s.stage, lives: s.lives, prog: Math.min(1, s.dist/s.goal) });

      /* ---- reached the Mandapa? ---- */
      if (s.gate && s.gate.x + 150 <= gx && !s.cut) {
        s.cut = { t: 0, sitting: false };
        s.score += 250 + s.lives * 100;                 // clear + life bonus
        setHud(h => ({ ...h, score: Math.floor(s.score) }));
      }
      if (s.cut) {
        s.cut.t++;
        // step 1 - glide the world to a halt so he settles inside the Mandapam
        s.speed *= 0.955;
        if (s.speed < 0.35) s.speed = 0;
        // step 2 - once still, he sits down
        if (s.speed === 0 && !s.cut.sitting) {
          s.cut.sitting = true;
          for (let k = 0; k < 40; k++) {                 // blessing sparkles
            const a = Math.random()*Math.PI*2, sp = 1+Math.random()*4;
            s.parts.push({ x: gx+40, y: groundY-70, vx: Math.cos(a)*sp,
                           vy: Math.sin(a)*sp-1, a: 1, r: 2+Math.random()*4 });
          }
        }
        // step 3 - hold a beat on the seated pose, then show the card
        if (s.cut.sitting && s.cut.t > 150 && !s.done) {
          s.done = true;
          setPhase(s.stage >= STAGES.length - 1 ? 'win' : 'stage');
          return;
        }
      }
      if (s.dead) {
        setHud({ score: Math.floor(s.score), modaks: s.modaks, stage: s.stage, lives: 0, prog: s.dist/s.goal });
        setPhase('over'); return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [phase, makeState]);

  /* ---- ornate Mandapa drawn on canvas (no extra asset needed) ---- */
  function drawMandapa(ctx, x, groundY, H) {
    const w = 330, h = Math.min(groundY * 0.92, 420);
    const top = groundY - h, cx = x + w/2;
    ctx.save();
    // glow behind the entrance
    const gr = ctx.createRadialGradient(cx, groundY-h*0.45, 10, cx, groundY-h*0.45, w*0.8);
    gr.addColorStop(0,'rgba(255,214,120,.55)'); gr.addColorStop(1,'rgba(255,214,120,0)');
    ctx.fillStyle = gr; ctx.fillRect(x-w*0.5, top-60, w*2, h+80);
    // pillars
    ctx.fillStyle = '#e8c98d';
    ctx.fillRect(x, top+70, 42, h-70);
    ctx.fillRect(x+w-42, top+70, 42, h-70);
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(x-6, top+62, 54, 14); ctx.fillRect(x+w-48, top+62, 54, 14);
    ctx.fillRect(x-6, groundY-16, 54, 16); ctx.fillRect(x+w-48, groundY-16, 54, 16);
    // arch + dome
    ctx.fillStyle = '#f0d7a2';
    ctx.beginPath(); ctx.moveTo(x, top+76); ctx.lineTo(x+w, top+76);
    ctx.lineTo(x+w, top+40); ctx.quadraticCurveTo(cx, top-46, x, top+40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#d4a017';
    ctx.beginPath(); ctx.moveTo(cx-46, top-22); ctx.quadraticCurveTo(cx, top-110, cx+46, top-22);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, top-112, 11, 0, 7); ctx.fill();
    // dark doorway
    ctx.fillStyle = 'rgba(60,26,10,.82)';
    ctx.fillRect(x+46, top+80, w-92, h-80);
    // marigold garlands
    for (let i = 0; i < 14; i++) {
      const gxp = x+50 + i*((w-100)/13);
      const dip = Math.sin(i/13*Math.PI)*26;
      ctx.fillStyle = i%2 ? '#ff9800' : '#ffd54f';
      ctx.beginPath(); ctx.arc(gxp, top+86+dip, 7, 0, 7); ctx.fill();
    }
    // bells
    ctx.fillStyle = '#d4a017';
    [x+70, x+w-70].forEach(bx => {
      ctx.fillRect(bx-1, top+96, 2, 22);
      ctx.beginPath(); ctx.moveTo(bx-11, top+142);
      ctx.quadraticCurveTo(bx, top+112, bx+11, top+142); ctx.closePath(); ctx.fill();
    });
    // welcome text
    ctx.fillStyle = '#ffe9a8'; ctx.font = 'bold 19px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('॥ GANESH MANDAPA ॥', cx, top+150);
    ctx.restore();
  }

  /* ------------------------- controls ------------------------- */
  const startGame = () => { stateRef.current = makeState(0); resize(); setPhase('playing'); };
  const nextStage = () => {
    const s = stateRef.current;
    stateRef.current = makeState(s.stage + 1,
      { score: s.score, modaks: s.modaks, lives: s.lives });
    resize(); setPhase('playing');
  };

  const Leaderboard = ({ compact }) => (
    <div className="mq-lb">
      <div className="mq-lb-h">🏆 Leaderboard{totalPlayers>0 && <span className="mq-lb-n"> · {totalPlayers} players</span>}</div>
      {(boardState==='idle'||boardState==='loading') && <div className="mq-lb-msg">Loading scores…</div>}
      {boardState==='noauth' && <div className="mq-lb-msg">Sign in to see the leaderboard.</div>}
      {boardState==='err' && <div className="mq-lb-msg">Couldn't load scores{boardErr?` (${boardErr})`:''}.
        <button className="mq-lb-retry" onClick={loadBoard}>Retry</button></div>}
      {boardState==='ok' && board.length===0 && <div className="mq-lb-msg">No scores yet — be the first! 🎉</div>}
      {board.length>0 && (
        <div className={compact ? '' : 'mq-lb-scroll'}>
          <table className="mq-lb-t">
            <thead><tr><th>#</th><th>Player</th><th>Modaks</th><th>Score</th></tr></thead>
            <tbody>
              {(compact ? board.slice(0,5) : board).map(r => (
                <tr key={r.rank} className={r.me ? 'mq-me' : ''}>
                  <td>{r.rank<=3 ? ['🥇','🥈','🥉'][r.rank-1] : r.rank}</td>
                  <td className="mq-nm">{r.name}{r.me && <span className="mq-you">you</span>}</td>
                  <td>{r.modaks}</td><td><b>{r.score}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {myRank && <div className="mq-lb-me">Your rank: <b>#{myRank}</b>{totalPlayers>0 && ` of ${totalPlayers}`}</div>}
    </div>
  );

  const hearts = '❤️'.repeat(Math.max(0, hud.lives)) + '🤍'.repeat(Math.max(0, START_LIVES - hud.lives));

  return (
    <div className="mq-root">
      <style>{CSS}</style>
      <div className="mq-wrap" ref={wrapRef}>
        <canvas ref={canvasRef} className="mq-canvas" />

        {phase === 'playing' && (
          <>
            <div className="mq-hud mq-hud-l">
              <span className="mq-chip">🍬 {hud.modaks}</span>
              <span className="mq-chip">⭐ {hud.score}</span>
              <span className="mq-chip mq-hearts">{hearts}</span>
            </div>
            <div className="mq-hud mq-hud-r">
              <button className="mq-icon" onClick={() => setPhase('paused')}>❚❚</button>
              <button className="mq-icon" onClick={onClose}>✕</button>
            </div>
            <div className="mq-prog">
              <div className="mq-prog-top">
                <span>Stage {hud.stage+1}/{STAGES.length} · {STAGES[hud.stage].name}</span>
                <span>🛕 Mandapa</span>
              </div>
              <div className="mq-prog-bar"><i style={{ width: `${hud.prog*100}%` }} /></div>
            </div>
            <div className="mq-help">SPACE / ↑ jump (×3) · ↓ slide · tap / swipe down on mobile</div>
          </>
        )}

        {phase === 'start' && (
          <div className="mq-overlay mq-start"
               style={{ justifyContent:'flex-start', alignItems:'center', padding:0 }}>
            <div className="mq-scene">
              <img className="mq-scene-img" alt=""
                   src={`/festive/scene_${champion && champion.gender==='female' ? 'female':'male'}.jpg`}
                   onError={(e)=>{e.currentTarget.style.display='none';}} />
              <div className="mq-sparkles" aria-hidden="true">
                {Array.from({length:18}).map((_,i)=>(
                  <i key={i} style={{ left:`${52+(i*2.7)%46}%`, top:`${18+(i*4.3)%62}%`,
                    animationDelay:`${(i%7)*0.5}s`, animationDuration:`${2.6+(i%4)*0.7}s` }} />
                ))}
              </div>
              {champion && (
                <div className="mq-plaque"><div className="mq-plaque-in">
                  <span className="mq-plaque-top">👑 Congratulations</span>
                  <span className="mq-plaque-name">{champion.name}!</span>
                  <span className="mq-plaque-sub">May Bappa bless you with happiness, success and prosperity!</span>
                  <span className="mq-plaque-score">🍬 {champion.modaks} · ⭐ {champion.score}</span>
                </div></div>
              )}
            </div>
            <div className="mq-card" style={{ position:'relative', zIndex:3,
                 marginLeft:'clamp(12px,4.5vw,84px)', width:'min(500px,44vw)', maxWidth:'500px',
                 maxHeight:'92vh', overflowY:'auto' }}>
              <div className="mq-title">Modak Quest</div>
              <div className="mq-sub">5 Stages · Reach the Mandapa</div>
              <p className="mq-p">Help little Ganesha run the festival route, collect modaks and dodge
                 obstacles through five stages — and lead him into the grand Ganesh Mandapa!</p>
              <div className="mq-keys">
                <span><b>SPACE / ↑</b> Jump ×3</span><span><b>↓</b> Slide</span><span><b>P</b> Pause</span>
                <span><b>❤️❤️❤️</b> 3 lives</span>
              </div>
              {best>0 && <div className="mq-best">🏆 Your Best: {best}</div>}
              <Leaderboard />
              <button className="mq-btn" onClick={startGame}>🎮 Start the Celebration</button>
              <button className="mq-link" onClick={onClose}>Back to Portal</button>
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="mq-overlay"><div className="mq-card">
            <div className="mq-title">Paused</div>
            <button className="mq-btn" onClick={()=>setPhase('playing')}>▶ Resume</button>
            <button className="mq-link" onClick={onClose}>Exit Game</button>
          </div></div>
        )}

        {phase === 'stage' && (
          <div className="mq-overlay"><div className="mq-card">
            <div className="mq-om">🛕</div>
            <div className="mq-title">Stage {hud.stage+1} Complete!</div>
            <div className="mq-sub">{STAGES[hud.stage].name} cleared</div>
            <div className="mq-scoreRow">
              <div><span>{hud.modaks}</span><small>Modaks</small></div>
              <div><span>{hud.score}</span><small>Score</small></div>
              <div><span>{hud.lives}</span><small>Lives left</small></div>
            </div>
            <p className="mq-p">Next up: <b>{STAGES[Math.min(hud.stage+1, STAGES.length-1)].name}</b> — it gets faster!</p>
            <button className="mq-btn" onClick={nextStage}>▶ Continue to Stage {hud.stage+2}</button>
            <button className="mq-link" onClick={onClose}>Back to Portal</button>
          </div></div>
        )}

        {phase === 'win' && (
          <div className="mq-overlay"><div className="mq-card mq-win">
            <div className="mq-om">॥ ॐ ॥</div>
            <div className="mq-title">Ganesha has reached the Mandapa!</div>
            <div className="mq-sub">गणपति बाप्पा मोरया!</div>
            <p className="mq-p">You cleared all {STAGES.length} stages and led little Ganesha
               safely into the grand Mandapa. 🎉</p>
            <div className="mq-scoreRow">
              <div><span>{hud.modaks}</span><small>Modaks</small></div>
              <div><span>{hud.score}</span><small>Final Score</small></div>
              <div><span>{best}</span><small>Best</small></div>
            </div>
            <Leaderboard compact />
            <button className="mq-btn" onClick={startGame}>↻ Play Again</button>
            <button className="mq-link" onClick={onClose}>Back to Portal</button>
          </div></div>
        )}

        {phase === 'over' && (
          <div className="mq-overlay"><div className="mq-card">
            <div className="mq-om">🙏</div>
            <div className="mq-title">Bappa needs you again!</div>
            <div className="mq-sub">Stage {hud.stage+1} · {STAGES[hud.stage].name}</div>
            <div className="mq-scoreRow">
              <div><span>{hud.modaks}</span><small>Modaks</small></div>
              <div><span>{hud.score}</span><small>Score</small></div>
              <div><span>{best}</span><small>Best</small></div>
            </div>
            <Leaderboard compact />
            <p className="mq-p">Every modak collected is a wish for a happier tomorrow. 🙏</p>
            <button className="mq-btn" onClick={startGame}>↻ Try Again</button>
            <button className="mq-link" onClick={onClose}>Back to Portal</button>
          </div></div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.mq-root{position:fixed;inset:0;z-index:10050;background:#1b0e05;font-family:'Inter','Segoe UI',Tahoma,sans-serif;}
.mq-wrap{position:absolute;inset:0;overflow:hidden;}
.mq-canvas{display:block;width:100%;height:100%;touch-action:none;}
.mq-hud{position:absolute;top:14px;display:flex;gap:8px;align-items:center;z-index:4;}
.mq-hud-l{left:14px;} .mq-hud-r{right:14px;}
.mq-chip{background:rgba(30,15,5,.62);color:#ffe9b8;font-weight:800;font-size:14px;padding:7px 14px;
  border-radius:999px;border:1px solid rgba(255,210,120,.45);backdrop-filter:blur(4px);}
.mq-hearts{letter-spacing:1px;font-size:12px;}
.mq-icon{width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,210,120,.45);
  background:rgba(30,15,5,.62);color:#ffe9b8;font-size:14px;cursor:pointer;font-weight:700;}
.mq-prog{position:absolute;top:60px;left:50%;transform:translateX(-50%);width:min(460px,76vw);z-index:4;}
.mq-prog-top{display:flex;justify-content:space-between;font-size:11px;color:#ffe9b8;
  margin-bottom:4px;text-shadow:0 1px 3px rgba(0,0,0,.6);font-weight:700;}
.mq-prog-bar{height:9px;border-radius:999px;background:rgba(30,15,5,.6);overflow:hidden;
  border:1px solid rgba(255,210,120,.4);}
.mq-prog-bar i{display:block;height:100%;border-radius:999px;
  background:linear-gradient(90deg,#ffd54f,#ff9800);transition:width .2s linear;}
.mq-help{position:absolute;bottom:12px;left:50%;transform:translateX(-50%);z-index:4;
  background:rgba(30,15,5,.55);color:#ffe9b8;font-size:12px;padding:7px 16px;border-radius:999px;
  border:1px solid rgba(255,210,120,.3);white-space:nowrap;}
.mq-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:rgba(20,8,0,.66);backdrop-filter:blur(5px);padding:16px;z-index:5;}
.mq-overlay.mq-start{padding:0;background:#1b0e05;justify-content:flex-start;align-items:center;}
.mq-scene{position:absolute;inset:0;overflow:hidden;}
.mq-scene-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:72% center;
  animation:mqKen 26s ease-in-out infinite alternate;}
@keyframes mqKen{from{transform:scale(1.03)}to{transform:scale(1.09)}}
.mq-scene::after{content:'';position:absolute;inset:0;z-index:2;
  background:radial-gradient(120% 90% at 78% 45%, rgba(255,190,90,.20), transparent 55%),
             linear-gradient(90deg, rgba(20,8,0,.92) 0%, rgba(20,8,0,.80) 30%, rgba(20,8,0,.30) 48%, rgba(20,8,0,0) 62%, rgba(20,8,0,.18) 100%);}
.mq-sparkles{position:absolute;inset:0;z-index:2;pointer-events:none;}
.mq-sparkles i{position:absolute;width:6px;height:6px;border-radius:50%;
  background:radial-gradient(circle,#fff6cf,rgba(255,214,120,0));
  animation-name:mqTwinkle;animation-iteration-count:infinite;animation-timing-function:ease-in-out;}
@keyframes mqTwinkle{0%,100%{opacity:0;transform:scale(.5)}50%{opacity:.95;transform:scale(1.5)}}
.mq-plaque{position:absolute;z-index:3;left:41%;top:26%;width:21%;min-width:210px;max-width:300px;
  animation:mqPlaque 3.4s ease-in-out infinite;}
@keyframes mqPlaque{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.mq-plaque-in{display:flex;flex-direction:column;align-items:center;text-align:center;padding:12px 16px;
  border-radius:12px;border:2px solid #d9a441;
  background:linear-gradient(160deg,rgba(60,28,10,.94),rgba(38,17,6,.96));
  box-shadow:0 10px 26px rgba(0,0,0,.5), inset 0 0 0 1px rgba(255,215,140,.25);}
.mq-plaque-top{font-size:12px;color:#f0c987;}
.mq-plaque-name{font-size:clamp(15px,1.7vw,21px);font-weight:800;color:#ffdf9e;margin:2px 0 4px;}
.mq-plaque-sub{font-size:10px;color:#e6c79a;font-style:italic;line-height:1.35;}
.mq-plaque-score{margin-top:6px;font-size:11px;font-weight:700;color:#ffd27a;}
.mq-card{width:min(520px,94vw);text-align:center;padding:28px 24px;border-radius:22px;
  background:linear-gradient(160deg,#fff6e6,#ffe3b8);border:3px solid #e8a33d;
  box-shadow:0 24px 60px rgba(0,0,0,.5);animation:mqPop .45s cubic-bezier(.2,1.1,.35,1) both;}
.mq-win{border-color:#ffcf4d;box-shadow:0 0 0 4px rgba(255,207,77,.25),0 24px 60px rgba(0,0,0,.5);}
@keyframes mqPop{from{opacity:0;transform:scale(.88) translateY(14px)}to{opacity:1;transform:none}}
.mq-om{font-size:26px;color:#c0392b;}
.mq-title{font-size:clamp(20px,4.4vw,30px);font-weight:800;color:#a8321f;margin:4px 0 2px;}
.mq-sub{font-size:14px;font-weight:700;color:#c98a2e;letter-spacing:.6px;text-transform:uppercase;}
.mq-p{color:#6b4a16;font-size:14px;line-height:1.6;margin:14px auto;max-width:400px;}
.mq-keys{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin:12px 0;color:#8a5a1f;font-size:13px;}
.mq-keys b{color:#a8321f;}
.mq-best{color:#a8321f;font-weight:800;margin:8px 0;}
.mq-scoreRow{display:flex;justify-content:center;gap:26px;margin:18px 0 6px;}
.mq-scoreRow div{display:flex;flex-direction:column;}
.mq-scoreRow span{font-size:30px;font-weight:800;color:#a8321f;line-height:1;}
.mq-scoreRow small{font-size:11px;color:#8a5a1f;text-transform:uppercase;letter-spacing:.6px;margin-top:4px;}
.mq-lb{margin:16px auto 4px;max-width:420px;text-align:left;background:rgba(255,255,255,.55);
  border:1px solid #e8c58d;border-radius:14px;padding:12px 14px;}
.mq-lb-h{font-size:13px;font-weight:800;color:#a8321f;text-transform:uppercase;letter-spacing:.6px;
  text-align:center;margin-bottom:8px;}
.mq-lb-n{font-weight:600;color:#b58438;text-transform:none;letter-spacing:0;font-size:11px;}
.mq-lb-msg{font-size:12.5px;color:#8a5a1f;text-align:center;padding:6px 0;}
.mq-lb-retry{margin-left:8px;cursor:pointer;border:1px solid #c0392b;background:#fff;color:#c0392b;
  border-radius:999px;padding:2px 12px;font-size:11px;font-weight:700;}
.mq-lb-scroll{max-height:230px;overflow-y:auto;overflow-x:hidden;}
.mq-lb-scroll::-webkit-scrollbar{width:7px}
.mq-lb-scroll::-webkit-scrollbar-thumb{background:#e8a33d;border-radius:99px}
.mq-lb-t{width:100%;border-collapse:collapse;font-size:13px;color:#6b4a16;}
.mq-lb-t thead th{position:sticky;top:0;background:#fdf1dc;z-index:1;}
.mq-lb-t th{font-size:10.5px;text-transform:uppercase;letter-spacing:.5px;color:#b58438;font-weight:700;
  padding:4px 6px;border-bottom:1px solid #e8c58d;text-align:left;}
.mq-lb-t th:first-child,.mq-lb-t td:first-child{width:34px;text-align:center;}
.mq-lb-t th:nth-child(3),.mq-lb-t td:nth-child(3),
.mq-lb-t th:last-child,.mq-lb-t td:last-child{text-align:right;width:62px;}
.mq-lb-t td{padding:5px 6px;border-bottom:1px solid rgba(232,197,141,.45);}
.mq-lb-t tr.mq-me{background:rgba(232,163,61,.22);}
.mq-you{margin-left:6px;font-size:9.5px;background:#c0392b;color:#fff;padding:1px 6px;border-radius:999px;}
.mq-lb-me{margin-top:8px;text-align:center;font-size:12px;color:#a8321f;}
.mq-btn{margin-top:14px;cursor:pointer;border:none;border-radius:999px;padding:13px 34px;font-size:16px;
  font-weight:800;color:#fff;background:linear-gradient(135deg,#c0392b,#e8a33d);box-shadow:0 8px 20px rgba(0,0,0,.28);}
.mq-btn:hover{filter:brightness(1.08);}
.mq-link{display:block;margin:12px auto 0;background:none;border:none;cursor:pointer;color:#8a5a1f;
  font-size:13px;font-weight:700;text-decoration:underline;}
@media(max-width:1100px){
  .mq-overlay.mq-start{justify-content:center;}
  .mq-plaque{display:none}
  .mq-scene::after{background:linear-gradient(180deg,rgba(20,8,0,.55),rgba(20,8,0,.85))}
}
@media(max-width:640px){.mq-help{font-size:10px;padding:6px 10px;}.mq-chip{font-size:12px;padding:6px 10px;}
  .mq-prog{top:56px;}}
`;
