'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { zonedLocalDateTimeToUtc, type Group } from '@academia/shared';
import {
  CALENDAR_DISPLAY_TIMEZONE,
  parseAcademyDatetimeLocalValue,
} from '@/lib/calendar';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function CreateClassSessionForm({
  groups,
}: {
  groups: readonly Group[];
}) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const activeGroups = groups.filter((group) => group.isActive);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);

    const groupId = String(form.get('groupId') ?? '').trim();
    const startLocal = String(form.get('startAt') ?? '').trim();
    const meetingUrlRaw = String(form.get('meetingUrl') ?? '').trim();
    const parsedStart = parseAcademyDatetimeLocalValue(startLocal);

    if (!groupId || !parsedStart) {
      setError('Revisá el grupo y el inicio de la clase.');
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

    const body: {
      groupId: string;
      startAt: string;
      meetingUrl?: string;
    } = { groupId, startAt };
    if (meetingUrlRaw) {
      body.meetingUrl = meetingUrlRaw;
    }

    try {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        setError(
          response.status === 403
            ? 'No tenés permiso para crear esta clase.'
            : response.status === 409
              ? 'Hay un conflicto de horario con otra clase del mismo docente.'
              : response.status === 400
                ? 'Revisá los datos (grupo, inicio o enlace https).'
                : 'No pudimos crear la clase. Intentá de nuevo.',
        );
        return;
      }

      const payload = (await response.json()) as {
        classSession?: { id?: string };
      };
      if (payload.classSession?.id) {
        router.push(`/dashboard/classes/${payload.classSession.id}`);
        router.refresh();
        return;
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 max-w-md space-y-4">
      <h2 className="text-lg font-semibold text-ink">Nueva clase</h2>
      <p className="text-sm text-ink-muted">
        El inicio se interpreta en la zona horaria de la academia. La duración la
        define el tipo de servicio del curso del grupo.
      </p>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="groupId">
          Grupo
        </label>
        {activeGroups.length > 0 ? (
          <select id="groupId" name="groupId" required className={FIELD} defaultValue="">
            <option value="" disabled>
              Seleccioná un grupo
            </option>
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        ) : (
          <>
            <input
              id="groupId"
              name="groupId"
              type="text"
              required
              className={FIELD}
              placeholder="UUID del grupo"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-ink-muted">
              No hay listado de grupos disponible; ingresá el identificador del
              grupo (por ejemplo, si sos docente del grupo).
            </p>
          </>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="startAt">
          Inicio
        </label>
        <input
          id="startAt"
          name="startAt"
          type="datetime-local"
          required
          className={FIELD}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="meetingUrl">
          Enlace de reunión (opcional)
        </label>
        <input
          id="meetingUrl"
          name="meetingUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          className={FIELD}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
      >
        {pending ? 'Guardando…' : 'Crear clase'}
      </button>
      <p className="text-sm text-ink-muted">
        <Link href="/dashboard" className="underline">
          Volver al panel
        </Link>
      </p>
    </form>
  );
}
