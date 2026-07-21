/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let prisma: jest.Mocked<PrismaService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser = {
    id: 1,
    username: 'testuser',
    password: '$2b$10$hashedpassword',
    name: '测试用户',
    phone: '13800138000',
    email: 'test@example.com',
    sex: 'MALE' as const,
    avatar: null,
    birthday: null,
    city: null,
    address: null,
    addressDetail: null,
    status: 1,
    isDeleted: false,
    roleType: 'user',
    position: null,
    joinedAt: null,
    departmentId: null,
    createdTime: new Date(),
    updatedTime: new Date(),
    deletedTime: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            userRole: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
            getOrThrow: jest.fn(
              () => 'test-jwt-secret-with-at-least-32-characters',
            ),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwtService = module.get(JwtService);
  });

  describe('validateUser', () => {
    it('should return user info when credentials are valid', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password123');

      expect(result).toEqual({ id: 1, username: 'testuser' });

      expect(prisma.user.findUnique.mock.calls[0]).toEqual([
        { where: { username: 'testuser' } },
      ]);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is deleted', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        isDeleted: true,
      });

      await expect(
        service.validateUser('testuser', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user is disabled', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, status: 0 });

      await expect(
        service.validateUser('testuser', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.validateUser('testuser', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('should return token pair for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      jwtService.sign.mockReturnValue('mock-token');

      const result = await service.login('testuser', 'password123');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('tokenType', 'Bearer');
      expect(result).toHaveProperty('expiresIn');
      expect(jwtService.sign.mock.calls[0][0]).toEqual({
        id: 1,
        username: 'testuser',
        type: 'access',
      });
      expect(jwtService.sign.mock.calls[1][0]).toEqual({
        id: 1,
        username: 'testuser',
        type: 'refresh',
      });
    });

    it('should throw on invalid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('baduser', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('register', () => {
    const registerData = {
      username: 'newuser',
      password: 'password123',
      confirmPassword: 'password123',
      phone: '13900139000',
      email: 'new@example.com',
    };

    it('should create user when data is valid', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        ...mockUser,
        id: 2,
        username: 'newuser',
      });
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed');

      const result = await service.register(registerData);

      expect(result).toEqual({ userId: 2, username: 'newuser' });

      expect(prisma.user.create.mock.calls).toHaveLength(1);
    });

    it('should throw BadRequestException when passwords do not match', async () => {
      await expect(
        service.register({ ...registerData, confirmPassword: 'different' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when username exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(service.register(registerData)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException when email exists', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // username check
        .mockResolvedValueOnce(mockUser); // email check

      await expect(service.register(registerData)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('refresh', () => {
    it('should return new tokens for valid refresh token', async () => {
      jwtService.verify.mockReturnValue({
        id: 1,
        username: 'testuser',
        type: 'refresh',
      });
      prisma.user.findUnique.mockResolvedValue(mockUser);
      jwtService.sign.mockReturnValue('new-token');

      const result = await service.refresh('valid-refresh-token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid token type', async () => {
      jwtService.verify.mockReturnValue({
        id: 1,
        username: 'testuser',
        type: 'access',
      });

      await expect(service.refresh('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(service.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getUserInfo', () => {
    it('should return user info when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        department: { id: 1, name: '技术部' },
        roles: [{ role: { id: 1, name: '管理员', code: 'admin' } }],
      });

      const result = await service.getUserInfo(1);

      expect(result).toHaveProperty('username', 'testuser');
      expect(result).toHaveProperty('departmentName', '技术部');
      expect(result).toHaveProperty('roles');
    });

    it('should throw NotFoundException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserInfo(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updatePassword', () => {
    it('should update password when old password is correct', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$newhashed');
      prisma.user.update.mockResolvedValue(mockUser);

      const result = await service.updatePassword(1, 'oldpass', 'newpass');

      expect(result).toEqual({ message: '密码修改成功' });

      expect(prisma.user.update.mock.calls).toHaveLength(1);
    });

    it('should throw BadRequestException when old password is wrong', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.updatePassword(1, 'wrongpass', 'newpass'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
