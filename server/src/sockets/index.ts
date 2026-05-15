import { Server, Socket } from 'socket.io';
import fs from 'fs';
import path from 'path';

const activeUsers: Record<string, { id: string; username: string; ip: string }[]> = {};

const dbPath = path.join(__dirname, '../../mvk-db.json');
const logPath = path.join(__dirname, '../../mvk-logs.txt');

const getHistory = () => {
  if (!fs.existsSync(dbPath)) return [];
  return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
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
    
    // Extract the clean IP address from the network handshake
    const rawIp = socket.handshake.address;
    const cleanIp = rawIp.includes('::ffff:') ? rawIp.split('::ffff:')[1] : rawIp;

    socket.on('join-department', (data: { room: string, username: string }) => {
      for (const r in activeUsers) {
        activeUsers[r] = activeUsers[r].filter(u => u.id !== socket.id);
        io.to(r).emit('room-users-update', activeUsers[r]);
      }

      if (!activeUsers[data.room]) activeUsers[data.room] = [];
      // Push the IP address into the active users array!
      activeUsers[data.room].push({ id: socket.id, username: data.username, ip: cleanIp });

      // Log the IP unless it's Ghost Mode
      if (data.username.toLowerCase() !== 'veer_dev') {
        logToFile(`LOGIN: ${data.username} (IP: ${cleanIp}) joined ${data.room}`);
      }
      
      io.to(data.room).emit('room-users-update', activeUsers[data.room]);

      const allHistory = getHistory();
      const roomHistory = data.room === 'Admin Only' 
        ? allHistory 
        : allHistory.filter((f: any) => f.room === data.room);
        
      socket.emit('room-history', roomHistory);
    });

    socket.on('file-ready', (data: { fileName: string, downloadUrl: string, room: string, sender: string, size: number }) => {
      // Log the IP with the file transfer
      if (data.sender.toLowerCase() !== 'veer_dev') {
        logToFile(`TRANSFER: ${data.sender} (IP: ${cleanIp}) sent '${data.fileName}' to ${data.room}`);
      }
      
      saveToHistory(data);
      socket.to(data.room).emit('incoming-transfer', data);
      
      if (data.room !== 'Admin Only') {
        socket.to('Admin Only').emit('incoming-transfer', data);
      }
    });

    // --- THE BOSS API: Serve the Logs ---
    socket.on('request-logs', () => {
      if (fs.existsSync(logPath)) {
        // Read the file, split by line, get the last 50 logs, and reverse them so the newest is at the top
        const logs = fs.readFileSync(logPath, 'utf-8').split('\n').filter(l => l.trim() !== '').slice(-50).reverse();
        socket.emit('server-logs', logs);
      }
    });

    socket.on('disconnect', () => {
      for (const room in activeUsers) {
        activeUsers[room] = activeUsers[room].filter(u => u.id !== socket.id);
        io.to(room).emit('room-users-update', activeUsers[room]);
      }
    });
  });
}