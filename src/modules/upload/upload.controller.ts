import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';

interface UploadBody {
  fileType?: string;
  folder?: string;
  maxSize?: number | string;
}

@ApiTags('文件上传')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '单文件上传' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadBody,
  ) {
    return this.uploadService.uploadFile(file, {
      fileType: String(body.fileType ?? ''),
      folder: String(body.folder ?? ''),
      maxSize: body.maxSize ? parseInt(String(body.maxSize), 10) : undefined,
    });
  }

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '批量文件上传' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('files', 10))
  uploadFiles(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UploadBody,
  ) {
    return this.uploadService.uploadFiles(files, {
      fileType: String(body.fileType ?? ''),
      folder: String(body.folder ?? ''),
      maxSize: body.maxSize ? parseInt(String(body.maxSize), 10) : undefined,
    });
  }
}
