import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, jest } from '@jest/globals';
import { AssignmentsService } from '../src/modules/assignments/assignments.service';

const ctx = {
  tenantId: 'tenant-a',
  tenantSlug: 'acme',
  userId: 'user-a',
  permissions: [],
  platformAdmin: false
};

describe('AssignmentsService', () => {
  it('prevents assigning a vehicle that already has an active assignment', async () => {
    const service = new AssignmentsService(
      {} as never,
      { findOne: async () => ({ _id: 'assignment-a' }) } as never,
      {} as never,
      { detail: async () => ({ _id: 'employee-a', active: true }) } as never,
      { detail: async () => ({ _id: 'vehicle-a', active: true, status: 'AVAILABLE' }) } as never
    );

    await expect(service.assignVehicle(ctx, {
      vehicleId: 'vehicle-a',
      employeeId: 'employee-a',
      mileageAtAssignment: 100
    })).rejects.toBeInstanceOf(BadRequestException);
  });
});
