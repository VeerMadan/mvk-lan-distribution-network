import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Ensure the MVK uploads directory exists on the Beast
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer to save directly to the disk
const storage = multer.diskStorage({
  // Use _req and _file with 'any' types to bypass TS strict mode
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, uploadDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    // Add a timestamp so if two people upload "Site_Plan.pdf", it doesn't overwrite
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ storage });

// Explicitly cast req and res as 'any'
router.post('/', upload.single('file'), (req: any, res: any) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file detected in payload' });
  }

  // Send back the exact file name so the frontend knows where to download it
  res.status(200).json({
    message: 'File secured on Beast',
    originalName: req.file.originalname,
    savedAs: req.file.filename,
    size: req.file.size
  });
});

export default router;