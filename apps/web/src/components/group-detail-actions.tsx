'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Group, ScheduleOption } from '@academia/shared';
import { academicMutationErrorMessage } from '@/lib/academic-structure';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function GroupDetailActions({
  group,
  scheduleOptions,
}: {
  group: Group;
  scheduleOptions: readonly ScheduleOption[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState(group.name);
  const [scheduleOptionId, setScheduleOptionId] = useState(
    group.scheduleOptionId ?? '',
  );

  const activeOptions = scheduleOptions.filter((option) => option.isActive);
  const selectedInactive = scheduleOptions.find(
    (option) =>
      option.id === group.scheduleOptionId &&
      !option.isActive &&
      group.scheduleOptionId,
  );

  async function saveChanges() {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scheduleOptionId:
            scheduleOptionId.trim().length > 0 ? scheduleOptionId : null,
        }),
      });
      if (!response.ok) {
        setError(
          academicMutationErrorMessage(
            response.status,
            response.status === 400 ? 'schedule' : 'group',
          ),
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
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'group'));
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
      const response = await fetch(`/api/groups/${group.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      if (!response.ok) {
        setError(academicMutationErrorMessage(response.status, 'group'));
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
      <h2 className="text-lg font-semibold text-ink">Editar grupo</h2>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div>
        <label className="block text-sm font-medium text-ink" htmlFor="name">
          Nombre
        </label>
        <input
          id="name"
          className={FIELD}
          value={name}
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
        />
      </div>
      <div>
        <label
          className="block text-sm font-medium text-ink"
          htmlFor="scheduleOptionId"
        >
          Franja horaria
        </label>
        <select
          id="scheduleOptionId"
          className={FIELD}
          value={scheduleOptionId}
          onChange={(event) => setScheduleOptionId(event.target.value)}
        >
          <option value="">Sin franja</option>
          {selectedInactive ? (
            <option value={selectedInactive.id}>
              {selectedInactive.label} (inactiva)
            </option>
          ) : null}
          {activeOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
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
        {group.isActive ? (
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
