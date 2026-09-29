'use client'

import {
  MATERIAL_DESCRIPTION_MAX_LENGTH,
  MATERIAL_EXTERNAL_URL_MAX_LENGTH,
  MATERIAL_TITLE_MAX_LENGTH,
  isMaterialAllowedMimeType,
  sanitizeOriginalFilename,
  type Material,
} from '@academia/shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { FileText, Link2, Upload } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Skeleton,
  Textarea,
} from '@/components/ui/primitives'
import {
  createMaterialLinkBrowser,
  deleteMaterialBrowser,
  downloadMaterialBrowser,
  listMaterialsBrowser,
  updateMaterialBrowser,
  uploadMaterialFileBrowser,
} from '@/lib/api-browser'
import {
  formatBytes,
  formatMaterialDate,
  materialKindLabel,
  materialUploadStatusLabel,
  validateMaterialDescriptionDraft,
  validateMaterialExternalUrlDraft,
  validateMaterialFile,
  validateMaterialTitleDraft,
  type MaterialsScope,
} from '@/lib/materials'

type BusyMode =
  | null
  | 'link'
  | 'upload'
  | 'edit'
  | 'delete'
  | 'download'
  | 'load'

type FormMode =
  | { type: 'idle' }
  | { type: 'create-link' }
  | { type: 'upload-file' }
  | { type: 'edit'; material: Material }

export function MaterialsSection({
  courseId,
  classSessionId,
  heading,
  canWrite,
  contextActive = true,
}: {
  courseId?: string
  classSessionId?: string
  heading: string
  canWrite: boolean
  /** When false, hide create/edit/delete (inactive course/session). */
  contextActive?: boolean
}) {
  const scope = useMemo((): MaterialsScope => {
    if (courseId && !classSessionId) return { courseId }
    if (classSessionId && !courseId) return { classSessionId }
    throw new Error(
      'MaterialsSection requires exactly one of courseId or classSessionId.',
    )
  }, [courseId, classSessionId])

  const [materials, setMaterials] = useState<Material[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState<BusyMode>(null)
  const [form, setForm] = useState<FormMode>({ type: 'idle' })
  const [deleteTarget, setDeleteTarget] = useState<Material | null>(null)

  const [linkTitle, setLinkTitle] = useState('')
  const [linkDescription, setLinkDescription] = useState('')
  const [linkUrl, setLinkUrl] = useState('')

  const [fileTitle, setFileTitle] = useState('')
  const [fileDescription, setFileDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const [editTitle, setEditTitle] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const association =
    'courseId' in scope
      ? { courseId: scope.courseId }
      : { classSessionId: scope.classSessionId }

  const writeEnabled = canWrite && contextActive
  const pending = busy !== null

  const load = useCallback(async () => {
    setBusy('load')
    setLoadError(null)
    const result = await listMaterialsBrowser(scope)
    setBusy(null)
    if (!result.ok) {
      setMaterials([])
      setLoadError(result.message)
      return
    }
    setMaterials(result.data)
  }, [scope])

  useEffect(() => {
    void load()
  }, [load])

  function resetCreateForms() {
    setLinkTitle('')
    setLinkDescription('')
    setLinkUrl('')
    setFileTitle('')
    setFileDescription('')
    setFile(null)
  }

  function openEdit(material: Material) {
    setError(null)
    setStatus(null)
    setEditTitle(material.title)
    setEditDescription(material.description ?? '')
    setForm({ type: 'edit', material })
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const titleError = validateMaterialTitleDraft(linkTitle)
    if (titleError) {
      setError(titleError)
      return
    }
    const descriptionError = validateMaterialDescriptionDraft(linkDescription)
    if (descriptionError) {
      setError(descriptionError)
      return
    }
    const urlError = validateMaterialExternalUrlDraft(linkUrl)
    if (urlError) {
      setError(urlError)
      return
    }

    setError(null)
    setStatus(null)
    setBusy('link')
    const result = await createMaterialLinkBrowser({
      kind: 'LINK',
      title: linkTitle.trim(),
      description: linkDescription.trim() || null,
      externalUrl: linkUrl.trim(),
      ...association,
    })
    setBusy(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    resetCreateForms()
    setForm({ type: 'idle' })
    setStatus('Enlace agregado.')
    setMaterials((current) => [result.data, ...current])
  }

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    const titleError = validateMaterialTitleDraft(fileTitle)
    if (titleError) {
      setError(titleError)
      return
    }
    const descriptionError = validateMaterialDescriptionDraft(fileDescription)
    if (descriptionError) {
      setError(descriptionError)
      return
    }
    if (!file) {
      setError('Seleccioná un archivo.')
      return
    }
    const fileError = validateMaterialFile(file)
    if (fileError) {
      setError(fileError)
      return
    }

    const originalFilename = sanitizeOriginalFilename(file.name)
    if (!originalFilename) {
      setError('El nombre del archivo no es válido.')
      return
    }
    if (!isMaterialAllowedMimeType(file.type)) {
      setError(
        'Tipo no permitido. Usá PDF, JPEG, PNG, WebP o audio (MP3, WAV, OGG, M4A).',
      )
      return
    }

    setError(null)
    setStatus('Subiendo archivo…')
    setBusy('upload')

    const result = await uploadMaterialFileBrowser(
      {
        title: fileTitle.trim(),
        description: fileDescription.trim() || null,
        mimeType: file.type,
        sizeBytes: file.size,
        originalFilename,
        ...association,
      },
      file,
      (phase) => {
        if (phase === 'intent') setStatus('Preparando subida…')
        if (phase === 'storage') setStatus('Enviando al almacenamiento…')
        if (phase === 'complete') setStatus('Verificando archivo…')
      },
    )
    setBusy(null)
    if (!result.ok) {
      setError(result.message)
      setStatus(null)
      return
    }

    resetCreateForms()
    setForm({ type: 'idle' })
    setStatus('Archivo subido.')
    setMaterials((current) => [result.data, ...current])
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending || form.type !== 'edit') return

    const titleError = validateMaterialTitleDraft(editTitle)
    if (titleError) {
      setError(titleError)
      return
    }
    const descriptionError = validateMaterialDescriptionDraft(editDescription)
    if (descriptionError) {
      setError(descriptionError)
      return
    }

    setError(null)
    setStatus(null)
    setBusy('edit')
    const result = await updateMaterialBrowser(form.material.id, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
    })
    setBusy(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setForm({ type: 'idle' })
    setStatus('Material actualizado.')
    setMaterials((current) =>
      current.map((item) => (item.id === result.data.id ? result.data : item)),
    )
  }

  async function confirmDelete() {
    if (pending || !deleteTarget) return
    setError(null)
    setStatus(null)
    setBusy('delete')
    const result = await deleteMaterialBrowser(deleteTarget.id)
    setBusy(null)
    if (!result.ok) {
      setError(result.message)
      return
    }
    const removedId = deleteTarget.id
    setDeleteTarget(null)
    setStatus('Material eliminado.')
    setMaterials((current) => current.filter((item) => item.id !== removedId))
  }

  async function openOrDownload(material: Material) {
    if (pending) return
    if (material.kind === 'FILE' && material.uploadStatus !== 'READY') {
      setError('El archivo todavía no está listo para descargar.')
      return
    }

    setError(null)
    setStatus(null)
    setBusy('download')
    const result = await downloadMaterialBrowser(material.id)
    setBusy(null)
    if (!result.ok) {
      setError(result.message)
      return
    }

    const url =
      result.data.kind === 'LINK'
        ? result.data.externalUrl
        : result.data.downloadUrl
    if (!url) {
      setError('No recibimos una URL de descarga.')
      return
    }
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const headingId = 'materials-heading'
  const loading = busy === 'load'

  return (
    <Card className="mt-5 p-6">
      <div className="flex items-center gap-2">
        <FileText className="size-4 text-primary" />
        <h2 id={headingId} className="font-semibold">
          {heading}
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Archivos y enlaces de este contexto. La autorización la confirma el
        servidor.
      </p>

      {!contextActive && canWrite ? (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          El contexto está inactivo: no se pueden crear ni editar materiales.
        </p>
      ) : null}

      {loadError ? (
        <div className="mt-4 flex flex-col gap-3">
          <Alert>{loadError}</Alert>
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={pending}
            >
              Reintentar
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {status ? (
        <div className="mt-4">
          <Alert tone="success">{status}</Alert>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 flex flex-col gap-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : null}

      {!loading && !loadError && materials.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Todavía no hay materiales.
        </p>
      ) : null}

      {!loading && !loadError && materials.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-3">
          {materials.map((material) => (
            <li
              key={material.id}
              className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3"
            >
              {form.type === 'edit' && form.material.id === material.id ? (
                <form
                  onSubmit={(event) => void saveEdit(event)}
                  className="flex flex-col gap-3"
                  noValidate
                >
                  <Field label="Título" htmlFor={`edit-title-${material.id}`}>
                    <Input
                      id={`edit-title-${material.id}`}
                      maxLength={MATERIAL_TITLE_MAX_LENGTH}
                      value={editTitle}
                      disabled={pending}
                      onChange={(event) => setEditTitle(event.target.value)}
                      required
                    />
                  </Field>
                  <Field
                    label="Descripción (opcional)"
                    htmlFor={`edit-description-${material.id}`}
                  >
                    <Textarea
                      id={`edit-description-${material.id}`}
                      rows={3}
                      maxLength={MATERIAL_DESCRIPTION_MAX_LENGTH}
                      value={editDescription}
                      disabled={pending}
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">
                    Solo se pueden editar título y descripción. El tipo y el
                    archivo o enlace no se modifican aquí.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm" disabled={pending}>
                      {busy === 'edit' ? 'Guardando…' : 'Guardar'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setForm({ type: 'idle' })}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{material.title}</p>
                    <Badge tone="neutral">
                      {materialKindLabel(material.kind)}
                      {material.kind === 'FILE'
                        ? ` · ${materialUploadStatusLabel(material.uploadStatus)}`
                        : null}
                    </Badge>
                  </div>
                  {material.description ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {material.description}
                    </p>
                  ) : null}
                  <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {material.kind === 'FILE' && material.originalFilename ? (
                      <div>
                        <dt className="inline">Archivo: </dt>
                        <dd className="inline text-foreground">
                          {material.originalFilename}
                          {material.sizeBytes !== null
                            ? ` (${formatBytes(material.sizeBytes)})`
                            : null}
                        </dd>
                      </div>
                    ) : null}
                    {material.kind === 'LINK' ? (
                      <div>
                        <dt className="inline">Tipo: </dt>
                        <dd className="inline text-foreground">
                          Enlace externo HTTPS
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="inline">Actualizado: </dt>
                      <dd className="inline">
                        {formatMaterialDate(material.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(material.kind === 'LINK' ||
                      material.uploadStatus === 'READY') && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void openOrDownload(material)}
                      >
                        {busy === 'download'
                          ? 'Abriendo…'
                          : material.kind === 'LINK'
                            ? 'Abrir enlace'
                            : 'Descargar'}
                      </Button>
                    )}
                    {writeEnabled ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => openEdit(material)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => {
                            setError(null)
                            setStatus(null)
                            setDeleteTarget(material)
                          }}
                        >
                          Eliminar
                        </Button>
                      </>
                    ) : null}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {writeEnabled ? (
        <div className="mt-6 flex flex-col gap-4">
          {form.type === 'idle' ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null)
                  setStatus(null)
                  setForm({ type: 'create-link' })
                }}
              >
                <Link2 className="size-4" />
                Agregar enlace
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setError(null)
                  setStatus(null)
                  setForm({ type: 'upload-file' })
                }}
              >
                <Upload className="size-4" />
                Subir archivo
              </Button>
            </div>
          ) : null}

          {form.type === 'create-link' ? (
            <form
              onSubmit={(event) => void createLink(event)}
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
              noValidate
            >
              <p className="text-sm font-semibold">Nuevo enlace</p>
              <Field label="Título" htmlFor="material-link-title">
                <Input
                  id="material-link-title"
                  maxLength={MATERIAL_TITLE_MAX_LENGTH}
                  value={linkTitle}
                  disabled={pending}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  required
                />
              </Field>
              <Field
                label="Descripción (opcional)"
                htmlFor="material-link-description"
              >
                <Textarea
                  id="material-link-description"
                  rows={2}
                  maxLength={MATERIAL_DESCRIPTION_MAX_LENGTH}
                  value={linkDescription}
                  disabled={pending}
                  onChange={(event) => setLinkDescription(event.target.value)}
                />
              </Field>
              <Field label="URL (HTTPS)" htmlFor="material-link-url">
                <Input
                  id="material-link-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={MATERIAL_EXTERNAL_URL_MAX_LENGTH}
                  value={linkUrl}
                  disabled={pending}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://"
                  required
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {busy === 'link' ? 'Guardando…' : 'Guardar enlace'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    resetCreateForms()
                    setForm({ type: 'idle' })
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}

          {form.type === 'upload-file' ? (
            <form
              onSubmit={(event) => void uploadFile(event)}
              className="flex flex-col gap-3 rounded-xl border border-border p-4"
              noValidate
            >
              <p className="text-sm font-semibold">Subir archivo</p>
              <p className="text-xs text-muted-foreground">
                PDF hasta 20&nbsp;MB, imágenes (JPEG/PNG/WebP) hasta 5&nbsp;MB,
                audio hasta 30&nbsp;MB. Sin video ni SVG. Requiere MinIO
                (profile&nbsp;materials) en desarrollo.
              </p>
              <Field label="Título" htmlFor="material-file-title">
                <Input
                  id="material-file-title"
                  maxLength={MATERIAL_TITLE_MAX_LENGTH}
                  value={fileTitle}
                  disabled={pending}
                  onChange={(event) => setFileTitle(event.target.value)}
                  required
                />
              </Field>
              <Field
                label="Descripción (opcional)"
                htmlFor="material-file-description"
              >
                <Textarea
                  id="material-file-description"
                  rows={2}
                  maxLength={MATERIAL_DESCRIPTION_MAX_LENGTH}
                  value={fileDescription}
                  disabled={pending}
                  onChange={(event) => setFileDescription(event.target.value)}
                />
              </Field>
              <Field label="Archivo" htmlFor="material-file-input">
                <Input
                  id="material-file-input"
                  type="file"
                  className="py-2 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm"
                  disabled={pending}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.m4a,application/pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null)
                  }}
                  required
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>
                  {busy === 'upload' ? 'Subiendo…' : 'Subir'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    resetCreateForms()
                    setForm({ type: 'idle' })
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {deleteTarget ? (
        <ConfirmDialog
          title="¿Eliminar este material?"
          description={`«${deleteTarget.title}» dejará de estar disponible (baja lógica).`}
          confirmLabel={busy === 'delete' ? 'Eliminando…' : 'Eliminar'}
          onConfirm={() => void confirmDelete()}
          onClose={() => {
            if (busy === 'delete') return
            setDeleteTarget(null)
          }}
        />
      ) : null}
    </Card>
  )
}
