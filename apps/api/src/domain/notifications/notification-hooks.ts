import type { NotificationPublisher } from './notification-types.js';

/** Welcome after a new student / teacher / administrative account is created. */
export async function notifyUserCreated(
  publisher: NotificationPublisher | undefined,
  input: {
    userId: string;
    email: string;
    roleLabel: string;
    displayName: string;
  },
): Promise<void> {
  if (!publisher) return;
  await publisher.notify({
    userId: input.userId,
    email: input.email,
    type: 'USER_CREATED',
    title: 'Bienvenido/a a Academia',
    body: `Hola ${input.displayName}: tu cuenta de ${input.roleLabel} fue creada. Ya podés iniciar sesión.`,
    payload: { roleLabel: input.roleLabel },
  });
}

/** Student ↔ teacher assignment. */
export async function notifyTeacherAssigned(
  publisher: NotificationPublisher | undefined,
  input: {
    student: { userId: string; email: string; name: string };
    teacher: { userId: string; email: string; name: string };
  },
): Promise<void> {
  if (!publisher) return;
  await publisher.notifyMany([
    {
      userId: input.student.userId,
      email: input.student.email,
      type: 'TEACHER_ASSIGNED',
      title: 'Se te asignó un/a docente',
      body: `${input.teacher.name} quedó asignado/a como tu docente.`,
      payload: { teacherUserId: input.teacher.userId },
    },
    {
      userId: input.teacher.userId,
      email: input.teacher.email,
      type: 'TEACHER_ASSIGNED',
      title: 'Nuevo/a estudiante asignado/a',
      body: `${input.student.name} fue asignado/a a tu cartera.`,
      payload: { studentUserId: input.student.userId },
    },
  ]);
}

/** Class session received a meeting link. */
export async function notifyClassMeetingLink(
  publisher: NotificationPublisher | undefined,
  input: {
    recipients: Array<{ userId: string; email: string }>;
    startAtIso: string;
    meetingUrl: string;
    classSessionId: string;
  },
): Promise<void> {
  if (!publisher || input.recipients.length === 0) return;
  const when = new Date(input.startAtIso).toLocaleString('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  await publisher.notifyMany(
    input.recipients.map((recipient) => ({
      userId: recipient.userId,
      email: recipient.email,
      type: 'CLASS_MEETING_LINK' as const,
      title: 'Link de clase disponible',
      body: `Tu clase del ${when} tiene un enlace de reunión: ${input.meetingUrl}`,
      payload: {
        classSessionId: input.classSessionId,
        meetingUrl: input.meetingUrl,
        startAt: input.startAtIso,
      },
    })),
  );
}
