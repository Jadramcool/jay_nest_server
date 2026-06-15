import { TransformInterceptor } from './transform.interceptor';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('should wrap plain data in standard response format', (done) => {
    const context = {} as ExecutionContext;
    const next: CallHandler = { handle: () => of({ id: 1, name: 'test' }) };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({
        code: 200,
        message: '操作成功',
        data: { id: 1, name: 'test' },
      });
      done();
    });
  });

  it('should wrap string response', (done) => {
    const context = {} as ExecutionContext;
    const next: CallHandler = { handle: () => of('hello') };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({
        code: 200,
        message: '操作成功',
        data: 'hello',
      });
      done();
    });
  });

  it('should wrap null data', (done) => {
    const context = {} as ExecutionContext;
    const next: CallHandler = { handle: () => of(null) };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({
        code: 200,
        message: '操作成功',
        data: null,
      });
      done();
    });
  });

  it('should wrap array data', (done) => {
    const context = {} as ExecutionContext;
    const next: CallHandler = { handle: () => of([1, 2, 3]) };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({
        code: 200,
        message: '操作成功',
        data: [1, 2, 3],
      });
      done();
    });
  });

  it('should wrap boolean data', (done) => {
    const context = {} as ExecutionContext;
    const next: CallHandler = { handle: () => of(true) };

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toEqual({
        code: 200,
        message: '操作成功',
        data: true,
      });
      done();
    });
  });
});
