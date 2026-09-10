// GaneshChaturthi.js
// Before the festival : Ganesha stands at the bottom-right with a step/bob
//                       rhythm, an animated deepam beside him, and a
//                       highlighted countdown that updates itself.
// On the festival day  : the countdown stops and a full Hindu-style greeting
//                       card is shown to everyone (dismissible).
// After the festival   : nothing renders.
//
// Image: public/festive/ganesha_walking.png (transparent PNG)

import React, { useEffect, useState } from 'react';

const FESTIVAL_DATE = new Date('2026-09-14T00:00:00+05:30'); // Ganesh Chaturthi 2026 (IST)
const SHOW_WITHIN_DAYS = 15;

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

const STYLES = `
  /* ===== corner Ganesha (countdown mode) ===== */
  #gc-corner {
    position: fixed; right: 18px; bottom: 16px; z-index: 9998;
    display: flex; align-items: flex-end; gap: 10px;
    pointer-events: none;
  }
  #gc-walker {
    display: flex; flex-direction: column; align-items: center;
    animation: gcStep .62s ease-in-out infinite;
    transform-origin: 50% 100%;
  }
  .gc-img {
    width: 190px; height: auto; display: block;
    filter: drop-shadow(0 12px 16px rgba(0,0,0,.30));
    animation: gcLean .62s ease-in-out infinite;
    transform-origin: 50% 100%;
  }
  .gc-shadow {
    width: 120px; height: 12px; margin-top: -8px;
    background: radial-gradient(ellipse at center, rgba(0,0,0,.28), rgba(0,0,0,0) 70%);
    animation: gcShadow .62s ease-in-out infinite;
  }
  .gc-bubble {
    background: linear-gradient(135deg,#ff8a00,#ffc36b);
    color:#fff; font-weight:700; font-size:14px; line-height:1;
    padding:9px 16px; border-radius:999px; white-space:nowrap;
    box-shadow:0 6px 18px rgba(0,0,0,.25); margin-bottom:10px;
    border:2px solid rgba(255,255,255,.55);
    animation: gcBounce 1.6s ease-in-out infinite;
    font-family:'Inter','Segoe UI',Tahoma,sans-serif;
  }
  .gc-count {
    display:inline-block; background:#fff; color:#d35400;
    font-weight:800; border-radius:999px; padding:2px 10px; margin:0 4px;
  }

  /* ===== animated deepam (oil lamp) ===== */
  .gc-deepam { width: 74px; margin-bottom: 6px; }
  .gc-flame  { transform-origin: 50% 100%; animation: gcFlame 1.1s ease-in-out infinite; }
  .gc-glow   { animation: gcGlow 1.1s ease-in-out infinite; transform-origin: center; }

  @keyframes gcFlame {
    0%,100% { transform: scale(1) rotate(-3deg); }
    35%     { transform: scale(1.12,.92) rotate(3deg); }
    70%     { transform: scale(.94,1.1) rotate(-1deg); }
  }
  @keyframes gcGlow {
    0%,100% { opacity:.40; transform: scale(1); }
    50%     { opacity:.75; transform: scale(1.18); }
  }
  @keyframes gcStep {
    0%,100% { transform: translateY(0); }
    25%     { transform: translateY(-8px); }
    50%     { transform: translateY(0); }
    75%     { transform: translateY(-6px); }
  }
  @keyframes gcLean {
    0%,100% { transform: rotate(-2.2deg); }
    50%     { transform: rotate(2.2deg); }
  }
  @keyframes gcShadow {
    0%,100% { transform: scaleX(1);   opacity:.30; }
    25%     { transform: scaleX(.76); opacity:.16; }
    75%     { transform: scaleX(.86); opacity:.22; }
  }
  @keyframes gcBounce {
    0%,100% { transform: translateY(0); }
    50%     { transform: translateY(-5px); }
  }

  /* ===== festival-day greeting card ===== */
  #gc-greet {
    position: fixed; inset: 0; z-index: 10000;
    background: rgba(20,8,0,.62); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; padding: 16px;
    animation: gcFade .5s ease-out both;
  }
  .gc-card {
    position: relative; width: min(560px, 96vw);
    background: linear-gradient(160deg,#fff6e6 0%,#ffe9c7 55%,#ffdca8 100%);
    border-radius: 22px; padding: 30px 24px 22px; text-align: center;
    box-shadow: 0 24px 60px rgba(0,0,0,.45);
    border: 3px solid #e8a33d; overflow: hidden;
    animation: gcPop .55s cubic-bezier(.2,1.1,.35,1) both;
    font-family:'Inter','Segoe UI',Tahoma,sans-serif;
  }
  .gc-toran {
    position:absolute; top:0; left:0; right:0; height:16px;
    background: repeating-linear-gradient(90deg,#e8a33d 0 10px,#c0392b 10px 20px);
  }
  .gc-om { font-size: 30px; color:#c0392b; margin-top:6px; }
  .gc-title {
    font-size: clamp(22px,5vw,32px); font-weight: 800; color:#a8321f;
    margin: 6px 0 2px; letter-spacing:.3px;
  }
  .gc-sub { font-size: 15px; color:#8a5a1f; font-weight:600; }
  .gc-shloka {
    margin: 14px auto 4px; max-width: 420px; font-size: 14px; line-height:1.6;
    color:#6b4a16; font-style: italic;
  }
  .gc-greetimg { width: 170px; margin: 6px auto 2px; display:block;
                 filter: drop-shadow(0 10px 16px rgba(0,0,0,.25));
                 animation: gcFloat 2.6s ease-in-out infinite; }
  .gc-from { margin-top: 14px; font-size: 13px; color:#8a5a1f; font-weight:700; }
  .gc-close {
    margin-top: 16px; pointer-events:auto; cursor:pointer;
    background: linear-gradient(135deg,#c0392b,#e8a33d); color:#fff;
    border:none; border-radius:999px; padding:10px 26px;
    font-weight:700; font-size:14px; box-shadow:0 6px 16px rgba(0,0,0,.25);
  }
  .gc-close:hover { filter: brightness(1.07); }

  @keyframes gcFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes gcPop   { from{opacity:0; transform:scale(.86) translateY(14px)} to{opacity:1; transform:scale(1) translateY(0)} }
  @keyframes gcFade  { from{opacity:0} to{opacity:1} }

  @media (max-width: 640px) {
    .gc-img { width: 130px; }
    .gc-shadow { width: 84px; }
    .gc-deepam { width: 54px; }
    .gc-bubble { font-size: 12px; padding: 7px 12px; }
  }
  @media (prefers-reduced-motion: reduce) {
    #gc-walker,.gc-img,.gc-shadow,.gc-bubble,.gc-flame,.gc-glow,.gc-greetimg,.gc-card { animation: none !important; }
  }
`;

/* animated oil lamp, drawn inline so there's no extra image to ship */
function Deepam() {
  return (
    <svg className="gc-deepam" viewBox="0 0 100 110" xmlns="http://www.w3.org/2000/svg">
      <ellipse className="gc-glow" cx="50" cy="46" rx="26" ry="30" fill="#ffb347" opacity=".5" />
      <g className="gc-flame">
        <path d="M50 20 C58 34, 63 40, 63 50 a13 13 0 0 1-26 0 c0-10, 5-16, 13-30z" fill="#ff9800" />
        <path d="M50 32 C55 42, 57 45, 57 51 a7 7 0 0 1-14 0 c0-6, 2-9, 7-19z" fill="#ffe082" />
      </g>
      <rect x="48.5" y="60" width="3" height="8" rx="1.5" fill="#6d4c41" />
      <path d="M18 70 q32 20, 64 0 q-6 22, -32 22 q-26 0, -32-22z" fill="#d4a017" />
      <path d="M18 70 q32 12, 64 0 q-32 8, -64 0z" fill="#f0c04a" />
      <ellipse cx="50" cy="94" rx="26" ry="5" fill="#8a5a1f" opacity=".45" />
    </svg>
  );
}

export default function GaneshChaturthi() {
  const [days, setDays] = useState(() => daysUntil(FESTIVAL_DATE));
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setDays(daysUntil(FESTIVAL_DATE)), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (days < 0 || days > SHOW_WITHIN_DAYS) return null;

  /* ---------- festival day: greeting card ---------- */
  if (days === 0) {
    if (dismissed) return null;
    return (
      <>
        <style>{STYLES}</style>
        <div id="gc-greet" role="dialog" aria-label="Ganesh Chaturthi greetings">
          <div className="gc-card">
            <div className="gc-toran" />
            <div className="gc-om">॥ ॐ ॥</div>
            <img src="/festive/ganesha_walking.png" alt="Lord Ganesha" className="gc-greetimg"
                 onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <div className="gc-title">Happy Ganesh Chaturthi!</div>
            <div className="gc-sub">गणपति बाप्पा मोरया! 🙏</div>
            <div className="gc-shloka">
              वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ।<br />
              निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा॥
            </div>
            <div className="gc-sub" style={{ marginTop: 8 }}>
              May Lord Ganesha remove every obstacle and bless you with
              wisdom, prosperity and happiness.
            </div>
            <div className="gc-from">— Team ShowTime Consulting</div>
            <button className="gc-close" onClick={() => setDismissed(true)}>Close</button>
          </div>
        </div>
      </>
    );
  }

  /* ---------- countdown mode: corner Ganesha + deepam ---------- */
  return (
    <>
      <style>{STYLES}</style>
      <div id="gc-corner" aria-hidden="true">
        <Deepam />
        <div id="gc-walker">
          <div className="gc-bubble">
            {days === 1 ? (
              <>🎉 Ganesh Chaturthi is <span className="gc-count">Tomorrow</span> 🙏</>
            ) : (
              <>🎉 Ganesh Chaturthi in <span className="gc-count">{days}</span> Days 🙏</>
            )}
          </div>
          <img src="/festive/ganesha_walking.png" alt="Lord Ganesha" className="gc-img"
               onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <div className="gc-shadow" />
        </div>
      </div>
    </>
  );
}
