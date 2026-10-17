'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useState } from 'react'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  FileText,
  MapPin,
  Pencil,
  UserRound,
  Users,
} from 'lucide-react'
import {
  zonedLocalDateTimeToUtc,
  type Attendance,
  type AttendanceStatus,
  type CivilDate,
  type ClassNote,
  type ClassSession,
  type Course,
  type Enrollment,
  type Group,
  type Teacher,
} from '@academia/shared'
import { DashboardShell, PageHeader } from '@/components/dashboard-shell'
import { MaterialsSection } from '@/components/materials-section'
import { useSessionUser } from '@/components/session-provider'
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
  courseServiceTypeLabels,
  createClassSessionAttendanceBrowser,
  createClassSessionNoteBrowser,
  deactivateClassSessionBrowser,
  deleteClassSessionNoteBrowser,
  getClassSessionBrowser,
  getCourseBrowser,
  getGoogleMeetStatusBrowser,
  getGroupBrowser,
  getTeacherBrowser,
  getZoomStatusBrowser,
  listClassSessionAttendanceBrowser,
  listClassSessionNotesBrowser,
  listGroupEnrollmentsBrowser,
  personFullName,
  updateClassSessionAttendanceBrowser,
  updateClassSessionBrowser,
  updateClassSessionNoteBrowser,
} from '@/lib/api-browser'
import {
  CALENDAR_DISPLAY_TIMEZONE,
  isoToAcademyDatetimeLocalValue,
  parseAcademyDatetimeLocalValue,
} from '@/lib/calendar'
import {
  attendanceMutationErrorMessage,
  attendanceStatusLabel,
  buildAttendanceRoster,
  canMutateAttendanceUi,
  studentDisplayName,
} from '@/lib/class-session-attendance'
import {
  classScheduleStatus,
  classScheduleStatusLabels,
  classScheduleStatusTones,
  formatClassScheduleLabel,
} from '@/lib/class-session-display'
import {
  canMutateNotesUi,
  classNoteMutationErrorMessage,
  validateNoteContentDraft,
} from '@/lib/class-session-notes'
import { isCivilDateInput } from '@/lib/class-session-generate'
import { canMutateMaterialsUi } from '@/lib/materials'

export default function ClassDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const user = useSessionUser()
  const [session, setSession] = useState<ClassSession | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [course, setCourse] = useState<Course | null>(null)
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [attendances, setAttendances] = useState<Attendance[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null)
  const [notes, setNotes] = useState<ClassNote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [editForm, setEditForm] = useState({
    datetimeLocal: '',
    meetingUrl: '',
    meetingDescription: '',
    createGoogleMeet: false,
    removeGoogleMeet: false,
    createZoom: false,
    removeZoom: false,
  })
  const [meetConfigured, setMeetConfigured] = useState(false)
  const [zoomConfigured, setZoomConfigured] = useState(false)
  const [attendanceBusyId, setAttendanceBusyId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editingNoteContent, setEditingNoteContent] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)

  const canMutateAttendance = canMutateAttendanceUi(user.role)
  const canMutateNotes = canMutateNotesUi(user.role)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const sessionResult = await getClassSessionBrowser(id)
    if (!sessionResult.ok) {
      setLoading(false)
      if (sessionResult.status === 404) {
        setSession(null)
        return
      }
      setError(sessionResult.message)
      return
    }

    const classSession = sessionResult.data
    setSession(classSession)
    setEditForm({
      datetimeLocal: isoToAcademyDatetimeLocalValue(classSession.startAt),
      meetingUrl: classSession.meetingUrl ?? '',
      meetingDescription: classSession.meetingDescription ?? '',
      createGoogleMeet: false,
      removeGoogleMeet: false,
      createZoom: false,
      removeZoom: false,
    })

    const [groupResult, attendanceResult, notesResult, meetStatus, zoomStatus] =
      await Promise.all([
      getGroupBrowser(classSession.groupId),
      listClassSessionAttendanceBrowser(classSession.id),
      listClassSessionNotesBrowser(classSession.id),
      getGoogleMeetStatusBrowser(),
      getZoomStatusBrowser(),
    ])

    if (meetStatus.ok) {
      setMeetConfigured(meetStatus.data.configured)
    }
    if (zoomStatus.ok) {
      setZoomConfigured(zoomStatus.data.configured)
    }

    if (groupResult.ok) {
      setGroup(groupResult.data)
      const courseResult = await getCourseBrowser(groupResult.data.courseId)
      if (courseResult.ok) setCourse(courseResult.data)

      const enrollmentsResult = await listGroupEnrollmentsBrowser(
        groupResult.data.id,
      )
      setEnrollments(enrollmentsResult.ok ? enrollmentsResult.data : null)

      const teacherId =
        groupResult.data.teacherId ?? classSession.teacherId ?? null
      if (teacherId) {
        const teacherResult = await getTeacherBrowser(teacherId)
        if (teacherResult.ok) setTeacher(teacherResult.data)
      }
    } else {
      setEnrollments(null)
      if (classSession.teacherId) {
        const fallbackTeacher = await getTeacherBrowser(classSession.teacherId)
        if (fallbackTeacher.ok) setTeacher(fallbackTeacher.data)
      }
    }

    if (attendanceResult.ok) {
      setAttendances(attendanceResult.data)
    } else if (attendanceResult.status !== 403) {
      setError(attendanceResult.message)
    }

    if (notesResult.ok) {
      setNotes(notesResult.data)
    } else if (notesResult.status !== 403) {
      setError(notesResult.message)
    }

    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const roster = useMemo(
    () =>
      buildAttendanceRoster({
        enrollments,
        attendances,
      }),
    [enrollments, attendances],
  )

  const presentCount = roster.filter((row) => row.status === 'PRESENT').length

  if (!loading && !session && !error) {
    notFound()
  }

  async function saveEdits() {
    if (!session || saving) return
    setSaving(true)
    setError('')
    setSuccess('')

    const parsed = parseAcademyDatetimeLocalValue(editForm.datetimeLocal)
    if (!parsed || !isCivilDateInput(parsed.date)) {
      setSaving(false)
      setError('Revisá la fecha y hora de inicio.')
      return
    }

    let startAt: string
    try {
      startAt = zonedLocalDateTimeToUtc(
        parsed.date as CivilDate,
        parsed.timeOfDay,
        CALENDAR_DISPLAY_TIMEZONE,
      ).toISOString()
    } catch {
      setSaving(false)
      setError('No pudimos interpretar la fecha y hora elegidas.')
      return
    }

    const meetingUrl = editForm.meetingUrl.trim()
    if (
      !editForm.createGoogleMeet &&
      !editForm.removeGoogleMeet &&
      !editForm.createZoom &&
      !editForm.removeZoom &&
      meetingUrl &&
      !/^https:\/\//i.test(meetingUrl)
    ) {
      setSaving(false)
      setError('El enlace de videollamada debe comenzar con https://')
      return
    }
    if (editForm.createGoogleMeet && !meetConfigured) {
      setSaving(false)
      setError('Google Meet no está configurado en el servidor.')
      return
    }
    if (
      editForm.createZoom &&
      !session.zoomMeetingId &&
      !zoomConfigured
    ) {
      setSaving(false)
      setError('Zoom no está configurado en el servidor.')
      return
    }
    if (
      editForm.createZoom &&
      session.zoomMeetingId &&
      !session.googleCalendarEventId &&
      !meetConfigured
    ) {
      setSaving(false)
      setError('Google Calendar no está configurado en el servidor.')
      return
    }
    if (
      (editForm.createGoogleMeet ||
        (editForm.createZoom && !session.zoomMeetingId)) &&
      new Date(startAt).getTime() < Date.now()
    ) {
      setSaving(false)
      setError(
        'No se puede crear una reunión automática para una clase en el pasado.',
      )
      return
    }

    const description = editForm.meetingDescription.trim()
    const result = await updateClassSessionBrowser(session.id, {
      startAt,
      meetingDescription: description ? description : null,
      ...(editForm.removeZoom
        ? { removeZoom: true }
        : editForm.removeGoogleMeet
          ? { removeGoogleMeet: true }
          : editForm.createZoom
            ? { createZoom: true }
            : editForm.createGoogleMeet
              ? { createGoogleMeet: true }
              : {
                  meetingUrl: meetingUrl ? meetingUrl : null,
                }),
    })
    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSession(result.data)
    setEditForm({
      datetimeLocal: isoToAcademyDatetimeLocalValue(result.data.startAt),
      meetingUrl: result.data.meetingUrl ?? '',
      meetingDescription: result.data.meetingDescription ?? '',
      createGoogleMeet: false,
      removeGoogleMeet: false,
      createZoom: false,
      removeZoom: false,
    })
    setEditing(false)
    setSuccess('Clase actualizada correctamente.')
  }

  async function confirmSoftDelete() {
    if (!session || saving) return
    setSaving(true)
    setError('')
    const result = await deactivateClassSessionBrowser(session.id)
    setSaving(false)
    setConfirmCancel(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSession(result.data)
    setSuccess('Clase cancelada correctamente.')
  }

  async function setAttendanceStatus(
    studentId: string,
    status: AttendanceStatus,
    current: AttendanceStatus | null,
  ) {
    if (!session || !canMutateAttendance) return
    setAttendanceBusyId(studentId)
    setError('')
    const result =
      current === null
        ? await createClassSessionAttendanceBrowser(session.id, {
            studentId,
            status,
          })
        : await updateClassSessionAttendanceBrowser(session.id, studentId, {
            status,
          })
    setAttendanceBusyId(null)
    if (!result.ok) {
      setError(attendanceMutationErrorMessage(result.status))
      return
    }
    setAttendances((currentRows) => {
      const without = currentRows.filter((row) => row.studentId !== studentId)
      return [...without, result.data]
    })
  }

  async function createNote() {
    if (!session || !canMutateNotes || noteBusy) return
    const validationError = validateNoteContentDraft(noteDraft)
    if (validationError) {
      setError(validationError)
      return
    }
    setNoteBusy(true)
    setError('')
    const result = await createClassSessionNoteBrowser(session.id, {
      content: noteDraft.trim(),
    })
    setNoteBusy(false)
    if (!result.ok) {
      setError(classNoteMutationErrorMessage(result.status, 'create'))
      return
    }
    setNotes((current) => [...current, result.data])
    setNoteDraft('')
    setSuccess('Nota creada correctamente.')
  }

  async function saveNoteEdit() {
    if (!session || !editingNoteId || !canMutateNotes || noteBusy) return
    const validationError = validateNoteContentDraft(editingNoteContent)
    if (validationError) {
      setError(validationError)
      return
    }
    setNoteBusy(true)
    setError('')
    const result = await updateClassSessionNoteBrowser(
      session.id,
      editingNoteId,
      { content: editingNoteContent.trim() },
    )
    setNoteBusy(false)
    if (!result.ok) {
      setError(classNoteMutationErrorMessage(result.status, 'update'))
      return
    }
    setNotes((current) =>
      current.map((note) =>
        note.id === result.data.id ? result.data : note,
      ),
    )
    setEditingNoteId(null)
    setEditingNoteContent('')
    setSuccess('Nota actualizada correctamente.')
  }

  async function removeNote(noteId: string) {
    if (!session || !canMutateNotes || noteBusy) return
    setNoteBusy(true)
    setError('')
    const result = await deleteClassSessionNoteBrowser(session.id, noteId)
    setNoteBusy(false)
    if (!result.ok) {
      setError(classNoteMutationErrorMessage(result.status, 'delete'))
      return
    }
    setNotes((current) => current.filter((note) => note.id !== noteId))
    if (editingNoteId === noteId) {
      setEditingNoteId(null)
      setEditingNoteContent('')
    }
    setSuccess('Nota eliminada correctamente.')
  }

  if (loading || !session) {
    return (
      <DashboardShell title="Detalle de clase">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </DashboardShell>
    )
  }

  const status = classScheduleStatus(session)
  const teacherLabel = teacher ? personFullName(teacher) : 'Sin asignar'

  return (
    <DashboardShell title="Detalle de clase">
      <Link
        href="/dashboard/classes"
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Volver a clases
      </Link>

      {success && (
        <div className="mb-5">
          <Alert tone="success">{success}</Alert>
        </div>
      )}
      {error && (
        <div className="mb-5">
          <Alert>{error}</Alert>
        </div>
      )}

      <PageHeader
        eyebrow={formatClassScheduleLabel(session.startAt, session.endAt)}
        title={course?.name ?? 'Clase'}
        description={group?.name ?? 'Grupo'}
        action={
          <div className="flex flex-wrap gap-2">
            {!editing && canMutateAttendance && (
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil data-icon="inline-start" />
                Editar
              </Button>
            )}
            {session.meetingUrl && (
              <a
                href={session.meetingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <ExternalLink className="size-4" />
                Ir a la clase
              </a>
            )}
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_.8fr]">
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Estado de la clase</p>
              <div className="mt-2">
                <Badge tone={classScheduleStatusTones[status]}>
                  {classScheduleStatusLabels[status]}
                </Badge>
              </div>
            </div>
            <CalendarDays className="size-5 text-primary" />
          </div>

          {editing ? (
            <div className="mt-8 flex flex-col gap-4">
              <Field label="Inicio" htmlFor="class-edit-start">
                <Input
                  id="class-edit-start"
                  type="datetime-local"
                  value={editForm.datetimeLocal}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      datetimeLocal: event.target.value,
                    }))
                  }
                />
              </Field>
              <Field
                label="Descripción de la reunión"
                htmlFor="class-edit-meet-description"
                hint="Aparece en Zoom (agenda) y/o en el evento de Google Calendar."
              >
                <Textarea
                  id="class-edit-meet-description"
                  rows={4}
                  maxLength={4000}
                  value={editForm.meetingDescription}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      meetingDescription: event.target.value,
                    }))
                  }
                />
              </Field>
              {session.zoomMeetingId ? (
                <Field
                  label="Zoom"
                  htmlFor="class-edit-remove-zoom"
                  hint="Elimina la reunión de Zoom y el evento de Calendar asociado (si existe)."
                >
                  <label
                    htmlFor="class-edit-remove-zoom"
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted/30 px-3 py-3 text-sm"
                  >
                    <input
                      id="class-edit-remove-zoom"
                      type="checkbox"
                      className="mt-0.5 size-4 accent-primary"
                      checked={editForm.removeZoom}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          removeZoom: event.target.checked,
                          createZoom: false,
                          createGoogleMeet: false,
                          removeGoogleMeet: false,
                          meetingUrl: event.target.checked
                            ? ''
                            : current.meetingUrl,
                        }))
                      }
                    />
                    <span className="font-medium text-foreground">
                      Quitar reunión de Zoom
                    </span>
                  </label>
                </Field>
              ) : null}
              {!session.zoomMeetingId &&
              (session.googleCalendarEventId || session.meetingUrl) ? (
                <Field
                  label="Google Meet"
                  htmlFor="class-edit-remove-meet"
                  hint={
                    session.googleCalendarEventId
                      ? 'Quita el evento de Google Calendar y limpia el enlace (conserva la descripción).'
                      : 'Limpia el enlace de videollamada.'
                  }
                >
                  <label
                    htmlFor="class-edit-remove-meet"
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted/30 px-3 py-3 text-sm"
                  >
                    <input
                      id="class-edit-remove-meet"
                      type="checkbox"
                      className="mt-0.5 size-4 accent-primary"
                      checked={editForm.removeGoogleMeet}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          removeGoogleMeet: event.target.checked,
                          createGoogleMeet: false,
                          createZoom: false,
                          removeZoom: false,
                          meetingUrl: event.target.checked
                            ? ''
                            : current.meetingUrl,
                        }))
                      }
                    />
                    <span className="font-medium text-foreground">
                      Quitar Meet / enlace de Google
                    </span>
                  </label>
                </Field>
              ) : null}
              {!editForm.removeGoogleMeet &&
                !editForm.removeZoom &&
                !session.zoomMeetingId &&
                !session.googleCalendarEventId &&
                !session.meetingUrl &&
                meetConfigured && (
                  <Field
                    label="Crear Google Meet"
                    htmlFor="class-edit-create-meet"
                    hint="Crea un evento en Google Calendar con enlace Meet. Excluyente con Zoom."
                  >
                    <label
                      htmlFor="class-edit-create-meet"
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted/30 px-3 py-3 text-sm"
                    >
                      <input
                        id="class-edit-create-meet"
                        type="checkbox"
                        className="mt-0.5 size-4 accent-primary"
                        checked={editForm.createGoogleMeet}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            createGoogleMeet: event.target.checked,
                            createZoom: false,
                            meetingUrl: event.target.checked
                              ? ''
                              : current.meetingUrl,
                          }))
                        }
                      />
                      <span className="font-medium text-foreground">
                        Generar enlace de Google Meet
                      </span>
                    </label>
                  </Field>
                )}
              {!editForm.removeGoogleMeet &&
                !editForm.removeZoom &&
                ((zoomConfigured &&
                  !session.zoomMeetingId &&
                  !session.googleCalendarEventId &&
                  !session.meetingUrl) ||
                  (Boolean(session.zoomMeetingId) &&
                    !session.googleCalendarEventId &&
                    meetConfigured)) && (
                  <Field
                    label={
                      session.zoomMeetingId
                        ? 'Sincronizar Google Calendar'
                        : 'Crear Zoom'
                    }
                    htmlFor="class-edit-create-zoom"
                    hint={
                      session.zoomMeetingId
                        ? 'Reintenta el evento de Calendar con el enlace de Zoom (no crea otra reunión).'
                        : 'Crea una reunión Zoom y, si Calendar está configurado, un evento con el enlace. Excluyente con Meet.'
                    }
                  >
                    <label
                      htmlFor="class-edit-create-zoom"
                      className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-muted/30 px-3 py-3 text-sm"
                    >
                      <input
                        id="class-edit-create-zoom"
                        type="checkbox"
                        className="mt-0.5 size-4 accent-primary"
                        checked={editForm.createZoom}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            createZoom: event.target.checked,
                            createGoogleMeet: false,
                            meetingUrl: event.target.checked
                              ? ''
                              : current.meetingUrl,
                          }))
                        }
                      />
                      <span className="font-medium text-foreground">
                        {session.zoomMeetingId
                          ? 'Reintentar evento en Google Calendar'
                          : 'Generar reunión de Zoom'}
                      </span>
                    </label>
                  </Field>
                )}
              {!editForm.createGoogleMeet &&
                !editForm.createZoom &&
                !editForm.removeGoogleMeet &&
                !editForm.removeZoom &&
                !session.zoomMeetingId &&
                !session.googleCalendarEventId && (
                <Field
                  label="Enlace de videollamada"
                  htmlFor="class-edit-meeting"
                  hint="Dejá vacío para quitar el enlace"
                >
                  <Input
                    id="class-edit-meeting"
                    type="url"
                    placeholder="https://..."
                    value={editForm.meetingUrl}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        meetingUrl: event.target.value,
                      }))
                    }
                  />
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void saveEdits()} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cambios'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancelar
                </Button>
                {session.isActive && (
                  <Button
                    variant="outline"
                    onClick={() => setConfirmCancel(true)}
                    disabled={saving}
                  >
                    Cancelar clase
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="mt-8 grid gap-5 sm:grid-cols-2">
                <Info
                  icon={CalendarDays}
                  label="Horario"
                  value={formatClassScheduleLabel(
                    session.startAt,
                    session.endAt,
                  )}
                />
                <Info
                  icon={Users}
                  label="Modalidad"
                  value={`${courseServiceTypeLabels[session.serviceType]} · ${session.durationMinutes} min`}
                />
                <Info icon={UserRound} label="Profesor" value={teacherLabel} />
                <Info
                  icon={MapPin}
                  label="Grupo"
                  value={group?.name ?? session.groupId}
                />
              </div>
              {session.meetingDescription ? (
                <div className="mt-6 rounded-xl border border-border bg-surface-muted/30 p-4">
                  <p className="text-xs font-medium text-muted-foreground">
                    Descripción de la reunión
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {session.meetingDescription}
                  </p>
                </div>
              ) : null}
            </>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="p-6">
            <p className="font-semibold">Asistencia</p>
            <p className="mt-3 text-2xl font-semibold">
              {presentCount} de {roster.length} presentes
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {canMutateAttendance
                ? 'Registrá presente o ausente por estudiante.'
                : 'Solo lectura de tu asistencia o del roster visible.'}
            </p>
            <div className="mt-5 flex flex-col gap-3">
              {roster.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay estudiantes para mostrar en esta clase.
                </p>
              ) : (
                roster.map((row) => (
                  <div
                    key={row.studentId}
                    className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {studentDisplayName(row)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {attendanceStatusLabel(row.status)}
                      </p>
                    </div>
                    {canMutateAttendance && session.isActive ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant={
                            row.status === 'PRESENT' ? 'primary' : 'outline'
                          }
                          disabled={attendanceBusyId === row.studentId}
                          onClick={() =>
                            void setAttendanceStatus(
                              row.studentId,
                              'PRESENT',
                              row.status,
                            )
                          }
                        >
                          Presente
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            row.status === 'ABSENT' ? 'primary' : 'outline'
                          }
                          disabled={attendanceBusyId === row.studentId}
                          onClick={() =>
                            void setAttendanceStatus(
                              row.studentId,
                              'ABSENT',
                              row.status,
                            )
                          }
                        >
                          Ausente
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-5 p-6">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-primary" />
          <p className="font-semibold">Notas de la clase</p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Notas privadas de la sesión (1–4000 caracteres).
        </p>

        {canMutateNotes && (
          <div className="mt-4 flex flex-col gap-3">
            <Field label="Nueva nota" htmlFor="class-note-draft">
              <Textarea
                id="class-note-draft"
                rows={3}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Escribí una nota…"
              />
            </Field>
            <div>
              <Button
                onClick={() => void createNote()}
                disabled={noteBusy || !noteDraft.trim()}
              >
                {noteBusy ? 'Guardando…' : 'Agregar nota'}
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay notas en esta clase.
            </p>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-border bg-surface-muted/40 px-4 py-3"
              >
                {editingNoteId === note.id ? (
                  <div className="flex flex-col gap-3">
                    <Textarea
                      rows={3}
                      value={editingNoteContent}
                      onChange={(event) =>
                        setEditingNoteContent(event.target.value)
                      }
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void saveNoteEdit()}
                        disabled={noteBusy}
                      >
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingNoteId(null)
                          setEditingNoteContent('')
                        }}
                        disabled={noteBusy}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap text-sm leading-6">
                      {note.content}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat('es-AR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(note.updatedAt))}
                    </p>
                    {canMutateNotes && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingNoteId(note.id)
                            setEditingNoteContent(note.content)
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void removeNote(note.id)}
                          disabled={noteBusy}
                        >
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <MaterialsSection
        classSessionId={session.id}
        heading="Materiales de la clase"
        canWrite={canMutateMaterialsUi(user.role)}
        contextActive={session.isActive}
      />

      {confirmCancel && (
        <ConfirmDialog
          title="¿Querés cancelar esta clase?"
          description="La clase quedará inactiva (baja lógica). Podés seguir viéndola en el listado."
          confirmLabel="Cancelar clase"
          onConfirm={() => void confirmSoftDelete()}
          onClose={() => setConfirmCancel(false)}
        />
      )}
    </DashboardShell>
  )
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarDays
  label: string
  value: string
}) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 text-primary" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}
