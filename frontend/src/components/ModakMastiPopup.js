// ModakMastiPopup.js
// Grand Ganesh Chaturthi welcome popup. Appears once per day when an employee
// opens the portal, dims everything behind it, and launches Modak Quest
// full-screen from "Play Now". "Maybe Later" dismisses it for the day.

import React, { useEffect, useState } from 'react';
import ModakQuest from './ModakQuest';

const FESTIVAL_DATE = new Date('2026-09-14T00:00:00+05:30');
const SHOW_WITHIN_DAYS = 15;           // show in the run-up and on the day

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export default function ModakMastiPopup() {
  const [inWindow, setInWindow] = useState(false);
  const [show, setShow] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const d = daysUntil(FESTIVAL_DATE);
    if (d < 0 || d > SHOW_WITHIN_DAYS) return;
    setInWindow(true);
    // greet on EVERY page load / refresh during the festival window
    const t = setTimeout(() => setShow(true), 700);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => setShow(false);
  const play = () => { setShow(false); setPlaying(true); };

  if (!inWindow) return null;
  if (playing) return <ModakQuest onClose={() => setPlaying(false)} />;

  const days = daysUntil(FESTIVAL_DATE);

  // once dismissed, keep a always-available launcher on the portal
  if (!show) {
    return (
      <>
        <style>{CSS}</style>
        <div className="mm-hang" aria-hidden="true">
          <span className="mm-cord mm-cord-l" />
          <span className="mm-cord mm-cord-r" />
        </div>
        <button className="mm-banner-top" onClick={() => setPlaying(true)}
                title="Play Modak Masti">
          <span className="mm-shimmer" />
          <span className="mm-bt-ico">🪔</span>
          <span className="mm-bt-txt">
            <b>Play Modak&nbsp;Masti</b>
            <small>
              {days > 0
                ? `Ganesh Chaturthi in ${days} ${days === 1 ? 'day' : 'days'} · tap to play`
                : 'Happy Ganesh Chaturthi! · tap to play'}
            </small>
          </span>
          <span className="mm-bt-ico">🎮</span>
        </button>
      </>
    );
  }

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
.mm-hang{position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9990;
  width:330px;height:26px;pointer-events:none;}
.mm-cord{position:absolute;top:0;width:2px;height:26px;
  background:linear-gradient(#e8a33d,rgba(232,163,61,.25));}
.mm-cord-l{left:58px;} .mm-cord-r{right:58px;}

.mm-banner-top{position:fixed;top:24px;left:50%;z-index:9991;cursor:pointer;
  display:flex;align-items:center;gap:12px;padding:10px 22px;
  border-radius:0 0 18px 18px;border:1px solid rgba(255,215,150,.55);border-top:none;
  background:linear-gradient(135deg,rgba(192,57,43,.62),rgba(232,163,61,.62));
  backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);
  color:#fff;font-family:'Inter','Segoe UI',Tahoma,sans-serif;overflow:hidden;
  box-shadow:0 10px 26px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.35);
  transform-origin:50% 0;
  animation:mmSwing 4.6s ease-in-out infinite;}
.mm-banner-top:hover{filter:brightness(1.1);}
.mm-bt-ico{font-size:19px;line-height:1;}
.mm-bt-txt{display:flex;flex-direction:column;align-items:center;line-height:1.2;}
.mm-bt-txt b{font-size:14.5px;font-weight:800;letter-spacing:.2px;
  text-shadow:0 1px 3px rgba(0,0,0,.35);}
.mm-bt-txt small{font-size:10.5px;font-weight:600;opacity:.95;
  text-shadow:0 1px 2px rgba(0,0,0,.3);}
/* light sweep across the banner */
.mm-shimmer{position:absolute;top:0;left:-60%;width:45%;height:100%;pointer-events:none;
  background:linear-gradient(100deg,transparent,rgba(255,255,255,.42),transparent);
  animation:mmSweep 3.6s ease-in-out infinite;}
@keyframes mmSweep{0%{left:-60%}55%{left:115%}100%{left:115%}}
/* gentle hanging swing from the cords */
@keyframes mmSwing{
  0%,100%{transform:translateX(-50%) rotate(-1.1deg)}
  50%    {transform:translateX(-50%) rotate(1.1deg)}
}

@media(max-width:640px){
  .mm-banner{height:150px}.mm-body{padding:4px 16px 20px}
  .mm-banner-top{top:18px;padding:8px 14px;gap:8px;}
  .mm-bt-txt b{font-size:12.5px;} .mm-bt-txt small{font-size:9px;}
  .mm-hang{width:250px;} .mm-cord-l{left:40px;} .mm-cord-r{right:40px;}
}
@media(prefers-reduced-motion:reduce){
  .mm-card,.mm-play,.mm-banner img,.mm-banner-top,.mm-shimmer{animation:none!important}
  .mm-confetti{display:none}
}
`;
