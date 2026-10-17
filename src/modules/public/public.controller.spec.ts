import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { assertTableSortAccess } from './public.controller';

describe('assertTableSortAccess', () => {
  it('unknown table is rejected', () => {
    expect(() => assertTableSortAccess('user', { permissions: [] })).toThrow(
      BadRequestException,
    );
    expect(() => assertTableSortAccess('operationLog')).toThrow(
      BadRequestException,
    );
  });

  it('rejects anonymous or permission-less users', () => {
    expect(() => assertTableSortAccess('department')).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertTableSortAccess('department', { permissions: [] }),
    ).toThrow(ForbiddenException);
    expect(() =>
      assertTableSortAccess('department', {
        permissions: ['system:user:list'],
      }),
    ).toThrow(ForbiddenException);
  });

  it('allows users holding the table update permission', () => {
    expect(() =>
      assertTableSortAccess('department', {
        permissions: ['system:department:update'],
      }),
    ).not.toThrow();
    expect(() =>
      assertTableSortAccess('department', {
        permissions: ['system:department:update', 'system:user:list'],
      }),
    ).not.toThrow();
  });
});
