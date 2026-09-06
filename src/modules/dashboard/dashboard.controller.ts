import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('仪表盘')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取仪表盘统计数据' })
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('trends')
  @ApiOperation({ summary: '获取趋势数据' })
  @ApiQuery({ name: 'days', required: false, type: Number, example: 7 })
  async getTrends(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    // 钳制范围：days 过大会触发逐日聚合查询风暴
    return this.dashboardService.getTrends(Math.min(Math.max(days, 1), 90));
  }

  @Get('system-info')
  @ApiOperation({ summary: '获取系统信息' })
  async getSystemInfo() {
    return this.dashboardService.getSystemInfo();
  }

  @Get('activities')
  @ApiOperation({ summary: '获取最近动态' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 8 })
  async getActivities(
    @Query('limit', new DefaultValuePipe(8), ParseIntPipe) limit: number,
  ) {
    return this.dashboardService.getActivities(
      Math.min(Math.max(limit, 1), 50),
    );
  }
}
