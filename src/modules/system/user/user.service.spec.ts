/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '@/prisma/prisma.service';
import { SessionService } from '@/modules/session/session.service';

/** 持有角色分配权限的调用方 */
const CALLER_WITH_ASSIGN_ROLE = {
  permissions: ['system:user:assign-role'],
};

describe('UserService', () => {
  let service: UserService;
  let prisma: jest.Mocked<PrismaService>;
  const kickByUser = jest.fn();

  const ADMIN_ROLE_ID = 1;

  const mockUser = {
    id: 1,
    username: 'admin1',
    password: '$2b$10$hashedpassword',
    name: '管理员一',
    phone: '13800138000',
    email: 'admin1@example.com',
    sex: 'MALE' as const,
    avatar: null,
    birthday: null,
    city: null,
    address: null,
    addressDetail: null,
    status: 1,
    isDeleted: false,
    roleType: 'admin',
    position: null,
    joinedAt: null,
    departmentId: null,
    createdTime: new Date(),
    updatedTime: new Date(),
    deletedTime: null,
  };

  const adminRoleRecord = {
    id: 10,
    userId: 1,
    roleId: ADMIN_ROLE_ID,
    assignedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            userRole: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              deleteMany: jest.fn(),
              createMany: jest.fn(),
            },
            role: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            kickByUser: kickByUser.mockResolvedValue({ kicked: 0 }),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const newUser = { ...mockUser, id: 2, username: 'newuser' };

    it('should create user and assign roles when roleIds provided', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
      );

      const result = await service.create(
        {
          username: 'newuser',
          password: '123456',
          roleIds: [1, 2],
        },
        CALLER_WITH_ASSIGN_ROLE,
      );

      expect(result.id).toBe(2);
      expect(prisma.user.create.mock.calls).toHaveLength(1);
      // roleIds 不应透传给 user.create(Prisma 会拒绝未知字段)
      expect(prisma.user.create.mock.calls[0][0]?.data).not.toHaveProperty(
        'roleIds',
      );
      expect(prisma.userRole.createMany.mock.calls[0][0]).toEqual({
        data: [
          { userId: 2, roleId: 1 },
          { userId: 2, roleId: 2 },
        ],
      });
    });

    it('should reject roleIds without assign-role permission', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          { username: 'newuser', password: '123456', roleIds: [1] },
          { permissions: ['system:user:create'] },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.create.mock.calls).toHaveLength(0);
    });

    it('should allow create without roleIds for caller lacking assign-role', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
      );

      await service.create(
        { username: 'newuser', password: '123456' },
        { permissions: ['system:user:create'] },
      );

      expect(prisma.user.create.mock.calls).toHaveLength(1);
    });

    it('should create user without role assignment when roleIds omitted', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(newUser);
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
      );

      await service.create({
        username: 'newuser',
        password: '123456',
      });

      expect(prisma.userRole.createMany.mock.calls).toHaveLength(0);
    });
  });

  describe('assignRoles', () => {
    it('should reject when the last active system admin removes their ADMIN role', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(0);

      await expect(service.assignRoles(1, [2])).rejects.toThrow(
        '系统中必须至少保留一个系统管理员',
      );

      expect(prisma.userRole.deleteMany.mock.calls).toHaveLength(0);
    });

    it('should succeed when another active system admin remains', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(1);
      prisma.userRole.deleteMany.mockResolvedValue({ count: 1 });
      prisma.userRole.createMany.mockResolvedValue({ count: 1 });
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
      );

      const result = await service.assignRoles(1, [2]);

      expect(result).toEqual({ userId: 1, roleIds: [2] });
      expect(prisma.userRole.deleteMany.mock.calls[0]).toEqual([
        { where: { userId: 1 } },
      ]);
      expect(prisma.userRole.count.mock.calls).toHaveLength(1);
    });

    it('should succeed when the target user is not an ADMIN holder', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.userRole.deleteMany.mockResolvedValue({ count: 1 });
      prisma.userRole.createMany.mockResolvedValue({ count: 1 });
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
      );

      const result = await service.assignRoles(1, [2]);

      expect(result).toEqual({ userId: 1, roleIds: [2] });
      expect(prisma.userRole.count.mock.calls).toHaveLength(0);
    });

    it('should succeed when the ADMIN role is kept in roleIds', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.deleteMany.mockResolvedValue({ count: 1 });
      prisma.userRole.createMany.mockResolvedValue({ count: 1 });
      prisma.$transaction.mockImplementation(
        async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma),
      );

      const result = await service.assignRoles(1, [ADMIN_ROLE_ID, 2]);

      expect(result).toEqual({ userId: 1, roleIds: [1, 2] });
      expect(prisma.userRole.count.mock.calls).toHaveLength(0);
    });
  });

  describe('update', () => {
    it('should reject when the last active system admin removes their ADMIN role via roleIds', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(0);

      await expect(
        service.update(1, { roleIds: [2] }, CALLER_WITH_ASSIGN_ROLE),
      ).rejects.toThrow('系统中必须至少保留一个系统管理员');

      expect(prisma.$transaction.mock.calls).toHaveLength(0);
    });

    it('should reject when the last active system admin is disabled via status=0', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(0);

      await expect(service.update(1, { status: 0 })).rejects.toThrow(
        '系统中必须至少保留一个系统管理员',
      );

      expect(prisma.$transaction.mock.calls).toHaveLength(0);
    });

    it('should succeed when another active system admin remains', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(1);
      prisma.$transaction.mockResolvedValue(mockUser);

      const result = await service.update(
        1,
        { roleIds: [2] },
        CALLER_WITH_ASSIGN_ROLE,
      );

      expect(result).toEqual({
        id: 1,
        username: 'admin1',
        name: '管理员一',
        phone: '13800138000',
        email: 'admin1@example.com',
      });
      expect(prisma.$transaction.mock.calls).toHaveLength(1);
    });

    it('should succeed when the user is not an ADMIN holder', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.$transaction.mockResolvedValue(mockUser);

      const result = await service.update(
        1,
        { roleIds: [2] },
        CALLER_WITH_ASSIGN_ROLE,
      );

      expect(result).toHaveProperty('id', 1);
      expect(prisma.userRole.count.mock.calls).toHaveLength(0);
    });

    it('should reject roleIds without assign-role permission', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.update(
          1,
          { roleIds: [2] },
          { permissions: ['system:user:update'] },
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction.mock.calls).toHaveLength(0);
    });

    it('should reject empty roleIds (clearing roles) without assign-role permission', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.update(
          1,
          { roleIds: [] },
          { permissions: ['system:user:update'] },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resetPassword', () => {
    it('should update password and kick all sessions of the user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.resetPassword(1, 'newpass123');

      expect(result).toEqual({ id: 1 });
      expect(kickByUser).toHaveBeenCalledWith(1);
    });

    it('should throw when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword(999, 'newpass123')).rejects.toThrow(
        NotFoundException,
      );
      expect(kickByUser).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus', () => {
    it('should reject when disabling the last active system admin', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(0);

      await expect(service.updateStatus(1, 0)).rejects.toThrow(
        '不能禁用最后一个系统管理员',
      );

      expect(prisma.user.update.mock.calls).toHaveLength(0);
    });

    it('should succeed when disabling a non-admin user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ ...mockUser, status: 0 });

      const result = await service.updateStatus(1, 0);

      expect(result).toEqual({ id: 1, status: 0 });
      expect(prisma.userRole.count.mock.calls).toHaveLength(0);
    });

    it('should succeed when other active system admins exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue({ ...mockUser, status: 0 });

      const result = await service.updateStatus(1, 0);

      expect(result).toEqual({ id: 1, status: 0 });
      expect(prisma.user.update.mock.calls).toHaveLength(1);
    });

    it('should skip the guard when enabling a user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.user.update.mockResolvedValue({ ...mockUser, status: 1 });

      const result = await service.updateStatus(1, 1);

      expect(result).toEqual({ id: 1, status: 1 });
      expect(prisma.userRole.findUnique.mock.calls).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('should reject when deleting the last active system admin', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(0);

      await expect(service.remove(1)).rejects.toThrow(
        '不能删除最后一个系统管理员',
      );

      expect(prisma.user.update.mock.calls).toHaveLength(0);
    });

    it('should succeed when other active system admins exist', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(adminRoleRecord);
      prisma.userRole.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue({ ...mockUser, isDeleted: true });

      const result = await service.remove(1);

      expect(result).toEqual({ id: 1 });
      expect(prisma.user.update.mock.calls).toHaveLength(1);
    });

    it('should succeed when deleting a non-admin user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ ...mockUser, isDeleted: true });

      const result = await service.remove(1);

      expect(result).toEqual({ id: 1 });
      expect(prisma.userRole.count.mock.calls).toHaveLength(0);
    });
  });

  describe('batchRemove', () => {
    it('should reject when the batch contains all active system admins', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);
      prisma.userRole.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0);

      await expect(service.batchRemove([1, 2])).rejects.toThrow(
        '不能删除最后一个系统管理员',
      );

      expect(prisma.user.updateMany.mock.calls).toHaveLength(0);
    });

    it('should succeed when at least one active system admin remains outside the batch', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findMany.mockResolvedValue([{ userId: 1 }]);
      prisma.userRole.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.batchRemove([1]);

      expect(result).toEqual({ ids: [1] });
      expect(prisma.user.updateMany.mock.calls).toHaveLength(1);
    });

    it('should succeed when the batch contains no ADMIN holders', async () => {
      prisma.role.findFirst.mockResolvedValue({ id: ADMIN_ROLE_ID });
      prisma.userRole.findMany.mockResolvedValue([]);
      prisma.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.batchRemove([3, 4]);

      expect(result).toEqual({ ids: [3, 4] });
      expect(prisma.userRole.count.mock.calls).toHaveLength(0);
    });
  });
});
