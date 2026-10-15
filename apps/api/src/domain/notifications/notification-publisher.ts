import type { Logger } from 'pino';
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
}): NotificationPublisher {
  const { store, email, logger, appPublicUrl } = options;

  async function notifyOne(input: NotifyInput) {
    const record = await store.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
    });

    const loginHint = appPublicUrl.replace(/\/$/, '');
    const text = `${input.body}\n\nIngresá a: ${loginHint}/login\n`;

    try {
      const result = await email.send({
        to: input.email,
        subject: input.title,
        text,
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
