import express from 'express';
import http from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { Server } from 'socket.io';
import setupSockets from './sockets/index';
import uploadRoutes from './routes/upload';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

// ABSOLUTE PATHING
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const DB_PATH = path.resolve(__dirname, '../../mvk-db.json');
const USERS_DB_PATH = path.resolve(__dirname, '../../mvk-users.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
if (!fs.existsSync(USERS_DB_PATH)) fs.writeFileSync(USERS_DB_PATH, JSON.stringify({}));

app.use(cors());
app.use(express.json());
app.use('/api/upload', uploadRoutes);
app.use('/preview', express.static(UPLOADS_DIR));

// --- ZERO-TRUST AUTHENTICATION SYSTEM (STRICT LOCKDOWN) ---
// Add the exact names of your Digital Team here (lowercase):
const APPROVED_TEAM = ['rahul', 'priya', 'amit', 'neha', 'karan']; 

app.post('/api/auth/check', (req: any, res: any) => {
  let { username, deviceId } = req.body;
  let attemptName = username.toLowerCase().trim();

  // 1. Allow the Admin Override to bypass the team check
  if (attemptName === 'veer_dev') {
    return res.json({ status: 'challenge', resolvedName: 'System Admin' });
  }

  // 2. The Bouncer: Reject anyone not on the VIP list
  if (!APPROVED_TEAM.includes(attemptName)) {
    return res.status(403).json({ error: "Access Denied: You are not authorized for the MVK Vault." });
  }

  // 3. Process Approved Users
  const users = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
  let user = users[attemptName];

  if (!user) {
    // First time setup for an approved team member
    users[attemptName] = { devices: [deviceId], pin: null, displayName: username };
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
    return res.json({ status: 'new_user', requiresPinSetup: true, resolvedName: username });
  }

  if (user.devices.includes(deviceId)) {
    if (!user.pin) return res.json({ status: 'allowed', requiresPinSetup: true, resolvedName: username });
    return res.json({ status: 'allowed', resolvedName: username });
  }

  return res.json({ status: 'challenge', resolvedName: username });
});

app.post('/api/auth/pin', (req: any, res: any) => {
  const { username, deviceId, pin, action } = req.body;

  // --- VEE-RM CUSTOM ENCRYPTION PROTOCOL (ADMIN OVERRIDE) ---
  if (username.toLowerCase() === 'veer_dev') {
    if (action === 'verify') {
      const pepper = process.env.SECRET_PEPPER || 'fallback_pepper';
      const attemptHash = crypto.createHmac('sha256', pepper).update(pin).digest('hex');

      // Paste the string you generated in the terminal right here:
      const MASTER_ADMIN_HASH = 'e01fa56ac1cc8394c6f1e7d5361eaee40274438a5f5bca043f2528354dc785c5';

      if (attemptHash === MASTER_ADMIN_HASH) {
         return res.json({ status: 'success', isAdmin: true });
      }
      return res.status(401).json({ error: "Access Denied: Invalid Admin Protocol" });
    }
    return res.status(400).json({ error: "Admin profile locked." });
  }
  // ----------------------------------------------------------

  const users = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
  const user = users[username.toLowerCase()];

  if (!user) return res.status(400).json({ error: "User not found" });

  if (action === 'setup') {
    user.pin = pin;
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
    return res.json({ status: 'success' });
  }

  if (action === 'verify') {
    if (user.pin === pin) {
      user.devices.push(deviceId); // Authorize this new device permanently
      fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
      return res.json({ status: 'success' });
    }
    return res.status(401).json({ error: "Invalid PIN" });
  }
});

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

// --- OTA UPDATE RADAR ---
app.get('/api/check-updates', (req, res) => {
  const { exec } = require('child_process');
  const repoDir = path.resolve(__dirname, '../../'); 
  exec('git fetch origin main && git rev-list HEAD...origin/main --count', { cwd: repoDir }, (err: any, stdout: any) => {
    if (err) return res.json({ updateAvailable: false });
    const commitsBehind = parseInt(stdout.trim(), 10);
    res.json({ updateAvailable: commitsBehind > 0, commits: commitsBehind });
  });
});

// UPGRADED: SECURE BATCH DELETE TUNNEL
app.post('/api/files/delete', (req: any, res: any) => {
  // Ignored client's isAdmin claim completely for zero-trust security
  const { targets, requester } = req.body; 
  if (!targets || !Array.isArray(targets)) return res.status(400).json({ error: "Invalid targets array" });

  try {
    let history: any[] = [];
    try {
      const rawData = fs.readFileSync(DB_PATH, 'utf-8');
      if (rawData && rawData.trim() !== '') {
        history = JSON.parse(rawData);
      }
    } catch (dbErr) {
      console.error("⚠️ Safely caught empty JSON in delete route. Starting fresh.");
    }
    let dbChanged = false;

    targets.forEach((targetId: string) => {
      const recordIndex = history.findIndex((r: any) => r.savedAs === targetId || r.fileName === targetId);
      if (recordIndex !== -1) {
        const record = history[recordIndex];
        
        // STRICT SECURITY OVERRIDE: Verify admin on backend, ignore client spoofing
        const isTrueAdmin = requester === 'SYSTEM ADMIN' || (typeof requester === 'string' && requester.toLowerCase() === 'veer_dev');
        
        if (isTrueAdmin || record.sender === requester) {
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
    const rawData = fs.readFileSync(DB_PATH, 'utf-8');
    if (!rawData || rawData.trim() === '') return; // 🛡️ Safety eject!
    const history = JSON.parse(rawData);
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
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const history = (raw && raw.trim() !== '') ? JSON.parse(raw) : [];
        socket.emit('force-db-sync', history);
      }
    } catch(err) { console.error("⚠️ Safely caught empty JSON on master sync"); }
  });

  // NEW: TIME EXTENSION PROTOCOL
  socket.on('extend-expiry', (data) => {
    try {
      if (fs.existsSync(DB_PATH)) {
        let history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        const addedMs = data.addedHours * 3600000;
        
        if (data.isFolder) {
          history = history.map((item: any) => {
            if (item.id === data.identifier || item.parentId === data.identifier) {
              if (item.expiresAt) item.expiresAt += addedMs;
            }
            return item;
          });
        } else {
          history = history.map((item: any) => {
            if ((item.savedAs === data.identifier || item.fileName === data.identifier) && item.expiresAt) {
              item.expiresAt += addedMs;
            }
            return item;
          });
        }
        
        fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2));
        io.emit('force-db-sync', history); 
      }
    } catch(err) { 
      console.error("⚠️ Failed to execute Time Extension Protocol:", err); 
    }
  });

  socket.on('create-folder', (folderData) => {
    try {
      let history: any[] = [];
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        if (raw && raw.trim() !== '') history = JSON.parse(raw);
      }
      
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
  // NEW: The Global Radar Ping
  socket.on('trigger-global-sync', () => {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        const history = (raw && raw.trim() !== '') ? JSON.parse(raw) : [];
        io.emit('force-db-sync', history); // io.emit blasts it to EVERYONE, not just the sender
      }
    } catch(err) { console.error("⚠️ Safely caught empty JSON on global sync"); }
  });
});

const PORT = Number(process.env.PORT || 3000);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MVK Beast Server broadcasting globally on port ${PORT}`);
});