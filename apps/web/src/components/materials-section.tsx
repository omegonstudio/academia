'use client';

import {
  MATERIAL_DESCRIPTION_MAX_LENGTH,
  MATERIAL_EXTERNAL_URL_MAX_LENGTH,
  MATERIAL_TITLE_MAX_LENGTH,
  materialDownloadResponseSchema,
  materialResponseSchema,
  materialUploadResponseSchema,
  sanitizeOriginalFilename,
  type Material,
} from '@academia/shared';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  formatBytes,
  formatMaterialDate,
  materialKindLabel,
  materialMutationErrorMessage,
  materialStoragePutErrorMessage,
  materialUploadStatusLabel,
  validateMaterialDescriptionDraft,
  validateMaterialExternalUrlDraft,
  validateMaterialFile,
  validateMaterialTitleDraft,
  type MaterialsScope,
} from '@/lib/materials';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

type BusyMode =
  | null
  | 'link'
  | 'upload'
  | 'edit'
  | 'delete'
  | 'download';

type FormMode =
  | { type: 'idle' }
  | { type: 'create-link' }
  | { type: 'upload-file' }
  | { type: 'edit'; material: Material }
  | { type: 'confirm-delete'; material: Material };

export function MaterialsSection({
  scope,
  heading,
  canWrite,
  contextActive = true,
  initialMaterials,
  loadError = null,
}: {
  scope: MaterialsScope;
  heading: string;
  canWrite: boolean;
  /** When false, hide create/edit/delete (inactive course/session). */
  contextActive?: boolean;
  initialMaterials: readonly Material[];
  loadError?: string | null;
}) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyMode>(null);
  const [form, setForm] = useState<FormMode>({ type: 'idle' });

  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  const [fileTitle, setFileTitle] = useState('');
  const [fileDescription, setFileDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const association =
    'courseId' in scope
      ? { courseId: scope.courseId }
      : { classSessionId: scope.classSessionId };

  const writeEnabled = canWrite && contextActive;
  const pending = busy !== null;

  function resetCreateForms() {
    setLinkTitle('');
    setLinkDescription('');
    setLinkUrl('');
    setFileTitle('');
    setFileDescription('');
    setFile(null);
  }

  function openEdit(material: Material) {
    setError(null);
    setStatus(null);
    setEditTitle(material.title);
    setEditDescription(material.description ?? '');
    setForm({ type: 'edit', material });
  }

  async function createLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const titleError = validateMaterialTitleDraft(linkTitle);
    if (titleError) {
      setError(titleError);
      return;
    }
    const descriptionError = validateMaterialDescriptionDraft(linkDescription);
    if (descriptionError) {
      setError(descriptionError);
      return;
    }
    const urlError = validateMaterialExternalUrlDraft(linkUrl);
    if (urlError) {
      setError(urlError);
      return;
    }

    setError(null);
    setStatus(null);
    setBusy('link');
    try {
      const response = await fetch('/api/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'LINK',
          title: linkTitle.trim(),
          description: linkDescription.trim() || null,
          externalUrl: linkUrl.trim(),
          ...association,
        }),
      });
      if (!response.ok) {
        setError(materialMutationErrorMessage(response.status, 'create'));
        return;
      }
      const parsed = materialResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        setError('Respuesta inválida del servidor.');
        return;
      }
      resetCreateForms();
      setForm({ type: 'idle' });
      setStatus('Enlace agregado.');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  async function uploadFile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const titleError = validateMaterialTitleDraft(fileTitle);
    if (titleError) {
      setError(titleError);
      return;
    }
    const descriptionError = validateMaterialDescriptionDraft(fileDescription);
    if (descriptionError) {
      setError(descriptionError);
      return;
    }
    if (!file) {
      setError('Seleccioná un archivo.');
      return;
    }
    const fileError = validateMaterialFile(file);
    if (fileError) {
      setError(fileError);
      return;
    }

    const originalFilename = sanitizeOriginalFilename(file.name);
    if (!originalFilename) {
      setError('El nombre del archivo no es válido.');
      return;
    }

    setError(null);
    setStatus('Subiendo archivo…');
    setBusy('upload');

    try {
      const intentResponse = await fetch('/api/materials/uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: fileTitle.trim(),
          description: fileDescription.trim() || null,
          mimeType: file.type,
          sizeBytes: file.size,
          originalFilename,
          ...association,
        }),
      });
      if (!intentResponse.ok) {
        setError(materialMutationErrorMessage(intentResponse.status, 'upload'));
        setStatus(null);
        return;
      }
      const intent = materialUploadResponseSchema.safeParse(
        await intentResponse.json(),
      );
      if (!intent.success) {
        setError('Respuesta inválida del servidor.');
        setStatus(null);
        return;
      }

      setStatus('Enviando al almacenamiento…');
      const putResponse = await fetch(intent.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!putResponse.ok) {
        setError(materialStoragePutErrorMessage(putResponse.status));
        setStatus(null);
        return;
      }

      setStatus('Verificando archivo…');
      const completeResponse = await fetch(
        `/api/materials/${intent.data.material.id}/complete`,
        { method: 'POST' },
      );
      if (!completeResponse.ok) {
        setError(
          materialMutationErrorMessage(completeResponse.status, 'complete'),
        );
        setStatus(null);
        return;
      }
      const completed = materialResponseSchema.safeParse(
        await completeResponse.json(),
      );
      if (!completed.success || completed.data.material.uploadStatus !== 'READY') {
        setError('El archivo no quedó disponible. Intentá de nuevo.');
        setStatus(null);
        return;
      }

      resetCreateForms();
      setForm({ type: 'idle' });
      setStatus('Archivo subido.');
      router.refresh();
    } catch {
      setError('No pudimos completar la subida. Intentá de nuevo.');
      setStatus(null);
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || form.type !== 'edit') return;

    const titleError = validateMaterialTitleDraft(editTitle);
    if (titleError) {
      setError(titleError);
      return;
    }
    const descriptionError = validateMaterialDescriptionDraft(editDescription);
    if (descriptionError) {
      setError(descriptionError);
      return;
    }

    setError(null);
    setStatus(null);
    setBusy('edit');
    try {
      const response = await fetch(`/api/materials/${form.material.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
        }),
      });
      if (!response.ok) {
        setError(materialMutationErrorMessage(response.status, 'update'));
        return;
      }
      setForm({ type: 'idle' });
      setStatus('Material actualizado.');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  async function confirmDelete() {
    if (pending || form.type !== 'confirm-delete') return;
    setError(null);
    setStatus(null);
    setBusy('delete');
    try {
      const response = await fetch(`/api/materials/${form.material.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        setError(materialMutationErrorMessage(response.status, 'delete'));
        return;
      }
      setForm({ type: 'idle' });
      setStatus('Material eliminado.');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  async function openOrDownload(material: Material) {
    if (pending) return;
    if (material.kind === 'FILE' && material.uploadStatus !== 'READY') {
      setError('El archivo todavía no está listo para descargar.');
      return;
    }

    setError(null);
    setStatus(null);
    setBusy('download');
    try {
      const response = await fetch(`/api/materials/${material.id}/download`);
      if (!response.ok) {
        setError(materialMutationErrorMessage(response.status, 'download'));
        return;
      }
      const parsed = materialDownloadResponseSchema.safeParse(
        await response.json(),
      );
      if (!parsed.success) {
        setError('Respuesta inválida del servidor.');
        return;
      }

      const url =
        parsed.data.kind === 'LINK'
          ? parsed.data.externalUrl
          : parsed.data.downloadUrl;
      if (!url) {
        setError('No recibimos una URL de descarga.');
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('No pudimos preparar la descarga. Intentá de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  const headingId = 'materials-heading';

  return (
    <section className="mt-10 max-w-2xl" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-lg font-semibold text-ink">
        {heading}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Archivos y enlaces del contexto. La autorización la confirma el
        servidor.
      </p>

      {!contextActive && canWrite ? (
        <p className="mt-3 text-sm text-ink-muted" role="status">
          El contexto está inactivo: no se pueden crear ni editar materiales.
        </p>
      ) : null}

      {loadError ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {loadError}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {status ? (
        <p role="status" className="mt-3 text-sm text-ink">
          {status}
        </p>
      ) : null}

      {!loadError && initialMaterials.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No hay materiales todavía.</p>
      ) : null}

      {!loadError && initialMaterials.length > 0 ? (
        <ul className="mt-4 space-y-4">
          {initialMaterials.map((material) => (
            <li key={material.id} className="border-b border-line pb-4">
              {form.type === 'edit' && form.material.id === material.id ? (
                <form
                  onSubmit={(event) => void saveEdit(event)}
                  className="space-y-3"
                  noValidate
                >
                  <div>
                    <label
                      className="block text-sm font-medium text-ink"
                      htmlFor={`edit-title-${material.id}`}
                    >
                      Título
                    </label>
                    <input
                      id={`edit-title-${material.id}`}
                      className={FIELD}
                      maxLength={MATERIAL_TITLE_MAX_LENGTH}
                      value={editTitle}
                      disabled={pending}
                      onChange={(event) => setEditTitle(event.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label
                      className="block text-sm font-medium text-ink"
                      htmlFor={`edit-description-${material.id}`}
                    >
                      Descripción (opcional)
                    </label>
                    <textarea
                      id={`edit-description-${material.id}`}
                      className={FIELD}
                      rows={3}
                      maxLength={MATERIAL_DESCRIPTION_MAX_LENGTH}
                      value={editDescription}
                      disabled={pending}
                      onChange={(event) =>
                        setEditDescription(event.target.value)
                      }
                    />
                  </div>
                  <p className="text-xs text-ink-muted">
                    Solo se pueden editar título y descripción. El tipo y el
                    archivo o enlace no se modifican aquí.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={pending}
                      className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
                    >
                      {busy === 'edit' ? 'Guardando…' : 'Guardar'}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setForm({ type: 'idle' })}
                      className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : form.type === 'confirm-delete' &&
                form.material.id === material.id ? (
                <div
                  className="space-y-3 rounded-md border border-line bg-surface p-4"
                  role="region"
                  aria-label="Confirmar eliminación"
                >
                  <p className="text-sm text-ink">
                    ¿Eliminar <strong>{material.title}</strong>? Dejará de
                    estar disponible.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void confirmDelete()}
                      className="rounded-md border border-danger px-3 py-2 text-sm font-medium text-danger disabled:opacity-60"
                    >
                      {busy === 'delete' ? 'Eliminando…' : 'Confirmar eliminación'}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setForm({ type: 'idle' })}
                      className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-medium text-ink">
                      {material.title}
                    </h3>
                    <span className="text-xs text-ink-muted">
                      {materialKindLabel(material.kind)}
                      {material.kind === 'FILE'
                        ? ` · ${materialUploadStatusLabel(material.uploadStatus)}`
                        : null}
                    </span>
                  </div>
                  {material.description ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">
                      {material.description}
                    </p>
                  ) : null}
                  <dl className="mt-2 space-y-1 text-xs text-ink-muted">
                    {material.kind === 'FILE' && material.originalFilename ? (
                      <div>
                        <dt className="inline">Archivo: </dt>
                        <dd className="inline text-ink">
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
                        <dd className="inline text-ink">Enlace externo HTTPS</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="inline">Actualizado: </dt>
                      <dd className="inline">
                        {formatMaterialDate(material.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(material.kind === 'LINK' ||
                      material.uploadStatus === 'READY') && (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void openOrDownload(material)}
                        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-60"
                      >
                        {busy === 'download'
                          ? 'Abriendo…'
                          : material.kind === 'LINK'
                            ? 'Abrir enlace'
                            : 'Descargar'}
                      </button>
                    )}
                    {writeEnabled ? (
                      <>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => openEdit(material)}
                          className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-60"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            setError(null);
                            setStatus(null);
                            setForm({
                              type: 'confirm-delete',
                              material,
                            });
                          }}
                          className="rounded-md border border-danger px-3 py-1.5 text-sm font-medium text-danger disabled:opacity-60"
                        >
                          Eliminar
                        </button>
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
        <div className="mt-6 space-y-4">
          {form.type === 'idle' ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setStatus(null);
                  setForm({ type: 'create-link' });
                }}
                className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
              >
                Agregar enlace
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setStatus(null);
                  setForm({ type: 'upload-file' });
                }}
                className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
              >
                Subir archivo
              </button>
            </div>
          ) : null}

          {form.type === 'create-link' ? (
            <form
              onSubmit={(event) => void createLink(event)}
              className="space-y-3 rounded-md border border-line p-4"
              noValidate
            >
              <h3 className="text-sm font-semibold text-ink">Nuevo enlace</h3>
              <div>
                <label
                  className="block text-sm font-medium text-ink"
                  htmlFor="material-link-title"
                >
                  Título
                </label>
                <input
                  id="material-link-title"
                  className={FIELD}
                  maxLength={MATERIAL_TITLE_MAX_LENGTH}
                  value={linkTitle}
                  disabled={pending}
                  onChange={(event) => setLinkTitle(event.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-ink"
                  htmlFor="material-link-description"
                >
                  Descripción (opcional)
                </label>
                <textarea
                  id="material-link-description"
                  className={FIELD}
                  rows={2}
                  maxLength={MATERIAL_DESCRIPTION_MAX_LENGTH}
                  value={linkDescription}
                  disabled={pending}
                  onChange={(event) => setLinkDescription(event.target.value)}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-ink"
                  htmlFor="material-link-url"
                >
                  URL (HTTPS)
                </label>
                <input
                  id="material-link-url"
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  className={FIELD}
                  maxLength={MATERIAL_EXTERNAL_URL_MAX_LENGTH}
                  value={linkUrl}
                  disabled={pending}
                  onChange={(event) => setLinkUrl(event.target.value)}
                  placeholder="https://"
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
                >
                  {busy === 'link' ? 'Guardando…' : 'Guardar enlace'}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    resetCreateForms();
                    setForm({ type: 'idle' });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}

          {form.type === 'upload-file' ? (
            <form
              onSubmit={(event) => void uploadFile(event)}
              className="space-y-3 rounded-md border border-line p-4"
              noValidate
            >
              <h3 className="text-sm font-semibold text-ink">Subir archivo</h3>
              <p className="text-xs text-ink-muted">
                PDF hasta 20&nbsp;MB, imágenes (JPEG/PNG/WebP) hasta 5&nbsp;MB,
                audio hasta 30&nbsp;MB. Sin video ni SVG.
              </p>
              <div>
                <label
                  className="block text-sm font-medium text-ink"
                  htmlFor="material-file-title"
                >
                  Título
                </label>
                <input
                  id="material-file-title"
                  className={FIELD}
                  maxLength={MATERIAL_TITLE_MAX_LENGTH}
                  value={fileTitle}
                  disabled={pending}
                  onChange={(event) => setFileTitle(event.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-ink"
                  htmlFor="material-file-description"
                >
                  Descripción (opcional)
                </label>
                <textarea
                  id="material-file-description"
                  className={FIELD}
                  rows={2}
                  maxLength={MATERIAL_DESCRIPTION_MAX_LENGTH}
                  value={fileDescription}
                  disabled={pending}
                  onChange={(event) => setFileDescription(event.target.value)}
                />
              </div>
              <div>
                <label
                  className="block text-sm font-medium text-ink"
                  htmlFor="material-file-input"
                >
                  Archivo
                </label>
                <input
                  id="material-file-input"
                  type="file"
                  className="mt-1 block w-full text-sm text-ink file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5"
                  disabled={pending}
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.mp3,.wav,.ogg,.m4a,application/pdf,image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                  }}
                  required
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
                >
                  {busy === 'upload' ? 'Subiendo…' : 'Subir'}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    resetCreateForms();
                    setForm({ type: 'idle' });
                  }}
                  className="rounded-md border border-line px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
