'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { zonedLocalDateTimeToUtc, type ClassSession } from '@academia/shared';
import {
  CALENDAR_DISPLAY_TIMEZONE,
  isoToAcademyDatetimeLocalValue,
  parseAcademyDatetimeLocalValue,
} from '@/lib/calendar';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function ClassSessionDetailActions({
  classSession,
}: {
  classSession: ClassSession;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [startLocal, setStartLocal] = useState(
    isoToAcademyDatetimeLocalValue(classSession.startAt),
  );
  const [meetingUrl, setMeetingUrl] = useState(classSession.meetingUrl ?? '');

  async function saveChanges() {
    setError(null);
    setPending(true);

    const parsedStart = parseAcademyDatetimeLocalValue(startLocal);
    if (!parsedStart) {
      setError('Revisá la fecha y hora de inicio.');
      setPending(false);
      return;
    }

    let startAt: string;
    try {
      startAt = zonedLocalDateTimeToUtc(
        parsedStart.date,
        parsedStart.timeOfDay,
        CALENDAR_DISPLAY_TIMEZONE,
      ).toISOString();
    } catch {
      setError('La fecha y hora no son válidas en la zona de la academia.');
      setPending(false);
      return;
    }

    const trimmedUrl = meetingUrl.trim();
    const body: {
      startAt: string;
      meetingUrl: string | null;
    } = {
      startAt,
      meetingUrl: trimmedUrl.length > 0 ? trimmedUrl : null,
    };

    try {
      const response = await fetch(`/api/classes/${classSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError(
          response.status === 403
            ? 'No tenés permiso para editar esta clase.'
            : response.status === 409
              ? 'Hay un conflicto de horario con otra clase del mismo docente.'
              : response.status === 400
                ? 'Revisá el inicio o el enlace https.'
                : 'No pudimos guardar los cambios.',
        );
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos.');
    } finally {
      setPending(false);
    }
  }

  async function deactivate() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/classes/${classSession.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setError(
          response.status === 403
            ? 'No tenés permiso para desactivar esta clase.'
            : 'No pudimos desactivar la clase.',
        );
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos.');
    } finally {
      setPending(false);
    }
  }

  async function reactivate() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/classes/${classSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) {
        setError(
          response.status === 403
            ? 'No tenés permiso para reactivar esta clase.'
            : response.status === 409
              ? 'Hay un conflicto de horario con otra clase del mismo docente.'
              : 'No pudimos reactivar la clase.',
        );
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-8 max-w-md space-y-4">
      <h2 className="text-lg font-semibold text-ink">Editar clase</h2>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="startAt">
          Inicio
        </label>
        <input
          id="startAt"
          type="datetime-local"
          className={FIELD}
          value={startLocal}
          onChange={(event) => setStartLocal(event.target.value)}
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-ink"
          htmlFor="meetingUrl"
        >
          Enlace de reunión
        </label>
        <input
          id="meetingUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          className={FIELD}
          value={meetingUrl}
          onChange={(event) => setMeetingUrl(event.target.value)}
        />
        <p className="mt-1 text-xs text-ink-muted">
          Dejá vacío y guardá para quitar el enlace.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => void saveChanges()}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
        >
          {pending ? 'Guardando…' : 'Guardar cambios'}
        </button>
        {classSession.isActive ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => void deactivate()}
            className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger disabled:opacity-60"
          >
            Desactivar
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => void reactivate()}
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
          >
            Reactivar
          </button>
        )}
      </div>
    </div>
  );
}
