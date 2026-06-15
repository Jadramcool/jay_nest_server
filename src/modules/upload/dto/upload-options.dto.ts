export enum FileTypeEnum {
  IMAGE = 'image',
  DOCUMENT = 'document',
  AUDIO = 'audio',
  VIDEO = 'video',
  ARCHIVE = 'archive',
  AVATAR = 'avatar',
  ALL = 'all',
}

export const FILE_TYPE_CONFIGS: Record<
  string,
  { maxSize: number; allowedExtensions: string[] }
> = {
  avatar: {
    maxSize: 5 * 1024 * 1024,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  },
  image: {
    maxSize: 10 * 1024 * 1024,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  },
  document: {
    maxSize: 50 * 1024 * 1024,
    allowedExtensions: [
      '.pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.ppt',
      '.pptx',
      '.txt',
    ],
  },
  video: {
    maxSize: 500 * 1024 * 1024,
    allowedExtensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv'],
  },
  audio: {
    maxSize: 100 * 1024 * 1024,
    allowedExtensions: ['.mp3', '.wav', '.flac', '.aac', '.ogg'],
  },
  archive: {
    maxSize: 100 * 1024 * 1024,
    allowedExtensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
  },
  all: { maxSize: 10 * 1024 * 1024, allowedExtensions: [] },
};
