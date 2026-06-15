import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PublicService } from './public.service';
import { SortDto, ResetSortDto } from './dto';

@ApiTags('公共接口')
@ApiBearerAuth()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Post('sort')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '拖拽排序' })
  async sort(@Body() dto: SortDto) {
    return this.publicService.sort(dto);
  }

  @Post('resetSort')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '重置排序' })
  async resetSort(@Body() dto: ResetSortDto) {
    return this.publicService.resetSort(dto);
  }
}
