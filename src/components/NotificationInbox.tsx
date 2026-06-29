'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/lib/store';
import type { GameNotificationKind } from '@/lib/sim';

const ICON: Record<GameNotificationKind, string> = {
  coach: '💬', market: '📉', deal: '📥', loi: '🤝', idle: '⏳', opportunity: '✨', system: '🔔',
};

const TOAST_TONE: Record<GameNotificationKind, string> = {
  coach: 'border-indigo-200 bg-indigo-50',
  market: 'border-amber-200 bg-amber-50',
  deal: 'border-sky-200 bg-sky-50',
  loi: 'border-violet-200 bg-violet-50',
  idle: 'border-red-200 bg-red-50',
  opportunity: 'border-emerald-200 bg-emerald-50',
  system: 'border-slate-200 bg-white',
};

interface Toast { id: string; kind: GameNotificationKind; title: string; body: string }

/**
 * Notification inbox (game-flow redesign). A top-bar bell with an unread count opens a slide-over of
 * every fired game event; freshly-arrived notifications also surface as transient toasts so the player
 * is actively alerted (e.g. a Ray message) — but nothing is ever lost, since it all stays in the inbox.
 * Game mode only.
 */
export function NotificationInbox() {
  const { mode, difficulty, notifications, markNotificationsRead, dismissNotification, clearNotifications, setSelectedDeal } = useApp();
  const [open, setOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const firstRun = useRef(true);

  // panels/toasts are portaled to <body> so the TopBar's backdrop-blur (a containing block) can't
  // trap their fixed positioning inside the tiny header — that's why they were unreadable before.
  useEffect(() => setMounted(true), []);

  const unread = notifications.filter((n) => !n.read).length;

  // surface newly-arrived notifications as toasts (skip the initial hydrate batch so a reload is quiet)
  useEffect(() => {
    if (firstRun.current) {
      notifications.forEach((n) => seen.current.add(n.id));
      firstRun.current = false;
      return;
    }
    const fresh = notifications.filter((n) => !seen.current.has(n.id));
    fresh.forEach((n) => seen.current.add(n.id));
    if (fresh.length) setToasts((t) => [...t, ...fresh.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body }))].slice(-3));
  }, [notifications]);

  // auto-dismiss the oldest toast every 6s
  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((ts) => ts.slice(1)), 6000);
    return () => clearTimeout(t);
  }, [toasts]);

  if (mode !== 'game' || !difficulty) return null;

  function openInbox() {
    setOpen(true);
    markNotificationsRead();
    setToasts([]);
  }

  // dedupe by id (deterministic ids + persistence could leave stale duplicates) then newest-first
  const recent = [...new Map(notifications.map((n) => [n.id, n])).values()].reverse();

  return (
    <>
      <button
        onClick={openInbox}
        title="Notifications"
        className={`relative rounded-lg border px-2.5 py-1.5 text-sm transition ${unread > 0 ? 'animate-pulse border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-300 text-slate-600 hover:bg-slate-100'}`}
      >
        🔔
        {unread > 0 && <span className="absolute -right-1.5 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread}</span>}
      </button>

      {/* slide-over inbox (portaled to <body> so it's full-height, not trapped in the header) */}
      {mounted && open && createPortal(
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setOpen(false)} />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <div className="text-sm font-semibold">🔔 Notifications</div>
              {notifications.length > 0 && <button onClick={clearNotifications} className="ml-auto text-[11px] text-slate-400 hover:text-slate-700">Clear all</button>}
              <button onClick={() => setOpen(false)} className={`text-slate-400 hover:text-slate-700 ${notifications.length > 0 ? 'ml-2' : 'ml-auto'}`}>✕</button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {recent.length === 0 && <p className="text-xs text-slate-400">No notifications yet. New deals, broker calls, LOI counters, market shifts, and notes from Ray will show up here as the days pass.</p>}
              {recent.map((n) => (
                <div key={n.id} className="rounded-lg border border-slate-200 p-2.5">
                  <div className="flex items-baseline gap-2">
                    <span>{ICON[n.kind]}</span>
                    <span className="text-xs font-semibold text-slate-800">{n.title}</span>
                    <span className="ml-auto shrink-0 rounded bg-slate-100 px-1 text-[9px] tabular-nums text-slate-400">day {n.day}</span>
                    <button onClick={() => dismissNotification(n.id)} className="shrink-0 text-slate-300 hover:text-slate-600">✕</button>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{n.body}</p>
                  {n.dealId && (
                    <button onClick={() => { setSelectedDeal(n.dealId!); setOpen(false); }} className="mt-1.5 text-[11px] font-semibold text-indigo-600 hover:underline">View deal →</button>
                  )}
                </div>
              ))}
            </div>
          </aside>
        </>,
        document.body,
      )}

      {/* transient toasts (portaled to <body>; sit at the right edge, fixed through scroll) */}
      {mounted && toasts.length > 0 && createPortal(
        <div className="fixed right-4 top-20 z-[60] flex w-80 flex-col gap-2">
          {toasts.map((t) => (
            <button
              key={t.id}
              onClick={openInbox}
              className={`rounded-xl border p-3 text-left shadow-xl transition hover:brightness-95 ${TOAST_TONE[t.kind]} ${t.kind === 'opportunity' || t.kind === 'idle' ? 'animate-pulse' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span>{ICON[t.kind]}</span>
                <span className="text-xs font-semibold text-slate-800">{t.title}</span>
              </div>
              <p className="mt-0.5 line-clamp-3 text-[11px] leading-relaxed text-slate-600">{t.body}</p>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
