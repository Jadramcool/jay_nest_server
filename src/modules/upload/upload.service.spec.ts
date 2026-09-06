import { Readable } from 'stream';
import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

/** 构造内存存储形态的假文件（file.path 为 undefined，不触发真实落盘） */
function makeFile(overrides: Partial<Express.Multer.File> = {}) {
  return {
    fieldname: 'file',
    originalname: 'test.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: 1024,
    buffer: Buffer.from('test'),
    stream: Readable.from([]),
    ...overrides,
  } as Express.Multer.File;
}

describe('UploadService', () => {
  const service = new UploadService();

  it('合法图片上传返回 uploads 相对路径', () => {
    const result = service.uploadFile(makeFile(), { fileType: 'image' });
    expect(result.path).toMatch(/^uploads\/image\/[\w-]+\.png$/);
    expect(result.mimeType).toBe('image/png');
  });

  it('folder 路径穿越被拒绝', () => {
    expect(() =>
      service.uploadFile(makeFile(), {
        fileType: 'image',
        folder: '../../prisma',
      }),
    ).toThrow(BadRequestException);
  });

  it('客户端 maxSize 只能收紧服务端配置、不能放宽', () => {
    // image 配置上限 10MB，客户端传 999MB 不应生效，11MB 文件仍被拒绝
    expect(() =>
      service.uploadFile(makeFile({ size: 11 * 1024 * 1024 }), {
        fileType: 'image',
        maxSize: 999 * 1024 * 1024,
      }),
    ).toThrow(BadRequestException);
  });

  it('无白名单的 fileType（缺省 all）被 fail-closed 拒绝', () => {
    expect(() => service.uploadFile(makeFile(), {})).toThrow(
      BadRequestException,
    );
  });

  it('扩展名不在白名单内被拒绝', () => {
    expect(() =>
      service.uploadFile(makeFile({ originalname: 'evil.html' }), {
        fileType: 'image',
      }),
    ).toThrow(BadRequestException);
  });

  it('批量上传复用同一组校验', () => {
    const results = service.uploadFiles(
      [makeFile(), makeFile({ originalname: 'b.png' })],
      { fileType: 'image' },
    );
    expect(results).toHaveLength(2);
    expect(
      results.every((item) => item.path.startsWith('uploads/image/')),
    ).toBe(true);
  });
});
