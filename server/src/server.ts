import express from 'express';
import https from 'https';
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

// 🚨 LOAD YOUR FORGED SSL CERTIFICATES 🚨
const privateKey = fs.readFileSync(path.resolve(__dirname, '../key.pem'), 'utf8');
const certificate = fs.readFileSync(path.resolve(__dirname, '../cert.pem'), 'utf8');
const credentials = { key: privateKey, cert: certificate };

const httpsServer = https.createServer(credentials, app);

// 🚨 MOVED TO TOP FOR GLOBAL KILL SIGNAL SCOPE 🚨
const io = new Server(httpsServer, { cors: { origin: '*' }, allowEIO3: true });

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const DB_PATH = path.resolve(__dirname, '../../mvk-db.json');
const USERS_DB_PATH = path.resolve(__dirname, '../../mvk-users.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
if (!fs.existsSync(USERS_DB_PATH)) fs.writeFileSync(USERS_DB_PATH, JSON.stringify({}));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use('/api/upload', uploadRoutes);

// --- GLOBAL SECRETS ---
const PEPPER = 'VeeRM_Audio_Vault_Protocol_99';
const MASTER_ADMIN_HASH = 'e01fa56ac1cc8394c6f1e7d5361eaee40274438a5f5bca043f2528354dc785c5';

// --- OVERLORD ADMIN MIDDLEWARE ---
const verifyAdmin = (req: any, res: any, next: any) => {
  const adminKey = req.headers['x-overlord-key'];
  if (!adminKey) return res.status(401).json({ error: "Unauthorized: Missing Overlord Clearance" });
  
  const attemptHash = crypto.createHmac('sha256', PEPPER).update(adminKey).digest('hex');
  if (attemptHash !== MASTER_ADMIN_HASH) return res.status(403).json({ error: "Access Denied: Invalid Master Key" });
  
  next();
};

// --- ADMIN API SUITE (DASHBOARD ENDPOINTS) ---
app.get('/api/admin/users', verifyAdmin, (req: any, res: any) => {
  const users = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
  res.json(users);
});

app.post('/api/admin/users/update', verifyAdmin, (req: any, res: any) => {
  const { targetUser, updates } = req.body;
  const users = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
  if (!users[targetUser]) return res.status(404).json({ error: "User not found in matrix" });
  
  users[targetUser] = { ...users[targetUser], ...updates };
  fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
  
  // Broadcast live permission sync to force target device to update
  io.emit('force-permission-sync', { username: targetUser, clearances: users[targetUser].allowedRooms });
  res.json({ success: true });
});

app.post('/api/admin/chaos-protocol', verifyAdmin, (req: any, res: any) => {
  const { targetUser, prankType } = req.body;
  io.emit('execute-chaos', { target: targetUser, payload: prankType });
  res.json({ success: true, message: `Chaos payload '${prankType}' deployed to ${targetUser}` });
});

// --- SESSION MANAGEMENT & USER MATRIX ---
app.post('/api/auth/check', (req: any, res: any) => {
  let { username, deviceId } = req.body;
  let attemptName = username.toLowerCase().trim();

  if (attemptName === 'veer_dev') return res.json({ status: 'challenge', resolvedName: 'System Admin' });

  const users = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
  let user = users[attemptName];

  if (!user) {
    // Scaffold new user in the Matrix (Default: No Room Clearances)
    users[attemptName] = { 
      currentDevice: deviceId, 
      pin: null, 
      displayName: username, 
      sessionExpiresAt: 0,
      role: 'user',
      allowedRooms: [], // Determines which rooms bypass the PIN
      isMuted: false,
      activityLog: [{ action: 'Account Created', timestamp: Date.now(), ip: req.ip }]
    };
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
    return res.json({ status: 'new_user', requiresPinSetup: true, resolvedName: username });
  }

  if (user.pin) {
     return res.json({ status: 'challenge', resolvedName: username });
  }
  
  return res.json({ status: 'allowed', requiresPinSetup: true, resolvedName: username });
});

app.post('/api/auth/pin', (req: any, res: any) => {
  const { username, deviceId, pin, action } = req.body;
  
  if (username.toLowerCase() === 'veer_dev') {
    if (action === 'verify') {
      const attemptHash = crypto.createHmac('sha256', PEPPER).update(pin).digest('hex');
      if (attemptHash === MASTER_ADMIN_HASH) return res.json({ status: 'success', isAdmin: true, allowedRooms: ['*'] });
      return res.status(401).json({ error: "Access Denied" });
    }
    return res.status(400).json({ error: "Admin locked." });
  }

  const users = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
  const user = users[username.toLowerCase()];
  if (!user) return res.status(400).json({ error: "User not found" });

  if (action === 'setup') {
    user.pin = pin; fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
    return res.json({ status: 'success' });
  }

  if (action === 'verify') {
    if (user.pin === pin) {
      user.currentDevice = deviceId; 
      user.sessionExpiresAt = Date.now() + 15 * 60 * 1000;
      
      // Update User Activity Log
      if (!user.activityLog) user.activityLog = [];
      user.activityLog.unshift({ action: 'Secure Login', timestamp: Date.now(), device: deviceId });
      if (user.activityLog.length > 30) user.activityLog.pop(); // Keep log clean (last 30 actions)

      fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));

      console.log(`[AUTH] ${username} logged in from ${deviceId}. Broadcasting kill signal.`);
      io.emit('security-kick', { username: username.toLowerCase(), activeDevice: deviceId });
      
      // Send allowedRooms back to frontend so it can bypass PINs dynamically
      return res.json({ status: 'success', allowedRooms: user.allowedRooms || [] });
    }
    return res.status(401).json({ error: "Invalid PIN" });
  }
});

// --- ZERO-TRUST FILE GATEWAY ---
const verifyFileAccess = (req: any, res: any, next: any) => {
  const username = (req.query.user as string || '').toLowerCase();
  const deviceId = req.query.device as string || '';
  const fileName = req.params.file;

  const history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const fileRecord = history.find((r: any) => r.savedAs === fileName || r.fileName === fileName);
  if (!fileRecord) {
    console.log(`[GATEWAY] 404 Missing File: ${fileName}`);
    return res.status(404).send("Error 404: Asset missing.");
  }

  if (fileRecord.room === 'General' || fileRecord.room === 'The Drive') {
    req.fileRecord = fileRecord;
    return next();
  }

  const isTrueAdmin = username === 'system admin' || username === 'veer_dev';
  
  if (!isTrueAdmin) {
    const users = JSON.parse(fs.readFileSync(USERS_DB_PATH, 'utf-8'));
    const userObj = users[username];
    
    if (!userObj || userObj.currentDevice !== deviceId) {
        return res.status(401).send("Unauthorized. Device Mismatch. Security Protocol Engaged.");
    }

    if (fileRecord.room === 'Admin Only') return res.status(403).send("Admin Clearance Required");
    
    // Dynamic Room Check instead of hardcoded APPROVED_TEAM
    const userClearances = userObj.allowedRooms || [];
    if (!userClearances.includes(fileRecord.room)) {
        return res.status(403).send(`${fileRecord.room} Clearance Required`);
    }

    // Log the file download in the user's matrix profile
    if (!userObj.activityLog) userObj.activityLog = [];
    userObj.activityLog.unshift({ action: `Downloaded: ${fileRecord.fileName}`, timestamp: Date.now() });
    if (userObj.activityLog.length > 30) userObj.activityLog.pop();
    fs.writeFileSync(USERS_DB_PATH, JSON.stringify(users, null, 2));
  }

  req.fileRecord = fileRecord;
  next();
};

app.get('/preview/:file', verifyFileAccess, (req: any, res: any) => {
  const absolutePath = path.join(UPLOADS_DIR, req.fileRecord.savedAs || req.fileRecord.fileName);
  if (fs.existsSync(absolutePath)) res.sendFile(absolutePath);
  else res.status(404).send("File purged.");
});

app.get('/download/:file', verifyFileAccess, (req: any, res: any) => {
  const absolutePath = path.join(UPLOADS_DIR, req.fileRecord.savedAs || req.fileRecord.fileName);
  if (fs.existsSync(absolutePath)) res.download(absolutePath, req.fileRecord.fileName);
  else res.status(404).send("File purged.");
});

app.get('/shared/:file', (req: any, res: any) => {
  const fileName = req.params.file;
  let history: any[] = [];
  if (fs.existsSync(DB_PATH)) history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  const fileRecord = history.find((r: any) => r.savedAs === fileName || r.fileName === fileName);
  
  if (!fileRecord) return res.status(404).send("Asset not found or purged.");

  if (fileRecord.room === 'General' || fileRecord.room === 'The Drive') {
     return res.redirect('/download/' + encodeURIComponent(fileName));
  }

  res.send(`
      <html style="background:#0B0D10; color:#E8EAED; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align:center; padding-top:15%;">
      <head><title>Access Denied</title></head>
      <body>
          <h1 style="color:#D4AF37; font-weight: 800; letter-spacing: -1px; margin-bottom:10px;">RESTRICTED ASSET</h1>
          <p style="color:#9CA3AF; font-size:18px; margin-bottom:30px;">Oops, login your creds first newbie! 🛑</p>
          <a href="/?asset=${encodeURIComponent(fileName)}" style="color:#14171B; background-color:#D4AF37; text-decoration:none; font-weight: 700; padding:12px 24px; border-radius:8px; display:inline-block; transition: 0.2s;">Authenticate to Unlock</a>
      </body>
      </html>
  `);
});

app.post('/api/download-batch', (req: any, res: any) => {
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
            zip.addFile(entryName, fs.readFileSync(absolutePath));
            filesAdded++;
          }
        }
      });
    };
  
    try {
      addItemsToArchive(files);
      if (filesAdded === 0) zip.addFile('system_notice.txt', Buffer.from('No physical files were found.', 'utf8'));
      const zipBuffer = zip.toBuffer();
      res.set('Content-Type', 'application/zip');
      res.set('Content-Length', zipBuffer.length.toString());
      res.send(zipBuffer);
    } catch (e: any) { res.status(500).json({ error: "Fatal zip error" }); }
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

app.post('/api/files/delete', (req: any, res: any) => {
  const { targets, requester } = req.body; 
  if (!targets || !Array.isArray(targets)) return res.status(400).json({ error: "Invalid targets array" });

  try {
    let history: any[] = [];
    if (fs.existsSync(DB_PATH)) history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    let dbChanged = false;

    targets.forEach((targetId: string) => {
      const recordIndex = history.findIndex((r: any) => r.savedAs === targetId || r.fileName === targetId);
      if (recordIndex !== -1) {
        const record = history[recordIndex];
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
  } catch (err) { res.status(500).json({ error: "System failed to purge assets" }); }
});

const cleanupUploads = () => {
  if (!fs.existsSync(UPLOADS_DIR) || !fs.existsSync(DB_PATH)) return;
  let dbChanged = false;
  const now = Date.now();
  try {
    const rawData = fs.readFileSync(DB_PATH, 'utf-8');
    if (!rawData || rawData.trim() === '') return;
    const history = JSON.parse(rawData);
    const freshHistory = history.filter((record: any) => {
      if (record.isFolder || record.room === 'The Drive') return true; 
      const absolutePath = path.join(UPLOADS_DIR, record.savedAs || record.fileName);
      const fileExists = fs.existsSync(absolutePath);
      const expiryTime = record.expiresAt || (record.timestamp + (24 * 60 * 60 * 1000));
      
      if (now > expiryTime || !fileExists) {
        if (fileExists) fs.unlinkSync(absolutePath);
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
    if (fs.existsSync(DB_PATH)) socket.emit('force-db-sync', JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')));
  });
  socket.on('extend-expiry', (data) => {
    if (fs.existsSync(DB_PATH)) {
      let history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
      const addedMs = data.addedHours * 3600000;
      history = history.map((item: any) => {
        if (item.isFolder && (item.id === data.identifier || item.parentId === data.identifier) && item.expiresAt) item.expiresAt += addedMs;
        else if (!item.isFolder && (item.savedAs === data.identifier || item.fileName === data.identifier) && item.expiresAt) item.expiresAt += addedMs;
        return item;
      });
      fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2));
      io.emit('force-db-sync', history); 
    }
  });
  socket.on('create-folder', (folderData) => {
    let history: any[] = [];
    if (fs.existsSync(DB_PATH)) history = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    history.unshift({
      fileName: folderData.folderName, savedAs: folderData.id, isFolder: true,
      room: folderData.room || 'General', sender: folderData.sender || 'Unknown',
      parentId: folderData.parentId || null, targetRecipient: folderData.targetRecipient || 'Everyone',
      size: 0, timestamp: Date.now()
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(history, null, 2));
    io.emit('force-db-sync', history);
  });
  socket.on('file-ready', (fileData) => socket.broadcast.emit('incoming-transfer', fileData));
  socket.on('trigger-global-sync', () => {
    if (fs.existsSync(DB_PATH)) io.emit('force-db-sync', JSON.parse(fs.readFileSync(DB_PATH, 'utf-8')));
  });
});

const PORT = Number(process.env.PORT || 3000);
httpsServer.listen(PORT, '0.0.0.0', () => console.log(`🚀 MVK Beast Server securely broadcasting globally over HTTPS on port ${PORT}`));