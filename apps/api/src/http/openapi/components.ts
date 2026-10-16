import {
  assignGroupTeacherRequestSchema,
  assignTeacherRequestSchema,
  attendanceListResponseSchema,
  attendanceResponseSchema,
  classNoteListResponseSchema,
  classNoteResponseSchema,
  classSessionCalendarResponseSchema,
  classSessionListResponseSchema,
  classSessionResponseSchema,
  courseListResponseSchema,
  courseResponseSchema,
  chargeListResponseSchema,
  chargeResponseSchema,
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
  createScheduleOptionRequestSchema,
  createStudentRequestSchema,
  createTeacherRequestSchema,
  createTeacherSettlementRequestSchema,
  enrollStudentRequestSchema,
  enrollmentListResponseSchema,
  enrollmentResponseSchema,
  financeSettingsResponseSchema,
  financeWebhookRequestSchema,
  financeWebhookResponseSchema,
  generateClassSessionsRequestSchema,
  generateClassSessionsResponseSchema,
  groupListResponseSchema,
  groupResponseSchema,
  groupTeacherResponseSchema,
  healthResponseSchema,
  loginRequestSchema,
  managePermissionRequestSchema,
  markTeacherSettlementPaidRequestSchema,
  materialDownloadResponseSchema,
  materialListResponseSchema,
  materialResponseSchema,
  materialSchema,
  materialUploadResponseSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
  permissionListResponseSchema,
  permissionMutationResponseSchema,
  provisionAdministrativeRequestSchema,
  provisionDirectorRequestSchema,
  provisionStudentRequestSchema,
  provisionTeacherRequestSchema,
  revenueAllocationListResponseSchema,
  revenueAllocationResponseSchema,
  refundResponseSchema,
  scheduleOptionListResponseSchema,
  scheduleOptionResponseSchema,
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
  updateScheduleOptionRequestSchema,
  updateStudentRequestSchema,
  updateTeacherRequestSchema,
  onlineCourseListResponseSchema,
  onlineCourseResponseSchema,
  createOnlineCourseRequestSchema,
  updateOnlineCourseRequestSchema,
  onlineCourseModuleSchema,
  createOnlineCourseModuleRequestSchema,
  updateOnlineCourseModuleRequestSchema,
  reorderOnlineCourseModulesRequestSchema,
  onlineLessonSchema,
  createOnlineLessonRequestSchema,
  updateOnlineLessonRequestSchema,
  reorderOnlineLessonsRequestSchema,
  onlineLessonAssetSchema,
  createOnlineLessonAssetRequestSchema,
  createOnlineLessonAssetUploadRequestSchema,
  onlineLessonAssetUploadResponseSchema,
  updateOnlineLessonAssetRequestSchema,
  onlineLessonAssetDownloadResponseSchema,
  onlineCourseAccessSchema,
  grantOnlineCourseAccessRequestSchema,
  onlineLessonProgressSchema,
  updateOnlineLessonProgressRequestSchema,
  publicOnlineCourseListResponseSchema,
  publicOnlineCourseResponseSchema,
  studentOnlineCourseOutlineSchema,
  studentOnlineLessonDetailSchema,
  onlineQuizPublicSchema,
  onlineQuizAdminSchema,
  upsertOnlineQuizRequestSchema,
  submitOnlineQuizRequestSchema,
  onlineQuizAttemptResultSchema,
  createOnlineLessonSubmissionRequestSchema,
  onlineLessonSubmissionSchema,
} from '@academia/shared';
import { z } from 'zod';
import { zodToOpenApiSchema } from './zod-json-schema.js';

const onlineCourseModuleListResponseSchema = z.object({
  modules: z.array(onlineCourseModuleSchema),
});
const onlineCourseModuleResponseSchema = z.object({
  module: onlineCourseModuleSchema,
});
const onlineLessonListResponseSchema = z.object({
  lessons: z.array(onlineLessonSchema),
});
const onlineLessonResponseSchema = z.object({
  lesson: onlineLessonSchema,
});
const onlineLessonAssetListResponseSchema = z.object({
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
const onlineQuizAdminResponseSchema = z.object({
  quiz: onlineQuizAdminSchema,
});
const onlineQuizPublicResponseSchema = z.object({
  quiz: onlineQuizPublicSchema,
});
const onlineLessonSubmissionListResponseSchema = z.object({
  submissions: z.array(onlineLessonSubmissionSchema),
});
const onlineLessonSubmissionResponseSchema = z.object({
  submission: onlineLessonSubmissionSchema,
});

const errorEnvelope = {
  type: 'object',
  required: ['error'],
  additionalProperties: false,
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      additionalProperties: false,
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
} as const;

export const openApiComponents = {
  securitySchemes: {
    sessionCookie: {
      type: 'apiKey',
      in: 'cookie',
      name: 'academia_session',
      description:
        'HttpOnly session cookie set by POST /auth/login. Swagger Try it out ' +
        'on the same origin (via /api/*) sends it automatically after login. ' +
        'Do not paste cookie values into Authorize — they are HttpOnly.',
    },
  },
  schemas: {
    HealthResponse: zodToOpenApiSchema(healthResponseSchema),
    LoginRequest: zodToOpenApiSchema(loginRequestSchema),
    SessionResponse: zodToOpenApiSchema(sessionResponseSchema),
    ProvisionDirectorRequest: zodToOpenApiSchema(provisionDirectorRequestSchema),
    ProvisionAdministrativeRequest: zodToOpenApiSchema(
      provisionAdministrativeRequestSchema,
    ),
    ProvisionTeacherRequest: zodToOpenApiSchema(provisionTeacherRequestSchema),
    ProvisionStudentRequest: zodToOpenApiSchema(provisionStudentRequestSchema),
    PermissionListResponse: zodToOpenApiSchema(permissionListResponseSchema),
    ManagePermissionRequest: zodToOpenApiSchema(managePermissionRequestSchema),
    PermissionMutationResponse: zodToOpenApiSchema(
      permissionMutationResponseSchema,
    ),
    StudentListResponse: zodToOpenApiSchema(studentListResponseSchema),
    StudentResponse: zodToOpenApiSchema(studentResponseSchema),
    StudentAttendanceListResponse: zodToOpenApiSchema(
      studentAttendanceListResponseSchema,
    ),
    StudentFinanceResponse: zodToOpenApiSchema(studentFinanceResponseSchema),
    StudentFinanceCheckoutResponse: zodToOpenApiSchema(
      studentFinanceCheckoutResponseSchema,
    ),
    CreateStudentRequest: zodToOpenApiSchema(createStudentRequestSchema),
    UpdateStudentRequest: zodToOpenApiSchema(updateStudentRequestSchema),
    TeacherListResponse: zodToOpenApiSchema(teacherListResponseSchema),
    TeacherResponse: zodToOpenApiSchema(teacherResponseSchema),
    TeacherHubStudentListResponse: zodToOpenApiSchema(
      teacherHubStudentListResponseSchema,
    ),
    TeacherAttendanceListResponse: zodToOpenApiSchema(
      teacherAttendanceListResponseSchema,
    ),
    CreateTeacherRequest: zodToOpenApiSchema(createTeacherRequestSchema),
    UpdateTeacherRequest: zodToOpenApiSchema(updateTeacherRequestSchema),
    TeacherAssignmentResponse: zodToOpenApiSchema(teacherAssignmentResponseSchema),
    AssignTeacherRequest: zodToOpenApiSchema(assignTeacherRequestSchema),
    CourseListResponse: zodToOpenApiSchema(courseListResponseSchema),
    CourseResponse: zodToOpenApiSchema(courseResponseSchema),
    CreateCourseRequest: zodToOpenApiSchema(createCourseRequestSchema),
    UpdateCourseRequest: zodToOpenApiSchema(updateCourseRequestSchema),
    GroupListResponse: zodToOpenApiSchema(groupListResponseSchema),
    GroupResponse: zodToOpenApiSchema(groupResponseSchema),
    CreateGroupRequest: zodToOpenApiSchema(createGroupRequestSchema),
    UpdateGroupRequest: zodToOpenApiSchema(updateGroupRequestSchema),
    GroupTeacherResponse: zodToOpenApiSchema(groupTeacherResponseSchema),
    AssignGroupTeacherRequest: zodToOpenApiSchema(assignGroupTeacherRequestSchema),
    EnrollmentListResponse: zodToOpenApiSchema(enrollmentListResponseSchema),
    EnrollmentResponse: zodToOpenApiSchema(enrollmentResponseSchema),
    EnrollStudentRequest: zodToOpenApiSchema(enrollStudentRequestSchema),
    ScheduleOptionListResponse: zodToOpenApiSchema(
      scheduleOptionListResponseSchema,
    ),
    ScheduleOptionResponse: zodToOpenApiSchema(scheduleOptionResponseSchema),
    CreateScheduleOptionRequest: zodToOpenApiSchema(
      createScheduleOptionRequestSchema,
    ),
    UpdateScheduleOptionRequest: zodToOpenApiSchema(
      updateScheduleOptionRequestSchema,
    ),
    ClassSessionListResponse: zodToOpenApiSchema(classSessionListResponseSchema),
    ClassSessionResponse: zodToOpenApiSchema(classSessionResponseSchema),
    CreateClassSessionRequest: zodToOpenApiSchema(createClassSessionRequestSchema),
    UpdateClassSessionRequest: zodToOpenApiSchema(updateClassSessionRequestSchema),
    GenerateClassSessionsRequest: zodToOpenApiSchema(
      generateClassSessionsRequestSchema,
    ),
    GenerateClassSessionsResponse: zodToOpenApiSchema(
      generateClassSessionsResponseSchema,
    ),
    ClassSessionCalendarResponse: zodToOpenApiSchema(
      classSessionCalendarResponseSchema,
    ),
    AttendanceListResponse: zodToOpenApiSchema(attendanceListResponseSchema),
    AttendanceResponse: zodToOpenApiSchema(attendanceResponseSchema),
    CreateAttendanceRequest: zodToOpenApiSchema(createAttendanceRequestSchema),
    UpdateAttendanceRequest: zodToOpenApiSchema(updateAttendanceRequestSchema),
    ClassNoteListResponse: zodToOpenApiSchema(classNoteListResponseSchema),
    ClassNoteResponse: zodToOpenApiSchema(classNoteResponseSchema),
    CreateClassNoteRequest: zodToOpenApiSchema(createClassNoteRequestSchema),
    UpdateClassNoteRequest: zodToOpenApiSchema(updateClassNoteRequestSchema),
    Material: zodToOpenApiSchema(materialSchema),
    MaterialListResponse: zodToOpenApiSchema(materialListResponseSchema),
    MaterialResponse: zodToOpenApiSchema(materialResponseSchema),
    CreateMaterialRequest: zodToOpenApiSchema(createMaterialRequestSchema),
    CreateMaterialUploadRequest: zodToOpenApiSchema(
      createMaterialUploadRequestSchema,
    ),
    MaterialUploadResponse: zodToOpenApiSchema(materialUploadResponseSchema),
    UpdateMaterialRequest: zodToOpenApiSchema(updateMaterialRequestSchema),
    MaterialDownloadResponse: zodToOpenApiSchema(materialDownloadResponseSchema),
    FinanceSettingsResponse: zodToOpenApiSchema(financeSettingsResponseSchema),
    UpdateFinanceSettingsRequest: zodToOpenApiSchema(
      updateFinanceSettingsRequestSchema,
    ),
    ChargeListResponse: zodToOpenApiSchema(chargeListResponseSchema),
    ChargeResponse: zodToOpenApiSchema(chargeResponseSchema),
    CreateChargeRequest: zodToOpenApiSchema(createChargeRequestSchema),
    PaymentListResponse: zodToOpenApiSchema(paymentListResponseSchema),
    PaymentResponse: zodToOpenApiSchema(paymentResponseSchema),
    CreatePaymentRequest: zodToOpenApiSchema(createPaymentRequestSchema),
    RefundResponse: zodToOpenApiSchema(refundResponseSchema),
    CreateRefundRequest: zodToOpenApiSchema(createRefundRequestSchema),
    RevenueAllocationListResponse: zodToOpenApiSchema(
      revenueAllocationListResponseSchema,
    ),
    RevenueAllocationResponse: zodToOpenApiSchema(
      revenueAllocationResponseSchema,
    ),
    TeacherSettlementListResponse: zodToOpenApiSchema(
      teacherSettlementListResponseSchema,
    ),
    TeacherSettlementResponse: zodToOpenApiSchema(
      teacherSettlementResponseSchema,
    ),
    CreateTeacherSettlementRequest: zodToOpenApiSchema(
      createTeacherSettlementRequestSchema,
    ),
    MarkTeacherSettlementPaidRequest: zodToOpenApiSchema(
      markTeacherSettlementPaidRequestSchema,
    ),
    FinanceWebhookRequest: zodToOpenApiSchema(financeWebhookRequestSchema),
    FinanceWebhookResponse: zodToOpenApiSchema(financeWebhookResponseSchema),
    OnlineCourseListResponse: zodToOpenApiSchema(onlineCourseListResponseSchema),
    OnlineCourseResponse: zodToOpenApiSchema(onlineCourseResponseSchema),
    CreateOnlineCourseRequest: zodToOpenApiSchema(createOnlineCourseRequestSchema),
    UpdateOnlineCourseRequest: zodToOpenApiSchema(updateOnlineCourseRequestSchema),
    OnlineCourseModuleListResponse: zodToOpenApiSchema(
      onlineCourseModuleListResponseSchema,
    ),
    OnlineCourseModuleResponse: zodToOpenApiSchema(
      onlineCourseModuleResponseSchema,
    ),
    CreateOnlineCourseModuleRequest: zodToOpenApiSchema(
      createOnlineCourseModuleRequestSchema,
    ),
    UpdateOnlineCourseModuleRequest: zodToOpenApiSchema(
      updateOnlineCourseModuleRequestSchema,
    ),
    ReorderOnlineCourseModulesRequest: zodToOpenApiSchema(
      reorderOnlineCourseModulesRequestSchema,
    ),
    OnlineLessonListResponse: zodToOpenApiSchema(onlineLessonListResponseSchema),
    OnlineLessonResponse: zodToOpenApiSchema(onlineLessonResponseSchema),
    CreateOnlineLessonRequest: zodToOpenApiSchema(createOnlineLessonRequestSchema),
    UpdateOnlineLessonRequest: zodToOpenApiSchema(updateOnlineLessonRequestSchema),
    ReorderOnlineLessonsRequest: zodToOpenApiSchema(
      reorderOnlineLessonsRequestSchema,
    ),
    OnlineLessonAssetListResponse: zodToOpenApiSchema(
      onlineLessonAssetListResponseSchema,
    ),
    OnlineLessonAssetResponse: zodToOpenApiSchema(
      onlineLessonAssetResponseSchema,
    ),
    CreateOnlineLessonAssetRequest: zodToOpenApiSchema(
      createOnlineLessonAssetRequestSchema,
    ),
    CreateOnlineLessonAssetUploadRequest: zodToOpenApiSchema(
      createOnlineLessonAssetUploadRequestSchema,
    ),
    OnlineLessonAssetUploadResponse: zodToOpenApiSchema(
      onlineLessonAssetUploadResponseSchema,
    ),
    UpdateOnlineLessonAssetRequest: zodToOpenApiSchema(
      updateOnlineLessonAssetRequestSchema,
    ),
    OnlineLessonAssetDownloadResponse: zodToOpenApiSchema(
      onlineLessonAssetDownloadResponseSchema,
    ),
    OnlineCourseAccessResponse: zodToOpenApiSchema(
      onlineCourseAccessResponseSchema,
    ),
    GrantOnlineCourseAccessRequest: zodToOpenApiSchema(
      grantOnlineCourseAccessRequestSchema,
    ),
    OnlineLessonProgressResponse: zodToOpenApiSchema(
      onlineLessonProgressResponseSchema,
    ),
    UpdateOnlineLessonProgressRequest: zodToOpenApiSchema(
      updateOnlineLessonProgressRequestSchema,
    ),
    PublicOnlineCourseListResponse: zodToOpenApiSchema(
      publicOnlineCourseListResponseSchema,
    ),
    PublicOnlineCourseResponse: zodToOpenApiSchema(
      publicOnlineCourseResponseSchema,
    ),
    StudentOnlineCourseOutline: zodToOpenApiSchema(
      studentOnlineCourseOutlineSchema,
    ),
    StudentOnlineLessonDetail: zodToOpenApiSchema(
      studentOnlineLessonDetailSchema,
    ),
    OnlineQuizAdminResponse: zodToOpenApiSchema(onlineQuizAdminResponseSchema),
    OnlineQuizPublicResponse: zodToOpenApiSchema(onlineQuizPublicResponseSchema),
    UpsertOnlineQuizRequest: zodToOpenApiSchema(upsertOnlineQuizRequestSchema),
    SubmitOnlineQuizRequest: zodToOpenApiSchema(submitOnlineQuizRequestSchema),
    OnlineQuizAttemptResult: zodToOpenApiSchema(onlineQuizAttemptResultSchema),
    CreateOnlineLessonSubmissionRequest: zodToOpenApiSchema(
      createOnlineLessonSubmissionRequestSchema,
    ),
    OnlineLessonSubmissionListResponse: zodToOpenApiSchema(
      onlineLessonSubmissionListResponseSchema,
    ),
    OnlineLessonSubmissionResponse: zodToOpenApiSchema(
      onlineLessonSubmissionResponseSchema,
    ),
    ErrorEnvelope: errorEnvelope,
  },
} as const;

export type OpenApiComponents = typeof openApiComponents;
