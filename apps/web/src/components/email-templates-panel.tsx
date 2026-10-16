'use client'

import { useEffect, useState } from 'react'
import type { EmailTemplate, NotificationType } from '@academia/shared'
import { Alert, Button, Card, Field, Input } from '@/components/ui/primitives'
import {
  listEmailTemplatesBrowser,
  updateEmailTemplateBrowser,
} from '@/lib/api-browser'

const TYPE_LABELS: Record<NotificationType, string> = {
  USER_CREATED: 'Bienvenida (cuenta nueva)',
  TEACHER_ASSIGNED: 'Asignación de docente (alumno)',
  CLASS_MEETING_LINK: 'Link de clase / Google Meet',
}

export function EmailTemplatesPanel() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [placeholders, setPlaceholders] = useState<string[]>([])
  const [selectedType, setSelectedType] =
    useState<NotificationType>('CLASS_MEETING_LINK')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saveOk, setSaveOk] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const result = await listEmailTemplatesBrowser()
      setLoading(false)
      if (!result.ok) {
        setLoadError(result.message)
        return
      }
      setTemplates(result.data.templates)
      setPlaceholders(result.data.placeholders)
      const initial =
        result.data.templates.find((t) => t.type === 'CLASS_MEETING_LINK') ??
        result.data.templates[0]
      if (initial) {
        setSelectedType(initial.type)
        setSubject(initial.subject)
        setBody(initial.body)
      }
    })()
  }, [])

  function selectType(type: NotificationType) {
    const row = templates.find((t) => t.type === type)
    setSelectedType(type)
    setSubject(row?.subject ?? '')
    setBody(row?.body ?? '')
    setSaveError('')
    setSaveOk('')
  }

  async function save() {
    if (saving) return
    setSaving(true)
    setSaveError('')
    setSaveOk('')
    const result = await updateEmailTemplateBrowser({
      type: selectedType,
      subject: subject.trim(),
      body: body.trim(),
    })
    setSaving(false)
    if (!result.ok) {
      setSaveError(result.message)
      return
    }
    setTemplates((current) => {
      const rest = current.filter((t) => t.type !== result.data.type)
      return [...rest, result.data].sort((a, b) =>
        a.type.localeCompare(b.type),
      )
    })
    setSubject(result.data.subject)
    setBody(result.data.body)
    setSaveOk('Plantilla guardada.')
  }

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Cargando plantillas…</p>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card className="p-6">
        <Alert>{loadError}</Alert>
      </Card>
    )
  }

  return (
    <Card className="p-6 sm:p-8">
      <div>
        <h3 className="text-lg font-semibold">Mails al alumno</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Definí el asunto y el cuerpo de los emails que recibe el alumno. Usá
          los placeholders entre llaves dobles.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(TYPE_LABELS) as NotificationType[]).map((type) => (
          <Button
            key={type}
            type="button"
            size="sm"
            variant={selectedType === type ? 'primary' : 'outline'}
            onClick={() => selectType(type)}
          >
            {TYPE_LABELS[type]}
          </Button>
        ))}
      </div>

      {placeholders.length > 0 && (
        <p className="mt-4 text-xs text-muted-foreground">
          Placeholders:{' '}
          <span className="font-mono text-foreground">
            {placeholders.join(' ')}
          </span>
        </p>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {saveError && <Alert>{saveError}</Alert>}
        {saveOk && (
          <p className="text-sm font-medium text-primary" role="status">
            {saveOk}
          </p>
        )}
        <Field label="Asunto" htmlFor="email-template-subject">
          <Input
            id="email-template-subject"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="Cuerpo" htmlFor="email-template-body">
          <textarea
            id="email-template-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={4000}
            rows={10}
            className="min-h-40 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          />
        </Field>
        <div className="flex justify-end">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar plantilla'}
          </Button>
        </div>
      </div>
    </Card>
  )
}
