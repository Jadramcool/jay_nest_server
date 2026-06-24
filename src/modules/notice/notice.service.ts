import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateNoticeDto, UpdateNoticeDto, QueryNoticeDto } from './dto';
import { paginate } from '@/common/utils/pagination.util';
import { buildQueryWhere } from '@/common/utils/query-where.util';

@Injectable()
export class NoticeService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createNoticeDto: CreateNoticeDto, authorId: number) {
    const { scopeTargets, ...data } = createNoticeDto;

    const notice = await this.prisma.notice.create({
      data: {
        ...data,
        authorId,
        // 如果状态为发布，设置发布时间
        ...(data.status === 1 ? { publishedAt: new Date() } : {}),
        // 如果指定了发布范围目标，同时创建
        ...(scopeTargets && scopeTargets.length > 0
          ? {
              targets: {
                createMany: {
                  data: scopeTargets.map((t) => ({
                    targetType: t.targetType,
                    targetId: t.targetId,
                  })),
                },
              },
            }
          : {}),
      },
      include: {
        author: { select: { id: true, name: true, username: true } },
        targets: true,
      },
    });

    // 如果状态为发布，创建 UserNotice 记录
    if (data.status === 1) {
      await this.createUserNotices(notice.id, notice.scopeType, scopeTargets);
    }

    return this.formatNotice(notice);
  }

  async findAll(queryNoticeDto: QueryNoticeDto) {
    const { page = 1, pageSize = 10, ...filters } = queryNoticeDto;

    const where: Prisma.NoticeWhereInput = {
      isDeleted: false,
      ...buildQueryWhere(filters, {
        title: 'contains',
        type: 'eq',
        status: 'eq',
      }),
    };

    const [notices, total] = await Promise.all([
      this.prisma.notice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ isPinned: 'desc' }, { createdTime: 'desc' }],
        include: {
          author: { select: { id: true, name: true, username: true } },
          receivers: {
            select: {
              id: true,
              readTime: true,
            },
          },
          targets: true,
        },
      }),
      this.prisma.notice.count({ where }),
    ]);

    const formattedNotices = notices.map((notice) => {
      const totalReceivers = notice.receivers.length;
      const readCount = notice.receivers.filter(
        (r) => r.readTime !== null,
      ).length;
      return {
        ...this.formatNotice(notice),
        readCount,
        unreadCount: totalReceivers - readCount,
        totalReceivers,
      };
    });

    return paginate(formattedNotices, { page, pageSize, total });
  }

  async findOne(id: number) {
    const notice = await this.prisma.notice.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, username: true } },
        targets: true,
        receivers: {
          select: { id: true, readTime: true },
        },
      },
    });

    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${id} 不存在`);
    }

    const totalReceivers = notice.receivers.length;
    const readCount = notice.receivers.filter(
      (r) => r.readTime !== null,
    ).length;

    return {
      ...this.formatNotice(notice),
      readCount,
      unreadCount: totalReceivers - readCount,
      totalReceivers,
    };
  }

  async update(id: number, updateNoticeDto: UpdateNoticeDto) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${id} 不存在`);
    }

    const { scopeTargets, ...data } = updateNoticeDto;

    // 如果更新时设置已发布，填充发布时间
    const updateData: any = { ...data };
    if (data.status === 1 && notice.status !== 1) {
      updateData.publishedAt = new Date();
    }

    // 如果更新发布范围目标，重建
    if (scopeTargets) {
      await this.prisma.noticeTarget.deleteMany({ where: { noticeId: id } });
      if (scopeTargets.length > 0) {
        await this.prisma.noticeTarget.createMany({
          data: scopeTargets.map((t) => ({
            noticeId: id,
            targetType: t.targetType,
            targetId: t.targetId,
          })),
        });
      }
    }

    const updated = await this.prisma.notice.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, username: true } },
        targets: true,
      },
    });

    // 如果刚刚发布，创建 UserNotice
    if (data.status === 1 && notice.status !== 1) {
      await this.createUserNotices(
        id,
        updated.scopeType,
        scopeTargets || updated.targets,
      );
    }

    return this.formatNotice(updated);
  }

  async toggleStatus(id: number) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${id} 不存在`);
    }

    const newStatus = notice.status === 1 ? 0 : 1;
    const updateData: any = { status: newStatus };

    if (newStatus === 1) {
      updateData.publishedAt = new Date();
    }

    const updated = await this.prisma.notice.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, username: true } },
        targets: true,
      },
    });

    // 如果发布，创建 UserNotice
    if (newStatus === 1) {
      await this.createUserNotices(id, updated.scopeType);
    }

    return this.formatNotice(updated);
  }

  async togglePin(id: number) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${id} 不存在`);
    }

    const updated = await this.prisma.notice.update({
      where: { id },
      data: { isPinned: !notice.isPinned },
      include: {
        author: { select: { id: true, name: true, username: true } },
        targets: true,
      },
    });

    return this.formatNotice(updated);
  }

  async resend(id: number) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${id} 不存在`);
    }
    if (notice.status !== 1) {
      throw new BadRequestException('只能对已发布的公告进行重推');
    }

    // 找到未读的用户，重新创建 UserNotice（忽略已存在的组合）
    const userIds = await this.resolveTargetUserIds(
      notice.scopeType,
      id,
    );

    // 获取已有记录
    const existingRecords = await this.prisma.userNotice.findMany({
      where: { noticeId: id },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingRecords.map((r) => r.userId));

    // 只对还没有记录的未读用户创建
    const newUserIds = userIds.filter((uid) => !existingUserIds.has(uid));

    if (newUserIds.length > 0) {
      await this.prisma.userNotice.createMany({
        data: newUserIds.map((userId) => ({
          noticeId: id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    return {
      id,
      resendCount: newUserIds.length,
      message: `已重新推送至 ${newUserIds.length} 位用户`,
    };
  }

  async remove(id: number) {
    const notice = await this.prisma.notice.findUnique({ where: { id } });
    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${id} 不存在`);
    }

    await this.prisma.notice.update({
      where: { id },
      data: { isDeleted: true, deletedTime: new Date() },
    });

    return { id };
  }

  async batchRemove(ids: number[]) {
    await this.prisma.notice.updateMany({
      where: { id: { in: ids }, isDeleted: false },
      data: { isDeleted: true, deletedTime: new Date() },
    });

    return { ids };
  }

  // ============ 私有方法 ============

  /**
   * 根据发布范围解析目标用户ID列表
   */
  private async resolveTargetUserIds(
    scopeType: string,
    noticeId?: number,
    targets?: { targetType: string; targetId: number }[],
  ): Promise<number[]> {
    if (scopeType === 'ALL') {
      const users = await this.prisma.user.findMany({
        where: { isDeleted: false, status: 1 },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    // 获取目标列表
    let targetList = targets;
    if (!targetList && noticeId) {
      const noticeTargets = await this.prisma.noticeTarget.findMany({
        where: { noticeId },
      });
      targetList = noticeTargets.map((t) => ({
        targetType: t.targetType,
        targetId: t.targetId,
      }));
    }

    if (!targetList || targetList.length === 0) {
      return [];
    }

    const userIdSet = new Set<number>();

    for (const target of targetList) {
      if (target.targetType === 'ROLE') {
        const roleUsers = await this.prisma.userRole.findMany({
          where: {
            roleId: target.targetId,
            user: { isDeleted: false, status: 1 },
          },
          select: { userId: true },
        });
        roleUsers.forEach((r) => userIdSet.add(r.userId));
      } else if (target.targetType === 'DEPARTMENT') {
        const deptUsers = await this.prisma.user.findMany({
          where: {
            departmentId: target.targetId,
            isDeleted: false,
            status: 1,
          },
          select: { id: true },
        });
        deptUsers.forEach((u) => userIdSet.add(u.id));
      } else if (target.targetType === 'USER') {
        userIdSet.add(target.targetId);
      }
    }

    return Array.from(userIdSet);
  }

  /**
   * 创建 UserNotice 记录（发布时调用）
   */
  private async createUserNotices(
    noticeId: number,
    scopeType: string,
    targets?: { targetType: string; targetId: number }[],
  ) {
    const userIds = await this.resolveTargetUserIds(
      scopeType,
      noticeId,
      targets,
    );

    if (userIds.length > 0) {
      await this.prisma.userNotice.createMany({
        data: userIds.map((userId) => ({
          noticeId,
          userId,
        })),
        skipDuplicates: true,
      });
    }
  }

  /**
   * 格式化公告输出
   */
  private formatNotice(notice: any) {
    return {
      id: notice.id,
      title: notice.title,
      content: notice.content,
      type: notice.type,
      authorId: notice.authorId,
      authorName: notice.author?.name || notice.author?.username || '',
      status: notice.status,
      isPinned: notice.isPinned,
      isMandatory: notice.isMandatory,
      scopeType: notice.scopeType,
      scopeTargets: notice.targets || [],
      publishedAt: notice.publishedAt,
      createdTime: notice.createdTime,
      updatedTime: notice.updatedTime,
    };
  }
}
