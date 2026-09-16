'use client';

import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import {
  CLASS_NOTE_CONTENT_MAX_LENGTH,
  type ClassNote,
} from '@academia/shared';
import {
  classNoteMutationErrorMessage,
  validateNoteContentDraft,
} from '@/lib/class-session-notes';

const FIELD =
  'mt-1 w-full rounded-md border border-line bg-surface px-3 py-2 text-ink';

export function ClassSessionNotesPanel({
  classSessionId,
  sessionActive,
  canWrite,
  initialNotes,
}: {
  classSessionId: string;
  sessionActive: boolean;
  canWrite: boolean;
  initialNotes: readonly ClassNote[];
}) {
  const router = useRouter();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  async function createNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNoteContentDraft(draft);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(`/api/classes/${classSessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft.trim() }),
      });
      if (!response.ok) {
        setError(classNoteMutationErrorMessage(response.status, 'create'));
        return;
      }
      setDraft('');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  async function saveEdit(noteId: string) {
    const validation = validateNoteContentDraft(editContent);
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/classes/${classSessionId}/notes/${noteId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editContent.trim() }),
        },
      );
      if (!response.ok) {
        setError(classNoteMutationErrorMessage(response.status, 'update'));
        return;
      }
      setEditingId(null);
      setEditContent('');
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  async function deleteNote(noteId: string) {
    setError(null);
    setPending(true);
    try {
      const response = await fetch(
        `/api/classes/${classSessionId}/notes/${noteId}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        setError(classNoteMutationErrorMessage(response.status, 'delete'));
        return;
      }
      if (editingId === noteId) {
        setEditingId(null);
        setEditContent('');
      }
      router.refresh();
    } catch {
      setError('No pudimos conectarnos. Intentá de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-10 max-w-lg" aria-labelledby="notes-heading">
      <h2 id="notes-heading" className="text-lg font-semibold text-ink">
        Notas de la clase
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Notas privadas de la sesión. La autorización la confirma el servidor.
      </p>

      {!sessionActive && canWrite ? (
        <p className="mt-3 text-sm text-ink-muted" role="status">
          La clase está inactiva: no se pueden crear ni editar notas.
        </p>
      ) : null}

      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {initialNotes.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">Todavía no hay notas.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {initialNotes.map((note) => (
            <li key={note.id} className="border-b border-line pb-4">
              {editingId === note.id && canWrite ? (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-ink" htmlFor={`note-${note.id}`}>
                    Editar nota
                  </label>
                  <textarea
                    id={`note-${note.id}`}
                    className={FIELD}
                    rows={4}
                    maxLength={CLASS_NOTE_CONTENT_MAX_LENGTH}
                    value={editContent}
                    disabled={pending}
                    onChange={(event) => setEditContent(event.target.value)}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void saveEdit(note.id)}
                      className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        setEditingId(null);
                        setEditContent('');
                      }}
                      className="rounded-md border border-line px-3 py-2 text-sm font-medium text-ink disabled:opacity-60"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-ink">{note.content}</p>
                  {canWrite && sessionActive ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          setEditingId(note.id);
                          setEditContent(note.content);
                          setError(null);
                        }}
                        className="rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-60"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => void deleteNote(note.id)}
                        className="rounded-md border border-danger px-3 py-1.5 text-sm font-medium text-danger disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && sessionActive ? (
        <form onSubmit={(event) => void createNote(event)} className="mt-6 space-y-3" noValidate>
          <div>
            <label className="block text-sm font-medium text-ink" htmlFor="new-note">
              Nueva nota
            </label>
            <textarea
              id="new-note"
              name="content"
              className={FIELD}
              rows={4}
              maxLength={CLASS_NOTE_CONTENT_MAX_LENGTH}
              value={draft}
              disabled={pending}
              onChange={(event) => setDraft(event.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-on-brand disabled:opacity-60"
          >
            {pending ? 'Guardando…' : 'Agregar nota'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
