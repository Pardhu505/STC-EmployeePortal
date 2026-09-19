// FestivalQuests.js
// "ShowTime Festival Game Quests" — a permanent hall of fame for the games we
// run at festivals. An animated 3D trophy sits on the portal; opening it shows
// the winners of each quest.
//
// ADDING A FUTURE FESTIVAL: append an object to QUESTS below. Winner photos go
// in public/festive/ and are referenced by `art`. Nothing else needs changing.

import React, { useState } from 'react';

const QUESTS = [
  {
    id: 'ganesh-2026',
    festival: 'Ganesh Chaturthi',
    year: '2026',
    game: 'Modak Masti',
    tagline: 'Run · Collect · Spread Happiness',
    icon: '🐘',
    players: 47,
    blurb: 'Little Ganesha ran the festival route collecting modaks. 47 colleagues played — these three collected the most.',
    winners: [
      { rank: 1, name: 'Kolati Vidya',       modaks: 3281, score: 105085, art: '/festive/winner1.png' },
      { rank: 2, name: 'Gatika Akhil varma', modaks: 2045, score: 81634,  art: '/festive/winner2.png' },
      { rank: 3, name: 'Avanish Kumar',      modaks: 1143, score: 37788,  art: '/festive/winner3.png' },
    ],
  },
  // Next festival quest goes here 👇
];

const MEDALS = {
  1: { emoji: '🥇', label: 'Gold',   ring: '#ffd24a', deep: '#c9971a', h: 96 },
  2: { emoji: '🥈', label: 'Silver', ring: '#d8dde3', deep: '#98a1ab', h: 72 },
  3: { emoji: '🥉', label: 'Bronze', ring: '#e2a172', deep: '#a9632f', h: 56 },
};

export default function FestivalQuests() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const quest = QUESTS[active] || QUESTS[0];
  const order = [2, 1, 3];

  return (
    <>
      <style>{CSS}</style>

      {/* animated 3D quest icon */}
      <button className="fq-launch" onClick={() => setOpen(true)}
              title="ShowTime Festival Game Quests">
        <span className="fq-cube" aria-hidden="true">
          <span className="fq-face fq-f1">🏆</span>
          <span className="fq-face fq-f2">🎮</span>
          <span className="fq-face fq-f3">🪔</span>
          <span className="fq-face fq-f4">🎉</span>
        </span>
        <span className="fq-launch-txt">
          <b>Festival Game Quests</b>
          <small>Hall of Champions</small>
        </span>
      </button>

      {open && (
        <div className="fq-overlay" role="dialog" aria-label="Festival Game Quests">
          <div className="fq-modal">
            <button className="fq-x" onClick={() => setOpen(false)} aria-label="Close">✕</button>

            <div className="fq-head">
              <div className="fq-badge">🏆</div>
              <h2 className="fq-title">ShowTime <span>Festival Game Quests</span></h2>
              <p className="fq-sub">Hall of Champions — our festival game winners</p>
            </div>

            {QUESTS.length > 1 && (
              <div className="fq-tabs">
                {QUESTS.map((q, i) => (
                  <button key={q.id} className={i === active ? 'fq-tab on' : 'fq-tab'}
                          onClick={() => setActive(i)}>
                    {q.icon} {q.festival} {q.year}
                  </button>
                ))}
              </div>
            )}

            <div className="fq-event">
              <div className="fq-ev-title">
                {quest.icon} {quest.festival} {quest.year} — <b>{quest.game}</b>
              </div>
              <div className="fq-ev-tag">{quest.tagline} · {quest.players} players</div>
              <p className="fq-ev-blurb">{quest.blurb}</p>
            </div>

            <div className="fq-podiums">
              {order.map((rank) => {
                const w = quest.winners.find(x => x.rank === rank);
                const m = MEDALS[rank];
                if (!w) return null;
                return (
                  <div key={rank} className={`fq-slot fq-s${rank}`}>
                    <div className="fq-medal" style={{ '--ring': m.ring }}>{m.emoji}</div>
                    <img className="fq-art" src={w.art} alt={w.name}
                         onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                    <div className="fq-plinth" style={{ height: m.h,
                         background: `linear-gradient(180deg, ${m.ring}, ${m.deep})` }}>
                      <span className="fq-rank">{rank}</span>
                      <span className="fq-mlabel">{m.label}</span>
                    </div>
                    <div className="fq-name">{w.name}</div>
                    <div className="fq-score">🍬 {w.modaks} · ⭐ {w.score}</div>
                  </div>
                );
              })}
            </div>

            <div className="fq-foot">
              More festival quests coming soon — watch this space! 🎊
            </div>
            <button className="fq-close" onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
/* ---------- floating 3D launcher ---------- */
.fq-launch{position:fixed;right:20px;bottom:22px;z-index:9993;cursor:pointer;
  display:flex;align-items:center;gap:11px;padding:10px 18px 10px 12px;border-radius:999px;
  border:2px solid rgba(255,215,150,.6);color:#fff;
  background:linear-gradient(135deg,#6a1b9a,#c0392b 55%,#e8a33d);
  box-shadow:0 12px 28px rgba(0,0,0,.38);
  font-family:'Inter','Segoe UI',Tahoma,sans-serif;
  animation:fqFloat 3.4s ease-in-out infinite;}
.fq-launch:hover{filter:brightness(1.1);transform:translateY(-2px);}
@keyframes fqFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.fq-launch-txt{display:flex;flex-direction:column;align-items:flex-start;line-height:1.2;text-align:left;}
.fq-launch-txt b{font-size:13.5px;font-weight:800;}
.fq-launch-txt small{font-size:10px;opacity:.92;font-weight:600;}
/* spinning cube of festival icons */
.fq-cube{position:relative;width:34px;height:34px;transform-style:preserve-3d;
  animation:fqSpin 7s linear infinite;}
@keyframes fqSpin{from{transform:rotateY(0)}to{transform:rotateY(360deg)}}
.fq-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-size:21px;backface-visibility:hidden;}
.fq-f1{transform:rotateY(0deg) translateZ(17px);}
.fq-f2{transform:rotateY(90deg) translateZ(17px);}
.fq-f3{transform:rotateY(180deg) translateZ(17px);}
.fq-f4{transform:rotateY(270deg) translateZ(17px);}

/* ---------- modal ---------- */
.fq-overlay{position:fixed;inset:0;z-index:10080;display:flex;align-items:flex-start;
  justify-content:center;overflow-y:auto;padding:16px;background:rgba(18,8,0,.74);
  backdrop-filter:blur(6px);font-family:'Inter','Segoe UI',Tahoma,sans-serif;
  animation:fqFade .4s ease-out both;}
@keyframes fqFade{from{opacity:0}to{opacity:1}}
.fq-modal{position:relative;margin:auto;width:min(880px,96vw);border-radius:22px;padding:26px 24px 22px;
  text-align:center;background:linear-gradient(170deg,#fff7ea 0%,#ffe9c7 60%,#ffdca8 100%);
  border:3px solid #e8a33d;box-shadow:0 26px 70px rgba(0,0,0,.6);
  animation:fqPop .5s cubic-bezier(.2,1.1,.35,1) both;}
@keyframes fqPop{from{opacity:0;transform:scale(.9) translateY(18px)}to{opacity:1;transform:none}}
.fq-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;
  border:2px solid rgba(255,255,255,.8);background:rgba(160,40,25,.85);color:#fff;
  font-size:14px;font-weight:700;cursor:pointer;}
.fq-badge{font-size:34px;animation:fqBob 2.8s ease-in-out infinite;}
@keyframes fqBob{0%,100%{transform:translateY(0) rotate(-5deg)}50%{transform:translateY(-7px) rotate(5deg)}}
.fq-title{margin:2px 0 0;font-size:clamp(20px,3.4vw,30px);font-weight:900;color:#a8321f;}
.fq-title span{color:#d35400;background:linear-gradient(90deg,#d35400,#e8a33d,#d35400);
  background-size:200% auto;-webkit-background-clip:text;background-clip:text;
  -webkit-text-fill-color:transparent;animation:fqShine 3.6s linear infinite;}
@keyframes fqShine{to{background-position:200% center}}
.fq-sub{font-size:12.5px;font-weight:700;color:#b58438;letter-spacing:.7px;
  text-transform:uppercase;margin-top:4px;}
.fq-tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:14px 0 2px;}
.fq-tab{cursor:pointer;border:2px solid #e8c58d;background:#fff;color:#8a5a1f;border-radius:999px;
  padding:6px 16px;font-size:12.5px;font-weight:700;}
.fq-tab.on{background:linear-gradient(135deg,#c0392b,#e8a33d);color:#fff;border-color:transparent;}
.fq-event{margin-top:14px;}
.fq-ev-title{font-size:clamp(15px,2.2vw,19px);font-weight:800;color:#a8321f;}
.fq-ev-tag{font-size:11.5px;font-weight:700;color:#b58438;text-transform:uppercase;
  letter-spacing:.8px;margin-top:3px;}
.fq-ev-blurb{max-width:560px;margin:10px auto 0;font-size:13px;line-height:1.6;color:#6b4a16;}
.fq-podiums{display:flex;align-items:flex-end;justify-content:center;gap:clamp(8px,2.6vw,34px);
  margin:18px auto 0;}
.fq-slot{display:flex;flex-direction:column;align-items:center;width:clamp(96px,20vw,180px);
  animation:fqRise .7s cubic-bezier(.2,1.1,.35,1) both;}
.fq-s1{animation-delay:.1s} .fq-s2{animation-delay:.25s} .fq-s3{animation-delay:.4s}
@keyframes fqRise{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
.fq-medal{width:clamp(34px,5vw,46px);height:clamp(34px,5vw,46px);border-radius:50%;
  display:flex;align-items:center;justify-content:center;font-size:clamp(17px,2.8vw,24px);
  background:radial-gradient(circle at 35% 30%, #fff, var(--ring));
  box-shadow:0 0 0 4px rgba(255,255,255,.35), 0 6px 16px rgba(0,0,0,.28);margin-bottom:5px;
  animation:fqBob 3.2s ease-in-out infinite;}
.fq-art{height:clamp(96px,17vh,168px);width:auto;object-fit:contain;
  filter:drop-shadow(0 8px 14px rgba(0,0,0,.32));animation:fqFloat 2.8s ease-in-out infinite;}
.fq-s1 .fq-art{height:clamp(112px,20vh,196px);}
.fq-plinth{width:100%;border-radius:10px 10px 4px 4px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;color:#3a2408;
  box-shadow:inset 0 2px 0 rgba(255,255,255,.55), 0 8px 20px rgba(0,0,0,.3);}
.fq-rank{font-size:clamp(17px,3vw,26px);font-weight:900;line-height:1;}
.fq-mlabel{font-size:9.5px;font-weight:800;letter-spacing:1.3px;text-transform:uppercase;opacity:.82;}
.fq-name{margin-top:8px;font-size:clamp(12px,1.7vw,15.5px);font-weight:800;color:#a8321f;line-height:1.25;}
.fq-score{font-size:11px;color:#8a5a1f;margin-top:2px;font-weight:600;}
.fq-foot{margin-top:20px;font-size:12.5px;font-weight:700;color:#b58438;}
.fq-close{margin-top:12px;cursor:pointer;border:none;border-radius:999px;padding:11px 30px;
  font-size:14px;font-weight:800;color:#fff;background:linear-gradient(135deg,#c0392b,#e8a33d);
  box-shadow:0 8px 20px rgba(0,0,0,.28);}
.fq-close:hover{filter:brightness(1.08);}
@media(max-width:640px){
  .fq-launch{right:12px;bottom:14px;padding:8px 14px 8px 10px;}
  .fq-launch-txt b{font-size:12px} .fq-launch-txt small{display:none}
  .fq-modal{padding:20px 14px 18px;}
  .fq-podiums{gap:4px}
}
@media(prefers-reduced-motion:reduce){
  .fq-launch,.fq-cube,.fq-badge,.fq-art,.fq-medal,.fq-slot,.fq-modal,.fq-title span{animation:none!important}
}
`;
