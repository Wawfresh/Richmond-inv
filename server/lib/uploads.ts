import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
  '.jfif',
]);

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/x-pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

export function getPrivateStorageRoot(): string {
  const configured = process.env.UPLOAD_STORAGE_DIR || './storage/private_uploads';
  const resolved = path.resolve(process.cwd(), configured);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function createPrivateUploader(subFolder: 'kyc' | 'payments' | 'offerings' | 'cms') {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        const targetDir = path.join(getPrivateStorageRoot(), subFolder);
        fs.mkdirSync(targetDir, { recursive: true });
        cb(null, targetDir);
      } catch (err: any) {
        cb(err, '');
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = (file.mimetype || '').toLowerCase();
      const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : MIME_TO_EXT[mime] || '.bin';
      const uniqueName = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${safeExt}`;
      cb(null, uniqueName);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 15 * 1024 * 1024, // 15MB max
      files: 5,
    },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const mime = (file.mimetype || '').toLowerCase();
      const extAllowed = ALLOWED_EXTENSIONS.has(ext);
      const mimeAllowed = ALLOWED_MIME_TYPES.has(mime);
      const genericOctetWithValidExt = (mime === '' || mime === 'application/octet-stream') && extAllowed;

      if ((extAllowed && mimeAllowed) || genericOctetWithValidExt || (!ext && mimeAllowed)) {
        cb(null, true);
        return;
      }
      cb(new Error('Unsupported file type. Only PDF, JPG, PNG, WEBP, GIF, and HEIC files are permitted.'));
    },
  });
}

export function resolveSafeStoragePath(storedPath: string): string | null {
  const root = getPrivateStorageRoot();
  const resolved = path.resolve(storedPath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null;
  }
  if (!fs.existsSync(resolved)) {
    return null;
  }
  return resolved;
}
