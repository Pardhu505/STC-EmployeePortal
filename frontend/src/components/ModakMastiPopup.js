// ModakMastiPopup.js
// Grand Ganesh Chaturthi welcome popup. Appears once per day when an employee
// opens the portal, dims everything behind it, and launches Modak Quest
// full-screen from "Play Now". "Maybe Later" dismisses it for the day.

import React, { useEffect, useState } from 'react';
import ModakQuest from './ModakQuest';

const FESTIVAL_DATE = new Date('2026-09-14T00:00:00+05:30');
const SHOW_WITHIN_DAYS = 15;           // show in the run-up and on the day
const SEEN_KEY = 'modakMastiSeen';     // stores the date it was last shown

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}
const todayKey = () => new Date().toISOString().slice(0, 10);

export default function ModakMastiPopup() {
  const [show, setShow] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const d = daysUntil(FESTIVAL_DATE);
    if (d < 0 || d > SHOW_WITHIN_DAYS) return;
    let seen = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch (e) {}
    if (seen !== todayKey()) {
      const t = setTimeout(() => setShow(true), 700);   // let the dashboard paint first
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(SEEN_KEY, todayKey()); } catch (e) {}
    setShow(false);
  };
  const play = () => {
    try { localStorage.setItem(SEEN_KEY, todayKey()); } catch (e) {}
    setShow(false); setPlaying(true);
  };

  if (playing) return <ModakQuest onClose={() => setPlaying(false)} />;
  if (!show) return null;

  const days = daysUntil(FESTIVAL_DATE);

  return (
    <div className="mm-overlay" role="dialog" aria-label="Modak Masti invitation">
      <style>{CSS}</style>

      {/* confetti */}
      <div className="mm-confetti" aria-hidden="true">
        {Array.from({ length: 26 }).map((_, i) => (
          <i key={i} style={{
            left: `${(i * 3.9 + (i % 5) * 2) % 100}%`,
            animationDelay: `${(i % 9) * 0.45}s`,
            animationDuration: `${4.5 + (i % 5)}s`,
            background: ['#ffcf4d', '#ff7f50', '#e8a33d', '#c0392b', '#ffe9a8'][i % 5],
          }} />
        ))}
      </div>

      <div className="mm-card">
        <button className="mm-x" onClick={dismiss} aria-label="Close">✕</button>

        <div className="mm-banner">
          <img src="/festive/modak_banner.jpg" alt=""
               onError={(e) => { e.currentTarget.parentNode.style.display = 'none'; }} />
          <div className="mm-bannerFade" />
        </div>

        <div className="mm-body">
          <div className="mm-om">॥ ॐ ॥</div>
          <div className="mm-hi">Happy Ganesh Chaturthi</div>
          <h2 className="mm-title">Would you like to play <span>Modak Masti</span> with Ganesh?</h2>
          <p className="mm-p">
            Take a quick festive break! Help Ganesha collect delicious modaks,
            dodge obstacles and see how high you can score.
          </p>
          {days > 0 && (
            <div className="mm-count">🎉 Ganesh Chaturthi in <b>{days}</b> {days === 1 ? 'day' : 'days'} 🙏</div>
          )}
          <button className="mm-play" onClick={play}>🎮 Play Now →</button>
          <button className="mm-later" onClick={dismiss}>Maybe Later</button>
          <div className="mm-foot">❈ Small Moments · Happier People · A Brighter Tomorrow ❈</div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.mm-overlay{position:fixed;inset:0;z-index:10040;display:flex;align-items:center;justify-content:center;
  background:rgba(18,8,0,.70);backdrop-filter:blur(5px);padding:16px;
  animation:mmFade .45s ease-out both;font-family:'Inter','Segoe UI',Tahoma,sans-serif;}
@keyframes mmFade{from{opacity:0}to{opacity:1}}
.mm-card{position:relative;width:min(560px,95vw);max-height:92vh;overflow:auto;border-radius:24px;
  background:linear-gradient(160deg,#fff7ea 0%,#ffe9c7 60%,#ffdca8 100%);
  border:3px solid #e8a33d;box-shadow:0 26px 70px rgba(0,0,0,.55);
  animation:mmPop .55s cubic-bezier(.2,1.1,.35,1) both;}
@keyframes mmPop{from{opacity:0;transform:scale(.86) translateY(18px)}to{opacity:1;transform:none}}
.mm-x{position:absolute;top:12px;right:12px;z-index:3;width:36px;height:36px;border-radius:50%;
  border:2px solid #fff;background:rgba(160,40,25,.9);color:#fff;font-size:15px;font-weight:700;cursor:pointer;
  box-shadow:0 4px 12px rgba(0,0,0,.3);}
.mm-x:hover{background:#c0392b;}
.mm-banner{position:relative;height:210px;overflow:hidden;border-radius:21px 21px 0 0;}
.mm-banner img{width:100%;height:100%;object-fit:cover;display:block;
  animation:mmFloat 6s ease-in-out infinite;}
@keyframes mmFloat{0%,100%{transform:scale(1.02)}50%{transform:scale(1.07)}}
.mm-bannerFade{position:absolute;inset:auto 0 0 0;height:70px;
  background:linear-gradient(transparent,#fff7ea);}
.mm-body{padding:4px 24px 24px;text-align:center;}
.mm-om{font-size:24px;color:#c0392b;}
.mm-hi{font-size:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#c98a2e;}
.mm-title{font-size:clamp(19px,4.2vw,25px);font-weight:800;color:#a8321f;margin:8px 0 0;line-height:1.3;}
.mm-title span{color:#d35400;}
.mm-p{color:#6b4a16;font-size:14px;line-height:1.65;margin:12px auto 0;max-width:410px;}
.mm-count{display:inline-block;margin-top:14px;background:linear-gradient(135deg,#ff8a00,#ffc36b);
  color:#fff;font-weight:700;font-size:13px;padding:7px 16px;border-radius:999px;
  border:2px solid rgba(255,255,255,.6);}
.mm-count b{background:#fff;color:#d35400;border-radius:999px;padding:1px 9px;margin:0 3px;}
.mm-play{display:block;margin:18px auto 0;cursor:pointer;border:none;border-radius:999px;
  padding:15px 44px;font-size:17px;font-weight:800;color:#fff;
  background:linear-gradient(135deg,#c0392b,#e8a33d);box-shadow:0 10px 24px rgba(0,0,0,.3);
  animation:mmPulse 2.2s ease-in-out infinite;}
@keyframes mmPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
.mm-play:hover{filter:brightness(1.08);}
.mm-later{display:block;margin:12px auto 0;cursor:pointer;background:#fff;border:2px solid #e8c58d;
  border-radius:999px;padding:9px 26px;color:#8a5a1f;font-weight:700;font-size:13px;}
.mm-later:hover{background:#fff3dd;}
.mm-foot{margin-top:16px;font-size:11px;color:#b08b४e;color:#b08b4e;letter-spacing:.4px;}
.mm-confetti{position:absolute;inset:0;overflow:hidden;pointer-events:none;}
.mm-confetti i{position:absolute;top:-14px;width:9px;height:14px;border-radius:2px;opacity:.9;
  animation-name:mmFall;animation-timing-function:linear;animation-iteration-count:infinite;}
@keyframes mmFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(105vh) rotate(680deg)}}
@media(max-width:640px){.mm-banner{height:150px}.mm-body{padding:4px 16px 20px}}
@media(prefers-reduced-motion:reduce){
  .mm-card,.mm-play,.mm-banner img{animation:none!important}
  .mm-confetti{display:none}
}
`;
