'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  CLASS_SESSION_GENERATE_MAX_DAYS,
  generateClassSessionsResponseSchema,
  type Group,
} from '@academia/shared';
import {
  formatGenerateResultSummary,
  generateClassSessionsErrorMessage,
  validateGenerateDateRange,
} from '@/lib/class-session-generate';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

type PendingConfirm = {
  groupId: string;
  groupLabel: string;
  from: string;
  to: string;
  dayCount: number;
};

export function GenerateClassSessionsForm({
  groups,
}: {
  groups: readonly Group[];
}) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  const eligibleGroups = groups.filter(
    (group) => group.isActive && group.scheduleOptionId,
  );

  function resolveGroupLabel(groupId: string): string {
    const match = groups.find((group) => group.id === groupId);
    return match?.name ?? groupId;
  }

  function handlePrepare(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const groupId = String(form.get('groupId') ?? '').trim();
    const from = String(form.get('from') ?? '').trim();
    const to = String(form.get('to') ?? '').trim();

    if (!groupId) {
      setError('Seleccioná o indicá un grupo.');
      setConfirm(null);
      return;
    }

    const validated = validateGenerateDateRange(from, to);
    if (!validated.ok) {
      setError(validated.message);
      setConfirm(null);
      return;
    }

    setConfirm({
      groupId,
      groupLabel: resolveGroupLabel(groupId),
      from: validated.from,
      to: validated.to,
      dayCount: validated.dayCount,
    });
  }

  async function handleConfirm() {
    if (!confirm || pending) return;
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/groups/${confirm.groupId}/classes/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: confirm.from, to: confirm.to }),
        },
      );

      if (!response.ok) {
        setError(generateClassSessionsErrorMessage(response.status));
        return;
      }

      const parsed = generateClassSessionsResponseSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success) {
        setError('Respuesta inválida del servidor.');
        return;
      }

      setSuccess(formatGenerateResultSummary(parsed.data));
      setConfirm(null);
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-10 max-w-md space-y-4" aria-labelledby="generate-heading">
      <h2 id="generate-heading" className="text-lg font-semibold text-ink">
        Generar clases semanales
      </h2>
      <p className="text-sm text-ink-muted">
        Crea sesiones a partir de la franja horaria del grupo, en la zona de la
        academia. Máximo {CLASS_SESSION_GENERATE_MAX_DAYS} días. Requiere permiso
        de creación de clases.
      </p>

      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      {success ? (
        <p role="status" className="text-sm text-ink">
          {success}
        </p>
      ) : null}

      {confirm ? (
        <div
          className="space-y-3 rounded-md border border-line bg-surface-muted p-4"
          role="region"
          aria-label="Confirmación de generación"
        >
          <p className="text-sm text-ink">
            Vas a generar clases para <strong>{confirm.groupLabel}</strong> del{' '}
            <strong>{confirm.from}</strong> al <strong>{confirm.to}</strong> (
            {confirm.dayCount} día
            {confirm.dayCount === 1 ? '' : 's'} civil
            {confirm.dayCount === 1 ? '' : 'es'}).
          </p>
          <p className="text-sm text-ink-muted">
            Las fechas que ya existan se omiten; los conflictos de horario del
            docente también.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void handleConfirm()}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
            >
              {pending ? 'Generando…' : 'Confirmar generación'}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirm(null)}
              className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handlePrepare} noValidate className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="generate-groupId">
              Grupo
            </label>
            {eligibleGroups.length > 0 ? (
              <select
                id="generate-groupId"
                name="groupId"
                required
                className={FIELD}
                defaultValue=""
              >
                <option value="" disabled>
                  Seleccioná un grupo con franja
                </option>
                {eligibleGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  id="generate-groupId"
                  name="groupId"
                  type="text"
                  required
                  className={FIELD}
                  placeholder="UUID del grupo"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  No hay grupos activos con franja en el listado; ingresá el ID
                  del grupo.
                </p>
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="generate-from">
              Desde
            </label>
            <input
              id="generate-from"
              name="from"
              type="date"
              required
              className={FIELD}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="generate-to">
              Hasta
            </label>
            <input
              id="generate-to"
              name="to"
              type="date"
              required
              className={FIELD}
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Revisar generación
          </button>
        </form>
      )}
    </section>
  );
}
