import type { NotificationType } from '@academia/shared';
import type {
  EmailTemplateRecord,
  EmailTemplateStore,
} from './email-template-store.js';

const DEFAULTS: ReadonlyArray<{
  type: NotificationType;
  subject: string;
  body: string;
}> = [
  {
    type: 'USER_CREATED',
    subject: 'Bienvenido/a a Academia',
    body: 'Hola {{displayName}},\n\nTu cuenta de {{roleLabel}} fue creada en Academia.\nYa podés iniciar sesión aquí: {{loginUrl}}\n\nEquipo Academia',
  },
  {
    type: 'TEACHER_ASSIGNED',
    subject: 'Se te asignó un/a docente',
    body: 'Hola {{studentName}},\n\n{{teacherName}} quedó asignado/a como tu docente.\nIngresá a tu panel: {{loginUrl}}\n\nEquipo Academia',
  },
  {
    type: 'CLASS_MEETING_LINK',
    subject: 'Tu clase tiene link de Google Meet',
    body: 'Hola {{displayName}},\n\nTu clase del {{when}} ya tiene enlace de reunión:\n{{meetingUrl}}\n\nTe esperamos.\nEquipo Academia',
  },
];

export function createInMemoryEmailTemplateStore(): EmailTemplateStore & {
  clear(): void;
} {
  const byType = new Map<NotificationType, EmailTemplateRecord>();

  function seedDefaults() {
    const now = new Date();
    for (const row of DEFAULTS) {
      byType.set(row.type, { ...row, updatedAt: now });
    }
  }

  seedDefaults();

  return {
    clear() {
      byType.clear();
      seedDefaults();
    },
    async list() {
      return [...byType.values()].sort((a, b) => a.type.localeCompare(b.type));
    },
    async findByType(type) {
      return byType.get(type) ?? null;
    },
    async upsert(input) {
      const record: EmailTemplateRecord = {
        type: input.type,
        subject: input.subject,
        body: input.body,
        updatedAt: new Date(),
      };
      byType.set(input.type, record);
      return record;
    },
  };
}
