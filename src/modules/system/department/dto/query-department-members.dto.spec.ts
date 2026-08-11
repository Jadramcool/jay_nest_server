import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryDepartmentMembersDto } from './query-department-members.dto';

describe('QueryDepartmentMembersDto', () => {
  it('transforms and validates the department members query', async () => {
    const dto = plainToInstance(QueryDepartmentMembersDto, {
      departmentId: '1',
      includeChildren: 'false',
      page: '1',
      pageSize: '20',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({
      departmentId: 1,
      includeChildren: false,
      page: 1,
      pageSize: 20,
    });
  });

  it('requires a positive departmentId', async () => {
    const dto = plainToInstance(QueryDepartmentMembersDto, {
      departmentId: '0',
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'departmentId')).toBe(
      true,
    );
  });
});
