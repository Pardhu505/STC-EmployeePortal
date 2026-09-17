// VisarjanAnnouncement.js
// Ganpati Visarjan Mahotsav invitation: the festival video plays in full (16:9,
// never cropped) blended into a decorated card, with the schedule revealed as
// animated, staggered lines beneath it.
//
// Assets: public/festive/visarjan.mp4, public/festive/visarjan_poster.jpg

import React, { useEffect, useState } from 'react';

// The day of the Visarjan celebrations at the office.
const VISARJAN_DATE = new Date('2026-09-18T00:00:00+05:30');
const SHOW_FROM_DAYS_BEFORE = 3;     // start inviting this many days ahead

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export default function VisarjanAnnouncement() {
  const [days, setDays] = useState(() => daysUntil(VISARJAN_DATE));
  const [closed, setClosed] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setDays(daysUntil(VISARJAN_DATE)), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (days < 0 || days > SHOW_FROM_DAYS_BEFORE) return null;

  const whenLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;

  if (closed) {
    return (
      <>
        <style>{CSS}</style>
        <button className="vs-reopen" onClick={() => setClosed(false)}>
          🌺 <b>Ganpati Visarjan Mahotsav</b> <small>{whenLabel} · tap for details</small>
        </button>
      </>
    );
  }

  return (
    <div className="vs-overlay" role="dialog" aria-label="Ganpati Visarjan Mahotsav">
      <style>{CSS}</style>

      <div className="vs-fx" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, i) => (
          <i key={i} style={{
            left: `${(i * 4.3 + (i % 5) * 3) % 100}%`,
            animationDelay: `${(i % 8) * 0.55}s`,
            animationDuration: `${5 + (i % 4)}s`,
            background: ['#ffcf4d', '#ff7f50', '#e8a33d', '#c0392b', '#ff8fb1'][i % 5],
          }} />
        ))}
      </div>

      <div className="vs-card">
        <div className="vs-toran" />
        <button className="vs-x" onClick={() => setClosed(true)} aria-label="Close">✕</button>

        {/* LEFT - the video at full size, blurred fill behind the letterbox */}
        <div className="vs-left">
          <div className="vs-blur" />
          <video className="vs-vid" src="/festive/visarjan.mp4"
                 poster="/festive/visarjan_poster.jpg"
                 autoPlay loop playsInline muted={muted}
                 onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          <button className="vs-sound" onClick={() => setMuted(m => !m)}
                  aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button>
        </div>

        {/* RIGHT - the animated announcement */}
        <div className="vs-body">
          <div className="vs-om vs-a" style={{ animationDelay: '.05s' }}>॥ ॐ ॥</div>
          <h2 className="vs-title vs-a" style={{ animationDelay: '.15s' }}>
            Ganpati Visarjan <span>Mahotsav</span>
          </h2>
          <div className="vs-when vs-a" style={{ animationDelay: '.25s' }}>
            <span className="vs-pill">{whenLabel}</span>
          </div>

          <p className="vs-lead vs-a" style={{ animationDelay: '.35s' }}>
            🙏 Dear Team, kindly assemble near <b>Ganpati Ji</b> for the devotional celebrations.
          </p>

          <div className="vs-sched">
            <div className="vs-slot vs-a" style={{ animationDelay: '.45s' }}>
              <span className="vs-ico">🕙</span>
              <span className="vs-time">10:00 AM</span>
              <span className="vs-what">Puja &amp; Aarti</span>
            </div>
            <div className="vs-slot vs-a" style={{ animationDelay: '.58s' }}>
              <span className="vs-ico">🌸</span>
              <span className="vs-time">2:00 – 6:00 PM</span>
              <span className="vs-what">Activity &amp; Visarjan</span>
            </div>
          </div>

          <p className="vs-bless vs-a" style={{ animationDelay: '.72s' }}>
            Let us come together in the spirit of devotion, sharing and togetherness.
            May Bappa bless us all with <b>happiness, peace, prosperity and success.</b>
          </p>

          <div className="vs-morya vs-a" style={{ animationDelay: '.85s' }}>
            🙏 गणपति बाप्पा मोरया! 🌺
          </div>
          <div className="vs-from vs-a" style={{ animationDelay: '.95s' }}>
            — EWC Team, ShowTime Consulting
          </div>

          <button className="vs-close vs-a" style={{ animationDelay: '1.05s' }}
                  onClick={() => setClosed(true)}>Continue to Portal</button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.vs-overlay{position:fixed;inset:0;z-index:10070;display:flex;align-items:flex-start;
  justify-content:center;overflow-y:auto;overflow-x:hidden;padding:14px 16px 26px;
  background:rgba(18,8,0,.74);backdrop-filter:blur(6px);
  font-family:'Inter','Segoe UI',Tahoma,sans-serif;animation:vsFade .45s ease-out both;}
@keyframes vsFade{from{opacity:0}to{opacity:1}}
.vs-card{position:relative;margin:auto;width:min(1180px,97vw);max-height:92vh;
  display:flex;align-items:stretch;border-radius:22px;overflow:hidden;
  background:linear-gradient(170deg,#fff7ea 0%,#ffe9c7 58%,#ffdca8 100%);
  border:3px solid #e8a33d;box-shadow:0 26px 70px rgba(0,0,0,.6);
  animation:vsPop .6s cubic-bezier(.2,1.1,.35,1) both;}
@keyframes vsPop{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:none}}
.vs-toran{position:absolute;top:0;left:0;right:0;height:12px;z-index:5;
  background:repeating-linear-gradient(90deg,#e8a33d 0 10px,#c0392b 10px 20px);}
.vs-x{position:absolute;top:16px;right:14px;z-index:4;width:34px;height:34px;border-radius:50%;
  border:2px solid rgba(255,255,255,.8);background:rgba(160,40,25,.85);color:#fff;
  font-size:14px;font-weight:700;cursor:pointer;}
.vs-x:hover{background:#c0392b;}

/* LEFT: video shown whole (contain); a blurred copy fills the side bars */
.vs-left{position:relative;flex:1 1 57%;min-width:0;background:#1d0e04;overflow:hidden;
  display:flex;align-items:center;justify-content:center;}
.vs-blur{position:absolute;inset:-30px;background-image:url('/festive/visarjan_poster.jpg');
  background-size:cover;background-position:center;filter:blur(26px) brightness(.55) saturate(1.1);
  transform:scale(1.12);}
.vs-vid{position:relative;z-index:2;max-width:100%;max-height:92vh;width:auto;height:auto;
  object-fit:contain;display:block;}
.vs-sound{position:absolute;bottom:12px;right:12px;z-index:3;width:34px;height:34px;border-radius:50%;
  border:1px solid rgba(255,255,255,.55);background:rgba(30,15,5,.6);color:#ffe9b8;
  font-size:14px;cursor:pointer;backdrop-filter:blur(4px);}

.vs-body{flex:1 1 43%;min-width:0;padding:26px 24px 22px;text-align:center;
  overflow-y:auto;display:flex;flex-direction:column;justify-content:center;}
.vs-a{opacity:0;animation:vsUp .6s cubic-bezier(.2,1,.3,1) forwards;}
@keyframes vsUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.vs-om{font-size:24px;color:#c0392b;}
.vs-title{margin:2px 0 0;font-size:clamp(22px,3.6vw,34px);font-weight:900;color:#a8321f;
  line-height:1.15;letter-spacing:.3px;}
.vs-title span{color:#d35400;
  background:linear-gradient(90deg,#d35400,#e8a33d,#d35400);background-size:200% auto;
  -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  animation:vsShine 3.4s linear infinite;}
@keyframes vsShine{to{background-position:200% center}}
.vs-when{margin-top:8px;}
.vs-pill{display:inline-block;background:linear-gradient(135deg,#c0392b,#e8a33d);color:#fff;
  font-weight:800;font-size:13px;letter-spacing:.8px;text-transform:uppercase;
  padding:6px 18px;border-radius:999px;border:2px solid rgba(255,255,255,.6);
  box-shadow:0 6px 16px rgba(0,0,0,.25);animation:vsPulse 2.2s ease-in-out infinite;}
@keyframes vsPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
.vs-lead{margin:12px auto 0;max-width:560px;color:#6b4a16;font-size:14.5px;line-height:1.6;}
.vs-lead b{color:#a8321f;}
.vs-sched{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin:14px 0 2px;}
.vs-slot{display:flex;flex-direction:column;align-items:center;gap:2px;flex:1 1 150px;min-width:140px;
  padding:11px 14px;border-radius:14px;border:2px solid #e8c58d;
  background:rgba(255,255,255,.62);box-shadow:0 6px 16px rgba(0,0,0,.10);}
.vs-slot:hover{transform:translateY(-3px);transition:transform .2s;}
.vs-ico{font-size:22px;}
.vs-time{font-size:16px;font-weight:900;color:#a8321f;}
.vs-what{font-size:12px;font-weight:700;color:#8a5a1f;text-transform:uppercase;letter-spacing:.7px;}
.vs-bless{margin:12px auto 0;max-width:580px;color:#6b4a16;font-size:13.5px;line-height:1.65;}
.vs-bless b{color:#a8321f;}
.vs-morya{margin-top:12px;font-size:clamp(16px,2.4vw,21px);font-weight:900;color:#c0392b;}
.vs-from{margin-top:6px;font-size:12px;font-weight:700;color:#8a5a1f;}
.vs-close{margin-top:14px;cursor:pointer;border:none;border-radius:999px;padding:12px 32px;
  font-size:15px;font-weight:800;color:#fff;background:linear-gradient(135deg,#c0392b,#e8a33d);
  box-shadow:0 10px 24px rgba(0,0,0,.28);}
.vs-close:hover{filter:brightness(1.08);}

.vs-fx{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:1;}
.vs-fx i{position:absolute;top:-16px;width:9px;height:14px;border-radius:2px;opacity:.85;
  animation-name:vsFall;animation-timing-function:linear;animation-iteration-count:infinite;}
@keyframes vsFall{0%{transform:translateY(-20px) rotate(0)}100%{transform:translateY(106vh) rotate(680deg)}}

.vs-reopen{position:fixed;top:0;left:50%;transform:translateX(-50%);z-index:9992;cursor:pointer;
  display:flex;align-items:center;gap:8px;padding:9px 20px;border-radius:0 0 16px 16px;
  border:1px solid rgba(255,215,150,.55);border-top:none;color:#fff;
  background:linear-gradient(135deg,rgba(192,57,43,.74),rgba(232,163,61,.74));
  backdrop-filter:blur(8px);box-shadow:0 8px 22px rgba(0,0,0,.3);
  font-family:'Inter','Segoe UI',Tahoma,sans-serif;font-size:13px;}
.vs-reopen b{font-weight:800;} .vs-reopen small{opacity:.9;font-size:10.5px;}
.vs-reopen:hover{filter:brightness(1.1);}

@media(max-width:900px){
  .vs-card{flex-direction:column;max-height:94vh;overflow-y:auto;}
  .vs-left{flex:none;aspect-ratio:16/9;}
  .vs-vid{max-height:none;width:100%;height:100%;}
  .vs-body{flex:none;padding:16px 18px 20px;}
}
@media(max-width:640px){
  .vs-slot{min-width:0;flex:1 1 100%;}
  .vs-lead,.vs-bless{font-size:12.5px;}
  .vs-title{font-size:clamp(19px,5.4vw,26px);}
}
@media(prefers-reduced-motion:reduce){
  .vs-card,.vs-a,.vs-pill,.vs-title span{animation:none!important;opacity:1!important;}
  .vs-fx{display:none;}
}
`;
