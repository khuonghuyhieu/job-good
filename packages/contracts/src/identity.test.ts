import { describe, expect, it } from 'vitest';

import { apiErrorSchema, identityErrorCodes } from './errors.js';
import {
  currentUserResponseSchema,
  demoLoginRequestSchema,
} from './identity.js';

const employeeId = '20000000-0000-4000-8000-000000000001';

describe('identity contracts', () => {
  it('accepts only an employee id in the demo login payload', () => {
    expect(demoLoginRequestSchema.parse({ employeeId })).toEqual({
      employeeId,
    });
    expect(() =>
      demoLoginRequestSchema.parse({
        employeeId,
        organizationId: '10000000-0000-4000-8000-000000000001',
      }),
    ).toThrow();
  });

  it('validates stable current-user and organization context', () => {
    expect(
      currentUserResponseSchema.parse({
        user: {
          id: employeeId,
          email: 'an@goodjob.local',
          displayName: 'An Nguyen',
          avatarUrl: null,
          status: 'active',
          team: {
            id: '11000000-0000-4000-8000-000000000001',
            name: 'Engineering',
          },
        },
        organization: {
          id: '10000000-0000-4000-8000-000000000001',
          name: 'Amanotes Demo',
          slug: 'amanotes-demo',
          timezone: 'Asia/Ho_Chi_Minh',
        },
      }).organization.slug,
    ).toBe('amanotes-demo');
  });

  it('defines a contract-valid inactive employee authentication error', () => {
    expect(identityErrorCodes.inactiveEmployee).toBe('EMPLOYEE_INACTIVE');
    expect(
      apiErrorSchema.parse({
        code: identityErrorCodes.inactiveEmployee,
        message: 'The selected employee is inactive.',
        requestId: 'request-id',
      }).code,
    ).toBe('EMPLOYEE_INACTIVE');
  });
});
