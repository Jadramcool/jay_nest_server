/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { SysConfigService } from './sys-config.service';
import { ConfigResolverService } from './config-resolver.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('SysConfigService', () => {
  let service: SysConfigService;
  let prisma: jest.Mocked<PrismaService>;
  let resolver: jest.Mocked<ConfigResolverService>;

  const mockConfig = {
    id: 1,
    key: 'site_name',
    name: '站点名称',
    value: 'JDM',
    type: 'STRING' as const,
    category: 'site',
    isPublic: true,
    isSystem: false,
    description: null,
    sortOrder: 1,
    createdTime: new Date(),
    updatedTime: new Date(),
  };

  const mockSystemConfig = { ...mockConfig, key: 'version', isSystem: true };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SysConfigService,
        {
          provide: PrismaService,
          useValue: {
            sysConfig: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
        {
          provide: ConfigResolverService,
          useValue: { invalidate: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SysConfigService>(SysConfigService);
    prisma = module.get(PrismaService);
    resolver = module.get(ConfigResolverService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should validate value by type', async () => {
      prisma.sysConfig.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          key: 'n',
          name: '数字',
          value: 'abc',
          type: 'NUMBER',
        }),
      ).rejects.toThrow('配置值校验失败');
      expect(prisma.sysConfig.create.mock.calls).toHaveLength(0);
    });

    it('should force isSystem=false on create', async () => {
      prisma.sysConfig.findUnique.mockResolvedValue(null);
      prisma.sysConfig.create.mockResolvedValue(mockConfig);

      await service.create({
        key: 'site_name',
        name: '站点',
        value: 'JDM',
        type: 'STRING',
        isSystem: true,
      });

      const arg = prisma.sysConfig.create.mock.calls[0][0] as any;
      expect(arg.data.isSystem).toBe(false);
    });
  });

  describe('update', () => {
    it('should reject key/type change on system config', async () => {
      prisma.sysConfig.findUnique.mockResolvedValue(mockSystemConfig);

      await expect(service.update(1, { key: 'new_key' })).rejects.toThrow(
        '系统配置不允许修改键或类型',
      );
      await expect(service.update(1, { type: 'NUMBER' })).rejects.toThrow(
        '系统配置不允许修改键或类型',
      );
    });

    it('should allow value change on system config', async () => {
      prisma.sysConfig.findUnique.mockResolvedValue(mockSystemConfig);
      prisma.sysConfig.update.mockResolvedValue({
        ...mockSystemConfig,
        value: '2.0',
      });

      await service.update(1, { value: '2.0' });

      expect(prisma.sysConfig.update.mock.calls.length).toBeGreaterThan(0);
    });

    it('should validate value by type and invalidate cache', async () => {
      prisma.sysConfig.findUnique.mockResolvedValue({
        ...mockConfig,
        type: 'NUMBER',
      });
      prisma.sysConfig.update.mockResolvedValue({
        ...mockConfig,
        type: 'NUMBER',
        value: '42',
      });

      await expect(
        service.update(1, { value: 'not-a-number' }),
      ).rejects.toThrow('配置值校验失败');

      await service.update(1, { value: '42' });
      expect(resolver.invalidate.mock.calls[0][0]).toBe('site_name');
    });
  });

  describe('remove', () => {
    it('should invalidate cache after delete', async () => {
      prisma.sysConfig.findUnique.mockResolvedValue(mockConfig);
      prisma.sysConfig.delete.mockResolvedValue(mockConfig);

      await service.remove(1);

      expect(resolver.invalidate.mock.calls[0][0]).toBe('site_name');
    });
  });

  describe('formatConfig 脱敏', () => {
    it('should mask PASSWORD value', async () => {
      prisma.sysConfig.findUnique.mockResolvedValue({
        ...mockConfig,
        key: 'smtp_password',
        type: 'PASSWORD',
        value: 'real-secret',
      });

      const result = await service.findByKey('smtp_password');

      expect((result as { value: string }).value).toBe('******');
    });
  });
});
