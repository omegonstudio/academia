import type { Logger } from 'pino';
import { renderEmailTemplate } from './email-template-render.js';
import type { EmailTemplateStore } from './email-template-store.js';
import type {
  EmailSender,
  NotificationPublisher,
  NotificationStore,
  NotifyInput,
} from './notification-types.js';

export function createNotificationPublisher(options: {
  store: NotificationStore;
  email: EmailSender;
  logger: Logger;
  appPublicUrl: string;
  emailTemplates?: EmailTemplateStore;
}): NotificationPublisher {
  const { store, email, logger, appPublicUrl, emailTemplates } = options;

  async function resolveEmailCopy(input: NotifyInput): Promise<{
    subject: string;
    text: string;
  }> {
    const loginUrl = `${appPublicUrl.replace(/\/$/, '')}/login`;

    if (input.templateVars && emailTemplates) {
      const template = await emailTemplates.findByType(input.type);
      if (template) {
        const vars = { loginUrl, ...input.templateVars };
        return {
          subject: renderEmailTemplate(template.subject, vars),
          text: `${renderEmailTemplate(template.body, vars)}\n`,
        };
      }
    }

    return {
      subject: input.title,
      text: `${input.body}\n\nIngresá a: ${loginUrl}\n`,
    };
  }

  async function notifyOne(input: NotifyInput) {
    const record = await store.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
    });

    try {
      const copy = await resolveEmailCopy(input);
      const result = await email.send({
        to: input.email,
        subject: copy.subject,
        text: copy.text,
      });
      if (!result.sent) {
        logger.info(
          { type: input.type, userId: input.userId, skipped: result.skipped },
          'Notification email skipped',
        );
      }
    } catch (error) {
      logger.warn(
        { err: error, type: input.type, userId: input.userId },
        'Notification email error swallowed',
      );
    }

    return record;
  }

  return {
    notify: notifyOne,
    async notifyMany(inputs) {
      for (const input of inputs) {
        try {
          await notifyOne(input);
        } catch (error) {
          logger.warn(
            { err: error, type: input.type, userId: input.userId },
            'Failed to persist notification; continuing',
          );
        }
      }
    },
  };
}
