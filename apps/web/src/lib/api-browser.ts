/**
 * Browser-side API helpers (same-origin `/api/*` + cookie session).
 * Server Components should keep using `lib/api.ts` + `API_INTERNAL_URL`.
 */

import {
  assignGroupTeacherRequestSchema,
  assignTeacherRequestSchema,
  attendanceListResponseSchema,
  attendanceResponseSchema,
  chargeListResponseSchema,
  chargeResponseSchema,
  classNoteListResponseSchema,
  classNoteResponseSchema,
  classSessionCalendarResponseSchema,
  classSessionListResponseSchema,
  classSessionResponseSchema,
  courseListResponseSchema,
  courseResponseSchema,
  createAttendanceRequestSchema,
  createChargeRequestSchema,
  createClassNoteRequestSchema,
  createClassSessionRequestSchema,
  createCourseRequestSchema,
  createGroupRequestSchema,
  createMaterialRequestSchema,
  createMaterialUploadRequestSchema,
  createPaymentRequestSchema,
  createRefundRequestSchema,
  createStudentRequestSchema,
  createTeacherRequestSchema,
  createTeacherSettlementRequestSchema,
  enrollStudentRequestSchema,
  enrollmentListResponseSchema,
  enrollmentResponseSchema,
  financeSettingsResponseSchema,
  generateClassSessionsRequestSchema,
  generateClassSessionsResponseSchema,
  groupListResponseSchema,
  groupResponseSchema,
  groupTeacherResponseSchema,
  managePermissionRequestSchema,
  markTeacherSettlementPaidRequestSchema,
  materialDownloadResponseSchema,
  materialListResponseSchema,
  materialResponseSchema,
  materialUploadResponseSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
  permissionListResponseSchema,
  permissionMutationResponseSchema,
  provisionAdministrativeRequestSchema,
  refundResponseSchema,
  revenueAllocationListResponseSchema,
  scheduleOptionListResponseSchema,
  sessionResponseSchema,
  studentListResponseSchema,
  studentResponseSchema,
  studentAttendanceListResponseSchema,
  studentFinanceCheckoutResponseSchema,
  studentFinanceResponseSchema,
  teacherAttendanceListResponseSchema,
  teacherAssignmentResponseSchema,
  teacherHubStudentListResponseSchema,
  teacherListResponseSchema,
  teacherResponseSchema,
  teacherSettlementListResponseSchema,
  teacherSettlementResponseSchema,
  updateAttendanceRequestSchema,
  updateClassNoteRequestSchema,
  updateClassSessionRequestSchema,
  updateCourseRequestSchema,
  updateFinanceSettingsRequestSchema,
  updateGroupRequestSchema,
  updateMaterialRequestSchema,
  updateStudentRequestSchema,
  updateTeacherRequestSchema,
  type AcademyPercentage,
  type AllocationListQuery,
  type Attendance,
  type Charge,
  type ChargeListQuery,
  type CivilDate,
  type ClassNote,
  type ClassSession,
  type ClassSessionCalendarEvent,
  type Course,
  type CourseServiceType,
  type CourseType,
  type CreateAttendanceRequest,
  type CreateChargeRequest,
  type CreateClassNoteRequest,
  type CreateClassSessionRequest,
  type CreateCourseRequest,
  type CreateGroupRequest,
  type CreateMaterialLinkRequest,
  type CreateMaterialUploadRequest,
  type CreatePaymentRequest,
  type CreateStudentRequest,
  type CreateTeacherRequest,
  type CreateTeacherSettlementRequest,
  type Enrollment,
  type FinanceSettings,
  type GenerateClassSessionsRequest,
  type GenerateClassSessionsResponse,
  type Group,
  type GroupTeacherResponse,
  type ManagePermissionRequest,
  type Material,
  type MaterialDownloadResponse,
  type MaterialUploadResponse,
  type Payment,
  type PaymentListQuery,
  type PermissionRef,
  type ProvisionAdministrativeRequest,
  type Refund,
  type RevenueAllocation,
  type ScheduleOption,
  type SessionUser,
  type SettlementListQuery,
  type Student,
  type StudentAttendanceItem,
  type StudentFinanceCheckoutResponse,
  type StudentFinanceResponse,
  type Teacher,
  type TeacherAttendanceItem,
  type TeacherHubStudent,
  type TeacherAssignment,
  type TeacherSettlement,
  type UpdateAttendanceRequest,
  type UpdateClassNoteRequest,
  type UpdateClassSessionRequest,
  type UpdateCourseRequest,
  type UpdateGroupRequest,
  type UpdateMaterialRequest,
  type UpdateStudentRequest,
  type UpdateTeacherRequest,
} from '@academia/shared';
import {
  materialMutationErrorMessage,
  materialsListPath,
  materialStoragePutErrorMessage,
  type MaterialsScope,
} from './materials';
import { identityMutationErrorMessage } from './stage1-identity';

export type BrowserApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string };

async function browserFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
}

function genericError(status: number, fallback: string): string {
  if (status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión.';
  if (status === 403) return 'No tenés permiso para esta acción.';
  if (status === 404) return 'No encontramos ese recurso.';
  if (status === 409) {
    return 'Hay un conflicto con el estado actual (duplicado o transición inválida).';
  }
  if (status === 400) return 'Revisá los datos e intentá de nuevo.';
  return fallback;
}

function classSessionWriteError(status: number, fallback: string): string {
  if (status === 409) {
    return 'Esa clase se solapa con otra del mismo profesor.';
  }
  return genericError(status, fallback);
}

export async function listStudentsBrowser(): Promise<
  BrowserApiResult<Student[]>
> {
  try {
    const response = await browserFetch('/students');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar los estudiantes.',
        ),
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
    return { ok: true, data: parsed.data.students };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getStudentBrowser(
  id: string,
): Promise<BrowserApiResult<Student>> {
  try {
    const response = await browserFetch(`/students/${id}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el estudiante.',
        ),
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
    return { ok: true, data: parsed.data.student };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

/** Session student profile — never pass a studentId from the client. */
export async function getStudentMeBrowser(): Promise<BrowserApiResult<Student>> {
  try {
    const response = await browserFetch('/students/me');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 404
            ? 'No encontramos tu perfil de estudiante. Contactá a la academia.'
            : genericError(
                response.status,
                'No pudimos cargar tu perfil de estudiante.',
              ),
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
    return { ok: true, data: parsed.data.student };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listStudentMeMaterialsBrowser(): Promise<
  BrowserApiResult<Material[]>
> {
  try {
    const response = await browserFetch('/students/me/materials');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar tus materiales.',
        ),
      };
    }
    const parsed = materialListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.materials };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

/** Session teacher profile — never pass a teacherId from the client. */
export async function getTeacherMeBrowser(): Promise<BrowserApiResult<Teacher>> {
  try {
    const response = await browserFetch('/teachers/me');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 404
            ? 'No encontramos tu perfil de profesor. Contactá a la academia.'
            : genericError(
                response.status,
                'No pudimos cargar tu perfil de profesor.',
              ),
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
    return { ok: true, data: parsed.data.teacher };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listTeacherMeStudentsBrowser(): Promise<
  BrowserApiResult<TeacherHubStudent[]>
> {
  try {
    const response = await browserFetch('/teachers/me/students');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar tus alumnos.',
        ),
      };
    }
    const parsed = teacherHubStudentListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.students };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listTeacherMeMaterialsBrowser(): Promise<
  BrowserApiResult<Material[]>
> {
  try {
    const response = await browserFetch('/teachers/me/materials');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar tus materiales.',
        ),
      };
    }
    const parsed = materialListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.materials };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listTeacherMeAttendanceBrowser(
  from: CivilDate,
  to: CivilDate,
): Promise<BrowserApiResult<TeacherAttendanceItem[]>> {
  try {
    const query = new URLSearchParams({ from, to });
    const response = await browserFetch(
      `/teachers/me/attendance?${query.toString()}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 400
            ? 'El rango de fechas no es válido.'
            : genericError(
                response.status,
                'No pudimos cargar la asistencia.',
              ),
      };
    }
    const parsed = teacherAttendanceListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.attendances };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listStudentMeAttendanceBrowser(
  from: CivilDate,
  to: CivilDate,
): Promise<BrowserApiResult<StudentAttendanceItem[]>> {
  try {
    const query = new URLSearchParams({ from, to });
    const response = await browserFetch(
      `/students/me/attendance?${query.toString()}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 400
            ? 'El rango de fechas no es válido.'
            : genericError(
                response.status,
                'No pudimos cargar tu asistencia.',
              ),
      };
    }
    const parsed = studentAttendanceListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.attendances };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

/** Session student finance portal — never pass a studentId from the client. */
export async function getStudentMeFinanceBrowser(): Promise<
  BrowserApiResult<StudentFinanceResponse>
> {
  try {
    const response = await browserFetch('/students/me/finance');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar tu información financiera.',
        ),
      };
    }
    const parsed = studentFinanceResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

/** Start checkout for an owned OPEN charge — session student only. */
export async function payStudentMeFinanceChargeBrowser(
  chargeId: string,
): Promise<BrowserApiResult<StudentFinanceCheckoutResponse>> {
  try {
    const response = await browserFetch(
      `/students/me/finance/charges/${encodeURIComponent(chargeId)}/pay`,
      { method: 'POST' },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos iniciar el pago. Intentá de nuevo.',
        ),
      };
    }
    const parsed = studentFinanceCheckoutResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createStudentBrowser(
  body: CreateStudentRequest,
): Promise<BrowserApiResult<Student>> {
  const validated = createStudentRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch('/students', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos crear el estudiante.',
        ),
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
    return { ok: true, data: parsed.data.student };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateStudentBrowser(
  id: string,
  body: UpdateStudentRequest,
): Promise<BrowserApiResult<Student>> {
  const validated = updateStudentRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/students/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos actualizar el estudiante.',
        ),
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
    return { ok: true, data: parsed.data.student };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function deactivateStudentBrowser(
  id: string,
): Promise<BrowserApiResult<Student>> {
  try {
    const response = await browserFetch(`/students/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos desactivar el estudiante.',
        ),
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
    return { ok: true, data: parsed.data.student };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getStudentTeacherBrowser(
  studentId: string,
): Promise<BrowserApiResult<TeacherAssignment | null>> {
  try {
    const response = await browserFetch(`/students/${studentId}/teacher`);
    if (response.status === 404) {
      return { ok: true, data: null };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el profesor asignado.',
        ),
      };
    }
    const parsed = teacherAssignmentResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.assignment };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listTeachersBrowser(): Promise<
  BrowserApiResult<Teacher[]>
> {
  try {
    const response = await browserFetch('/teachers');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar los profesores.',
        ),
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
    return { ok: true, data: parsed.data.teachers };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getTeacherBrowser(
  id: string,
): Promise<BrowserApiResult<Teacher>> {
  try {
    const response = await browserFetch(`/teachers/${id}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el profesor.',
        ),
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
    return { ok: true, data: parsed.data.teacher };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createTeacherBrowser(
  body: CreateTeacherRequest,
): Promise<BrowserApiResult<Teacher>> {
  const validated = createTeacherRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch('/teachers', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos crear el profesor.',
        ),
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
    return { ok: true, data: parsed.data.teacher };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateTeacherBrowser(
  id: string,
  body: UpdateTeacherRequest,
): Promise<BrowserApiResult<Teacher>> {
  const validated = updateTeacherRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/teachers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos actualizar el profesor.',
        ),
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
    return { ok: true, data: parsed.data.teacher };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function deactivateTeacherBrowser(
  id: string,
): Promise<BrowserApiResult<Teacher>> {
  try {
    const response = await browserFetch(`/teachers/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos desactivar el profesor.',
        ),
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
    return { ok: true, data: parsed.data.teacher };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function assignTeacherBrowser(
  studentId: string,
  teacherId: string,
): Promise<BrowserApiResult<TeacherAssignment>> {
  const validated = assignTeacherRequestSchema.safeParse({ teacherId });
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/students/${studentId}/teacher`, {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos asignar el profesor.',
        ),
      };
    }
    const parsed = teacherAssignmentResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.assignment };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function unassignTeacherBrowser(
  studentId: string,
): Promise<BrowserApiResult<null>> {
  try {
    const response = await browserFetch(`/students/${studentId}/teacher`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos quitar la asignación.',
        ),
      };
    }
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listCoursesBrowser(): Promise<
  BrowserApiResult<Course[]>
> {
  try {
    const response = await browserFetch('/courses');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar los cursos.',
        ),
      };
    }
    const parsed = courseListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.courses };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getCourseBrowser(
  id: string,
): Promise<BrowserApiResult<Course>> {
  try {
    const response = await browserFetch(`/courses/${id}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos cargar el curso.'),
      };
    }
    const parsed = courseResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.course };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createCourseBrowser(
  body: CreateCourseRequest,
): Promise<BrowserApiResult<Course>> {
  const validated = createCourseRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch('/courses', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos crear el curso.'),
      };
    }
    const parsed = courseResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.course };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateCourseBrowser(
  id: string,
  body: UpdateCourseRequest,
): Promise<BrowserApiResult<Course>> {
  const validated = updateCourseRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos actualizar el curso.',
        ),
      };
    }
    const parsed = courseResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.course };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function deactivateCourseBrowser(
  id: string,
): Promise<BrowserApiResult<Course>> {
  try {
    const response = await browserFetch(`/courses/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos desactivar el curso.',
        ),
      };
    }
    const parsed = courseResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.course };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listGroupsBrowser(): Promise<BrowserApiResult<Group[]>> {
  try {
    const response = await browserFetch('/groups');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos cargar los grupos.'),
      };
    }
    const parsed = groupListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.groups };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getGroupBrowser(
  id: string,
): Promise<BrowserApiResult<Group>> {
  try {
    const response = await browserFetch(`/groups/${id}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos cargar el grupo.'),
      };
    }
    const parsed = groupResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.group };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createGroupBrowser(
  body: CreateGroupRequest,
): Promise<BrowserApiResult<Group>> {
  const validated = createGroupRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch('/groups', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos crear el grupo.'),
      };
    }
    const parsed = groupResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.group };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateGroupBrowser(
  id: string,
  body: UpdateGroupRequest,
): Promise<BrowserApiResult<Group>> {
  const validated = updateGroupRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos actualizar el grupo.',
        ),
      };
    }
    const parsed = groupResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.group };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function deactivateGroupBrowser(
  id: string,
): Promise<BrowserApiResult<Group>> {
  try {
    const response = await browserFetch(`/groups/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos desactivar el grupo.',
        ),
      };
    }
    const parsed = groupResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.group };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getGroupTeacherBrowser(
  groupId: string,
): Promise<BrowserApiResult<GroupTeacherResponse | null>> {
  try {
    const response = await browserFetch(`/groups/${groupId}/teacher`);
    if (response.status === 404) {
      return { ok: true, data: null };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el profesor del grupo.',
        ),
      };
    }
    const parsed = groupTeacherResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function assignGroupTeacherBrowser(
  groupId: string,
  teacherId: string,
): Promise<BrowserApiResult<GroupTeacherResponse>> {
  const validated = assignGroupTeacherRequestSchema.safeParse({ teacherId });
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/groups/${groupId}/teacher`, {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos asignar el profesor al grupo.',
        ),
      };
    }
    const parsed = groupTeacherResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function unassignGroupTeacherBrowser(
  groupId: string,
): Promise<BrowserApiResult<null>> {
  try {
    const response = await browserFetch(`/groups/${groupId}/teacher`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos quitar el profesor del grupo.',
        ),
      };
    }
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listScheduleOptionsBrowser(): Promise<
  BrowserApiResult<ScheduleOption[]>
> {
  try {
    const response = await browserFetch('/schedule-options');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar las franjas horarias.',
        ),
      };
    }
    const parsed = scheduleOptionListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.scheduleOptions };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listGroupEnrollmentsBrowser(
  groupId: string,
): Promise<BrowserApiResult<Enrollment[]>> {
  try {
    const response = await browserFetch(`/groups/${groupId}/students`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar los estudiantes del grupo.',
        ),
      };
    }
    const parsed = enrollmentListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.enrollments };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function enrollStudentInGroupBrowser(
  groupId: string,
  studentId: string,
): Promise<BrowserApiResult<Enrollment>> {
  const validated = enrollStudentRequestSchema.safeParse({ studentId });
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/groups/${groupId}/students`, {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      let message = genericError(
        response.status,
        'No pudimos inscribir al estudiante.',
      );
      if (response.status === 400) {
        try {
          const body = (await response.json()) as {
            error?: { message?: string };
          };
          const apiMessage = body.error?.message ?? '';
          if (apiMessage.includes('full') || apiMessage.includes('maximum')) {
            message =
              'El grupo ya tiene 15 estudiantes. Sacá a alguien antes de inscribir otro.';
          } else if (apiMessage.includes('already enrolled')) {
            message = 'Ese estudiante ya está inscrito en este grupo.';
          } else if (apiMessage.includes('inactive')) {
            message = 'El grupo o el estudiante no está activo.';
          }
        } catch {
          /* keep generic */
        }
      }
      return { ok: false, status: response.status, message };
    }
    const parsed = enrollmentResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.enrollment };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function unenrollStudentFromGroupBrowser(
  groupId: string,
  studentId: string,
): Promise<BrowserApiResult<null>> {
  try {
    const response = await browserFetch(
      `/groups/${groupId}/students/${studentId}`,
      { method: 'DELETE' },
    );
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos dar de baja al estudiante del grupo.',
        ),
      };
    }
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listClassSessionsBrowser(
  groupId?: string,
): Promise<BrowserApiResult<ClassSession[]>> {
  try {
    const query = groupId
      ? `?${new URLSearchParams({ groupId }).toString()}`
      : '';
    const response = await browserFetch(`/classes${query}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar las clases.',
        ),
      };
    }
    const parsed = classSessionListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.classSessions };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getClassSessionBrowser(
  id: string,
): Promise<BrowserApiResult<ClassSession>> {
  try {
    const response = await browserFetch(`/classes/${id}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos cargar la clase.'),
      };
    }
    const parsed = classSessionResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.classSession };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createClassSessionBrowser(
  body: CreateClassSessionRequest,
): Promise<BrowserApiResult<ClassSession>> {
  const validated = createClassSessionRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch('/classes', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      let message = classSessionWriteError(
        response.status,
        'No pudimos crear la clase.',
      );
      if (response.status === 400) {
        try {
          const bodyJson = (await response.json()) as {
            error?: { message?: string };
          };
          const apiMessage = bodyJson.error?.message ?? '';
          if (apiMessage.includes('schedule option')) {
            message =
              'El grupo necesita una franja horaria asignada antes de crear clases.';
          } else if (apiMessage.includes('inactive')) {
            message = 'El grupo o el curso no está activo.';
          }
        } catch {
          /* keep mapped message */
        }
      }
      return { ok: false, status: response.status, message };
    }
    const parsed = classSessionResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.classSession };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateClassSessionBrowser(
  id: string,
  body: UpdateClassSessionRequest,
): Promise<BrowserApiResult<ClassSession>> {
  const validated = updateClassSessionRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: classSessionWriteError(
          response.status,
          'No pudimos actualizar la clase.',
        ),
      };
    }
    const parsed = classSessionResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.classSession };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function deactivateClassSessionBrowser(
  id: string,
): Promise<BrowserApiResult<ClassSession>> {
  try {
    const response = await browserFetch(`/classes/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cancelar la clase.',
        ),
      };
    }
    const parsed = classSessionResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.classSession };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function generateClassSessionsBrowser(
  groupId: string,
  body: GenerateClassSessionsRequest,
): Promise<BrowserApiResult<GenerateClassSessionsResponse>> {
  const validated = generateClassSessionsRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá el rango de fechas e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(
      `/groups/${groupId}/classes/generate`,
      {
        method: 'POST',
        body: JSON.stringify(validated.data),
      },
    );
    if (!response.ok) {
      let message = genericError(
        response.status,
        'No pudimos generar las clases.',
      );
      if (response.status === 400) {
        message =
          'No se pudo generar. Revisá el grupo, el rango de fechas y que el grupo tenga franja horaria asignada.';
      } else if (response.status === 403) {
        message = 'No tenés permiso para generar clases.';
      } else if (response.status === 404) {
        message = 'No encontramos el grupo.';
      } else if (response.status === 409) {
        message = 'Hay un conflicto que impide completar la generación.';
      }
      return { ok: false, status: response.status, message };
    }
    const parsed = generateClassSessionsResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listClassSessionCalendarBrowser(
  from: CivilDate,
  to: CivilDate,
): Promise<
  BrowserApiResult<{
    from: CivilDate;
    to: CivilDate;
    classSessions: ClassSessionCalendarEvent[];
  }>
> {
  try {
    const query = new URLSearchParams({ from, to });
    const response = await browserFetch(
      `/classes/calendar?${query.toString()}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 400
            ? 'El rango de fechas del calendario no es válido.'
            : genericError(
                response.status,
                'No pudimos cargar el calendario.',
              ),
      };
    }
    const parsed = classSessionCalendarResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return {
      ok: true,
      data: {
        from: parsed.data.from,
        to: parsed.data.to,
        classSessions: parsed.data.classSessions,
      },
    };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listClassSessionAttendanceBrowser(
  classSessionId: string,
): Promise<BrowserApiResult<Attendance[]>> {
  try {
    const response = await browserFetch(
      `/classes/${classSessionId}/attendance`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar la asistencia.',
        ),
      };
    }
    const parsed = attendanceListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.attendances };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createClassSessionAttendanceBrowser(
  classSessionId: string,
  body: CreateAttendanceRequest,
): Promise<BrowserApiResult<Attendance>> {
  const validated = createAttendanceRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(
      `/classes/${classSessionId}/attendance`,
      {
        method: 'POST',
        body: JSON.stringify(validated.data),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos registrar la asistencia.',
        ),
      };
    }
    const parsed = attendanceResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.attendance };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateClassSessionAttendanceBrowser(
  classSessionId: string,
  studentId: string,
  body: UpdateAttendanceRequest,
): Promise<BrowserApiResult<Attendance>> {
  const validated = updateAttendanceRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(
      `/classes/${classSessionId}/attendance/${studentId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(validated.data),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos actualizar la asistencia.',
        ),
      };
    }
    const parsed = attendanceResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.attendance };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listClassSessionNotesBrowser(
  classSessionId: string,
): Promise<BrowserApiResult<ClassNote[]>> {
  try {
    const response = await browserFetch(`/classes/${classSessionId}/notes`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos cargar las notas.'),
      };
    }
    const parsed = classNoteListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.notes };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createClassSessionNoteBrowser(
  classSessionId: string,
  body: CreateClassNoteRequest,
): Promise<BrowserApiResult<ClassNote>> {
  const validated = createClassNoteRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá el contenido de la nota (1–4000 caracteres).',
    };
  }
  try {
    const response = await browserFetch(`/classes/${classSessionId}/notes`, {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos crear la nota.'),
      };
    }
    const parsed = classNoteResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.note };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateClassSessionNoteBrowser(
  classSessionId: string,
  noteId: string,
  body: UpdateClassNoteRequest,
): Promise<BrowserApiResult<ClassNote>> {
  const validated = updateClassNoteRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá el contenido de la nota (1–4000 caracteres).',
    };
  }
  try {
    const response = await browserFetch(
      `/classes/${classSessionId}/notes/${noteId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(validated.data),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos actualizar la nota.',
        ),
      };
    }
    const parsed = classNoteResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.note };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function deleteClassSessionNoteBrowser(
  classSessionId: string,
  noteId: string,
): Promise<BrowserApiResult<null>> {
  try {
    const response = await browserFetch(
      `/classes/${classSessionId}/notes/${noteId}`,
      { method: 'DELETE' },
    );
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos eliminar la nota.',
        ),
      };
    }
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export function personFullName(person: {
  firstName: string;
  lastName: string;
}): string {
  return `${person.firstName} ${person.lastName}`;
}

export const teacherAvailabilityLabels: Record<
  Teacher['availability'],
  string
> = {
  AVAILABLE: 'Disponible',
  UNAVAILABLE: 'No disponible',
  LIMITED: 'Disponibilidad limitada',
};

export const courseTypeLabels: Record<CourseType, string> = {
  REGULAR: 'Regular',
  TEACHER_TRAINING: 'Formación docente',
};

export const courseServiceTypeLabels: Record<CourseServiceType, string> = {
  ONE_TO_ONE_60: 'Individual · 60 min',
  ONE_TO_ONE_90: 'Individual · 90 min',
  GROUP_120: 'Grupal · 120 min',
};

/** Convert major units (e.g. "1500.50") to integer minor-unit string. */
export function priceMajorToAmountMinor(
  major: string,
): string | null {
  const trimmed = major.trim();
  if (!trimmed) return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(trimmed)) return null;
  const normalized = trimmed.replace(',', '.');
  const [whole = '0', fraction = ''] = normalized.split('.');
  const cents = `${fraction}00`.slice(0, 2);
  const minor = `${whole}${cents}`.replace(/^0+(?=\d)/, '');
  return minor === '' ? '0' : minor;
}

/** Display amountMinor (integer string) as major units for forms. */
export function amountMinorToPriceMajor(
  amountMinor: string | null,
): string {
  if (!amountMinor) return '';
  const padded = amountMinor.padStart(3, '0');
  const whole = padded.slice(0, -2).replace(/^0+(?=\d)/, '') || '0';
  const cents = padded.slice(-2);
  return cents === '00' ? whole : `${whole}.${cents}`;
}

export async function listMaterialsBrowser(
  scope: MaterialsScope,
): Promise<BrowserApiResult<Material[]>> {
  try {
    const response = await browserFetch(materialsListPath(scope));
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: materialMutationErrorMessage(response.status, 'list'),
      };
    }
    const parsed = materialListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.materials };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createMaterialLinkBrowser(
  body: CreateMaterialLinkRequest,
): Promise<BrowserApiResult<Material>> {
  const validated = createMaterialRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá título y URL (HTTPS absoluto).',
    };
  }
  try {
    const response = await browserFetch('/materials', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: materialMutationErrorMessage(response.status, 'create'),
      };
    }
    const parsed = materialResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.material };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createMaterialUploadBrowser(
  body: CreateMaterialUploadRequest,
): Promise<BrowserApiResult<MaterialUploadResponse>> {
  const validated = createMaterialUploadRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá el archivo (tipo, tamaño y nombre).',
    };
  }
  try {
    const response = await browserFetch('/materials/uploads', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: materialMutationErrorMessage(response.status, 'upload'),
      };
    }
    const parsed = materialUploadResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: materialMutationErrorMessage(503, 'upload'),
    };
  }
}

/** Step 2 of FILE upload: PUT bytes directly to the presigned MinIO/Spaces URL. */
export async function putMaterialFileToStorageBrowser(
  uploadUrl: string,
  file: File,
): Promise<BrowserApiResult<null>> {
  try {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: materialStoragePutErrorMessage(response.status),
      };
    }
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      status: 503,
      message: materialStoragePutErrorMessage(0),
    };
  }
}

export async function completeMaterialUploadBrowser(
  id: string,
): Promise<BrowserApiResult<Material>> {
  try {
    const response = await browserFetch(`/materials/${id}/complete`, {
      method: 'POST',
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: materialMutationErrorMessage(response.status, 'complete'),
      };
    }
    const parsed = materialResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.material };
  } catch {
    return {
      ok: false,
      status: 503,
      message: materialMutationErrorMessage(503, 'complete'),
    };
  }
}

export async function updateMaterialBrowser(
  id: string,
  body: UpdateMaterialRequest,
): Promise<BrowserApiResult<Material>> {
  const validated = updateMaterialRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá título y descripción.',
    };
  }
  try {
    const response = await browserFetch(`/materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: materialMutationErrorMessage(response.status, 'update'),
      };
    }
    const parsed = materialResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.material };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function deleteMaterialBrowser(
  id: string,
): Promise<BrowserApiResult<null>> {
  try {
    const response = await browserFetch(`/materials/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        status: response.status,
        message: materialMutationErrorMessage(response.status, 'delete'),
      };
    }
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function downloadMaterialBrowser(
  id: string,
): Promise<BrowserApiResult<MaterialDownloadResponse>> {
  try {
    const response = await browserFetch(`/materials/${id}/download`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: materialMutationErrorMessage(response.status, 'download'),
      };
    }
    const parsed = materialDownloadResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data };
  } catch {
    return {
      ok: false,
      status: 503,
      message: materialMutationErrorMessage(503, 'download'),
    };
  }
}

/**
 * Full FILE upload: intent → PUT to storage → complete.
 * Does not fake success if MinIO/Spaces is unreachable.
 */
export async function uploadMaterialFileBrowser(
  body: CreateMaterialUploadRequest,
  file: File,
  onProgress?: (phase: 'intent' | 'storage' | 'complete') => void,
): Promise<BrowserApiResult<Material>> {
  onProgress?.('intent');
  const intent = await createMaterialUploadBrowser(body);
  if (!intent.ok) return intent;

  onProgress?.('storage');
  const put = await putMaterialFileToStorageBrowser(intent.data.uploadUrl, file);
  if (!put.ok) return put;

  onProgress?.('complete');
  const completed = await completeMaterialUploadBrowser(intent.data.material.id);
  if (!completed.ok) return completed;
  if (completed.data.uploadStatus !== 'READY') {
    return {
      ok: false,
      status: 500,
      message: 'El archivo no quedó disponible. Intentá de nuevo.',
    };
  }
  return completed;
}

export async function listPermissionCatalogBrowser(): Promise<
  BrowserApiResult<PermissionRef[]>
> {
  try {
    const response = await browserFetch('/permissions/catalog');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: identityMutationErrorMessage(response.status, 'permission'),
      };
    }
    const parsed = permissionListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.permissions };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listAdministrativePermissionGrantsBrowser(): Promise<
  BrowserApiResult<PermissionRef[]>
> {
  try {
    const response = await browserFetch('/roles/administrative/permissions');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: identityMutationErrorMessage(response.status, 'permission'),
      };
    }
    const parsed = permissionListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.permissions };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function grantAdministrativePermissionBrowser(
  body: ManagePermissionRequest,
): Promise<BrowserApiResult<PermissionRef>> {
  const validated = managePermissionRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Ese permiso no está en el catálogo.',
    };
  }
  try {
    const response = await browserFetch('/roles/administrative/permissions', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: identityMutationErrorMessage(response.status, 'permission'),
      };
    }
    const parsed = permissionMutationResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.permission };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function revokeAdministrativePermissionBrowser(
  body: ManagePermissionRequest,
): Promise<BrowserApiResult<null>> {
  const validated = managePermissionRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Ese permiso no está en el catálogo.',
    };
  }
  try {
    const response = await browserFetch('/roles/administrative/permissions', {
      method: 'DELETE',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        status: response.status,
        message: identityMutationErrorMessage(response.status, 'permission'),
      };
    }
    return { ok: true, data: null };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

// ---------------------------------------------------------------------------
// Finance (Stage 6B-2 / 6C)
// ---------------------------------------------------------------------------

export async function getFinanceSettingsBrowser(): Promise<
  BrowserApiResult<FinanceSettings>
> {
  try {
    const response = await browserFetch('/finance/settings');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar la configuración financiera.',
        ),
      };
    }
    const parsed = financeSettingsResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.settings };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateFinanceSettingsBrowser(
  academyPercentage: AcademyPercentage,
): Promise<BrowserApiResult<FinanceSettings>> {
  const validated = updateFinanceSettingsRequestSchema.safeParse({
    academyPercentage,
  });
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'El porcentaje de academia debe ser 20, 30, 40 o 50.',
    };
  }
  try {
    const response = await browserFetch('/finance/settings', {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos guardar la configuración financiera.',
        ),
      };
    }
    const parsed = financeSettingsResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.settings };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listChargesBrowser(
  query: ChargeListQuery = {},
): Promise<BrowserApiResult<Charge[]>> {
  try {
    const params = new URLSearchParams();
    if (query.studentId) params.set('studentId', query.studentId);
    if (query.teacherId) params.set('teacherId', query.teacherId);
    if (query.courseId) params.set('courseId', query.courseId);
    if (query.classSessionId) params.set('classSessionId', query.classSessionId);
    if (query.status) params.set('status', query.status);
    if (query.currency) params.set('currency', query.currency);
    const qs = params.toString();
    const response = await browserFetch(
      `/finance/charges${qs ? `?${qs}` : ''}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos listar los cargos.'),
      };
    }
    const parsed = chargeListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.charges };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createChargeBrowser(
  body: CreateChargeRequest,
): Promise<BrowserApiResult<Charge>> {
  const validated = createChargeRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos del cargo (sesión o matrícula + período).',
    };
  }
  try {
    const response = await browserFetch('/finance/charges', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos crear el cargo.'),
      };
    }
    const parsed = chargeResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.charge };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listPaymentsBrowser(
  query: PaymentListQuery = {},
): Promise<BrowserApiResult<Payment[]>> {
  try {
    const params = new URLSearchParams();
    if (query.studentId) params.set('studentId', query.studentId);
    if (query.teacherId) params.set('teacherId', query.teacherId);
    if (query.chargeId) params.set('chargeId', query.chargeId);
    if (query.status) params.set('status', query.status);
    if (query.currency) params.set('currency', query.currency);
    if (query.provider) params.set('provider', query.provider);
    const qs = params.toString();
    const response = await browserFetch(
      `/finance/payments${qs ? `?${qs}` : ''}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos listar los pagos.',
        ),
      };
    }
    const parsed = paymentListResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.payments };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createPaymentBrowser(
  body: CreatePaymentRequest,
): Promise<BrowserApiResult<Payment>> {
  const validated = createPaymentRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá cargo, proveedor y clave de idempotencia.',
    };
  }
  try {
    const response = await browserFetch('/finance/payments', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos crear el pago.'),
      };
    }
    const parsed = paymentResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.payment };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function succeedManualPaymentBrowser(
  paymentId: string,
): Promise<BrowserApiResult<Payment>> {
  try {
    const response = await browserFetch(
      `/finance/payments/${paymentId}/succeed`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos confirmar el pago manual.',
        ),
      };
    }
    const parsed = paymentResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.payment };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function refundPaymentBrowser(
  paymentId: string,
  reason?: string,
): Promise<BrowserApiResult<{ refund: Refund; payment: Payment }>> {
  const validated = createRefundRequestSchema.safeParse(
    reason ? { reason } : {},
  );
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Motivo de reembolso inválido.',
    };
  }
  try {
    const response = await browserFetch(
      `/finance/payments/${paymentId}/refunds`,
      {
        method: 'POST',
        body: JSON.stringify(validated.data),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos procesar el reembolso.',
        ),
      };
    }
    const parsed = refundResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return {
      ok: true,
      data: { refund: parsed.data.refund, payment: parsed.data.payment },
    };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listAllocationsBrowser(
  query: AllocationListQuery = {},
): Promise<BrowserApiResult<RevenueAllocation[]>> {
  try {
    const params = new URLSearchParams();
    if (query.studentId) params.set('studentId', query.studentId);
    if (query.teacherId) params.set('teacherId', query.teacherId);
    if (query.paymentId) params.set('paymentId', query.paymentId);
    if (query.chargeId) params.set('chargeId', query.chargeId);
    if (query.kind) params.set('kind', query.kind);
    if (query.currency) params.set('currency', query.currency);
    const qs = params.toString();
    const response = await browserFetch(
      `/finance/allocations${qs ? `?${qs}` : ''}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos listar las asignaciones de ingresos.',
        ),
      };
    }
    const parsed = revenueAllocationListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.allocations };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listSettlementsBrowser(
  query: SettlementListQuery = {},
): Promise<BrowserApiResult<TeacherSettlement[]>> {
  try {
    const params = new URLSearchParams();
    if (query.teacherId) params.set('teacherId', query.teacherId);
    if (query.status) params.set('status', query.status);
    if (query.currency) params.set('currency', query.currency);
    const qs = params.toString();
    const response = await browserFetch(
      `/finance/settlements${qs ? `?${qs}` : ''}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos listar las liquidaciones.',
        ),
      };
    }
    const parsed = teacherSettlementListResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.settlements };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createSettlementBrowser(
  body: CreateTeacherSettlementRequest,
): Promise<BrowserApiResult<TeacherSettlement>> {
  const validated = createTeacherSettlementRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá profesor, período y moneda de la liquidación.',
    };
  }
  try {
    const response = await browserFetch('/finance/settlements', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos crear la liquidación.',
        ),
      };
    }
    const parsed = teacherSettlementResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.settlement };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function markSettlementPaidBrowser(
  settlementId: string,
  note?: string,
): Promise<BrowserApiResult<TeacherSettlement>> {
  const validated = markTeacherSettlementPaidRequestSchema.safeParse(
    note ? { note } : {},
  );
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Nota de liquidación inválida.',
    };
  }
  try {
    const response = await browserFetch(
      `/finance/settlements/${settlementId}/mark-paid`,
      {
        method: 'POST',
        body: JSON.stringify(validated.data),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos marcar la liquidación como pagada.',
        ),
      };
    }
    const parsed = teacherSettlementResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.settlement };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function provisionAdministrativeBrowser(
  body: ProvisionAdministrativeRequest,
): Promise<BrowserApiResult<SessionUser>> {
  const validated = provisionAdministrativeRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message:
        'Revisá email, contraseña (mín. 12 caracteres) y nombre opcional.',
    };
  }
  try {
    const response = await browserFetch('/users/administratives', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: identityMutationErrorMessage(
          response.status,
          'administrative',
        ),
      };
    }
    const parsed = sessionResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.user };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}
