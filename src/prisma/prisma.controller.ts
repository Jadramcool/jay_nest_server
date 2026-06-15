import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { PrismaService } from './prisma.service';

@ApiTags('健康检查')
@Controller('health')
export class PrismaController {
  constructor(private readonly prismaService: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '健康检查' })
  async checkHealth() {
    const dbHealth = await this.prismaService.checkHealth();

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      database: dbHealth,
    };
  }

  @Public()
  @Get('database')
  @ApiOperation({ summary: '数据库健康检查' })
  async checkDatabase() {
    return this.prismaService.checkHealth();
  }
}
