import { paginate } from './pagination.util';

describe('paginate', () => {
  it('returns the unified flat pagination contract', () => {
    expect(paginate([{ id: 1 }], { page: 2, pageSize: 20, total: 41 })).toEqual(
      {
        items: [{ id: 1 }],
        total: 41,
        page: 2,
        pageSize: 20,
      },
    );
  });

  it('does not expose legacy list or pagination fields', () => {
    const result = paginate([], { page: 1, pageSize: 20, total: 0 });

    expect(result).not.toHaveProperty('list');
    expect(result).not.toHaveProperty('pagination');
    expect(result).not.toHaveProperty('page_size');
  });
});
