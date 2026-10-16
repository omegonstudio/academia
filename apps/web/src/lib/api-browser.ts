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
  createOnlineCourseModuleRequestSchema,
  createOnlineCourseRequestSchema,
  createOnlineLessonAssetRequestSchema,
  createOnlineLessonAssetUploadRequestSchema,
  createOnlineLessonRequestSchema,
  emailTemplateListResponseSchema,
  emailTemplateResponseSchema,
  googleMeetStatusResponseSchema,
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
  grantOnlineCourseAccessRequestSchema,
  onlineCourseAccessSchema,
  onlineCourseListResponseSchema,
  onlineCourseModuleSchema,
  onlineCourseResponseSchema,
  onlineLessonAssetDownloadResponseSchema,
  onlineLessonAssetSchema,
  onlineLessonAssetUploadResponseSchema,
  onlineLessonProgressSchema,
  onlineLessonSchema,
  onlineQuizAdminSchema,
  onlineQuizAttemptResultSchema,
  onlineQuizPublicSchema,
  upsertOnlineQuizRequestSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
  permissionListResponseSchema,
  permissionMutationResponseSchema,
  provisionAdministrativeRequestSchema,
  publicOnlineCourseListResponseSchema,
  publicOnlineCourseResponseSchema,
  refundResponseSchema,
  reorderOnlineCourseModulesRequestSchema,
  reorderOnlineLessonsRequestSchema,
  revenueAllocationListResponseSchema,
  scheduleOptionListResponseSchema,
  sessionResponseSchema,
  studentListResponseSchema,
  studentOnlineCourseOutlineSchema,
  studentOnlineLessonDetailSchema,
  studentResponseSchema,
  studentAttendanceListResponseSchema,
  studentFinanceCheckoutResponseSchema,
  studentFinanceResponseSchema,
  submitOnlineQuizRequestSchema,
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
  updateEmailTemplateRequestSchema,
  updateCourseRequestSchema,
  updateFinanceSettingsRequestSchema,
  updateGroupRequestSchema,
  updateMaterialRequestSchema,
  updateOnlineCourseModuleRequestSchema,
  updateOnlineCourseRequestSchema,
  updateOnlineLessonRequestSchema,
  updateOnlineLessonProgressRequestSchema,
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
  type CreateOnlineCourseModuleRequest,
  type CreateOnlineCourseRequest,
  type CreateOnlineLessonAssetRequest,
  type CreateOnlineLessonAssetUploadRequest,
  type CreateOnlineLessonRequest,
  type EmailTemplate,
  type EmailTemplateListResponse,
  type GoogleMeetStatusResponse,
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
  type OnlineCourse,
  type OnlineCourseAccess,
  type OnlineCourseAccessMode,
  type OnlineCourseModule,
  type OnlineCourseStatus,
  type OnlineLesson,
  type OnlineLessonAsset,
  type OnlineLessonAssetDownloadResponse,
  type OnlineLessonAssetUploadResponse,
  type OnlineLessonProgress,
  type OnlineQuizAdmin,
  type OnlineQuizAttemptResult,
  type OnlineQuizPublic,
  type UpsertOnlineQuizRequest,
  type Payment,
  type PaymentListQuery,
  type PermissionRef,
  type ProvisionAdministrativeRequest,
  type PublicOnlineCourse,
  type PublicOnlineCourseListResponse,
  type Refund,
  type RevenueAllocation,
  type ScheduleOption,
  type SessionUser,
  type SettlementListQuery,
  type Student,
  type StudentAttendanceItem,
  type StudentFinanceCheckoutResponse,
  type StudentFinanceResponse,
  type StudentOnlineCourseOutline,
  type StudentOnlineLessonDetail,
  type SubmitOnlineQuizRequest,
  type Teacher,
  type TeacherAttendanceItem,
  type TeacherHubStudent,
  type TeacherAssignment,
  type TeacherSettlement,
  type UpdateAttendanceRequest,
  type UpdateClassNoteRequest,
  type UpdateClassSessionRequest,
  type UpdateEmailTemplateRequest,
  type UpdateCourseRequest,
  type UpdateGroupRequest,
  type UpdateMaterialRequest,
  type UpdateOnlineCourseModuleRequest,
  type UpdateOnlineCourseRequest,
  type UpdateOnlineLessonProgressRequest,
  type UpdateOnlineLessonRequest,
  type UpdateStudentRequest,
  type UpdateTeacherRequest,
} from '@academia/shared';
import { z } from 'zod';
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
      let apiMessage: string | undefined;
      try {
        const body = (await response.json()) as {
          error?: { message?: string };
        };
        apiMessage = body.error?.message;
      } catch {
        /* ignore */
      }
      // #region agent log
      fetch('http://127.0.0.1:7252/ingest/93706407-f206-4d2e-8561-ff46b8472d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4ec339'},body:JSON.stringify({sessionId:'4ec339',runId:'pay-verify',hypothesisId:'D',location:'api-browser.ts:payStudentMeFinanceChargeBrowser',message:'pay response',data:{chargeId,httpStatus:response.status,ok:false,hasApiMessage:Boolean(apiMessage)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return {
        ok: false,
        status: response.status,
        message:
          apiMessage ??
          genericError(
            response.status,
            'No pudimos iniciar el pago. Intentá de nuevo.',
          ),
      };
    }
    // #region agent log
    fetch('http://127.0.0.1:7252/ingest/93706407-f206-4d2e-8561-ff46b8472d6d',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'4ec339'},body:JSON.stringify({sessionId:'4ec339',runId:'pay-verify',hypothesisId:'B',location:'api-browser.ts:payStudentMeFinanceChargeBrowser',message:'pay response ok',data:{chargeId,httpStatus:response.status},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

export type CreateClassSessionBrowserResult =
  | {
      ok: true;
      data: ClassSession;
      /** Class saved but Google Meet was not provisioned — retry via PATCH. */
      meetCreationFailed?: boolean;
    }
  | { ok: false; status: number; message: string };

export async function createClassSessionBrowser(
  body: CreateClassSessionRequest,
): Promise<CreateClassSessionBrowserResult> {
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
          } else if (apiMessage.includes('Google Meet is not configured')) {
            message =
              'Google Meet no está configurado en el servidor. Pedile a la dirección que complete GOOGLE_MEET_*.';
          } else if (apiMessage.includes('starts in the past')) {
            message =
              'No se puede crear un Meet para una clase en el pasado.';
          } else if (apiMessage.includes('Could not create a Google Meet')) {
            message =
              'No pudimos crear el enlace de Google Meet. Abrí la clase y reintentá el Meet desde el detalle (no crees otra clase).';
          }
        } catch {
          /* keep mapped message */
        }
      }
      if (response.status === 409) {
        message =
          'Ya existe una clase en ese horario. Abrila desde el listado para reintentar el Meet o editarla.';
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
    return {
      ok: true,
      data: parsed.data.classSession,
      ...(parsed.data.meetCreationFailed
        ? { meetCreationFailed: true }
        : {}),
    };
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
      let message = classSessionWriteError(
        response.status,
        'No pudimos actualizar la clase.',
      );
      if (response.status === 400) {
        try {
          const bodyJson = (await response.json()) as {
            error?: { message?: string };
          };
          const apiMessage = bodyJson.error?.message ?? '';
          if (apiMessage.includes('starts in the past')) {
            message =
              'No se puede crear un Meet para una clase en el pasado.';
          } else if (apiMessage.includes('Google Meet is not configured')) {
            message =
              'Google Meet no está configurado en el servidor.';
          } else if (apiMessage.includes('Could not create a Google Meet')) {
            message =
              'No pudimos crear el enlace de Google Meet. Probá de nuevo más tarde.';
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

export async function getGoogleMeetStatusBrowser(): Promise<
  BrowserApiResult<GoogleMeetStatusResponse>
> {
  try {
    const response = await browserFetch('/google-meet/status');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: 'No pudimos consultar el estado de Google Meet.',
      };
    }
    const parsed = googleMeetStatusResponseSchema.safeParse(
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

export async function listEmailTemplatesBrowser(): Promise<
  BrowserApiResult<EmailTemplateListResponse>
> {
  try {
    const response = await browserFetch('/email-templates');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 403
            ? 'No tenés permiso para editar plantillas de email.'
            : 'No pudimos cargar las plantillas de email.',
      };
    }
    const parsed = emailTemplateListResponseSchema.safeParse(
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

export async function updateEmailTemplateBrowser(
  body: UpdateEmailTemplateRequest,
): Promise<BrowserApiResult<EmailTemplate>> {
  const validated = updateEmailTemplateRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá el asunto y el cuerpo del mail.',
    };
  }
  try {
    const response = await browserFetch('/email-templates', {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message:
          response.status === 403
            ? 'No tenés permiso para editar plantillas de email.'
            : 'No pudimos guardar la plantilla.',
      };
    }
    const parsed = emailTemplateResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.template };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

// —— Online courses (async) ——

const onlineCourseModuleListSchema = z.object({
  modules: z.array(onlineCourseModuleSchema),
});
const onlineCourseModuleResponseSchema = z.object({
  module: onlineCourseModuleSchema,
});
const onlineLessonListSchema = z.object({
  lessons: z.array(onlineLessonSchema),
});
const onlineLessonResponseSchema = z.object({
  lesson: onlineLessonSchema,
});
const onlineLessonAssetListSchema = z.object({
  assets: z.array(onlineLessonAssetSchema),
});
const onlineLessonAssetResponseSchema = z.object({
  asset: onlineLessonAssetSchema,
});
const onlineCourseAccessResponseSchema = z.object({
  access: onlineCourseAccessSchema,
});
const onlineLessonProgressResponseSchema = z.object({
  progress: onlineLessonProgressSchema,
});
const studentOnlineQuizResponseSchema = z.object({
  quiz: onlineQuizPublicSchema,
});

export const onlineCourseStatusLabels: Record<OnlineCourseStatus, string> = {
  DRAFT: 'Borrador',
  PUBLISHED: 'Publicado',
  ARCHIVED: 'Archivado',
};

export const onlineCourseAccessModeLabels: Record<
  OnlineCourseAccessMode,
  string
> = {
  OPEN: 'Libre',
  LINEAR: 'Lineal',
};

export function slugifyOnlineCourseTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export async function getSessionBrowser(): Promise<
  BrowserApiResult<SessionUser | null>
> {
  try {
    const response = await browserFetch('/auth/me');
    if (response.status === 401) {
      return { ok: true, data: null };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos verificar tu sesión.'),
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

export async function listOnlineCoursesBrowser(): Promise<
  BrowserApiResult<OnlineCourse[]>
> {
  try {
    const response = await browserFetch('/online-courses');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar los cursos online.',
        ),
      };
    }
    const parsed = onlineCourseListResponseSchema.safeParse(
      await response.json(),
    );
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

export async function getOnlineCourseBrowser(
  id: string,
): Promise<BrowserApiResult<OnlineCourse>> {
  try {
    const response = await browserFetch(`/online-courses/${id}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el curso online.',
        ),
      };
    }
    const parsed = onlineCourseResponseSchema.safeParse(await response.json());
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

export async function createOnlineCourseBrowser(
  body: CreateOnlineCourseRequest,
): Promise<BrowserApiResult<OnlineCourse>> {
  const validated = createOnlineCourseRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá título, slug y el resto de los datos.',
    };
  }
  try {
    const response = await browserFetch('/online-courses', {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos crear el curso online.',
        ),
      };
    }
    const parsed = onlineCourseResponseSchema.safeParse(await response.json());
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

export async function updateOnlineCourseBrowser(
  id: string,
  body: UpdateOnlineCourseRequest,
): Promise<BrowserApiResult<OnlineCourse>> {
  const validated = updateOnlineCourseRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(`/online-courses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos actualizar el curso online.',
        ),
      };
    }
    const parsed = onlineCourseResponseSchema.safeParse(await response.json());
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

async function onlineCourseStatusActionBrowser(
  id: string,
  action: 'publish' | 'unpublish' | 'archive',
  fallback: string,
): Promise<BrowserApiResult<OnlineCourse>> {
  try {
    const response = await browserFetch(`/online-courses/${id}/${action}`, {
      method: 'POST',
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, fallback),
      };
    }
    const parsed = onlineCourseResponseSchema.safeParse(await response.json());
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

export function publishOnlineCourseBrowser(id: string) {
  return onlineCourseStatusActionBrowser(
    id,
    'publish',
    'No pudimos publicar el curso.',
  );
}

export function unpublishOnlineCourseBrowser(id: string) {
  return onlineCourseStatusActionBrowser(
    id,
    'unpublish',
    'No pudimos despublicar el curso.',
  );
}

export function archiveOnlineCourseBrowser(id: string) {
  return onlineCourseStatusActionBrowser(
    id,
    'archive',
    'No pudimos archivar el curso.',
  );
}

export async function listOnlineCourseModulesBrowser(
  courseId: string,
): Promise<BrowserApiResult<OnlineCourseModule[]>> {
  try {
    const response = await browserFetch(`/online-courses/${courseId}/modules`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos cargar los módulos.'),
      };
    }
    const parsed = onlineCourseModuleListSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.modules };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createOnlineCourseModuleBrowser(
  courseId: string,
  body: CreateOnlineCourseModuleRequest,
): Promise<BrowserApiResult<OnlineCourseModule>> {
  const validated = createOnlineCourseModuleRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Ingresá un título de módulo válido.',
    };
  }
  try {
    const response = await browserFetch(`/online-courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos crear el módulo.'),
      };
    }
    const parsed = onlineCourseModuleResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.module };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateOnlineCourseModuleBrowser(
  courseId: string,
  moduleId: string,
  body: UpdateOnlineCourseModuleRequest,
): Promise<BrowserApiResult<OnlineCourseModule>> {
  const validated = updateOnlineCourseModuleRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos del módulo.',
    };
  }
  try {
    const response = await browserFetch(
      `/online-courses/${courseId}/modules/${moduleId}`,
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
          'No pudimos actualizar el módulo.',
        ),
      };
    }
    const parsed = onlineCourseModuleResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.module };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function reorderOnlineCourseModulesBrowser(
  courseId: string,
  moduleIds: string[],
): Promise<BrowserApiResult<OnlineCourseModule[]>> {
  const validated = reorderOnlineCourseModulesRequestSchema.safeParse({
    moduleIds,
  });
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'No pudimos reordenar los módulos.',
    };
  }
  try {
    const response = await browserFetch(
      `/online-courses/${courseId}/modules/reorder`,
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
          'No pudimos reordenar los módulos.',
        ),
      };
    }
    const parsed = onlineCourseModuleListSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.modules };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listOnlineLessonsBrowser(
  courseId: string,
  moduleId: string,
): Promise<BrowserApiResult<OnlineLesson[]>> {
  try {
    const response = await browserFetch(
      `/online-courses/${courseId}/modules/${moduleId}/lessons`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos cargar las lecciones.'),
      };
    }
    const parsed = onlineLessonListSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.lessons };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createOnlineLessonBrowser(
  courseId: string,
  moduleId: string,
  body: CreateOnlineLessonRequest,
): Promise<BrowserApiResult<OnlineLesson>> {
  const validated = createOnlineLessonRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Ingresá un título de lección válido.',
    };
  }
  try {
    const response = await browserFetch(
      `/online-courses/${courseId}/modules/${moduleId}/lessons`,
      {
        method: 'POST',
        body: JSON.stringify(validated.data),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos crear la lección.'),
      };
    }
    const parsed = onlineLessonResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.lesson };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function updateOnlineLessonBrowser(
  courseId: string,
  moduleId: string,
  lessonId: string,
  body: UpdateOnlineLessonRequest,
): Promise<BrowserApiResult<OnlineLesson>> {
  const validated = updateOnlineLessonRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá los datos de la lección.',
    };
  }
  try {
    const response = await browserFetch(
      `/online-courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
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
          'No pudimos actualizar la lección.',
        ),
      };
    }
    const parsed = onlineLessonResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.lesson };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function reorderOnlineLessonsBrowser(
  courseId: string,
  moduleId: string,
  lessonIds: string[],
): Promise<BrowserApiResult<OnlineLesson[]>> {
  const validated = reorderOnlineLessonsRequestSchema.safeParse({ lessonIds });
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'No pudimos reordenar las lecciones.',
    };
  }
  try {
    const response = await browserFetch(
      `/online-courses/${courseId}/modules/${moduleId}/lessons/reorder`,
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
          'No pudimos reordenar las lecciones.',
        ),
      };
    }
    const parsed = onlineLessonListSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.lessons };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function listOnlineLessonAssetsBrowser(
  lessonId: string,
): Promise<BrowserApiResult<OnlineLessonAsset[]>> {
  try {
    const response = await browserFetch(
      `/online-courses/lessons/${lessonId}/assets`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar los contenidos de la lección.',
        ),
      };
    }
    const parsed = onlineLessonAssetListSchema.safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.assets };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createOnlineLessonAssetBrowser(
  lessonId: string,
  body: CreateOnlineLessonAssetRequest,
): Promise<BrowserApiResult<OnlineLessonAsset>> {
  const validated = createOnlineLessonAssetRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá el contenido (texto o URL HTTPS).',
    };
  }
  try {
    const response = await browserFetch(
      `/online-courses/lessons/${lessonId}/assets`,
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
          'No pudimos agregar el contenido.',
        ),
      };
    }
    const parsed = onlineLessonAssetResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.asset };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function createOnlineLessonAssetUploadBrowser(
  lessonId: string,
  body: CreateOnlineLessonAssetUploadRequest,
): Promise<BrowserApiResult<OnlineLessonAssetUploadResponse>> {
  const validated = createOnlineLessonAssetUploadRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá el archivo (tipo, tamaño y nombre).',
    };
  }
  try {
    const response = await browserFetch(
      `/online-courses/lessons/${lessonId}/assets/uploads`,
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
          'No pudimos preparar la subida del documento.',
        ),
      };
    }
    const parsed = onlineLessonAssetUploadResponseSchema.safeParse(
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

export async function completeOnlineLessonAssetUploadBrowser(
  assetId: string,
): Promise<BrowserApiResult<OnlineLessonAsset>> {
  try {
    const response = await browserFetch(
      `/online-courses/assets/${assetId}/complete`,
      { method: 'POST' },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos completar la subida del documento.',
        ),
      };
    }
    const parsed = onlineLessonAssetResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.asset };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

/** DOCUMENT upload: intent → PUT storage → complete. */
export async function uploadOnlineLessonDocumentBrowser(
  lessonId: string,
  body: CreateOnlineLessonAssetUploadRequest,
  file: File,
  onProgress?: (phase: 'intent' | 'storage' | 'complete') => void,
): Promise<BrowserApiResult<OnlineLessonAsset>> {
  onProgress?.('intent');
  const intent = await createOnlineLessonAssetUploadBrowser(lessonId, body);
  if (!intent.ok) return intent;

  onProgress?.('storage');
  const put = await putMaterialFileToStorageBrowser(
    intent.data.uploadUrl,
    file,
  );
  if (!put.ok) return put;

  onProgress?.('complete');
  const completed = await completeOnlineLessonAssetUploadBrowser(
    intent.data.asset.id,
  );
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

export async function deleteOnlineLessonAssetBrowser(
  assetId: string,
): Promise<BrowserApiResult<null>> {
  try {
    const response = await browserFetch(`/online-courses/assets/${assetId}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos eliminar el contenido.',
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

export async function downloadOnlineLessonAssetBrowser(
  assetId: string,
): Promise<BrowserApiResult<OnlineLessonAssetDownloadResponse>> {
  try {
    const response = await browserFetch(
      `/online-courses/assets/${assetId}/download`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos obtener el enlace de descarga.',
        ),
      };
    }
    const parsed = onlineLessonAssetDownloadResponseSchema.safeParse(
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

export async function listPublicOnlineCoursesBrowser(): Promise<
  BrowserApiResult<PublicOnlineCourseListResponse['courses']>
> {
  try {
    const response = await browserFetch('/public/online-courses');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el catálogo de cursos.',
        ),
      };
    }
    const parsed = publicOnlineCourseListResponseSchema.safeParse(
      await response.json(),
    );
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

export async function getPublicOnlineCourseBrowser(
  slug: string,
): Promise<BrowserApiResult<PublicOnlineCourse>> {
  try {
    const response = await browserFetch(`/public/online-courses/${slug}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el curso.',
        ),
      };
    }
    const parsed = publicOnlineCourseResponseSchema.safeParse(
      await response.json(),
    );
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

export async function listStudentOnlineCoursesBrowser(): Promise<
  BrowserApiResult<OnlineCourse[]>
> {
  try {
    const response = await browserFetch('/students/me/online-courses');
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar tus cursos online.',
        ),
      };
    }
    const parsed = onlineCourseListResponseSchema.safeParse(
      await response.json(),
    );
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

export async function getStudentOnlineCourseOutlineBrowser(
  slug: string,
): Promise<BrowserApiResult<StudentOnlineCourseOutline>> {
  try {
    const response = await browserFetch(`/students/me/online-courses/${slug}`);
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el curso.',
        ),
      };
    }
    const parsed = studentOnlineCourseOutlineSchema.safeParse(
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

export async function getStudentOnlineLessonBrowser(
  slug: string,
  lessonId: string,
): Promise<BrowserApiResult<StudentOnlineLessonDetail>> {
  try {
    const response = await browserFetch(
      `/students/me/online-courses/${slug}/lessons/${lessonId}`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar la lección.',
        ),
      };
    }
    const parsed = studentOnlineLessonDetailSchema.safeParse(
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

export async function updateStudentOnlineLessonProgressBrowser(
  slug: string,
  lessonId: string,
  body: UpdateOnlineLessonProgressRequest,
): Promise<BrowserApiResult<OnlineLessonProgress>> {
  const validated = updateOnlineLessonProgressRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Estado de progreso inválido.',
    };
  }
  try {
    const response = await browserFetch(
      `/students/me/online-courses/${slug}/lessons/${lessonId}/progress`,
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
          'No pudimos actualizar el progreso.',
        ),
      };
    }
    const parsed = onlineLessonProgressResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.progress };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function enrollFreeOnlineCourseBrowser(
  slug: string,
): Promise<BrowserApiResult<OnlineCourseAccess>> {
  try {
    const response = await browserFetch(
      `/students/me/online-courses/${slug}/enroll-free`,
      { method: 'POST' },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos inscribirte en el curso gratis.',
        ),
      };
    }
    const parsed = onlineCourseAccessResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.access };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getStudentOnlineLessonQuizBrowser(
  slug: string,
  lessonId: string,
): Promise<BrowserApiResult<OnlineQuizPublic | null>> {
  try {
    const response = await browserFetch(
      `/students/me/online-courses/${slug}/lessons/${lessonId}/quiz`,
    );
    if (response.status === 404) {
      return { ok: true, data: null };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(response.status, 'No pudimos cargar el quiz.'),
      };
    }
    const parsed = studentOnlineQuizResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.quiz };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function submitStudentOnlineLessonQuizBrowser(
  slug: string,
  lessonId: string,
  body: SubmitOnlineQuizRequest,
): Promise<BrowserApiResult<OnlineQuizAttemptResult>> {
  const validated = submitOnlineQuizRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá tus respuestas e intentá de nuevo.',
    };
  }
  try {
    const response = await browserFetch(
      `/students/me/online-courses/${slug}/lessons/${lessonId}/quiz/submit`,
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
          'No pudimos enviar el quiz.',
        ),
      };
    }
    const parsed = onlineQuizAttemptResultSchema.safeParse(
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

export async function downloadStudentOnlineLessonAssetBrowser(
  assetId: string,
): Promise<BrowserApiResult<OnlineLessonAssetDownloadResponse>> {
  try {
    const response = await browserFetch(
      `/students/me/online-courses/assets/${assetId}/download`,
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos obtener el enlace de descarga.',
        ),
      };
    }
    const parsed = onlineLessonAssetDownloadResponseSchema.safeParse(
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

export async function grantOnlineCourseAccessBrowser(
  courseId: string,
  body: { studentId: string; expiresAt?: string | null },
): Promise<BrowserApiResult<OnlineCourseAccess>> {
  const validated = grantOnlineCourseAccessRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Seleccioná un estudiante válido.',
    };
  }
  try {
    const response = await browserFetch(`/online-courses/${courseId}/access`, {
      method: 'POST',
      body: JSON.stringify(validated.data),
    });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos conceder el acceso.',
        ),
      };
    }
    const parsed = z
      .object({ access: onlineCourseAccessSchema })
      .safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.access };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function getOnlineQuizAdminBrowser(
  lessonId: string,
): Promise<BrowserApiResult<OnlineQuizAdmin | null>> {
  try {
    const response = await browserFetch(
      `/online-courses/lessons/${lessonId}/quiz`,
    );
    if (response.status === 404) {
      return { ok: true, data: null };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos cargar el cuestionario.',
        ),
      };
    }
    const parsed = z
      .object({ quiz: onlineQuizAdminSchema })
      .safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.quiz };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}

export async function upsertOnlineQuizBrowser(
  lessonId: string,
  body: UpsertOnlineQuizRequest,
): Promise<BrowserApiResult<OnlineQuizAdmin>> {
  const validated = upsertOnlineQuizRequestSchema.safeParse(body);
  if (!validated.success) {
    return {
      ok: false,
      status: 400,
      message: 'Revisá el cuestionario (preguntas y opciones).',
    };
  }
  try {
    const response = await browserFetch(
      `/online-courses/lessons/${lessonId}/quiz`,
      {
        method: 'PUT',
        body: JSON.stringify(validated.data),
      },
    );
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: genericError(
          response.status,
          'No pudimos guardar el cuestionario.',
        ),
      };
    }
    const parsed = z
      .object({ quiz: onlineQuizAdminSchema })
      .safeParse(await response.json());
    if (!parsed.success) {
      return {
        ok: false,
        status: 500,
        message: 'Respuesta inválida del servidor.',
      };
    }
    return { ok: true, data: parsed.data.quiz };
  } catch {
    return {
      ok: false,
      status: 503,
      message: 'No pudimos conectar con el servidor.',
    };
  }
}
