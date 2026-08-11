import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PaginationDto,
} from './pagination.dto';

describe('PaginationDto', () => {
  it('uses the shared defaults', async () => {
    const dto = plainToInstance(PaginationDto, {});

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('converts query values and caps pageSize at the shared maximum', async () => {
    const dto = plainToInstance(PaginationDto, {
      page: '2',
      pageSize: '999',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({ page: 2, pageSize: MAX_PAGE_SIZE });
  });

  it('rejects page and pageSize values below one', async () => {
    const dto = plainToInstance(PaginationDto, { page: '0', pageSize: '0' });

    expect(await validate(dto)).toHaveLength(2);
  });
});
