import { Injectable, BadRequestException } from '@nestjs/common';
import { FILE_TYPE_CONFIGS } from './dto/upload-options.dto';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadService {
  uploadFile(
    file: Express.Multer.File,
    options: {
      fileType?: string;
      folder?: string;
      maxSize?: number;
      allowedExtensions?: string[];
    } = {},
  ) {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const fileType = options.fileType || 'all';
    const config = FILE_TYPE_CONFIGS[fileType] || FILE_TYPE_CONFIGS.all;

    const maxSize = options.maxSize || config.maxSize;
    if (file.size > maxSize) {
      this.cleanupFile(file.path);
      throw new BadRequestException(
        `文件大小超过限制，最大允许 ${(maxSize / 1024 / 1024).toFixed(1)}MB`,
      );
    }

    const allowedExtensions =
      options.allowedExtensions && options.allowedExtensions.length > 0
        ? options.allowedExtensions
        : config.allowedExtensions;

    if (allowedExtensions && allowedExtensions.length > 0) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedExtensions.includes(ext)) {
        this.cleanupFile(file.path);
        throw new BadRequestException(
          `不支持的文件类型 ${ext}，允许的类型：${allowedExtensions.join(', ')}`,
        );
      }
    }

    const folder = options.folder || fileType;
    const uploadDir = path.join(process.cwd(), 'uploads', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const safeName = this.generateSafeFileName(file.originalname);
    const newPath = path.join(uploadDir, safeName);

    if (file.path && file.path !== newPath) {
      fs.renameSync(file.path, newPath);
    }

    const relativePath = path
      .join('uploads', folder, safeName)
      .replace(/\\/g, '/');

    return {
      originalName: file.originalname,
      fileName: safeName,
      path: relativePath,
      url: `/${relativePath}`,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  uploadFiles(
    files: Express.Multer.File[],
    options: {
      fileType?: string;
      folder?: string;
      maxSize?: number;
      allowedExtensions?: string[];
    } = {},
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择要上传的文件');
    }

    return files.map((file) => this.uploadFile(file, options));
  }

  private generateSafeFileName(originalName: string): string {
    const ext = path.extname(originalName).toLowerCase();
    const basename = path
      .basename(originalName, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 50);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${basename}_${timestamp}_${random}${ext}`;
  }

  private cleanupFile(filePath: string) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // 清理失败不影响主流程
    }
  }
}
