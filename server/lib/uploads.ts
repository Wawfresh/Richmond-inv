import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

export function getPrivateStorageRoot(): string {
  const configured = process.env.UPLOAD_STORAGE_DIR || './storage/private_uploads';
  const resolved = path.resolve(process.cwd(), configured);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function createPrivateUploader(subFolder: 'kyc' | 'payments' | 'offerings' | 'cms') {
  const targetDir = path.join(getPrivateStorageRoot(), subFolder);
  fs.mkdirSync(targetDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(targetDir, { recursive: true });
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.bin';
      const uniqueName = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${safeExt}`;
      cb(null, uniqueName);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
      files: 5,
    },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
        cb(new Error('Unsupported file type. Only PDF, JPG, PNG, and WEBP files are permitted.'));
        return;
      }
      cb(null, true);
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
