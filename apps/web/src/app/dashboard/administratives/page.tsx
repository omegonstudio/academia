'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Plus, UserPlus } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { Alert, Button, Card, EmptyState, Field, Input } from '@/components/ui/primitives'

export default function AdministrativesPage() {
  const [showForm, setShowForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 12) { setError('La contraseña debe tener al menos 12 caracteres.'); return }
    setError(''); setSuccess(true); setShowForm(false); setPassword('')
  }
  function openForm() { setSuccess(false); setError(''); setShowForm(true) }

  return <DashboardShell title="Administrativos"><PageHeader eyebrow="Administración / Administrativos" title="Administrativos" description="Gestioná el acceso del equipo administrativo de la academia." action={<Button onClick={openForm}><Plus className="size-4" />Nuevo administrativo</Button>} />
    {success && <div className="mb-6"><Alert tone="success">Administrativo creado correctamente.</Alert></div>}
    {showForm ? <Card className="max-w-2xl p-6 sm:p-8"><div className="flex items-start gap-4"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"><UserPlus className="size-5" /></span><div><h3 className="text-lg font-semibold">Nuevo administrativo</h3><p className="mt-1 text-sm text-muted-foreground">Creá una cuenta para que pueda acceder al panel.</p></div></div><form onSubmit={submit} className="mt-8 flex flex-col gap-5"><Field label="Nombre" htmlFor="name"><Input id="name" name="name" required placeholder="Nombre completo" /></Field><Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" required placeholder="nombre@academia.com" /></Field><Field label="Contraseña" htmlFor="password" hint="Al menos 12 caracteres"><div className="relative"><Input id="password" name="password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} placeholder="Ingresá una contraseña segura" className="pr-12" /><button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></Field>{error && <Alert>{error}</Alert>}<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit">Crear administrativo</Button></div></form></Card> : <EmptyState title="Todavía no hay administrativos para mostrar" description="La gestión completa de administrativos estará disponible próximamente. Desde acá podés crear el primer acceso." action={<Button onClick={openForm}><UserPlus className="size-4" />Crear administrativo</Button>} />}
  </DashboardShell>
}
