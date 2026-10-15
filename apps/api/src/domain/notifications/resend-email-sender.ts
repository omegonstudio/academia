import type { Logger } from 'pino';
import type { EmailSender } from './notification-types.js';

/**
 * Resend HTTP API sender. Never throws to callers — failures are logged and
 * reported as skipped so user-facing operations stay successful.
 */
export function createResendEmailSender(options: {
  apiKey: string | undefined;
  fromEmail: string | undefined;
  enabled: boolean;
  logger: Logger;
}): EmailSender {
  const { apiKey, fromEmail, enabled, logger } = options;

  return {
    async send(input) {
      if (!enabled) {
        return { sent: false, skipped: 'NOTIFICATIONS_ENABLED=false' };
      }
      if (!apiKey) {
        return { sent: false, skipped: 'RESEND_API_KEY unset' };
      }
      if (!fromEmail) {
        return { sent: false, skipped: 'RESEND_FROM_EMAIL unset' };
      }

      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [input.to],
            subject: input.subject,
            text: input.text,
          }),
        });

        if (!response.ok) {
          logger.warn(
            { status: response.status, to: input.to },
            'Resend email rejected',
          );
          return { sent: false, skipped: `resend_http_${response.status}` };
        }

        return { sent: true };
      } catch (error) {
        logger.warn({ err: error, to: input.to }, 'Resend email failed');
        return { sent: false, skipped: 'resend_network_error' };
      }
    },
  };
}

/** Test / offline double — records calls, never hits the network. */
export function createNoopEmailSender(): EmailSender & {
  sent: Array<{ to: string; subject: string; text: string }>;
} {
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  return {
    sent,
    async send(input) {
      sent.push(input);
      return { sent: false, skipped: 'noop' };
    },
  };
}
