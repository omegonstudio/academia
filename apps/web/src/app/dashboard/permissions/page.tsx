'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type PermissionAction,
  type PermissionModule,
  type PermissionRef,
} from '@academia/shared'
import { Check, Save, Undo2 } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import {
  Alert,
  Button,
  Card,
  Skeleton,
} from '@/components/ui/primitives'
import {
  grantAdministrativePermissionBrowser,
  listAdministrativePermissionGrantsBrowser,
  listPermissionCatalogBrowser,
  revokeAdministrativePermissionBrowser,
} from '@/lib/api-browser'
import {
  canManageAdministrativePermissionsUi,
  permissionActionLabel,
  permissionKey,
  permissionModuleLabel,
} from '@/lib/stage1-identity'

type GrantMap = Record<string, boolean>

function toGrantMap(permissions: readonly PermissionRef[]): GrantMap {
  const map: GrantMap = {}
  for (const permission of permissions) {
    map[permissionKey(permission.module, permission.action)] = true
  }
  return map
}

function mapsEqual(a: GrantMap, b: GrantMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (Boolean(a[key]) !== Boolean(b[key])) return false
  }
  return true
}

export default function PermissionsPage() {
  const user = useSessionUser()
  const canManage = canManageAdministrativePermissionsUi(user.role)

  const [catalog, setCatalog] = useState<PermissionRef[]>([])
  const [saved, setSaved] = useState<GrantMap>({})
  const [draft, setDraft] = useState<GrantMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const dirty = !mapsEqual(draft, saved)

  const catalogSet = useMemo(() => {
    const set = new Set<string>()
    for (const entry of catalog) {
      set.add(permissionKey(entry.module, entry.action))
    }
    return set
  }, [catalog])

  const modulesInCatalog = useMemo(() => {
    return PERMISSION_MODULES.filter((module) =>
      PERMISSION_ACTIONS.some((action) =>
        catalogSet.has(permissionKey(module, action)),
      ),
    )
  }, [catalogSet])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    setSuccess(false)
    const [catalogResult, grantsResult] = await Promise.all([
      listPermissionCatalogBrowser(),
      listAdministrativePermissionGrantsBrowser(),
    ])
    setLoading(false)

    if (!catalogResult.ok) {
      setError(catalogResult.message)
      setCatalog([])
      setSaved({})
      setDraft({})
      return
    }
    if (!grantsResult.ok) {
      setError(grantsResult.message)
      setCatalog(catalogResult.data)
      setSaved({})
      setDraft({})
      return
    }

    const grants = toGrantMap(grantsResult.data)
    setCatalog(catalogResult.data)
    setSaved(grants)
    setDraft(grants)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function toggle(module: PermissionModule, action: PermissionAction) {
    const key = permissionKey(module, action)
    if (!catalogSet.has(key)) return
    setSuccess(false)
    setError('')
    setDraft((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  async function save() {
    if (!dirty || saving) return
    setSaving(true)
    setError('')
    setSuccess(false)

    const keys = new Set([...Object.keys(draft), ...Object.keys(saved)])
    const failures: string[] = []

    for (const key of keys) {
      const [module, action] = key.split(':') as [
        PermissionModule,
        PermissionAction,
      ]
      const next = Boolean(draft[key])
      const prev = Boolean(saved[key])
      if (next === prev) continue

      if (next) {
        const result = await grantAdministrativePermissionBrowser({
          module,
          action,
        })
        if (!result.ok) {
          failures.push(
            `${permissionModuleLabel(module)} · ${permissionActionLabel(action)}: ${result.message}`,
          )
        }
      } else {
        const result = await revokeAdministrativePermissionBrowser({
          module,
          action,
        })
        if (!result.ok) {
          failures.push(
            `${permissionModuleLabel(module)} · ${permissionActionLabel(action)}: ${result.message}`,
          )
        }
      }
    }

    const grantsResult = await listAdministrativePermissionGrantsBrowser()
    setSaving(false)

    if (!grantsResult.ok) {
      setError(
        failures.length > 0
          ? failures.join(' ')
          : grantsResult.message,
      )
      return
    }

    const grants = toGrantMap(grantsResult.data)
    setSaved(grants)
    setDraft(grants)

    if (failures.length > 0) {
      setError(
        `Algunos cambios no se aplicaron: ${failures.join(' ')}`,
      )
      return
    }

    setSuccess(true)
  }

  function discard() {
    setDraft(saved)
    setSuccess(false)
    setError('')
  }

  if (!canManage) {
    return (
      <DashboardShell title="Permisos">
        <PageHeader
          eyebrow="Administración / Permisos"
          title="Permisos"
          description="Configurá qué puede hacer el rol administrativo."
        />
        <Alert>
          Solo el director o el superadministrador pueden gestionar permisos
          administrativos.
        </Alert>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Permisos">
      <PageHeader
        eyebrow="Administración / Permisos"
        title="Permisos"
        description="Otorgá o revocá permisos del rol ADMINISTRATIVE. Los cambios se confirman en el servidor."
        action={
          <div className="flex items-center gap-3">
            {dirty && (
              <span className="text-xs font-semibold text-secondary-foreground">
                Cambios sin guardar
              </span>
            )}
            <Button onClick={() => void save()} disabled={!dirty || saving || loading}>
              <Save className="size-4" />
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        }
      />

      {success && (
        <div className="mb-6">
          <Alert tone="success">
            <span className="inline-flex items-center gap-2">
              <Check className="size-4" />
              Permisos actualizados correctamente.
            </span>
          </Alert>
        </div>
      )}

      {error && (
        <div className="mb-6">
          <Alert>{error}</Alert>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading || saving}
          >
            Reintentar
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full md:hidden" />
        </div>
      ) : (
        <>
          <Card className="hidden overflow-hidden md:block">
            <div className="border-b border-border bg-surface-muted/50 px-6 py-4">
              <p className="font-semibold">Acceso del rol ADMINISTRATIVE</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Solo se muestran pares módulo/acción del catálogo real. Las
                celdas vacías no existen en el catálogo.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-6 py-4 font-semibold">Módulo</th>
                    {PERMISSION_ACTIONS.map((action) => (
                      <th
                        key={action}
                        className="px-4 py-4 text-center font-semibold"
                      >
                        {permissionActionLabel(action)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modulesInCatalog.map((module) => (
                    <tr
                      key={module}
                      className="border-b border-border last:border-0"
                    >
                      <th scope="row" className="px-6 py-4 font-medium">
                        {permissionModuleLabel(module)}
                      </th>
                      {PERMISSION_ACTIONS.map((action) => {
                        const key = permissionKey(module, action)
                        const inCatalog = catalogSet.has(key)
                        return (
                          <td key={action} className="px-4 py-4 text-center">
                            {inCatalog ? (
                              <input
                                type="checkbox"
                                checked={Boolean(draft[key])}
                                onChange={() => toggle(module, action)}
                                disabled={saving}
                                aria-label={`${permissionModuleLabel(module)}: ${permissionActionLabel(action)}`}
                                className="size-4 accent-[var(--primary)]"
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex flex-col gap-3 md:hidden">
            {modulesInCatalog.map((module) => (
              <Card key={module} className="p-5">
                <h3 className="font-semibold">
                  {permissionModuleLabel(module)}
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {PERMISSION_ACTIONS.filter((action) =>
                    catalogSet.has(permissionKey(module, action)),
                  ).map((action) => {
                    const key = permissionKey(module, action)
                    return (
                      <label
                        key={action}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(draft[key])}
                          onChange={() => toggle(module, action)}
                          disabled={saving}
                          aria-label={`${permissionModuleLabel(module)}: ${permissionActionLabel(action)}`}
                          className="size-4 accent-[var(--primary)]"
                        />
                        {permissionActionLabel(action)}
                      </label>
                    )
                  })}
                </div>
              </Card>
            ))}
          </div>

          {dirty && (
            <div className="mt-6 flex justify-end">
              <Button variant="ghost" onClick={discard} disabled={saving}>
                <Undo2 className="size-4" />
                Descartar cambios
              </Button>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  )
}
