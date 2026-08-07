import { describe, expect, it, jest } from '@jest/globals';
import { TenantScopedRepository } from '../src/common/tenant/tenant-scoped.repository';

describe('TenantScopedRepository', () => {
  it('always injects tenantId into findById filters', () => {
    const findOne = jest.fn();
    const model = { findOne } as never;
    const repo = new TenantScopedRepository<{ tenantId: string }>(model);

    repo.findById(
      {
        tenantId: 'tenant-a',
        tenantSlug: 'acme',
        userId: 'user-a',
        permissions: [],
        platformAdmin: false
      },
      'employee-from-tenant-b'
    );

    expect(findOne).toHaveBeenCalledWith({ _id: 'employee-from-tenant-b', tenantId: 'tenant-a' });
  });
});
