import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@/prisma/prisma.service';
import { NoticeGateway } from './notice.gateway';

describe('NoticeGateway', () => {
  const verifyAsync = jest.fn();
  const findUnique = jest.fn();
  let gateway: NoticeGateway;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    gateway = new NoticeGateway(
      { verifyAsync } as unknown as JwtService,
      { user: { findUnique } } as unknown as PrismaService,
    );
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  function createClient() {
    return {
      handshake: { auth: { token: 'token' }, query: {} },
      data: {},
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
    };
  }

  it('rejects refresh tokens', async () => {
    verifyAsync.mockResolvedValue({
      id: 1,
      username: 'admin',
      type: 'refresh',
    });
    const client = createClient();

    await gateway.handleConnection(client as never);

    expect(client.disconnect.mock.calls).toHaveLength(1);
    expect(findUnique.mock.calls).toHaveLength(0);
    expect(client.join.mock.calls).toHaveLength(0);
  });

  it('rejects disabled users before joining their room', async () => {
    verifyAsync.mockResolvedValue({
      id: 1,
      username: 'admin',
      type: 'access',
    });
    findUnique.mockResolvedValue({ isDeleted: false, status: 0 });
    const client = createClient();

    await gateway.handleConnection(client as never);

    expect(client.disconnect.mock.calls).toHaveLength(1);
    expect(client.join.mock.calls).toHaveLength(0);
  });

  it('joins active users to their own room', async () => {
    verifyAsync.mockResolvedValue({
      id: 1,
      username: 'admin',
      type: 'access',
    });
    findUnique.mockResolvedValue({ isDeleted: false, status: 1 });
    const client = createClient();

    await gateway.handleConnection(client as never);

    expect(client.data).toEqual({ userId: 1 });
    expect(client.join.mock.calls[0]).toEqual(['user:1']);
    expect(client.disconnect.mock.calls).toHaveLength(0);
  });
});
