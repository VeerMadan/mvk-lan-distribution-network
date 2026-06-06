import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Absolute paths to guarantee the database never splits again
const UPLOADS_DIR = path.resolve(__dirname, '../../../uploads');
const DB_PATH = path.resolve(__dirname, '../../../mvk-db.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    // CRITICAL FIX: path.basename() strips the "folder/subfolder/" that Chrome adds, 
    // saving ONLY the pure original file name to the hard drive so it doesn't crash!
    const exactName = path.basename(file.originalname);
    cb(null, exactName);
  }
});

const upload = multer({ storage });

router.post('/', upload.single('file'), (req: any, res: any) => {
  if (!req.file) return res.status(400).json({ error: 'No file detected' });

  try {
    const { room, sender, targetRecipient, expiryHours, parentId } = req.body;
    const exactFileName = req.file.filename;

    let history = [];
    if (fs.existsSync(DB_PATH)) {
      history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    }

    const newRecord = {
      fileName: exactFileName, 
      savedAs: exactFileName,           
      room: room || 'General',
      sender: sender || 'Unknown',
      size: req.file.size,
      targetRecipient: targetRecipient || 'Everyone',
      parentId: parentId === 'null' ? null : parentId,
      expiresAt: Date.now() + ((Number(expiryHours) || 24) * 60 * 60 * 1000),
      timestamp: Date.now(),
      downloadUrl: `/download/${encodeURIComponent(exactFileName)}`
    };

    // Replace old entry if a file with the exact same name is uploaded
    history = history.filter((r: any) => r.savedAs !== exactFileName);
    history.unshift(newRecord);
    fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2));

    res.status(200).json(newRecord);
  } catch (e) {
    console.error("DB Save Error:", e);
    res.status(500).json({ error: "Saved file but Database failed" });
  }
});

export default router;