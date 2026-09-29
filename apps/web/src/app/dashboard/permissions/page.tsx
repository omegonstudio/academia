'use client'

import { useState } from 'react'
import { Check, Save, Undo2 } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Alert, Button, Card } from '@/components/ui/primitives'

const modules = [
  ['students', 'Estudiantes'], ['teachers', 'Profesores'], ['assignments', 'Asignaciones'], ['courses', 'Cursos'], ['groups', 'Grupos'], ['schedules', 'Horarios'], ['classes', 'Clases'], ['materials', 'Materiales'], ['finance', 'Finanzas'], ['users', 'Usuarios'], ['permissions', 'Permisos'],
] as const
const actions = ['read', 'create', 'update', 'delete'] as const
const labels = { read: 'Ver', create: 'Crear', update: 'Editar', delete: 'Eliminar' }
type PermissionState = Record<string, Record<(typeof actions)[number], boolean>>
const initial: PermissionState = Object.fromEntries(modules.map(([key]) => [key, { read: true, create: ['students', 'teachers', 'assignments'].includes(key), update: ['students', 'teachers'].includes(key), delete: false }]))

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState(initial)
  const [saved, setSaved] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState(false)
  const dirty = JSON.stringify(permissions) !== JSON.stringify(saved)

  function toggle(module: string, action: (typeof actions)[number]) {
    setFeedback(false)
    setPermissions((current) => {
      const row = current[module] ?? { read: false, create: false, update: false, delete: false }
      return { ...current, [module]: { ...row, [action]: !row[action] } }
    })
  }
  function save() {
    setSaving(true)
    window.setTimeout(() => { setSaved(permissions); setSaving(false); setFeedback(true) }, 650)
  }
  function discard() { setPermissions(saved); setFeedback(false) }

  return <DashboardShell title="Permisos"><PageHeader eyebrow="Administración / Permisos" title="Permisos" description="Configurá qué puede hacer cada usuario administrativo." action={<div className="flex items-center gap-3">{dirty && <span className="text-xs font-semibold text-secondary">Cambios sin guardar</span>}<Button onClick={save} disabled={!dirty || saving}><Save className="size-4" />{saving ? 'Guardando...' : 'Guardar cambios'}</Button></div>} />
    {feedback && <div className="mb-6"><Alert tone="success"><span className="inline-flex items-center gap-2"><Check className="size-4" />Permisos actualizados correctamente.</span></Alert></div>}
    <Card className="hidden overflow-hidden md:block"><div className="border-b border-border bg-surface-muted/50 px-6 py-4"><p className="font-semibold">Acceso del rol ADMINISTRATIVE</p><p className="mt-1 text-sm text-muted-foreground">Definí los permisos para el equipo administrativo.</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-6 py-4 font-semibold">Módulo</th>{actions.map((action) => <th key={action} className="px-4 py-4 text-center font-semibold">{labels[action]}</th>)}</tr></thead><tbody>{modules.map(([key, label]) => <tr key={key} className="border-b border-border last:border-0"><th scope="row" className="px-6 py-4 font-medium">{label}</th>{actions.map((action) => <td key={action} className="px-4 py-4 text-center"><input type="checkbox" checked={Boolean(permissions[key]?.[action])} onChange={() => toggle(key, action)} aria-label={`${label}: ${labels[action]}`} className="size-4 accent-[var(--primary)]" /></td>)}</tr>)}</tbody></table></div></Card>
    <div className="flex flex-col gap-3 md:hidden">{modules.map(([key, label]) => <Card key={key} className="p-5"><h3 className="font-semibold">{label}</h3><div className="mt-4 grid grid-cols-2 gap-3">{actions.map((action) => <label key={action} className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={Boolean(permissions[key]?.[action])} onChange={() => toggle(key, action)} aria-label={`${label}: ${labels[action]}`} className="size-4 accent-[var(--primary)]" />{labels[action]}</label>)}</div></Card>)}</div>
    {dirty && <div className="mt-6 flex justify-end"><Button variant="ghost" onClick={discard}><Undo2 className="size-4" />Descartar cambios</Button></div>}
  </DashboardShell>
}
