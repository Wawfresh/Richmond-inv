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

export interface SavedPrivateFile {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
}

export function saveBase64PrivateFile(
  subFolder: 'kyc' | 'payments' | 'offerings' | 'cms',
  input: { filename?: string; mimeType?: string; dataBase64: string }
): SavedPrivateFile {
  const originalName = path.basename(String(input.filename || 'document')).slice(0, 200) || 'document';
  let mime = String(input.mimeType || '').toLowerCase().trim();
  let rawBase64 = String(input.dataBase64 || '').trim();

  const dataUrlMatch = rawBase64.match(/^data:([^;]+);base64,(.+)$/i);
  if (dataUrlMatch) {
    if (!mime) mime = dataUrlMatch[1].toLowerCase().trim();
    rawBase64 = dataUrlMatch[2];
  }

  const ext = path.extname(originalName).toLowerCase();
  const extAllowed = ALLOWED_EXTENSIONS.has(ext);
  const mimeAllowed = ALLOWED_MIME_TYPES.has(mime);
  const genericOctetWithValidExt = (mime === '' || mime === 'application/octet-stream') && extAllowed;

  if (!((extAllowed && mimeAllowed) || genericOctetWithValidExt || (!ext && mimeAllowed))) {
    throw new Error('Unsupported file type. Only PDF, JPG, PNG, WEBP, GIF, and HEIC files are permitted.');
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  if (!buffer || buffer.length === 0) {
    throw new Error('Uploaded file appears to be empty. Please select the file again.');
  }
  if (buffer.length > 15 * 1024 * 1024) {
    const err: any = new Error('Uploaded file exceeds the 15MB size limit.');
    err.code = 'LIMIT_FILE_SIZE';
    throw err;
  }

  const safeExt = extAllowed ? ext : MIME_TO_EXT[mime] || '.jpg';
  const normalizedMime = mimeAllowed
    ? mime
    : safeExt === '.pdf'
    ? 'application/pdf'
    : safeExt === '.png'
    ? 'image/png'
    : safeExt === '.webp'
    ? 'image/webp'
    : safeExt === '.gif'
    ? 'image/gif'
    : 'image/jpeg';

  const targetDir = path.join(getPrivateStorageRoot(), subFolder);
  fs.mkdirSync(targetDir, { recursive: true });
  const uniqueName = `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${safeExt}`;
  const fullPath = path.join(targetDir, uniqueName);
  fs.writeFileSync(fullPath, buffer);

  return {
    originalname: ext ? originalName : `${originalName}${safeExt}`,
    filename: uniqueName,
    mimetype: normalizedMime,
    size: buffer.length,
    path: fullPath,
  };
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
