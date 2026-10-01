// File upload (multer): sirf jpg/png/pdf, max 5MB
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const uploadDirectory = path.resolve(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDirectory, { recursive: true });

export const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDirectory,
    filename: (req, file, cb) =>
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname))
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 30 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpe?g|png|pdf)$/i.test(file.originalname);
    cb(allowed ? null : new Error('Only JPG, PNG, and PDF files are allowed.'), allowed);
  }
});
