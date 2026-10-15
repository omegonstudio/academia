import {
  markNotificationsReadResponseSchema,
  notificationListResponseSchema,
  notificationResponseSchema,
  type MarkNotificationsReadResponse,
  type Notification,
  type NotificationListResponse,
} from '@academia/shared';

async function notificationsFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    cache: 'no-store',
  });
}

export async function fetchNotifications(): Promise<NotificationListResponse> {
  const response = await notificationsFetch('/notifications');
  if (!response.ok) {
    throw new Error('No se pudieron cargar las notificaciones.');
  }
  const parsed = notificationListResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Respuesta de notificaciones inválida.');
  }
  return parsed.data;
}

export async function markNotificationRead(
  id: string,
): Promise<Notification> {
  const response = await notificationsFetch(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
  if (!response.ok) {
    throw new Error('No se pudo marcar la notificación.');
  }
  const parsed = notificationResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error('Respuesta de notificación inválida.');
  }
  return parsed.data.notification;
}

export async function markAllNotificationsRead(): Promise<MarkNotificationsReadResponse> {
  const response = await notificationsFetch('/notifications/read-all', {
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error('No se pudieron marcar las notificaciones.');
  }
  const parsed = markNotificationsReadResponseSchema.safeParse(
    await response.json(),
  );
  if (!parsed.success) {
    throw new Error('Respuesta inválida.');
  }
  return parsed.data;
}
