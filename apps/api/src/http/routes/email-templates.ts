import {
  EMAIL_TEMPLATE_PLACEHOLDERS,
  emailTemplateListResponseSchema,
  emailTemplateResponseSchema,
  googleMeetStatusResponseSchema,
  updateEmailTemplateRequestSchema,
  zoomStatusResponseSchema,
  type EmailTemplateListResponse,
  type EmailTemplateResponse,
  type GoogleMeetStatusResponse,
  type SessionUser,
  type ZoomStatusResponse,
} from '@academia/shared';
import { Router } from 'express';
import type { GoogleMeetService } from '../../domain/classes/google-meet-service.js';
import type { ZoomMeetingService } from '../../domain/classes/zoom-meeting-service.js';
import type { EmailTemplateStore } from '../../domain/notifications/email-template-store.js';
import { BadRequestError, ForbiddenError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface EmailTemplatesDependencies {
  authenticate: AuthenticateOptions;
  emailTemplates: EmailTemplateStore;
  googleMeet?: GoogleMeetService;
  zoomMeeting?: ZoomMeetingService;
}

function assertDirectorOrSuperAdmin(user: SessionUser): void {
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'DIRECTOR') {
    throw new ForbiddenError();
  }
}

function toDto(record: {
  type: string;
  subject: string;
  body: string;
  updatedAt: Date;
}) {
  return {
    type: record.type,
    subject: record.subject,
    body: record.body,
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function createEmailTemplatesRouter({
  authenticate: authOptions,
  emailTemplates,
  googleMeet,
  zoomMeeting,
}: EmailTemplatesDependencies): Router {
  const router = Router();

  router.get(
    '/email-templates',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          assertDirectorOrSuperAdmin(req.user!);
          const rows = await emailTemplates.list();
          const body: EmailTemplateListResponse = {
            templates: rows.map(toDto) as EmailTemplateListResponse['templates'],
            placeholders: [...EMAIL_TEMPLATE_PLACEHOLDERS],
          };
          emailTemplateListResponseSchema.parse(body);
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.patch(
    '/email-templates',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          assertDirectorOrSuperAdmin(req.user!);
          const parsed = updateEmailTemplateRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError(
              'Valid type, subject, and body are required.',
            );
          }
          const record = await emailTemplates.upsert({
            type: parsed.data.type,
            subject: parsed.data.subject,
            body: parsed.data.body,
            updatedByUserId: req.user!.id,
          });
          const body: EmailTemplateResponse = {
            template: toDto(record) as EmailTemplateResponse['template'],
          };
          emailTemplateResponseSchema.parse(body);
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/google-meet/status',
    authenticate(authOptions),
    (_req, res, next) => {
      void (async () => {
        try {
          const body: GoogleMeetStatusResponse = {
            configured: googleMeet?.isConfigured() ?? false,
            calendarId: googleMeet?.isConfigured()
              ? (googleMeet.calendarId() ?? null)
              : null,
          };
          googleMeetStatusResponseSchema.parse(body);
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  router.get(
    '/zoom/status',
    authenticate(authOptions),
    (_req, res, next) => {
      void (async () => {
        try {
          const body: ZoomStatusResponse = {
            configured: zoomMeeting?.isConfigured() ?? false,
          };
          zoomStatusResponseSchema.parse(body);
          res.status(200).json(body);
        } catch (error) {
          next(error);
        }
      })();
    },
  );

  return router;
}
