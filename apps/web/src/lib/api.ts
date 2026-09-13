import {
  sessionResponseSchema,
  studentListResponseSchema,
  studentResponseSchema,
  teacherListResponseSchema,
  teacherResponseSchema,
  type SessionUser,
  type Student,
  type Teacher,
} from '@academia/shared';
import { cookies } from 'next/headers';

/**
 * Server-side address of the API. Distinct from the browser path (`/api`),
 * which the Next.js rewrite proxies here.
 */
const apiInternalUrl =
  process.env['API_INTERNAL_URL'] ?? 'http://localhost:4000';

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const cookieHeader = (await cookies()).toString();
  return fetch(`${apiInternalUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      cookie: cookieHeader,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
}

/**
 * Resolves the current session by asking the API.
 *
 * Authorization is never inferred from the presence of a cookie: the API
 * verifies the signature and reloads the user, so a revoked account stops
 * resolving immediately. Returns null on any failure — an unreachable API means
 * "not authenticated", never "assume authenticated".
 */
export async function getSession(): Promise<SessionUser | null> {
  try {
    const response = await apiFetch('/auth/me');
    if (!response.ok) return null;
    const parsed = sessionResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.user : null;
  } catch {
    return null;
  }
}

export type StudentsFetchResult =
  | { ok: true; students: Student[] }
  | { ok: false; status: number; message: string };

export async function fetchStudents(): Promise<StudentsFetchResult> {
  try {
    const response = await apiFetch('/students');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 403
            ? 'No tenés permiso para ver el listado de estudiantes.'
            : 'No pudimos cargar los estudiantes.',
      };
    }
    const parsed = studentListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, students: parsed.data.students };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export type StudentFetchResult =
  | { ok: true; student: Student }
  | { ok: false; status: number; message: string };

export async function fetchStudent(id: string): Promise<StudentFetchResult> {
  try {
    const response = await apiFetch(`/students/${id}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 404
            ? 'Estudiante no encontrado.'
            : response.status === 403
              ? 'No tenés permiso para ver este estudiante.'
              : 'No pudimos cargar el estudiante.',
      };
    }
    const parsed = studentResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, student: parsed.data.student };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export type TeachersFetchResult =
  | { ok: true; teachers: Teacher[] }
  | { ok: false; status: number; message: string };

export async function fetchTeachers(): Promise<TeachersFetchResult> {
  try {
    const response = await apiFetch('/teachers');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 403
            ? 'No tenés permiso para ver el listado de profesores.'
            : 'No pudimos cargar los profesores.',
      };
    }
    const parsed = teacherListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, teachers: parsed.data.teachers };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export type TeacherFetchResult =
  | { ok: true; teacher: Teacher }
  | { ok: false; status: number; message: string };

export async function fetchTeacher(id: string): Promise<TeacherFetchResult> {
  try {
    const response = await apiFetch(`/teachers/${id}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 404
            ? 'Profesor no encontrado.'
            : response.status === 403
              ? 'No tenés permiso para ver este profesor.'
              : 'No pudimos cargar el profesor.',
      };
    }
    const parsed = teacherResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, teacher: parsed.data.teacher };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}
