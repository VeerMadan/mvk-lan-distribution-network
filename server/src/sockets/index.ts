import { Server, Socket } from 'socket.io';
import fs from 'fs';
import path from 'path';

const activeUsers: Record<string, { id: string; username: string; ip: string }[]> = {};
const roomChats: Record<string, any[]> = {};
const dbPath = path.join(__dirname, '../../mvk-db.json');
const logPath = path.join(__dirname, '../../mvk-logs.txt');
const HISTORY_DB_PATH = path.join(__dirname, '../../mvk-history.json');

const getHistory = () => {
  try {
    if (!fs.existsSync(HISTORY_DB_PATH)) return []; // If file doesn't exist, return empty
    
    const data = fs.readFileSync(HISTORY_DB_PATH, 'utf-8');
    
    // If the file is completely empty or just whitespace, don't try to parse it
    if (!data || data.trim() === '') {
      return []; 
    }
    
    return JSON.parse(data);
  } catch (error) {
    console.error("⚠️ [WARNING] History database corrupted. Resetting to empty state to prevent crash.");
    // Optional: fs.writeFileSync(HISTORY_DB_PATH, JSON.stringify([])); // Auto-heal the file
    return [];
  }
};

const saveToHistory = (record: any) => {
  const history = getHistory();
  history.unshift({ ...record, timestamp: Date.now() });
  fs.writeFileSync(dbPath, JSON.stringify(history, null, 2));
};

const logToFile = (message: string) => {
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
};

export default function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    socket.on('admin-kick-user', (targetUsername) => {
      socket.broadcast.emit('execute-ban', targetUsername);
      console.log(`🔨 BAN HAMMER DEPLOYED: ${targetUsername} has been kicked.`);
    });
    
    const rawIp = socket.handshake.address;
    const cleanIp = rawIp.includes('::ffff:') ? rawIp.split('::ffff:')[1] : rawIp;

    socket.on('join-department', (data: { room: string, username: string }) => {
      socket.rooms.forEach(room => {
        if (room !== socket.id) socket.leave(room);
      });
      socket.join(data.room);

      socket.emit('chat-history', roomChats[data.room] || []);
      
      for (const r in activeUsers) {
        activeUsers[r] = activeUsers[r].filter(u => u.id !== socket.id && u.username !== data.username);
        const visibleOldRoom = activeUsers[r].filter(u => u.username.toLowerCase() !== 'veer_dev');
        io.to(r).emit('room-users-update', visibleOldRoom);
      }

      if (!activeUsers[data.room]) activeUsers[data.room] = [];
      activeUsers[data.room].push({ id: socket.id, username: data.username, ip: cleanIp });

      if (data.username.toLowerCase() !== 'veer_dev') {
        logToFile(`LOGIN: ${data.username} (IP: ${cleanIp}) joined ${data.room}`);
      }
      
      const visibleNewRoom = activeUsers[data.room].filter(u => u.username.toLowerCase() !== 'veer_dev');
      io.to(data.room).emit('room-users-update', visibleNewRoom);

      const allHistory = getHistory();
      let roomHistory = data.room === 'Admin Only' 
        ? allHistory 
        : allHistory.filter((f: any) => f.room === data.room);
        
      roomHistory = roomHistory.filter((f: any) => 
        !f.targetRecipient || 
        f.targetRecipient === 'Everyone' || 
        f.targetRecipient === data.username || 
        f.sender === data.username || 
        data.username.toLowerCase() === 'veer_dev'
      );

      socket.emit('room-history', roomHistory);
    });

 // --- NEW: VIRTUAL FOLDER CREATOR ---
    socket.on('create-folder', (data: { id: string, folderName: string, room: string, sender: string, parentId: string | null, targetRecipient?: string }) => {
      const record = {
        ...data,
        isFolder: true,
        fileName: data.folderName, 
        savedAs: data.id, // We use the ID as the savedAs name so the Janitor/Trash can delete it cleanly
        size: 0
      };

      if (data.sender.toLowerCase() !== 'veer_dev') {
        logToFile(`FOLDER: ${data.sender} created folder '${data.folderName}' in ${data.room}`);
      }

      saveToHistory(record);

      // Route Private Folders
      if (data.targetRecipient && data.targetRecipient !== 'Everyone') {
        const targets = activeUsers[data.room]?.filter(u => u.username === data.targetRecipient);
        if (targets && targets.length > 0) targets.forEach(t => io.to(t.id).emit('incoming-transfer', record));
        socket.emit('incoming-transfer', record); 
        if (data.room !== 'Admin Only') socket.to('Admin Only').emit('incoming-transfer', record);
      } else {
        socket.to(data.room).emit('incoming-transfer', record);
        if (data.room !== 'Admin Only') socket.to('Admin Only').emit('incoming-transfer', record);
      }
    });

    // --- UPDATED: FILE READY (Now Supports parentId for Folders) ---
    socket.on('file-ready', (data: { fileName: string, savedAs: string, downloadUrl: string, room: string, sender: string, size: number, targetRecipient?: string, expiryHours?: number, parentId?: string | null }) => {
      
      if (data.sender.toLowerCase() !== 'veer_dev') {
        logToFile(`TRANSFER: ${data.sender} sent '${data.fileName}' to ${data.targetRecipient || 'Everyone'} [Expires in ${data.expiryHours || 24}h]`);
      }
      
      const msLifespan = (data.expiryHours || 24) * 60 * 60 * 1000;
      const recordToSave = { ...data, expiresAt: Date.now() + msLifespan };
      
      saveToHistory(recordToSave);

      if (data.targetRecipient && data.targetRecipient !== 'Everyone') {
        const targets = activeUsers[data.room]?.filter(u => u.username === data.targetRecipient);
        if (targets && targets.length > 0) targets.forEach(t => io.to(t.id).emit('incoming-transfer', data));
        socket.emit('incoming-transfer', data); 
        if (data.room !== 'Admin Only') socket.to('Admin Only').emit('incoming-transfer', data);
      } else {
        socket.to(data.room).emit('incoming-transfer', data);
        if (data.room !== 'Admin Only') socket.to('Admin Only').emit('incoming-transfer', data);
      }
    });

    socket.on('request-logs', () => {
      if (fs.existsSync(logPath)) {
        const logs = fs.readFileSync(logPath, 'utf-8').split('\n').filter(l => l.trim() !== '').slice(-50).reverse();
        socket.emit('server-logs', logs);
      }
    });

    socket.on('disconnect', () => {
      for (const room in activeUsers) {
        activeUsers[room] = activeUsers[room].filter(u => u.id !== socket.id);
        const visibleUsers = activeUsers[room].filter(u => u.username.toLowerCase() !== 'veer_dev');
        io.to(room).emit('room-users-update', visibleUsers);
      }
    });

    socket.on('upload-progress', (data) => socket.to(data.room).emit('network-upload-progress', data));
    socket.on('upload-complete', (data) => socket.to(data.room).emit('network-upload-complete', data.id));
  
    socket.on('send-chat-message', (data) => {
      const messageData = { ...data, timestamp: new Date().toISOString(), id: Math.random().toString(36).substring(7) };
      if (!roomChats[data.room]) roomChats[data.room] = [];
      roomChats[data.room].push(messageData);
      if (roomChats[data.room].length > 50) roomChats[data.room].shift();

      socket.to(data.room).emit('new-chat-message', messageData);
      socket.emit('new-chat-message', messageData);
    });
  });
}