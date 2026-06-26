import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateNoticeDto, UpdateNoticeDto, QueryNoticeDto } from './dto';
import { NoticeGateway } from './notice.gateway';
import { paginate } from '@/common/utils/pagination.util';
import { buildQueryWhere } from '@/common/utils/query-where.util';

export interface NoticeResponse {
  id: number;
  title: string;
  content?: string | null;
  type: string;
  authorId: number;
  authorName: string;
  status: number;
  isPinned: boolean;
  isMandatory: boolean;
  scopeType: string;
  scopeTargets: any[];
  publishedAt: Date | null;
  createdTime: Date;
  updatedTime: Date;
}

@Injectable()
export class NoticeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly noticeGateway: NoticeGateway,
  ) {}

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

    // 如果状态为发布，创建 UserNotice 记录并推送
    if (data.status === 1) {
      await this.createUserNotices(
        notice.id,
        notice.scopeType,
        scopeTargets,
        notice,
      );
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
          targets: true,
          _count: { select: { receivers: { where: { isDeleted: false } } } },
        },
      }),
      this.prisma.notice.count({ where }),
    ]);

    // 批量查询已读计数
    const noticeIds = notices.map((n) => n.id);
    const readCounts =
      noticeIds.length > 0
        ? await this.prisma.userNotice.groupBy({
            by: ['noticeId'],
            where: {
              noticeId: { in: noticeIds },
              readTime: { not: null },
              isDeleted: false,
            },
            _count: { noticeId: true },
          })
        : [];
    const readCountMap = new Map(
      readCounts.map((r) => [r.noticeId, r._count.noticeId]),
    );

    const formattedNotices = notices.map((notice) => {
      const totalReceivers = notice._count.receivers;
      const readCount = readCountMap.get(notice.id) || 0;
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
    const notice = await this.prisma.notice.findUnique({
      where: { id },
      include: { targets: true },
    });
    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${id} 不存在`);
    }

    const { scopeTargets, ...data } = updateNoticeDto;
    const scopeTypeChanged =
      data.scopeType != null && data.scopeType !== notice.scopeType;
    const targetsProvided = scopeTargets !== undefined;
    const wasPublished = notice.status === 1;
    const isPublishingNow = data.status === 1 && !wasPublished;

    // 收集旧范围用户（已发布状态下范围变更时需要）
    let oldTargetUserIds: number[] | undefined;
    if (wasPublished && (scopeTypeChanged || targetsProvided)) {
      oldTargetUserIds = await this.resolveTargetUserIds(
        notice.scopeType,
        id,
        notice.targets,
      );
    }

    const updateData: any = { ...data };
    if (isPublishingNow) {
      updateData.publishedAt = new Date();
    }

    // 事务保护：重建 targets
    if (targetsProvided) {
      await this.prisma.$transaction(async (tx) => {
        await tx.noticeTarget.deleteMany({ where: { noticeId: id } });
        if (scopeTargets.length > 0) {
          await tx.noticeTarget.createMany({
            data: scopeTargets.map((t) => ({
              noticeId: id,
              targetType: t.targetType,
              targetId: t.targetId,
            })),
          });
        }
      });
    } else if (scopeTypeChanged) {
      // scopeType 变了但未传新 targets → 清空旧 targets
      await this.prisma.noticeTarget.deleteMany({ where: { noticeId: id } });
    }

    const updated = await this.prisma.notice.update({
      where: { id },
      data: updateData,
      include: {
        author: { select: { id: true, name: true, username: true } },
        targets: true,
      },
    });

    // 草稿 → 发布：创建 UserNotice
    if (isPublishingNow) {
      await this.createUserNotices(
        id,
        updated.scopeType,
        scopeTargets || updated.targets,
        updated,
      );
    } else if (wasPublished && (scopeTypeChanged || targetsProvided)) {
      // 已发布公告范围变更：同步 UserNotice（清除旧范围用户 + 添加新范围用户）
      const newTargetUserIds = await this.resolveTargetUserIds(
        updated.scopeType,
        id,
        updated.targets,
      );
      await this.syncUserNotices(id, oldTargetUserIds!, newTargetUserIds);
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

    if (newStatus === 1 && !notice.publishedAt) {
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

    // 如果发布，创建 UserNotice 并推送
    if (newStatus === 1) {
      await this.createUserNotices(id, updated.scopeType, undefined, updated);
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
    const notice = await this.prisma.notice.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true, username: true } } },
    });
    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${id} 不存在`);
    }
    if (notice.status !== 1) {
      throw new BadRequestException('只能对已发布的公告进行重推');
    }

    // 根据发布范围解析所有目标用户
    const userIds = await this.resolveTargetUserIds(notice.scopeType, id);

    if (userIds.length === 0) {
      return {
        id,
        resendCount: 0,
        message: '公告暂无目标用户，无需重推',
      };
    }

    // 获取已有记录
    const existingRecords = await this.prisma.userNotice.findMany({
      where: { noticeId: id },
      select: { id: true, userId: true, readTime: true },
    });
    const existingMap = new Map(existingRecords.map((r) => [r.userId, r]));

    // 分离出新用户和已有用户
    const newUserIds: number[] = [];
    const resetUserIds: number[] = [];

    for (const uid of userIds) {
      const record = existingMap.get(uid);
      if (!record) {
        newUserIds.push(uid);
      } else if (record.readTime !== null) {
        // 已读用户 → 重置为未读
        resetUserIds.push(uid);
      }
      // 已有未读记录的用户保持不变
    }

    // 创建新用户记录
    let createdCount = 0;
    if (newUserIds.length > 0) {
      const createResult = await this.prisma.userNotice.createMany({
        data: newUserIds.map((userId) => ({
          noticeId: id,
          userId,
        })),
        skipDuplicates: true,
      });
      createdCount = createResult.count;
    }

    // 重置已读用户的 readTime（使其重新变为未读）
    if (resetUserIds.length > 0) {
      await this.prisma.userNotice.updateMany({
        where: {
          noticeId: id,
          userId: { in: resetUserIds },
        },
        data: { readTime: null, isDeleted: false },
      });
    }

    // WebSocket 推送所有受影响的用户
    const allAffectedUserIds = [...newUserIds, ...resetUserIds];
    if (allAffectedUserIds.length > 0) {
      const formatted = this.formatNotice(notice);
      this.noticeGateway.sendToUsers(allAffectedUserIds, formatted);
    }

    return {
      id,
      resendCount: allAffectedUserIds.length,
      message: `已重新推送至 ${allAffectedUserIds.length} 位用户（其中已读重置 ${resetUserIds.length} 人，新增 ${createdCount} 人）`,
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
    const result = await this.prisma.notice.updateMany({
      where: { id: { in: ids }, isDeleted: false },
      data: { isDeleted: true, deletedTime: new Date() },
    });

    return { ids, count: result.count };
  }

  // ============ 用户端接口 ============

  /**
   * 获取公告接收人列表
   */
  async findReceivers(
    noticeId: number,
    status?: string,
    page = 1,
    pageSize = 10,
  ) {
    const notice = await this.prisma.notice.findUnique({
      where: { id: noticeId },
    });
    if (!notice || notice.isDeleted) {
      throw new NotFoundException(`公告 ID ${noticeId} 不存在`);
    }

    const where: Prisma.UserNoticeWhereInput = { noticeId, isDeleted: false };
    if (status === 'read') {
      where.readTime = { not: null };
    } else if (status === 'unread') {
      where.readTime = null;
    }

    const [records, total] = await Promise.all([
      this.prisma.userNotice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              phone: true,
              email: true,
              sex: true,
              avatar: true,
              status: true,
              roleType: true,
              position: true,
              joinedAt: true,
              birthday: true,
              city: true,
              address: true,
              addressDetail: true,
              department: {
                select: { id: true, name: true },
              },
              roles: {
                include: {
                  role: {
                    select: { id: true, name: true, code: true },
                  },
                },
              },
            },
          },
        },
        orderBy: { assignedTime: 'desc' },
      }),
      this.prisma.userNotice.count({ where }),
    ]);

    return {
      list: records.map((r) => ({
        userId: r.user.id,
        username: r.user.username,
        name: r.user.name,
        phone: r.user.phone,
        email: r.user.email,
        sex: r.user.sex,
        roleType: r.user.roleType,
        position: r.user.position,
        status: r.user.status,
        departmentName: r.user.department?.name,
        roles: r.user.roles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          code: ur.role.code,
        })),
        readTime: r.readTime,
        assignedTime: r.assignedTime,
      })),
      pagination: { page, pageSize, total },
    };
  }

  /**
   * 获取当前用户未读公告列表
   */
  async findUnreadByUser(userId: number) {
    const userNotices = await this.prisma.userNotice.findMany({
      where: {
        userId,
        readTime: null,
        isDeleted: false,
        notice: { isDeleted: false, status: 1 },
      },
      include: {
        notice: {
          include: {
            author: { select: { id: true, name: true, username: true } },
          },
        },
      },
      orderBy: [{ notice: { isPinned: 'desc' } }, { assignedTime: 'desc' }],
    });

    return userNotices.map((un: any) => ({
      noticeId: un.noticeId,
      id: un.id,
      title: un.notice.title,
      content: un.notice.content,
      type: un.notice.type,
      isMandatory: un.notice.isMandatory,
      isPinned: un.notice.isPinned,
      authorName: un.notice.author?.name || un.notice.author?.username || '',
      publishedAt: un.notice.publishedAt,
      assignedTime: un.assignedTime,
    }));
  }

  /**
   * 标记公告为已读
   */
  async markAsRead(userId: number, noticeId: number) {
    const record = await this.prisma.userNotice.findFirst({
      where: { userId, noticeId },
    });

    if (record) {
      // 已有记录（含软删除）→ 恢复并更新阅读时间
      await this.prisma.userNotice.update({
        where: { id: record.id },
        data: { readTime: new Date(), isDeleted: false },
      });
    } else {
      // 无记录（非发布时目标用户）→ 创建一条已读记录
      await this.prisma.userNotice.create({
        data: { userId, noticeId, readTime: new Date() },
      });
    }

    return { id: noticeId };
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
   * 创建 UserNotice 记录（发布时调用）并推送
   * 仅推送给新分配的用户，已读用户不再重复推送
   */
  private async createUserNotices(
    noticeId: number,
    scopeType: string,
    targets?: { targetType: string; targetId: number }[],
    existingNotice?: any,
  ) {
    const userIds = await this.resolveTargetUserIds(
      scopeType,
      noticeId,
      targets,
    );

    if (userIds.length === 0) return;

    // 过滤已有记录的用户
    const existingRecords = await this.prisma.userNotice.findMany({
      where: { noticeId },
      select: { userId: true },
    });
    const existingUserIds = new Set(existingRecords.map((r) => r.userId));
    const newUserIds = userIds.filter((uid) => !existingUserIds.has(uid));

    if (newUserIds.length > 0) {
      await this.prisma.userNotice.createMany({
        data: newUserIds.map((userId) => ({
          noticeId,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    // 通过 WebSocket 推送公告给「新分配」的用户
    const notice =
      existingNotice ||
      (await this.prisma.notice.findUnique({
        where: { id: noticeId },
      }));
    if (notice && newUserIds.length > 0) {
      const formatted = this.formatNotice(notice);
      this.noticeGateway.sendToUsers(newUserIds, formatted);
    }
  }

  /**
   * 同步 UserNotice：清理旧范围用户，添加新范围用户
   */
  private async syncUserNotices(
    noticeId: number,
    oldUserIds: number[],
    newUserIds: number[],
  ) {
    const oldSet = new Set(oldUserIds);
    const newSet = new Set(newUserIds);

    // 要删除的用户：在旧范围中但不在新范围中
    const toRemove = oldUserIds.filter((uid) => !newSet.has(uid));
    if (toRemove.length > 0) {
      await this.prisma.userNotice.updateMany({
        where: { noticeId, userId: { in: toRemove } },
        data: { isDeleted: true },
      });
    }

    // 要新增的用户：在新范围中但不在旧范围中
    const toAdd = newUserIds.filter((uid) => !oldSet.has(uid));
    if (toAdd.length > 0) {
      await this.prisma.userNotice.createMany({
        data: toAdd.map((userId) => ({ noticeId, userId })),
        skipDuplicates: true,
      });
      const notice = await this.prisma.notice.findUnique({
        where: { id: noticeId },
      });
      if (notice) {
        this.noticeGateway.sendToUsers(toAdd, this.formatNotice(notice));
      }
    }
  }

  /**
   * 格式化公告输出
   */
  private formatNotice(notice: any): NoticeResponse {
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
