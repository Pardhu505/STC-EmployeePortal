// MooshikaCursor.js
// Festive cursor companion: Mooshika follows the mouse pointer with a soft
// spring lag, swings/tilts while moving, faces the direction of travel, and
// settles with a gentle idle bob when the pointer stops.
//
// Image: public/festive/mooshika.png (transparent PNG)
//
// Only active during the Ganesh Chaturthi window, and only on devices that
// actually have a mouse (skipped on touch screens, where there is no cursor).

import React, { useEffect, useRef, useState } from 'react';

const FESTIVAL_DATE = new Date('2026-09-14T00:00:00+05:30');
const SHOW_WITHIN_DAYS = 15;   // show from this many days before, through the day

function daysUntil(target) {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((b - a) / 86400000);
}

export default function MooshikaCursor() {
  const elRef = useRef(null);
  const raf = useRef(null);
  // target = where the mouse is; pos = where Mooshika currently is
  const target = useRef({ x: -300, y: -300 });
  const pos = useRef({ x: -300, y: -300 });
  const facing = useRef(1);        // 1 = facing right, -1 = facing left
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const days = daysUntil(FESTIVAL_DATE);
    const inWindow = days >= 0 && days <= SHOW_WITHIN_DAYS;
    // only where a real pointer exists (skip phones/tablets)
    const hasMouse = window.matchMedia('(pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setEnabled(inWindow && hasMouse && !reduce);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onMove = (e) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    const tick = () => {
      const p = pos.current;
      const t = target.current;
      const dx = t.x - p.x;
      const dy = t.y - p.y;

      // spring-ish easing: the lag is what creates the "chasing" feel
      p.x += dx * 0.14;
      p.y += dy * 0.14;

      const speed = Math.hypot(dx, dy);
      // face the direction of travel (only flip on clear horizontal motion)
      if (dx > 2) facing.current = 1;
      else if (dx < -2) facing.current = -1;

      // swing harder the faster it runs, capped so it never looks silly
      const swing = Math.max(-18, Math.min(18, dx * 0.35));
      const el = elRef.current;
      if (el) {
        el.style.transform =
          `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) ` +
          `scaleX(${facing.current}) rotate(${swing}deg)`;
        // idle bob when nearly stopped
        el.classList.toggle('mk-idle', speed < 1.5);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <style>{`
        #mk-cursor {
          position: fixed; top: 0; left: 0; z-index: 10001;
          width: 74px; height: auto; pointer-events: none;
          will-change: transform;
          filter: drop-shadow(0 6px 10px rgba(0,0,0,.28));
          transition: filter .2s ease;
        }
        #mk-cursor.mk-idle { animation: mkIdle 1.8s ease-in-out infinite; }
        @keyframes mkIdle {
          0%,100% { filter: drop-shadow(0 6px 10px rgba(0,0,0,.28)); }
          50%     { filter: drop-shadow(0 10px 14px rgba(0,0,0,.20)); }
        }
      `}</style>
      <img
        id="mk-cursor"
        ref={elRef}
        src="/festive/mooshika.png"
        alt=""
        aria-hidden="true"
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
    </>
  );
}
