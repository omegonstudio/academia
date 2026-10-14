'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import type { Notification } from '@academia/shared';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function NotificationsBell() {
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNotifications();
      setItems(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar notificaciones.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  async function onOpen() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  async function onMarkOne(id: string) {
    try {
      await markNotificationRead(id);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo marcar como leída.',
      );
    }
  }

  async function onMarkAll() {
    try {
      await markAllNotificationsRead();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudieron marcar todas.',
      );
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className="relative flex size-10 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
        aria-label={
          unreadCount > 0
            ? `Notificaciones, ${unreadCount} sin leer`
            : 'Notificaciones'
        }
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          void onOpen();
        }}
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          role="region"
          aria-label="Bandeja de notificaciones"
          className="absolute right-0 z-40 mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-border bg-background p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Notificaciones</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                className="text-xs font-semibold text-primary"
                onClick={() => {
                  void onMarkAll();
                }}
              >
                Marcar todas
              </button>
            ) : null}
          </div>
          {loading ? (
            <p className="py-4 text-sm text-muted-foreground" role="status">
              Cargando…
            </p>
          ) : null}
          {error ? (
            <p className="py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {!loading && items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No tenés notificaciones.
            </p>
          ) : null}
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className={`rounded-xl border border-border px-3 py-2 ${
                  item.readAt ? 'opacity-70' : 'bg-primary/5'
                }`}
              >
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {item.body}
                </p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <time
                    className="text-[10px] text-muted-foreground"
                    dateTime={item.createdAt}
                  >
                    {formatWhen(item.createdAt)}
                  </time>
                  {!item.readAt ? (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-primary"
                      onClick={() => {
                        void onMarkOne(item.id);
                      }}
                    >
                      Marcar leída
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
