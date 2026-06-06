import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import setupSockets from './sockets/index';
import uploadRoutes from './routes/upload';

const app = express();
const httpServer = http.createServer(app);

// ABSOLUTE PATHING
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const DB_PATH = path.resolve(__dirname, '../../mvk-db.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));

app.use(cors());
app.use(express.json());
app.use('/api/upload', uploadRoutes);

app.use('/preview', express.static(UPLOADS_DIR));

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST', 'DELETE'] },
  allowEIO3: true, pingTimeout: 60000, pingInterval: 25000
});

// SINGLE DOWNLOAD TUNNEL
app.get('/download/:file', (req: any, res: any) => {
  const absolutePath = path.join(UPLOADS_DIR, decodeURIComponent(req.params.file));
  if (!fs.existsSync(absolutePath)) return res.status(404).send("Error 404: Asset missing from Beast PC.");
  res.download(absolutePath, (err: any) => {
    if (err && !res.headersSent) console.error("Download failed:", err);
  });
});

// UPGRADED: BATCH DOWNLOAD (ADM-ZIP ENGINE)
app.post('/api/download-batch', (req: any, res: any) => {
  // Bypassing top-level imports completely
  const AdmZip = require('adm-zip');
  const zip = new AdmZip();

  const { files } = req.body;
  if (!files || !files.length) return res.status(400).json({ error: "No files requested" });

  let history: any[] = [];
  if (fs.existsSync(DB_PATH)) history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));

  let filesAdded = 0;
  const addedNames = new Set<string>(); 

  const addItemsToArchive = (itemIds: string[], basePath: string = '') => {
    itemIds.forEach(id => {
      if (!id) return;
      const record = history.find((r: any) => r.savedAs === id || r.fileName === id);
      if (!record) return;

      if (record.isFolder) {
        const children = history.filter((r: any) => r.parentId === record.savedAs).map((r: any) => r.savedAs);
        addItemsToArchive(children, `${basePath}${record.fileName}/`);
      } else {
        const absolutePath = path.join(UPLOADS_DIR, record.savedAs || record.fileName);
        if (fs.existsSync(absolutePath)) {
          let entryName = `${basePath}${record.fileName}`;
          
          let counter = 1;
          while (addedNames.has(entryName)) {
             const parts = record.fileName.split('.');
             const ext = parts.length > 1 ? `.${parts.pop()}` : '';
             const base = parts.join('.');
             entryName = `${basePath}${base}_(${counter})${ext}`;
             counter++;
          }

          addedNames.add(entryName);
          // Directly injects the physical file into the zip at the correct path
          zip.addFile(entryName, fs.readFileSync(absolutePath));
          filesAdded++;
        }
      }
    });
  };

  try {
    addItemsToArchive(files);

    if (filesAdded === 0) {
      zip.addFile('system_notice.txt', Buffer.from('No physical files were found on the Beast PC for this selection.', 'utf8'));
    }

    // Generate the zip in memory and send it directly to the browser
    const zipBuffer = zip.toBuffer();
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', 'attachment; filename="MVK-Vault-Export.zip"');
    res.set('Content-Length', zipBuffer.length.toString());
    res.send(zipBuffer);
    
  } catch (e: any) {
    console.error("ZIP Generation Crash:", e);
    if (!res.headersSent) res.status(500).json({ error: "Fatal zip error" });
  }
});

const getStorageUsedGB = () => {
  let size = 0;
  if (!fs.existsSync(UPLOADS_DIR)) return 0;
  const files = fs.readdirSync(UPLOADS_DIR);
  for (let i = 0; i < files.length; i++) {
    const stat = fs.statSync(path.join(UPLOADS_DIR, files[i]));
    if (!stat.isDirectory()) size += stat.size;
  }
  return Number((size / (1024 * 1024 * 1024)).toFixed(2));
};

app.get('/api/storage', (req, res) => res.json({ storageUsed: getStorageUsedGB() }));

// UPGRADED: SECURE BATCH DELETE TUNNEL
app.post('/api/files/delete', (req: any, res: any) => {
  const { targets, requester, isAdmin } = req.body;
  if (!targets || !Array.isArray(targets)) return res.status(400).json({ error: "Invalid targets array" });

  try {
    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    let dbChanged = false;

    targets.forEach((targetId: string) => {
      const recordIndex = history.findIndex((r: any) => r.savedAs === targetId || r.fileName === targetId);
      if (recordIndex !== -1) {
        const record = history[recordIndex];
        
        // SECURITY CHECK: Are they Admin? Did they upload it?
        if (isAdmin || record.sender === requester) {
          const absolutePath = path.join(UPLOADS_DIR, record.savedAs);
          if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
          history.splice(recordIndex, 1);
          io.emit('file-deleted', targetId);
          dbChanged = true;
        }
      }
    });

    if (dbChanged) {
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2));
      io.emit('storage-update', getStorageUsedGB());
    }
    
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "System failed to purge assets" });
  }
});

const cleanupUploads = () => {
  if (!fs.existsSync(UPLOADS_DIR) || !fs.existsSync(DB_PATH)) return;
  
  let dbChanged = false;
  const now = Date.now();

  try {
    const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    const freshHistory = history.filter((record: any) => {
      if (record.isFolder) return true; 

      const absolutePath = path.join(UPLOADS_DIR, record.savedAs || record.fileName);
      const fileExists = fs.existsSync(absolutePath);
      const expiryTime = record.expiresAt || (record.timestamp + (24 * 60 * 60 * 1000));
      
      if (now > expiryTime) {
        if (fileExists) fs.unlinkSync(absolutePath);
        io.emit('file-deleted', record.savedAs || record.fileName);
        dbChanged = true; return false; 
      }
      
      if (!fileExists) {
        io.emit('file-deleted', record.savedAs || record.fileName);
        dbChanged = true; return false;
      }
      return true; 
    });

    if (dbChanged) {
      fs.writeFileSync(DB_PATH, JSON.stringify(freshHistory, null, 2));
      io.emit('storage-update', getStorageUsedGB());
    }
  } catch (e) {}
};
setInterval(cleanupUploads, 5 * 1000); 

setupSockets(io);

io.on('connection', (socket) => {
  socket.on('request-master-sync', () => {
    if (fs.existsSync(DB_PATH)) {
      const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      socket.emit('force-db-sync', history);
    }
  });

  socket.on('create-folder', (folderData) => {
    try {
      let history: any[] = [];
      if (fs.existsSync(DB_PATH)) history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      
      const newFolderRecord = {
        fileName: folderData.folderName,
        savedAs: folderData.id,
        isFolder: true,
        room: folderData.room || 'General',
        sender: folderData.sender || 'Unknown',
        parentId: folderData.parentId || null,
        targetRecipient: folderData.targetRecipient || 'Everyone',
        size: 0,
        timestamp: Date.now()
      };

      history.unshift(newFolderRecord);
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2));
      io.emit('force-db-sync', history);
    } catch (err) {}
  });

  socket.on('file-ready', (fileData) => {
     socket.broadcast.emit('incoming-transfer', fileData);
  });
});

const PORT = Number(process.env.PORT || 3000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MVK Beast Server broadcasting globally on port ${PORT}`);
});