'use client'

import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, EyeOff, Plus, UserPlus } from 'lucide-react'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { useSessionUser } from '@/components/session-provider'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
} from '@/components/ui/primitives'
import { provisionAdministrativeBrowser } from '@/lib/api-browser'
import { canProvisionAdministrativeUi } from '@/lib/stage1-identity'

export default function AdministrativesPage() {
  const user = useSessionUser()
  const canProvision = canProvisionAdministrativeUi(user.role)

  const [showForm, setShowForm] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  function openForm() {
    setSuccess('')
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    if (submitting) return
    setShowForm(false)
    setName('')
    setEmail('')
    setPassword('')
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return

    if (password.length < 12) {
      setError('La contraseña debe tener al menos 12 caracteres.')
      return
    }

    setError('')
    setSuccess('')
    setSubmitting(true)

    const result = await provisionAdministrativeBrowser({
      email: email.trim(),
      password,
      ...(name.trim() ? { name: name.trim() } : {}),
    })
    setSubmitting(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    setShowForm(false)
    setName('')
    setEmail('')
    setPassword('')
    setSuccess(
      `Administrativo ${result.data.email} creado correctamente.`,
    )
  }

  if (!canProvision) {
    return (
      <DashboardShell title="Administrativos">
        <PageHeader
          eyebrow="Administración / Administrativos"
          title="Administrativos"
          description="Gestioná el acceso del equipo administrativo de la academia."
        />
        <Alert>
          Solo el director o el superadministrador pueden aprovisionar
          administrativos.
        </Alert>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell title="Administrativos">
      <PageHeader
        eyebrow="Administración / Administrativos"
        title="Administrativos"
        description="Creá cuentas del rol ADMINISTRATIVE. No hay listado en la API: solo aprovisionamiento."
        action={
          <Button onClick={openForm} disabled={showForm}>
            <Plus className="size-4" />
            Nuevo administrativo
          </Button>
        }
      />

      {success && (
        <div className="mb-6">
          <Alert tone="success">{success}</Alert>
        </div>
      )}

      {showForm ? (
        <Card className="max-w-2xl p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <UserPlus className="size-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold">Nuevo administrativo</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Creá una cuenta para que pueda acceder al panel. Los permisos se
                configuran en Permisos.
              </p>
            </div>
          </div>
          <form
            onSubmit={(event) => void submit(event)}
            className="mt-8 flex flex-col gap-5"
            noValidate
          >
            <Field label="Nombre (opcional)" htmlFor="admin-name">
              <Input
                id="admin-name"
                name="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nombre completo"
                disabled={submitting}
                maxLength={120}
              />
            </Field>
            <Field label="Email" htmlFor="admin-email">
              <Input
                id="admin-email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nombre@academia.com"
                disabled={submitting}
                autoComplete="off"
              />
            </Field>
            <Field
              label="Contraseña"
              htmlFor="admin-password"
              hint="Al menos 12 caracteres"
            >
              <div className="relative">
                <Input
                  id="admin-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setError('')
                  }}
                  placeholder="Ingresá una contraseña segura"
                  className="pr-12"
                  disabled={submitting}
                  autoComplete="new-password"
                  minLength={12}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={
                    showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </Field>
            {error && <Alert>{error}</Alert>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeForm}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Creando…' : 'Crear administrativo'}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <EmptyState
          title="Aprovisionar administrativos"
          description="La API no expone un listado de administrativos. Desde acá podés crear un acceso nuevo; los permisos se gestionan en la pantalla de Permisos."
          action={
            <Button onClick={openForm}>
              <UserPlus className="size-4" />
              Crear administrativo
            </Button>
          }
        />
      )}
    </DashboardShell>
  )
}
