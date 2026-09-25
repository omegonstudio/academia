import { ROLES } from '@academia/shared';
import { describe, expect, it } from 'vitest';
import {
  canManageAdministrativePermissionsUi,
  canProvisionAdministrativeUi,
  canViewSettingsUi,
  identityMutationErrorMessage,
  permissionActionLabel,
  permissionKey,
  permissionModuleLabel,
} from './stage1-identity.js';

describe('stage1-identity UX gates', () => {
  it('limits permissions management UI to SUPER_ADMIN and DIRECTOR', () => {
    expect(canManageAdministrativePermissionsUi('SUPER_ADMIN')).toBe(true);
    expect(canManageAdministrativePermissionsUi('DIRECTOR')).toBe(true);
    expect(canManageAdministrativePermissionsUi('ADMINISTRATIVE')).toBe(false);
    expect(canManageAdministrativePermissionsUi('TEACHER')).toBe(false);
    expect(canManageAdministrativePermissionsUi('STUDENT')).toBe(false);
  });

  it('limits administrative provisioning UI to SUPER_ADMIN and DIRECTOR', () => {
    expect(canProvisionAdministrativeUi('SUPER_ADMIN')).toBe(true);
    expect(canProvisionAdministrativeUi('DIRECTOR')).toBe(true);
    for (const role of ROLES) {
      if (role === 'SUPER_ADMIN' || role === 'DIRECTOR') continue;
      expect(canProvisionAdministrativeUi(role)).toBe(false);
    }
  });

  it('allows every role to open settings', () => {
    for (const role of ROLES) {
      expect(canViewSettingsUi(role)).toBe(true);
    }
  });

  it('labels modules and actions in Spanish', () => {
    expect(permissionModuleLabel('students')).toBe('Estudiantes');
    expect(permissionModuleLabel('permissions')).toBe('Permisos');
    expect(permissionActionLabel('read')).toBe('Leer');
    expect(permissionActionLabel('update')).toBe('Actualizar');
    expect(permissionKey('classes', 'create')).toBe('classes:create');
  });

  it('maps identity mutation errors', () => {
    expect(identityMutationErrorMessage(403, 'permission')).toMatch(/permiso/i);
    expect(identityMutationErrorMessage(409, 'administrative')).toMatch(/correo/i);
    expect(identityMutationErrorMessage(401)).toMatch(/sesión/i);
  });

  it('keeps STUDENT and TEACHER off administrative nav surfaces', () => {
    for (const role of ['STUDENT', 'TEACHER', 'ADMINISTRATIVE'] as const) {
      expect(canManageAdministrativePermissionsUi(role)).toBe(false);
      expect(canProvisionAdministrativeUi(role)).toBe(false);
      expect(canViewSettingsUi(role)).toBe(true);
    }
  });
});
