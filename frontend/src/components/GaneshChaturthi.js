// GaneshChaturthi.js
// Festive overlay: Lord Ganesha walks across the bottom of every page with a
// highlighted countdown to Ganesh Chaturthi (14 Sep 2026). The day number
// updates by itself and the whole thing disappears after the festival day.
//
// Image: public/festive/ganesha_walking.png  (transparent PNG)
// The image is a still, so the "walking" is built from motion: a step-bob,
// a slight body sway and a lean, layered on top of the slide across screen.

import React, { useEffect, useState } from 'react';

const FESTIVAL_DATE = new Date('2026-09-14T00:00:00+05:30'); // Ganesh Chaturthi 2026 (IST)
const SHOW_WITHIN_DAYS = 15;   // start showing this many days before

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export default function GaneshChaturthi() {
  const [days, setDays] = useState(() => daysUntil(FESTIVAL_DATE));

  useEffect(() => {
    const id = setInterval(() => setDays(daysUntil(FESTIVAL_DATE)), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (days < 0 || days > SHOW_WITHIN_DAYS) return null;

  const isToday = days === 0;
  const isTomorrow = days === 1;

  return (
    <>
      <style>{`
        /* track: carries Ganesha left -> right -> back, flipping at each end */
        #gc-track {
          position: fixed; bottom: 14px; left: 0; z-index: 9998;
          pointer-events: none; will-change: transform;
          animation: gcCross 26s linear infinite;
        }
        /* inner: the step rhythm (bob + sway), independent of the crossing */
        #gc-walker {
          display: flex; flex-direction: column; align-items: center;
          animation: gcStep .62s ease-in-out infinite;
          transform-origin: 50% 100%;
        }
        .gc-img {
          width: 132px; height: auto; display: block;
          filter: drop-shadow(0 10px 14px rgba(0,0,0,.30));
          animation: gcLean .62s ease-in-out infinite;
          transform-origin: 50% 100%;
        }
        /* soft contact shadow that squashes with each step */
        .gc-shadow {
          width: 90px; height: 10px; margin-top: -6px;
          background: radial-gradient(ellipse at center, rgba(0,0,0,.28), rgba(0,0,0,0) 70%);
          animation: gcShadow .62s ease-in-out infinite;
        }
        .gc-bubble {
          background: linear-gradient(135deg, #ff8a00, #ffc36b);
          color: #fff; font-weight: 700; font-size: 14px; line-height: 1;
          padding: 9px 16px; border-radius: 999px; white-space: nowrap;
          box-shadow: 0 6px 18px rgba(0,0,0,.25);
          margin-bottom: 10px; animation: gcBounce 1.6s ease-in-out infinite;
          font-family: 'Inter','Segoe UI',Tahoma,sans-serif;
          border: 2px solid rgba(255,255,255,.55);
        }
        .gc-count {
          display: inline-block; background: #fff; color: #d35400;
          font-weight: 800; border-radius: 999px; padding: 2px 10px; margin: 0 4px;
        }
        @keyframes gcCross {
          0%   { transform: translateX(-260px) scaleX(1); }
          47%  { transform: translateX(calc(100vw + 60px)) scaleX(1); }
          50%  { transform: translateX(calc(100vw + 60px)) scaleX(-1); }
          97%  { transform: translateX(-260px) scaleX(-1); }
          100% { transform: translateX(-260px) scaleX(1); }
        }
        /* up-down of the body = footfall rhythm */
        @keyframes gcStep {
          0%,100% { transform: translateY(0); }
          25%     { transform: translateY(-7px); }
          50%     { transform: translateY(0); }
          75%     { transform: translateY(-5px); }
        }
        /* subtle lean forward/back so it doesn't look like a floating sticker */
        @keyframes gcLean {
          0%,100% { transform: rotate(-2.2deg); }
          50%     { transform: rotate(2.2deg); }
        }
        @keyframes gcShadow {
          0%,100% { transform: scaleX(1);   opacity:.30; }
          25%     { transform: scaleX(.78); opacity:.18; }
          75%     { transform: scaleX(.85); opacity:.22; }
        }
        @keyframes gcBounce {
          0%,100% { transform: translateY(0); }
          50%     { transform: translateY(-5px); }
        }
        @media (max-width: 640px) {
          .gc-img { width: 92px; }
          .gc-bubble { font-size: 12px; padding: 7px 12px; }
          .gc-shadow { width: 64px; }
        }
        /* accessibility: park it quietly instead of animating */
        @media (prefers-reduced-motion: reduce) {
          #gc-track { animation: none; transform: translateX(16px); }
          #gc-walker, .gc-img, .gc-shadow, .gc-bubble { animation: none; }
        }
      `}</style>

      <div id="gc-track" aria-hidden="true">
        <div id="gc-walker">
          <div className="gc-bubble">
            {isToday ? (
              <>🎉 Happy Ganesh Chaturthi! 🙏</>
            ) : isTomorrow ? (
              <>🎉 Ganesh Chaturthi is <span className="gc-count">Tomorrow</span> 🙏</>
            ) : (
              <>🎉 Ganesh Chaturthi in <span className="gc-count">{days}</span> Days 🙏</>
            )}
          </div>
          <img
            src="/festive/ganesha_walking.png"
            alt="Lord Ganesha"
            className="gc-img"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="gc-shadow" />
        </div>
      </div>
    </>
  );
}
