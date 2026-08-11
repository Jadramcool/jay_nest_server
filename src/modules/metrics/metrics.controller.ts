import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Headers,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequirePermissions } from '@/common/decorators';
import { MetricsService } from './metrics.service';
import { ReportClientEventsDto, QueryClientEventDto } from './dto/metrics.dto';

@ApiTags('前端监控')
@ApiBearerAuth()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /** 前端批量上报(仅需登录) */
  @Post('events')
  @ApiOperation({ summary: '批量上报前端事件' })
  async report(
    @Req() request: { user?: { userId: number } },
    @Headers('user-agent') userAgent: string,
    @Body() dto: ReportClientEventsDto,
  ) {
    return this.metricsService.report(
      request.user?.userId ?? null,
      dto.events,
      userAgent,
    );
  }

  @Get('events')
  @RequirePermissions('system:metrics:list')
  @ApiOperation({ summary: '查询前端事件(分页)' })
  async findAll(@Query() query: QueryClientEventDto) {
    return this.metricsService.findAll(query);
  }

  @Get('stats')
  @RequirePermissions('system:metrics:list')
  @ApiOperation({ summary: '事件统计' })
  async getStats() {
    return this.metricsService.getStats();
  }
}
