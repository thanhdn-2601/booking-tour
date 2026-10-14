import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';

import {
  BadRequestException,
  HttpStatus,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';

import { PUBLIC_DIR } from '../common/public-dir';
import {
  TOUR_IMAGE_ALLOWED_MIME_TYPES,
  TOUR_IMAGE_MAX_SIZE_BYTES,
  TOUR_IMAGES_UPLOAD_SUBDIR,
} from './tour-images.constants';

export const tourImageUploadOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      const dir = join(PUBLIC_DIR, TOUR_IMAGES_UPLOAD_SUBDIR);
      mkdirSync(dir, { recursive: true });
      callback(null, dir);
    },
    filename: (_req, file, callback) => {
      callback(null, `${randomUUID()}${extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: TOUR_IMAGE_MAX_SIZE_BYTES },
};

// Covers both "no file attached" and "wrong mime type" with the same
// {code:'VALIDATION_ERROR', errors:{...}} shape every other 400 in this
// project uses — the oversized-file case (Multer's own limits.fileSize,
// enforced before this pipe even runs) is handled separately by
// MulterExceptionFilter.
export const tourImageValidationPipe = new ParseFilePipeBuilder()
  .addFileTypeValidator({
    fileType: new RegExp(`^(${TOUR_IMAGE_ALLOWED_MIME_TYPES.join('|')})$`),
    skipMagicNumbersValidation: true,
  })
  .build({
    errorHttpStatusCode: HttpStatus.BAD_REQUEST,
    exceptionFactory: (error) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        errors: { file: [error] },
      }),
  });
