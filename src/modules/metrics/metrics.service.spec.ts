/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from './metrics.service';
import { PrismaService } from '@/prisma/prisma.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        {
          provide: PrismaService,
          useValue: {
            clientEvent: {
              createMany: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<MetricsService>(MetricsService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('report', () => {
    it('should skip empty event list', async () => {
      const result = await service.report(1, []);

      expect(result.received).toBe(0);
      expect(prisma.clientEvent.createMany.mock.calls).toHaveLength(0);
    });

    it('should batch create events with user id and parsed browser', async () => {
      prisma.clientEvent.createMany.mockResolvedValue({ count: 2 });

      const result = await service.report(
        1,
        [
          { type: 'error', category: 'JS_ERROR', message: 'boom' },
          { type: 'pageview', category: 'ROUTE_CHANGE', route: '/home' },
        ],
        'Mozilla/5.0 Chrome/126.0.0.0 Safari/537.36',
      );

      expect(result.received).toBe(2);
      const arg = prisma.clientEvent.createMany.mock.calls[0][0] as any;
      expect(arg.data).toHaveLength(2);
      expect(arg.data[0]).toEqual(
        expect.objectContaining({
          type: 'error',
          userId: 1,
          browser: 'Chrome 126.0.0.0',
        }),
      );
      expect(arg.data[1].route).toBe('/home');
    });

    it('should truncate long message and stack', async () => {
      prisma.clientEvent.createMany.mockResolvedValue({ count: 1 });

      await service.report(1, [
        {
          type: 'error',
          message: 'x'.repeat(600),
          stack: 's'.repeat(5000),
        },
      ]);

      const arg = prisma.clientEvent.createMany.mock.calls[0][0] as any;
      expect(arg.data[0].message).toHaveLength(500);
      expect(arg.data[0].stack).toHaveLength(4000);
    });
  });

  describe('getStats', () => {
    it('should aggregate counts', async () => {
      prisma.clientEvent.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3) // errors
        .mockResolvedValueOnce(7) // pageviews
        .mockResolvedValueOnce(1); // todayErrors

      const stats = await service.getStats();

      expect(stats).toEqual({
        total: 10,
        errors: 3,
        pageviews: 7,
        todayErrors: 1,
      });
    });
  });
});
