import {
  createMaterialRequestSchema,
  createMaterialUploadRequestSchema,
  materialListQuerySchema,
  updateMaterialRequestSchema,
  type MaterialDownloadResponse,
  type MaterialListResponse,
  type MaterialResponse,
  type MaterialUploadResponse,
  type PermissionAction,
  type SessionUser,
} from '@academia/shared';
import { Router } from 'express';
import {
  hasPermission,
  type PermissionGrantStore,
} from '../../domain/authorization/has-permission.js';
import {
  MaterialForbiddenError,
  MaterialNotFoundError,
  MaterialValidationError,
  completeMaterialUpload,
  createFileUploadIntent,
  createLinkMaterial,
  downloadMaterial,
  getMaterial,
  listMaterials,
  softDeleteMaterial,
  updateMaterial,
  type MaterialReadActor,
  type MaterialSizeLimits,
  type MaterialStore,
  type MaterialUrlTtls,
  type MaterialWriteActor,
} from '../../domain/materials/material-service.js';
import type { StudentStore } from '../../domain/students/student-service.js';
import type { TeacherStore } from '../../domain/teachers/teacher-service.js';
import type { ObjectStoragePort } from '../../storage/object-storage.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors.js';
import {
  authenticate,
  type AuthenticateOptions,
} from '../middleware/authenticate.js';

export interface MaterialsDependencies {
  authenticate: AuthenticateOptions;
  materials: MaterialStore;
  storage: ObjectStoragePort;
  teachers: TeacherStore;
  students: StudentStore;
  permissionGrants: PermissionGrantStore;
  sizeLimits: MaterialSizeLimits;
  urlTtls: MaterialUrlTtls;
  logError?: (payload: Record<string, unknown>, message: string) => void;
}

function pathId(raw: string | string[] | undefined): string | undefined {
  return typeof raw === 'string' ? raw : raw?.[0];
}

function mapDomainError(error: unknown): never {
  if (error instanceof MaterialForbiddenError) {
    throw new ForbiddenError(error.message);
  }
  if (error instanceof MaterialNotFoundError) {
    throw new NotFoundError(error.message);
  }
  if (error instanceof MaterialValidationError) {
    throw new BadRequestError(error.message);
  }
  throw error;
}

/**
 * Administrative callers with materials.read → unrestricted.
 * TEACHER / STUDENT without that grant → ownership / entitlement.
 */
async function resolveMaterialReadActor(
  grants: PermissionGrantStore,
  user: SessionUser,
  teachers: TeacherStore,
  students: StudentStore,
): Promise<MaterialReadActor | null> {
  if (await hasPermission(grants, user.role, 'materials', 'read')) {
    return { mode: 'admin' };
  }
  if (user.role === 'TEACHER') {
    const teacher = await teachers.findByUserId(user.id);
    if (!teacher) return null;
    return { mode: 'teacher', teacherId: teacher.id };
  }
  if (user.role === 'STUDENT') {
    const student = await students.findByUserId(user.id);
    if (!student) return null;
    return { mode: 'student', studentId: student.id };
  }
  return null;
}

/**
 * Write: materials.create|update grant, or TEACHER via Group.teacherId.
 * Students never write. Soft-delete uses materials.update (no materials.delete).
 */
async function resolveMaterialWriteActor(
  grants: PermissionGrantStore,
  user: SessionUser,
  teachers: TeacherStore,
  adminAction: Extract<PermissionAction, 'create' | 'update'>,
): Promise<MaterialWriteActor | null> {
  if (await hasPermission(grants, user.role, 'materials', adminAction)) {
    return { mode: 'admin' };
  }
  if (user.role === 'TEACHER') {
    const teacher = await teachers.findByUserId(user.id);
    if (!teacher) return null;
    return { mode: 'teacher', teacherId: teacher.id };
  }
  return null;
}

export function createMaterialsRouter({
  authenticate: authOptions,
  materials,
  storage,
  teachers,
  students,
  permissionGrants,
  sizeLimits,
  urlTtls,
  logError = () => undefined,
}: MaterialsDependencies): Router {
  const router = Router();

  router.get('/materials', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const actor = await resolveMaterialReadActor(
          permissionGrants,
          req.user!,
          teachers,
          students,
        );
        if (!actor) throw new ForbiddenError();

        const query = materialListQuerySchema.safeParse(req.query);
        if (!query.success) {
          throw new BadRequestError(
            'Exactly one of courseId or classSessionId is required.',
          );
        }

        const list = await listMaterials(materials, {
          courseId: query.data.courseId,
          classSessionId: query.data.classSessionId,
          actor,
        });
        const body: MaterialListResponse = { materials: list };
        res.status(200).json(body);
      } catch (error) {
        mapDomainError(error);
      }
    })().catch(next);
  });

  router.get('/materials/:id', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const id = pathId(req.params.id);
        if (!id) throw new BadRequestError('Invalid material id.');

        const actor = await resolveMaterialReadActor(
          permissionGrants,
          req.user!,
          teachers,
          students,
        );
        if (!actor) throw new ForbiddenError();

        const material = await getMaterial(materials, actor, id);
        const body: MaterialResponse = { material };
        res.status(200).json(body);
      } catch (error) {
        mapDomainError(error);
      }
    })().catch(next);
  });

  router.get(
    '/materials/:id/download',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params.id);
          if (!id) throw new BadRequestError('Invalid material id.');

          const actor = await resolveMaterialReadActor(
            permissionGrants,
            req.user!,
            teachers,
            students,
          );
          if (!actor) throw new ForbiddenError();

          const body: MaterialDownloadResponse = await downloadMaterial(
            materials,
            storage,
            actor,
            id,
            urlTtls,
          );
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post('/materials', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const actor = await resolveMaterialWriteActor(
          permissionGrants,
          req.user!,
          teachers,
          'create',
        );
        if (!actor) throw new ForbiddenError();

        const parsed = createMaterialRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError('Invalid material payload.');
        }

        const material = await createLinkMaterial(
          materials,
          actor,
          req.user!.id,
          parsed.data,
        );
        const body: MaterialResponse = { material };
        res.status(201).json(body);
      } catch (error) {
        mapDomainError(error);
      }
    })().catch(next);
  });

  router.post(
    '/materials/uploads',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const actor = await resolveMaterialWriteActor(
            permissionGrants,
            req.user!,
            teachers,
            'create',
          );
          if (!actor) throw new ForbiddenError();

          const parsed = createMaterialUploadRequestSchema.safeParse(req.body);
          if (!parsed.success) {
            throw new BadRequestError('Invalid upload intent payload.');
          }

          const body: MaterialUploadResponse = await createFileUploadIntent(
            materials,
            storage,
            actor,
            req.user!.id,
            parsed.data,
            sizeLimits,
            urlTtls,
          );
          res.status(201).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.post(
    '/materials/:id/complete',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params.id);
          if (!id) throw new BadRequestError('Invalid material id.');

          const actor = await resolveMaterialWriteActor(
            permissionGrants,
            req.user!,
            teachers,
            'update',
          );
          if (!actor) throw new ForbiddenError();

          const material = await completeMaterialUpload(
            materials,
            storage,
            actor,
            id,
            sizeLimits,
          );
          const body: MaterialResponse = { material };
          res.status(200).json(body);
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  router.patch('/materials/:id', authenticate(authOptions), (req, res, next) => {
    void (async () => {
      try {
        const id = pathId(req.params.id);
        if (!id) throw new BadRequestError('Invalid material id.');

        const actor = await resolveMaterialWriteActor(
          permissionGrants,
          req.user!,
          teachers,
          'update',
        );
        if (!actor) throw new ForbiddenError();

        const parsed = updateMaterialRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new BadRequestError('Invalid material update payload.');
        }

        const material = await updateMaterial(
          materials,
          actor,
          id,
          parsed.data,
        );
        const body: MaterialResponse = { material };
        res.status(200).json(body);
      } catch (error) {
        mapDomainError(error);
      }
    })().catch(next);
  });

  router.delete(
    '/materials/:id',
    authenticate(authOptions),
    (req, res, next) => {
      void (async () => {
        try {
          const id = pathId(req.params.id);
          if (!id) throw new BadRequestError('Invalid material id.');

          // Soft-delete authorizes via materials.update — no materials.delete.
          const actor = await resolveMaterialWriteActor(
            permissionGrants,
            req.user!,
            teachers,
            'update',
          );
          if (!actor) throw new ForbiddenError();

          await softDeleteMaterial(
            materials,
            storage,
            actor,
            id,
            logError,
          );
          res.status(204).send();
        } catch (error) {
          mapDomainError(error);
        }
      })().catch(next);
    },
  );

  return router;
}
