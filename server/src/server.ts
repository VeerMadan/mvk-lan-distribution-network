import path from 'path';
import uploadRoutes from './routes/upload';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import setupSockets from './sockets';

const app = express();
const httpServer = createServer(app);

// Force TypeScript to treat it as a number
const PORT = Number(process.env.PORT || 3000);

// Allow CORS so other laptops in the office can connect to your dev machine
app.use(cors({
  origin: '*', // In production on the Beast, lock this down to your subnet
  methods: ['GET', 'POST']
}));

app.use(express.json());
// Allow network devices to download files from the uploads folder
// Custom route to FORCE downloads instead of opening in browser
app.get('/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);
  // res.download automatically forces the browser to save the file
  res.download(filePath, (err) => {
    if (err) console.error("Download failed:", err);
  });
});

// Mount our new Multer upload route
app.use('/api/upload', uploadRoutes);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Pass the io instance to our socket handler
setupSockets(io);

// Basic health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'MVK Network is Live' });
});

// Keep 0.0.0.0 so it listens to all network interfaces
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MVK Beast Server running on port ${PORT}`);
  console.log(`📡 Local Network Access: http://192.168.88.26:${PORT}`);
});

import fs from 'fs';
// --- THE BEAST JANITOR (Auto Cleanup v2) ---
const cleanupUploads = () => {
  const uploadsDir = path.join(__dirname, '../uploads');
  const dbPath = path.join(__dirname, '../mvk-db.json');
  
  if (!fs.existsSync(uploadsDir)) return;

  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // 1. Delete old physical files
  fs.readdir(uploadsDir, (err, files) => {
    if (err) return;
    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return;
        if (now - stats.mtimeMs > TWENTY_FOUR_HOURS) {
          fs.unlink(filePath, () => console.log(`🧹 Deleted file: ${file}`));
        }
      });
    });
  });

  // 2. Clean up the JSON Database
  if (fs.existsSync(dbPath)) {
    try {
      const history = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
      const freshHistory = history.filter((record: any) => now - record.timestamp < TWENTY_FOUR_HOURS);
      fs.writeFileSync(dbPath, JSON.stringify(freshHistory, null, 2));
    } catch (e) {
      console.error("Database cleanup failed", e);
    }
  }
};

setInterval(cleanupUploads, 60 * 60 * 1000);
console.log("🧹 Enterprise Janitor online.");