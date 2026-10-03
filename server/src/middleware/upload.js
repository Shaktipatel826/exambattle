import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize original name to prevent path traversal or special character attacks
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(sanitizedOriginalName).toLowerCase();
    cb(null, `file-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.txt', '.csv', '.pdf', '.docx', '.xlsx', '.json'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Extension check
  if (!allowedExtensions.includes(ext)) {
    return cb(new Error(`Invalid file format ${ext}. Allowed formats: TXT, CSV, PDF, DOCX, XLSX, JSON`), false);
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB max size limit
});

/**
 * Safely delete temporary upload file
 */
export const cleanupFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error(`[File Cleanup Error] ${err.message}`);
  }
};
