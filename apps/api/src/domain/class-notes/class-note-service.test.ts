import { beforeEach, describe, expect, it } from 'vitest';
import {
  ClassNoteForbiddenError,
  ClassNoteNotFoundError,
  ClassNoteValidationError,
  createClassNote,
  deleteClassNote,
  listClassNotes,
  updateClassNote,
} from './class-note-service.js';
import { createInMemoryClassNoteStore } from './in-memory-class-note-store.js';

describe('class-note service', () => {
  const sessionId = '11111111-1111-4111-8111-111111111111';
  const otherSessionId = '22222222-2222-4222-8222-222222222222';
  const teacherId = '44444444-4444-4444-8444-444444444444';

  let sessions = new Map([
    [
      sessionId,
      {
        id: sessionId,
        groupId: '33333333-3333-4333-8333-333333333333',
        isActive: true,
        teacherId,
      },
    ],
    [
      otherSessionId,
      {
        id: otherSessionId,
        groupId: '77777777-7777-4777-8777-777777777777',
        isActive: true,
        teacherId: '88888888-8888-4888-8888-888888888888',
      },
    ],
  ]);
  let store = createInMemoryClassNoteStore({
    findClassSession: async (id) => sessions.get(id) ?? null,
  });

  beforeEach(() => {
    sessions = new Map([
      [
        sessionId,
        {
          id: sessionId,
          groupId: '33333333-3333-4333-8333-333333333333',
          isActive: true,
          teacherId,
        },
      ],
      [
        otherSessionId,
        {
          id: otherSessionId,
          groupId: '77777777-7777-4777-8777-777777777777',
          isActive: true,
          teacherId: '88888888-8888-4888-8888-888888888888',
        },
      ],
    ]);
    store = createInMemoryClassNoteStore({
      findClassSession: async (id) => sessions.get(id) ?? null,
    });
  });

  it('creates, lists, updates and deletes notes', async () => {
    const first = await createClassNote(
      store,
      sessionId,
      { content: 'First note' },
      { mode: 'admin' },
    );
    await createClassNote(
      store,
      sessionId,
      { content: 'Second note' },
      { mode: 'admin' },
    );
    expect(first.content).toBe('First note');

    const listed = await listClassNotes(store, sessionId);
    expect(listed).toHaveLength(2);
    expect(listed.map((n) => n.content)).toEqual(
      expect.arrayContaining(['First note', 'Second note']),
    );
    // Deterministic: createdAt ASC, then id ASC
    for (let i = 1; i < listed.length; i += 1) {
      const prev = listed[i - 1]!;
      const curr = listed[i]!;
      const byCreated =
        new Date(prev.createdAt).getTime() - new Date(curr.createdAt).getTime();
      if (byCreated === 0) {
        expect(prev.id < curr.id).toBe(true);
      } else {
        expect(byCreated < 0).toBe(true);
      }
    }

    const updated = await updateClassNote(
      store,
      sessionId,
      first.id,
      { content: 'Updated note' },
      { mode: 'admin' },
    );
    expect(updated.content).toBe('Updated note');

    await deleteClassNote(store, sessionId, first.id, { mode: 'admin' });
    expect(await listClassNotes(store, sessionId)).toHaveLength(1);
  });

  it('rejects inactive sessions and foreign teachers', async () => {
    sessions.set(sessionId, {
      id: sessionId,
      groupId: '33333333-3333-4333-8333-333333333333',
      isActive: false,
      teacherId,
    });
    await expect(
      createClassNote(
        store,
        sessionId,
        { content: 'Nope' },
        { mode: 'admin' },
      ),
    ).rejects.toBeInstanceOf(ClassNoteValidationError);

    sessions.set(sessionId, {
      id: sessionId,
      groupId: '33333333-3333-4333-8333-333333333333',
      isActive: true,
      teacherId,
    });
    await expect(
      createClassNote(
        store,
        sessionId,
        { content: 'Nope' },
        { mode: 'teacher', teacherId: '99999999-9999-4999-8999-999999999999' },
      ),
    ).rejects.toBeInstanceOf(ClassNoteForbiddenError);
  });

  it('does not allow cross-session note mutation via noteId', async () => {
    const note = await createClassNote(
      store,
      sessionId,
      { content: 'Owned by session A' },
      { mode: 'admin' },
    );

    await expect(
      updateClassNote(
        store,
        otherSessionId,
        note.id,
        { content: 'Hijack' },
        { mode: 'admin' },
      ),
    ).rejects.toBeInstanceOf(ClassNoteNotFoundError);

    await expect(
      deleteClassNote(store, otherSessionId, note.id, { mode: 'admin' }),
    ).rejects.toBeInstanceOf(ClassNoteNotFoundError);

    await expect(
      updateClassNote(
        store,
        sessionId,
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        { content: 'Missing' },
        { mode: 'admin' },
      ),
    ).rejects.toBeInstanceOf(ClassNoteNotFoundError);
  });
});
