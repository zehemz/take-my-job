'use client';

import { useEffect, useRef, useState } from 'react';
import { useKobaniStore } from '@/lib/store';
import { relativeTime } from '@/lib/timeUtils';
import type { ApiNotification } from '@/lib/api-types';

const TYPE_CONFIG: Record<string, { color: string; label: string }> = {
  blocked: { color: 'bg-amber-500', label: 'Blocked' },
  'evaluation-failed': { color: 'bg-rose-500', label: 'Eval Failed' },
  'pending-approval': { color: 'bg-violet-500', label: 'Pending Approval' },
  failed: { color: 'bg-red-500', label: 'Failed' },
};

function NotificationItem({
  notification,
  onClickNotification,
}: {
  notification: ApiNotification;
  onClickNotification: (n: ApiNotification) => void;
}) {
  const cfg = TYPE_CONFIG[notification.type] ?? { color: 'bg-zinc-500', label: notification.type };

  return (
    <button
      onClick={() => onClickNotification(notification)}
      className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors flex gap-3 items-start cursor-pointer"
    >
      <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${cfg.color}`} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${notification.isRead ? 'text-zinc-300' : 'text-zinc-100 font-medium'}`}>
          {notification.cardTitle}
        </p>
        <p className="text-xs text-zinc-500 truncate mt-0.5">
          {notification.boardName}
        </p>
        {notification.message && (
          <p className="text-xs text-zinc-400 mt-1 line-clamp-2">
            {notification.message.slice(0, 120)}
          </p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${notification.isRead ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {cfg.label}
        </span>
        <span className="flex items-center gap-1.5">
          {!notification.isRead && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
          <span className="text-xs text-zinc-600">
            {relativeTime(notification.createdAt)}
          </span>
        </span>
      </div>
    </button>
  );
}

export default function NotificationBell() {
  const popupRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const notifications = useKobaniStore((s) => s.notifications);
  const unreadCount = useKobaniStore((s) => s.unreadNotificationCount);
  const popupOpen = useKobaniStore((s) => s.notificationPopupOpen);
  const fetchNotifications = useKobaniStore((s) => s.fetchNotifications);
  const markNotificationsRead = useKobaniStore((s) => s.markNotificationsRead);
  const markAllNotificationsRead = useKobaniStore((s) => s.markAllNotificationsRead);
  const openPopup = useKobaniStore((s) => s.openNotificationPopup);
  const closePopup = useKobaniStore((s) => s.closeNotificationPopup);
  const openCardDetail = useKobaniStore((s) => s.openCardDetail);

  const [markingAll, setMarkingAll] = useState(false);

  // Poll notifications
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click outside to close
  useEffect(() => {
    if (!popupOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        closePopup();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [popupOpen, closePopup]);

  function handleBellClick() {
    if (popupOpen) {
      closePopup();
    } else {
      openPopup();
    }
  }

  function handleClickNotification(n: ApiNotification) {
    if (!n.isRead) {
      markNotificationsRead([n.id]);
    }
    openCardDetail(n.cardId);
    closePopup();
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={bellRef}
        onClick={handleBellClick}
        className="relative text-zinc-400 hover:text-zinc-100 cursor-pointer transition-colors p-1"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {popupOpen && (
        <div
          ref={popupRef}
          className="absolute right-0 top-full mt-2 w-96 max-h-[28rem] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl flex flex-col z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-100">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {markingAll ? 'Marking...' : 'Mark all read'}
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
            {notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-zinc-600">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onClickNotification={handleClickNotification}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800 px-4 py-2">
            <a
              href="/attention"
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              View all
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
