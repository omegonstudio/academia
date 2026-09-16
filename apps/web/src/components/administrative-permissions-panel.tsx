'use client';

import { useMemo, useState, useTransition } from 'react';
import type { PermissionAction, PermissionModule, PermissionRef } from '@academia/shared';
import {
  identityMutationErrorMessage,
  permissionActionLabel,
  permissionKey,
  permissionModuleLabel,
} from '@/lib/stage1-identity';

interface AdministrativePermissionsPanelProps {
  catalog: PermissionRef[];
  grants: PermissionRef[];
  canUpdate: boolean;
}

function groupByModule(
  permissions: PermissionRef[],
): Map<PermissionModule, PermissionAction[]> {
  const map = new Map<PermissionModule, PermissionAction[]>();
  for (const entry of permissions) {
    const list = map.get(entry.module) ?? [];
    list.push(entry.action);
    map.set(entry.module, list);
  }
  return map;
}

/**
 * Catalog vs current ADMINISTRATIVE grants. Grant/revoke hit the real API;
 * success is only shown after a successful response.
 */
export function AdministrativePermissionsPanel({
  catalog,
  grants: initialGrants,
  canUpdate,
}: AdministrativePermissionsPanelProps) {
  const [grants, setGrants] = useState(initialGrants);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const grantedKeys = useMemo(
    () => new Set(grants.map((g) => permissionKey(g.module, g.action))),
    [grants],
  );

  const byModule = useMemo(() => groupByModule(catalog), [catalog]);

  async function mutate(
    module: PermissionModule,
    action: PermissionAction,
    nextGranted: boolean,
  ) {
    const key = permissionKey(module, action);
    if (pendingKey || isPending) return;
    if (nextGranted === grantedKeys.has(key)) return;

    setError(null);
    setStatus(null);
    setPendingKey(key);

    try {
      const response = await fetch('/api/roles/administrative/permissions', {
        method: nextGranted ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, action }),
      });

      if (!response.ok) {
        setError(identityMutationErrorMessage(response.status, 'permission'));
        return;
      }

      startTransition(() => {
        setGrants((current) => {
          if (nextGranted) {
            if (
              current.some((g) => g.module === module && g.action === action)
            ) {
              return current;
            }
            return [...current, { module, action }];
          }
          return current.filter(
            (g) => !(g.module === module && g.action === action),
          );
        });
        setStatus(
          nextGranted
            ? `Permiso concedido: ${permissionModuleLabel(module)} · ${permissionActionLabel(action)}.`
            : `Permiso revocado: ${permissionModuleLabel(module)} · ${permissionActionLabel(action)}.`,
        );
      });
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-ink">
          {status}
        </p>
      ) : null}

      {!canUpdate ? (
        <p className="text-sm text-ink-muted">
          Solo dirección y administración técnica pueden conceder o revocar
          permisos. La API sigue siendo la autoridad.
        </p>
      ) : null}

      {[...byModule.entries()].map(([module, actions]) => (
        <section
          key={module}
          aria-labelledby={`perm-module-${module}`}
          className="rounded-lg border border-line p-4"
        >
          <h2
            id={`perm-module-${module}`}
            className="text-base font-semibold text-ink"
          >
            {permissionModuleLabel(module)}
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {actions.map((action) => {
              const key = permissionKey(module, action);
              const granted = grantedKeys.has(key);
              const busy = pendingKey === key;

              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-ink">
                      {permissionActionLabel(action)}
                    </p>
                    <p className="text-ink-muted">
                      {module}:{action}
                      {' · '}
                      {granted ? 'concedido' : 'sin grant'}
                    </p>
                  </div>
                  {canUpdate ? (
                    <button
                      type="button"
                      disabled={busy || Boolean(pendingKey)}
                      onClick={() => void mutate(module, action, !granted)}
                      aria-pressed={granted}
                      className="rounded-md border border-line px-3 py-1.5 font-medium text-ink disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {busy
                        ? 'Guardando…'
                        : granted
                          ? 'Revocar'
                          : 'Conceder'}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
