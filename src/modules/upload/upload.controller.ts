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
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { FILE_TYPE_CONFIGS } from './dto/upload-options.dto';

interface UploadBody {
  fileType?: string;
  folder?: string;
  maxSize?: number | string;
}

// multer 磁盘存储：先落到临时目录，service 校验通过后再 rename 到目标目录。
// 默认内存存储没有 file.path，文件永远不会落盘（且大文件全部缓冲进内存）。
const UPLOAD_TMP_DIR = path.join(process.cwd(), 'uploads', '.tmp');
// 全局硬上限取各类型配置的最大值（video 500MB），实际限制仍由 service 按 fileType 收紧
const MAX_UPLOAD_SIZE = Math.max(
  ...Object.values(FILE_TYPE_CONFIGS).map((config) => config.maxSize),
);

const uploadStorage = diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdir(UPLOAD_TMP_DIR, { recursive: true }, (err) =>
      cb(err, UPLOAD_TMP_DIR),
    );
  },
});

@ApiTags('文件上传')
@ApiBearerAuth()
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '单文件上传' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      limits: { fileSize: MAX_UPLOAD_SIZE },
    }),
  )
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
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: uploadStorage,
      limits: { fileSize: MAX_UPLOAD_SIZE },
    }),
  )
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
