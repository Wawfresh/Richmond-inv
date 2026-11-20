import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Response } from 'express';
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

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heif']);

/**
 * Inspects actual binary magic bytes to verify the file is genuinely an allowed
 * PDF or raster image (blocks spoofed HTML, SVG, PHP, JS, or executable uploads).
 */
export function detectAllowedFileSignature(header: Buffer): { mime: string; ext: string } | null {
  if (!header || header.length < 4) return null;

  // PDF: %PDF-
  if (
    header.length >= 5 &&
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46 &&
    header[4] === 0x2d
  ) {
    return { mime: 'application/pdf', ext: '.pdf' };
  }

  // JPEG: FF D8 FF
  if (header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    header.length >= 8 &&
    header[0] === 0x89 &&
    header[1] === 0x50 &&
    header[2] === 0x4e &&
    header[3] === 0x47 &&
    header[4] === 0x0d &&
    header[5] === 0x0a &&
    header[6] === 0x1a &&
    header[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: '.png' };
  }

  // WEBP: RIFF....WEBP
  if (
    header.length >= 12 &&
    header.subarray(0, 4).toString('ascii') === 'RIFF' &&
    header.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mime: 'image/webp', ext: '.webp' };
  }

  // GIF: GIF87a / GIF89a
  if (header.length >= 6) {
    const sig = header.subarray(0, 6).toString('ascii');
    if (sig === 'GIF87a' || sig === 'GIF89a') {
      return { mime: 'image/gif', ext: '.gif' };
    }
  }

  // HEIC / HEIF ISO-BMFF container: ....ftyp<brand>
  if (header.length >= 12 && header.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = header.subarray(8, 12).toString('ascii').toLowerCase();
    if (HEIF_BRANDS.has(brand)) {
      return { mime: 'image/heic', ext: '.heic' };
    }
  }

  return null;
}

/**
 * Validates a file already saved to disk by multer against actual magic bytes.
 * Immediately unlinks and rejects spoofed or corrupted files.
 */
export function verifyDiskFileMagicBytes(file: Express.Multer.File): { mime: string; ext: string } {
  let fd: number | null = null;
  try {
    fd = fs.openSync(file.path, 'r');
    const header = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, header, 0, 16, 0);
    const detected = detectAllowedFileSignature(header.subarray(0, bytesRead));
    if (!detected) {
      throw new Error('Uploaded file content does not match a permitted PDF or image format.');
    }
    return detected;
  } catch (err) {
    try {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch {
      // Ignore unlink errors
    }
    throw err;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore close errors
      }
    }
  }
}

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

  // Enforce true binary magic-byte inspection so spoofed HTML/SVG/scripts are blocked
  const detected = detectAllowedFileSignature(buffer.subarray(0, 16));
  if (!detected) {
    throw new Error('Unsupported file content. Only genuine PDF, JPG, PNG, WEBP, GIF, and HEIC files are permitted.');
  }

  const safeExt = detected.ext;
  const normalizedMime = detected.mime;

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
  if (!resolved.startsWith(root + path.sep)) {
    return null;
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    return null;
  }
  return resolved;
}

export function sanitizeDownloadFilename(name?: string | null, fallback = 'document'): string {
  const base = path.basename(String(name || fallback)).replace(/[\r\n"\\/;]/g, '_').trim();
  return base.slice(0, 180) || fallback;
}

/**
 * Serves a private file with strict anti-sniffing, no-store caching,
 * and sandboxed CSP headers so uploaded files can never execute scripts.
 */
export function sendSafePrivateFile(
  res: Response,
  safePath: string,
  options: { filename?: string | null; mimeType?: string | null; inline?: boolean }
): void {
  const safeName = sanitizeDownloadFilename(options.filename, 'document');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Security-Policy', 'sandbox');

  if (options.inline) {
    const allowedInlineMime = ALLOWED_MIME_TYPES.has(String(options.mimeType || '').toLowerCase())
      ? String(options.mimeType)
      : 'application/octet-stream';
    res.setHeader('Content-Type', allowedInlineMime);
    res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    res.sendFile(safePath);
    return;
  }

  res.download(safePath, safeName);
}
