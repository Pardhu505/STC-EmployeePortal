// GaneshWinners.js
// Grand Ganesh Chaturthi 2026 announcement: the top three Modak Masti champions,
// shown every time someone opens or refreshes the portal.
//
//  * Live top-3 pulled from the leaderboard API (falls back to the known winners)
//  * Animated traditional-dress characters on gold / silver / bronze podiums
//  * Ganesha blessing scene behind, falling petals, confetti, diya glow
//  * Dismissible, with a slim top banner to reopen it any time

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/api';

// Announced winners - used until the API responds, and if it ever fails.
const FALLBACK = [
  { rank: 1, name: 'Kolati Vidya',      modaks: 3281, score: 105085, gender: 'female' },
  { rank: 2, name: 'Gatika Akhil varma', modaks: 2045, score: 81634, gender: 'male' },
  { rank: 3, name: 'Avanish Kumar',     modaks: 1143, score: 37788, gender: 'male' },
];
const MEDALS = {
  1: { emoji: '🥇', label: 'Gold',   ring: '#ffd24a', deep: '#c9971a', h: 118 },
  2: { emoji: '🥈', label: 'Silver', ring: '#d8dde3', deep: '#98a1ab', h: 86 },
  3: { emoji: '🥉', label: 'Bronze', ring: '#e2a172', deep: '#a9632f', h: 66 },
};

/* ---- traditional-dress characters, drawn as SVG so no extra art is needed ---- */
function Devotee({ gender, accent }) {
  const skin = '#f2c9a0', hair = '#2b1a12';
  const cloth = gender === 'female' ? '#e0457b' : '#f2f0e6';
  const drape = gender === 'female' ? '#ffb300' : '#d84315';
  return (
    <svg className="gw-fig" viewBox="0 0 120 190" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="60" cy="184" rx="30" ry="5" fill="rgba(0,0,0,.28)" />
      {/* body / garment */}
      {gender === 'female' ? (
        <path d="M60 78 C40 84 30 120 26 178 L94 178 C90 120 80 84 60 78 Z" fill={cloth} />
      ) : (
        <path d="M60 78 C44 82 38 110 36 132 L84 132 C82 110 76 82 60 78 Z" fill={cloth} />
      )}
      {gender === 'male' && <path d="M36 132 L84 132 L88 178 L32 178 Z" fill="#fff8e1" />}
      {/* drape / dupatta */}
      <path d={gender === 'female'
        ? 'M60 80 C74 92 82 120 86 160 L96 158 C92 116 82 88 66 78 Z'
        : 'M60 80 C72 90 78 108 80 128 L90 126 C88 104 78 86 66 78 Z'}
        fill={drape} opacity=".95" />
      {/* namaste hands */}
      <path d="M60 92 l-9 22 h18 Z" fill={skin} />
      {/* head */}
      <circle cx="60" cy="58" r="21" fill={skin} />
      {gender === 'female' ? (
        <>
          <path d="M39 56 a21 21 0 0 1 42 0 q-21 -13 -42 0 Z" fill={hair} />
          <path d="M60 79 q16 26 10 60 q-6 8 -12 0 q8 -34 -4 -58 Z" fill={hair} />
          <circle cx="72" cy="86" r="4" fill="#fff8e1" />
          <circle cx="76" cy="96" r="4" fill="#fff8e1" />
          <circle cx="60" cy="43" r="2.6" fill="#c0392b" />
        </>
      ) : (
        <>
          <path d="M39 55 a21 21 0 0 1 42 0 q-21 -15 -42 0 Z" fill={hair} />
          <rect x="57.6" y="40" width="4.8" height="9" rx="2" fill="#c0392b" />
        </>
      )}
      {/* jewellery accent */}
      <circle cx="60" cy="80" r="6" fill={accent} opacity=".9" />
    </svg>
  );
}

export default function GaneshWinners() {
  const { user } = useAuth();
  const [open, setOpen] = useState(true);
  const [winners, setWinners] = useState(FALLBACK);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r = await fetch(`${API_BASE_URL}/api/game/leaderboard?limit=3`, {
        headers: { Authorization: `Bearer ${btoa(JSON.stringify(user))}` },
      });
      if (!r.ok) return;
      const d = await r.json();
      const top = (d.leaderboard || []).slice(0, 3);
      if (top.length === 3) setWinners(top.map(w => ({ ...w, gender: w.gender || 'male' })));
    } catch (e) { /* keep the announced winners */ }
  }, [user]);
  useEffect(() => { load(); }, [load]);

  const order = [2, 1, 3];   // silver, gold, bronze - podium layout

  if (!open) {
    return (
      <>
        <style>{CSS}</style>
        <button className="gw-reopen" onClick={() => setOpen(true)}>
          🏆 <b>Modak Masti Champions</b> <small>Ganesh Chaturthi 2026</small>
        </button>
      </>
    );
  }

  return (
    <div className="gw-overlay" role="dialog" aria-label="Ganesh Chaturthi winners">
      <style>{CSS}</style>
      <img className="gw-bg" src="/festive/scene_female.jpg" alt=""
           onError={(e) => { e.currentTarget.style.display = 'none'; }} />
      <div className="gw-veil" />

      {/* confetti + petals */}
      <div className="gw-fx" aria-hidden="true">
        {Array.from({ length: 30 }).map((_, i) => (
          <i key={i} className={i % 3 === 0 ? 'gw-petal' : 'gw-conf'} style={{
            left: `${(i * 3.4 + (i % 7) * 2) % 100}%`,
            animationDelay: `${(i % 10) * 0.42}s`,
            animationDuration: `${4.4 + (i % 5) * 0.9}s`,
            background: ['#ffcf4d','#ff7f50','#e8a33d','#c0392b','#ffe9a8','#ff8fb1'][i % 6],
          }} />
        ))}
      </div>

      <button className="gw-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>

      <div className="gw-inner">
        <div className="gw-om">॥ ॐ ॥</div>
        <h1 className="gw-title">Ganesh Chaturthi <span>2026</span></h1>
        <div className="gw-sub">🏆 Modak Masti — Champions 🏆</div>
        <p className="gw-bless">
          They helped little Ganesha collect the most modaks.
          May Bappa bless them with <b>health, happiness &amp; prosperity!</b>
        </p>

        <div className="gw-podiums">
          {order.map((rank) => {
            const w = winners.find(x => x.rank === rank) || FALLBACK[rank - 1];
            const m = MEDALS[rank];
            return (
              <div key={rank} className={`gw-slot gw-r${rank}`}>
                <div className="gw-medal" style={{ '--ring': m.ring }}>
                  <span>{m.emoji}</span>
                </div>
                <Devotee gender={w.gender} accent={m.ring} />
                <div className="gw-plinth" style={{ height: m.h, background:
                  `linear-gradient(180deg, ${m.ring}, ${m.deep})` }}>
                  <div className="gw-rank">{rank}</div>
                  <div className="gw-mlabel">{m.label}</div>
                </div>
                <div className="gw-name">{w.name}</div>
                <div className="gw-stats">🍬 {w.modaks} &nbsp;·&nbsp; ⭐ {w.score}</div>
              </div>
            );
          })}
        </div>

        <div className="gw-foot">गणपति बाप्पा मोरया! 🙏 &nbsp;·&nbsp; Team ShowTime Consulting</div>
        <button className="gw-close" onClick={() => setOpen(false)}>Continue to Portal</button>
      </div>
    </div>
  );
}

const CSS = `
.gw-overlay{position:fixed;inset:0;z-index:10040;overflow:auto;
  display:flex;align-items:center;justify-content:center;padding:20px;
  font-family:'Inter','Segoe UI',Tahoma,sans-serif;animation:gwFade .5s ease-out both;}
@keyframes gwFade{from{opacity:0}to{opacity:1}}
.gw-bg{position:fixed;inset:0;width:100%;height:100%;object-fit:cover;object-position:68% center;
  animation:gwKen 30s ease-in-out infinite alternate;}
@keyframes gwKen{from{transform:scale(1.04)}to{transform:scale(1.12)}}
.gw-veil{position:fixed;inset:0;background:
  radial-gradient(90% 70% at 50% 35%, rgba(60,20,0,.30), rgba(20,8,0,.86) 78%);}
.gw-x{position:fixed;top:18px;right:18px;z-index:5;width:40px;height:40px;border-radius:50%;
  border:2px solid #fff;background:rgba(160,40,25,.9);color:#fff;font-size:16px;cursor:pointer;}
.gw-inner{position:relative;z-index:4;text-align:center;max-width:1000px;width:100%;}
.gw-om{font-size:30px;color:#ffd77a;text-shadow:0 2px 10px rgba(0,0,0,.7);}
.gw-title{margin:2px 0 0;font-size:clamp(26px,5vw,46px);font-weight:900;color:#fff3d6;
  letter-spacing:.5px;text-shadow:0 3px 16px rgba(0,0,0,.75);}
.gw-title span{color:#ffcf4d;}
.gw-sub{font-size:clamp(14px,2.2vw,19px);font-weight:800;color:#ffd77a;letter-spacing:2px;
  text-transform:uppercase;margin-top:4px;text-shadow:0 2px 8px rgba(0,0,0,.7);}
.gw-bless{max-width:620px;margin:12px auto 0;color:#f6e4c4;font-size:14px;line-height:1.7;
  text-shadow:0 2px 6px rgba(0,0,0,.7);}
.gw-bless b{color:#ffd77a;}
.gw-podiums{display:flex;align-items:flex-end;justify-content:center;gap:clamp(10px,3vw,46px);
  margin:26px auto 0;flex-wrap:nowrap;}
.gw-slot{display:flex;flex-direction:column;align-items:center;width:clamp(120px,22vw,200px);
  animation:gwRise .8s cubic-bezier(.2,1.1,.35,1) both;}
.gw-r1{animation-delay:.15s} .gw-r2{animation-delay:.35s} .gw-r3{animation-delay:.5s}
@keyframes gwRise{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
.gw-medal{width:clamp(44px,7vw,60px);height:clamp(44px,7vw,60px);border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:clamp(22px,3.6vw,31px);
  background:radial-gradient(circle at 35% 30%, #fff, var(--ring));
  box-shadow:0 0 0 4px rgba(255,255,255,.22), 0 8px 20px rgba(0,0,0,.45);
  margin-bottom:6px;animation:gwSpin 3.4s ease-in-out infinite;}
@keyframes gwSpin{0%,100%{transform:translateY(0) rotate(-6deg)}50%{transform:translateY(-8px) rotate(6deg)}}
.gw-fig{width:clamp(74px,13vw,118px);height:auto;filter:drop-shadow(0 8px 14px rgba(0,0,0,.45));
  animation:gwBob 2.6s ease-in-out infinite;}
@keyframes gwBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
.gw-plinth{width:100%;border-radius:10px 10px 4px 4px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;color:#3a2408;
  box-shadow:inset 0 2px 0 rgba(255,255,255,.55), 0 10px 26px rgba(0,0,0,.5);}
.gw-rank{font-size:clamp(20px,3.4vw,30px);font-weight:900;line-height:1;}
.gw-mlabel{font-size:10px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;opacity:.8;}
.gw-name{margin-top:10px;font-size:clamp(13px,1.9vw,18px);font-weight:800;color:#fff3d6;
  text-shadow:0 2px 8px rgba(0,0,0,.75);line-height:1.25;}
.gw-stats{font-size:11.5px;color:#ffd77a;margin-top:3px;text-shadow:0 1px 5px rgba(0,0,0,.8);}
.gw-foot{margin-top:24px;font-size:13px;font-weight:700;color:#ffd77a;
  text-shadow:0 2px 8px rgba(0,0,0,.8);}
.gw-close{margin:16px auto 0;cursor:pointer;border:2px solid rgba(255,255,255,.5);border-radius:999px;
  padding:11px 30px;font-size:14px;font-weight:800;color:#fff;
  background:linear-gradient(135deg,#c0392b,#e8a33d);box-shadow:0 10px 24px rgba(0,0,0,.4);}
.gw-close:hover{filter:brightness(1.1);}
.gw-fx{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:3;}
.gw-fx i{position:absolute;top:-16px;animation-name:gwFall;animation-timing-function:linear;
  animation-iteration-count:infinite;}
.gw-conf{width:9px;height:15px;border-radius:2px;opacity:.9;}
.gw-petal{width:11px;height:8px;border-radius:60% 40% 55% 45%;opacity:.85;}
@keyframes gwFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(106vh) rotate(700deg)}}
.gw-reopen{position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9991;cursor:pointer;
  display:flex;align-items:center;gap:8px;padding:9px 20px;border-radius:0 0 16px 16px;
  border:1px solid rgba(255,215,150,.55);border-top:none;color:#fff;
  background:linear-gradient(135deg,rgba(192,57,43,.72),rgba(232,163,61,.72));
  backdrop-filter:blur(8px);box-shadow:0 8px 22px rgba(0,0,0,.3);
  font-family:'Inter','Segoe UI',Tahoma,sans-serif;font-size:13px;}
.gw-reopen b{font-weight:800;} .gw-reopen small{opacity:.9;font-size:10.5px;}
.gw-reopen:hover{filter:brightness(1.1);}
@media(max-width:760px){
  .gw-podiums{gap:6px}
  .gw-bless{font-size:12.5px}
  .gw-slot{width:30vw}
}
@media(prefers-reduced-motion:reduce){
  .gw-bg,.gw-slot,.gw-medal,.gw-fig{animation:none!important}
  .gw-fx{display:none}
}
`;
