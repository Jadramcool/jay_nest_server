import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '@/prisma/prisma.service';

type NoticeSocket = Socket<any, any, any, { userId?: number }>;

@WebSocketGateway({
  namespace: '/notice',
  cors: {
    origin: true,
    credentials: true,
  },
})
@Injectable()
export class NoticeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 客户端连接时验证 JWT，解析 userId 并加入个人房间
   */
  async handleConnection(client: NoticeSocket): Promise<void> {
    try {
      const token: unknown =
        client.handshake.auth?.token || client.handshake.query?.token;

      if (typeof token !== 'string' || !token) {
        client.emit('error', { message: '缺少 token' });
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{
        id: number;
        username: string;
        type: 'access';
      }>(token);

      if (!payload?.id || payload.type !== 'access') {
        client.emit('error', { message: '无效 token' });
        client.disconnect();
        return;
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: { isDeleted: true, status: true },
      });
      if (!user || user.isDeleted || user.status !== 1) {
        client.emit('error', { message: '用户不可用' });
        client.disconnect();
        return;
      }

      // 将 userId 挂载到 socket 上，方便断开时使用
      client.data.userId = payload.id;

      // 加入用户专属房间（同一用户多标签页都在此房间）
      await client.join(`user:${payload.id}`);

      console.log(
        `[NoticeGateway] 用户 ${payload.username}(${payload.id}) 已连接`,
      );
    } catch {
      client.emit('error', { message: 'token 验证失败' });
      client.disconnect();
    }
  }

  handleDisconnect(client: NoticeSocket): void {
    const userId = client.data.userId;
    if (userId) {
      console.log(`[NoticeGateway] 用户(${userId}) 已断开`);
    }
  }

  /**
   * 向指定用户推送新公告通知
   */
  sendToUsers(
    userIds: number[],
    notice: {
      id: number;
      title: string;
      content?: string | null;
      type: string;
      isMandatory: boolean;
      isPinned: boolean;
      publishedAt?: Date | string | null;
    },
  ): void {
    if (!userIds?.length) return;

    const payload = {
      noticeId: notice.id,
      id: notice.id,
      title: notice.title,
      content: notice.content || undefined,
      type: notice.type,
      isMandatory: notice.isMandatory,
      isPinned: notice.isPinned,
      publishedAt: notice.publishedAt
        ? new Date(notice.publishedAt).toISOString()
        : undefined,
    };

    for (const userId of userIds) {
      this.server.to(`user:${userId}`).emit('newNotice', payload);
    }
  }
}
