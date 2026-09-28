'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Material } from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import { Alert, Button, Skeleton } from '@/components/ui/primitives'
import {
  downloadMaterialBrowser,
  listStudentMeMaterialsBrowser,
} from '@/lib/api-browser'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; materials: Material[] }

export default function StudentMaterialsPage() {
  const user = useSessionUser()
  const router = useRouter()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (user.role !== 'STUDENT') {
      router.replace('/dashboard')
      return
    }
    let cancelled = false
    void (async () => {
      const result = await listStudentMeMaterialsBrowser()
      if (cancelled) return
      if (!result.ok) {
        setState({ status: 'error', message: result.message })
        return
      }
      setState({ status: 'ready', materials: result.data })
    })()
    return () => {
      cancelled = true
    }
  }, [user.role, router])

  async function openMaterial(material: Material) {
    setActionError(null)
    setBusyId(material.id)
    const result = await downloadMaterialBrowser(material.id)
    setBusyId(null)
    if (!result.ok) {
      setActionError(result.message)
      return
    }
    window.open(result.data.downloadUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <DashboardShell title="Materiales">
      <PageHeader
        eyebrow="Estudiante"
        title="Mis materiales"
        description="Materiales de tus cursos y clases (solo lectura)."
      />
      {state.status === 'loading' ? (
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      ) : null}
      {state.status === 'error' ? (
        <div className="mt-6"><Alert tone="danger">
          {state.message}
        </Alert></div>
      ) : null}
      {actionError ? (
        <div className="mt-4"><Alert tone="danger">
          {actionError}
        </Alert></div>
      ) : null}
      {state.status === 'ready' ? (
        state.materials.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            Todavía no hay materiales disponibles para vos.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-surface">
            {state.materials.map((material) => (
              <li
                key={material.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
              >
                <div>
                  <p className="font-medium">{material.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {material.kind === 'LINK' ? 'Enlace externo' : 'Archivo'}
                    {material.description
                      ? ` · ${material.description}`
                      : null}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === material.id}
                  onClick={() => void openMaterial(material)}
                >
                  {busyId === material.id ? 'Abriendo…' : 'Abrir'}
                </Button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </DashboardShell>
  )
}
