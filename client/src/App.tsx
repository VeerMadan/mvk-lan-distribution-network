import { useState, useEffect, useRef } from 'react';
import { Share2, Users, Activity, ShieldCheck, Download, FileText, UserCircle, Lock, Menu, X, Search, LayoutGrid, List, Terminal, Server } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = `http://${window.location.hostname}:3000`;
const socket = io(SERVER_URL, { autoConnect: false });

const ROOM_PINS: Record<string, string> = {
  'Digital Team': '1234',
  'Sales & Mktg': '2026',
  'Admin Only': '9999'
};

const App = () => {
  const [username, setUsername] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false); // NEW: Handshake state
  const [activeRoom, setActiveRoom] = useState('General');
  const [isOnline, setIsOnline] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [roomFiles, setRoomFiles] = useState<any[]>([]);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [serverLogs, setServerLogs] = useState<string[]>([]); 

  const fileInputRef = useRef<HTMLInputElement>(null);

  const rooms = [
    { name: 'General', icon: <Share2 size={20} />, locked: false },
    { name: 'Digital Team', icon: <Activity size={20} />, locked: true },
    { name: 'Sales & Mktg', icon: <Users size={20} />, locked: true },
    { name: 'Admin Only', icon: <ShieldCheck size={20} />, locked: true },
  ];

  const joinNetwork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    setIsConnecting(true); // Start handshake UI
    socket.connect();
  };

  const attemptRoomJoin = (targetRoom: string) => {
    if (targetRoom === activeRoom) {
      setIsMobileMenuOpen(false);
      return;
    }

    if (ROOM_PINS[targetRoom] && username.toLowerCase() !== 'veer_dev') {
      const enteredPin = window.prompt(`🔒 Enter Security PIN for ${targetRoom}`);
      if (enteredPin !== ROOM_PINS[targetRoom]) {
        alert("Access Denied. Incorrect PIN.");
        return; 
      }
    }
    
    setActiveRoom(targetRoom);
    setSearchQuery(''); 
    setIsMobileMenuOpen(false); 
  };

  useEffect(() => {
    socket.on('connect', () => {
      setIsOnline(true);
      setIsConnecting(false);
      setIsNameSet(true); // ONLY load dashboard once fully connected!
    });
    
    socket.on('disconnect', () => setIsOnline(false));

    socket.on('incoming-transfer', (data) => setRoomFiles((prev) => [data, ...prev]));
    socket.on('room-users-update', (users) => setActiveUsers(users));
    socket.on('room-history', (history) => setRoomFiles(history));
    socket.on('server-logs', (logs) => setServerLogs(logs));

    return () => {
      socket.disconnect();
      socket.off('incoming-transfer');
      socket.off('room-users-update');
      socket.off('room-history');
      socket.off('server-logs');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  useEffect(() => {
    if (isOnline && isNameSet) {
      setRoomFiles([]); 
      socket.emit('join-department', { room: activeRoom, username });
      
      if (activeRoom === 'Admin Only') {
        socket.emit('request-logs');
      }
    }
  }, [activeRoom, isOnline, isNameSet, username]);

  const uploadFileToServer = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${SERVER_URL}/api/upload`, formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
          setUploadProgress(percentCompleted);
        }
      });
      
      const fileData = {
        fileName: res.data.originalName,
        downloadUrl: `${SERVER_URL}/download/${res.data.savedAs}`, 
        room: activeRoom,
        sender: username,
        size: res.data.size
      };

      socket.emit('file-ready', fileData);
      setRoomFiles((prev) => [fileData, ...prev]);
      setUploadProgress(0);
      
    } catch (error) {
      console.error("Upload failed:", error);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFileToServer(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFileToServer(file);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const filteredFiles = roomFiles.filter(file => 
    file.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isNameSet && !isOnline) {
    return (
      <div className="flex flex-col h-screen bg-[#0a0a0a] text-white items-center justify-center font-sans">
        <div className="bg-[#1a0505] border border-red-900/50 p-10 rounded-3xl text-center max-w-lg mx-4 shadow-[0_0_50px_rgba(255,0,0,0.1)]">
          <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Activity size={40} className="text-red-500 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-red-500 mb-2 tracking-widest uppercase">Connection Lost</h1>
          <p className="text-gray-400 mb-6">The MVK Beast Server is currently offline or rebooting. Please wait for the system to automatically reconnect.</p>
          <div className="flex items-center justify-center gap-3 text-sm font-mono text-gray-500">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
            Attempting to establish handshake...
          </div>
        </div>
      </div>
    );
  }

  if (!isNameSet) {
    return (
      <div className="flex h-screen bg-[#0a0a0a] text-white items-center justify-center font-sans">
        <form onSubmit={joinNetwork} className="bg-[#121212] p-8 rounded-2xl border border-gray-800 text-center shadow-[0_0_30px_rgba(255,215,0,0.1)] w-11/12 max-w-md">
          <h1 className="text-3xl font-bold text-[#FFD700] mb-2 italic tracking-tighter">MVK NET</h1>
          <p className="text-gray-400 mb-6">Enter your system identity to connect</p>
          <input 
            type="text" 
            autoFocus
            placeholder="e.g. Rahul - Sales Mac"
            className="w-full bg-[#0a0a0a] border border-gray-700 text-white px-4 py-3 rounded-lg focus:outline-none focus:border-[#FFD700] transition-colors mb-4 text-center"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isConnecting}
          />
          <button 
            type="submit" 
            disabled={isConnecting}
            className="w-full bg-[#FFD700] text-black font-bold py-3 rounded-lg hover:bg-[#e6c200] transition-colors shadow-gold-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? 'Establishing Handshake...' : 'Connect to LAN'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200 overflow-hidden font-sans">
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed md:relative z-50 h-full w-64 bg-[#121212] border-r border-gray-800 flex flex-col transition-transform duration-300 ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="p-6 flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-[#FFD700] tracking-tighter italic">MVK NET</h1>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Internal Protocol v1.0</p>
          </div>
          <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {rooms.map((room) => (
            <button
              key={room.name}
              onClick={() => attemptRoomJoin(room.name)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                activeRoom === room.name ? 'bg-[#FFD700]/10 text-[#FFD700] border border-[#FFD700]/30 shadow-[0_0_15px_rgba(255,215,0,0.3)]' : 'hover:bg-white/5 text-gray-400'
              }`}
            >
              <div className="flex items-center gap-3">
                {room.icon}
                <span className="font-medium">{room.name}</span>
              </div>
              {room.locked && activeRoom !== room.name && <Lock size={14} className="text-gray-600" />}
            </button>
          ))}
        </nav>

        <div className="h-[56px] shrink-0 border-t border-gray-800 flex items-center gap-3 px-6 bg-[#121212]">
          <UserCircle className="text-[#FFD700]" size={24} />
          <div className="truncate text-sm font-bold text-white">{username}</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative w-full overflow-hidden">
        
        <header className="shrink-0 h-16 border-b border-gray-800 flex items-center px-4 md:px-8 bg-[#0a0a0a] z-10">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}>
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold uppercase tracking-widest text-gray-400 truncate">
              Room: <span className="text-white">{activeRoom}</span>
            </h2>
          </div>
        </header>

        {/* SCROLLING CONTENT AREA (Added massive bottom padding pb-48) */}
        <section className="flex-1 overflow-y-auto p-4 md:p-8 pb-48 md:pb-52">
          
          {activeRoom === 'Admin Only' && (
            <div className="mb-8 md:mb-12 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 w-full max-w-5xl mx-auto">
              
              <div className="bg-[#121212] border border-gray-800 rounded-2xl p-4 md:p-6 shadow-lg">
                <div className="flex items-center gap-3 mb-4 md:mb-6 border-b border-gray-800 pb-3 md:pb-4">
                  <Server className="text-[#FFD700] w-5 h-5 md:w-6 md:h-6" />
                  <h3 className="text-xs md:text-sm font-bold tracking-widest uppercase text-white">Live System Architecture</h3>
                </div>
                <div className="space-y-2 md:space-y-3 max-h-[200px] lg:max-h-none overflow-y-auto pr-1">
                  {activeUsers.map((user) => (
                    <div key={user.id} className="flex items-center justify-between bg-[#0a0a0a] p-2 md:p-3 rounded-lg border border-gray-800/50">
                      <div className="flex items-center gap-2 md:gap-3">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs md:text-sm font-medium text-white truncate max-w-[100px] sm:max-w-[150px]">{user.username} {user.username === username ? '(You)' : ''}</span>
                      </div>
                      <span className="text-[10px] md:text-xs font-mono text-[#FFD700] bg-[#FFD700]/10 px-2 py-1 rounded truncate ml-2">{user.ip || 'Local'}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#121212] border border-gray-800 rounded-2xl p-4 md:p-6 shadow-lg flex flex-col h-[300px] md:h-[350px]">
                <div className="flex items-center justify-between mb-4 md:mb-6 border-b border-gray-800 pb-3 md:pb-4 shrink-0">
                  <div className="flex items-center gap-2 md:gap-3">
                    <Activity className="text-[#FFD700] w-5 h-5 md:w-6 md:h-6" />
                    <h3 className="text-xs md:text-sm font-bold tracking-widest uppercase text-white">System Activity Log</h3>
                  </div>
                  <button onClick={() => socket.emit('request-logs')} className="text-[9px] md:text-[10px] uppercase tracking-wider text-[#FFD700] hover:bg-[#FFD700]/10 px-2 md:px-3 py-1 rounded transition-colors border border-[#FFD700]/30">
                    Refresh Feed
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-2 md:space-y-3 pr-1 md:pr-2">
                  {serverLogs.length > 0 ? serverLogs.map((log, i) => {
                    const isLogin = log.includes('LOGIN');
                    const splitMatch = log.match(/^\[(.*?)\] (.*)$/);
                    let timestamp = '';
                    let message = log;
                    
                    if (splitMatch) {
                       const d = new Date(splitMatch[1]);
                       timestamp = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' - ' + d.toLocaleDateString();
                       message = splitMatch[2];
                    }

                    return (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 bg-[#0a0a0a] p-2 md:p-3 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                         {timestamp && (
                           <div className="text-[9px] md:text-[10px] font-bold tracking-wider text-gray-500 shrink-0 sm:min-w-[130px] uppercase">
                             {timestamp}
                           </div>
                         )}
                         <div className={`text-[11px] md:text-sm font-medium ${isLogin ? 'text-gray-400' : 'text-white'}`}>
                           {message}
                         </div>
                      </div>
                    );
                  }) : (
                    <div className="flex items-center justify-center h-full text-gray-600 italic text-xs md:text-sm">
                      Awaiting network events...
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {activeRoom !== 'Admin Only' && (
            <div className="mb-8 w-full max-w-5xl mx-auto">
              <h3 className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-4">Systems Online ({activeUsers.length})</h3>
              <div className="flex flex-wrap gap-4">
                {activeUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 bg-[#121212] border border-gray-800 px-4 py-2 rounded-full shadow-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">{user.username} {user.username === username ? '(You)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* THE FILE VAULT */}
          <div className="w-full max-w-5xl mx-auto">
            {roomFiles.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
                <div className="relative w-full sm:w-96">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    placeholder={`Search ${activeRoom === 'Admin Only' ? 'Global Network' : activeRoom}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#121212] border border-gray-800 text-white pl-11 pr-4 py-3 rounded-xl focus:outline-none focus:border-[#FFD700]/50 transition-colors"
                  />
                </div>
                
                <div className="flex bg-[#121212] border border-gray-800 rounded-xl p-1 w-full sm:w-auto justify-center">
                  <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none flex justify-center p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[#FFD700]/20 text-[#FFD700]' : 'text-gray-500 hover:text-white'}`}><List size={20} /></button>
                  <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none flex justify-center p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[#FFD700]/20 text-[#FFD700]' : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={20} /></button>
                </div>
              </div>
            )}

            {roomFiles.length === 0 ? (
              <div className="text-center text-gray-600 mt-20 font-medium">No files available.</div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center text-gray-600 mt-20 font-medium">No matching files found.</div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {filteredFiles.map((file, idx) => (
                  <div key={idx} className="bg-[#121212] border border-gray-800 p-4 rounded-xl flex items-center justify-between hover:border-gray-700 transition-colors">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="p-3 bg-[#0a0a0a] rounded-lg text-gray-400 shrink-0"><FileText size={24} /></div>
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{file.fileName}</p>
                        <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB • Sent by {file.sender} {activeRoom === 'Admin Only' && `• Room: ${file.room}`}</p>
                      </div>
                    </div>
                    <a href={file.downloadUrl} className="shrink-0 text-[#FFD700] hover:bg-[#FFD700]/10 p-3 rounded-lg transition-colors border border-[#FFD700]/20 hover:border-[#FFD700]">
                      <Download size={20} />
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map((file, idx) => (
                  <div key={idx} className="bg-[#121212] border border-gray-800 p-6 rounded-xl flex flex-col items-center text-center hover:border-gray-700 transition-colors group">
                    <div className="p-4 bg-[#0a0a0a] rounded-full text-gray-400 group-hover:text-[#FFD700] transition-colors mb-4">
                      <FileText size={32} />
                    </div>
                    <p className="text-white font-medium truncate w-full mb-1">{file.fileName}</p>
                    <p className="text-xs text-gray-500 mb-6">{(file.size / 1024 / 1024).toFixed(2)} MB • {file.sender} {activeRoom === 'Admin Only' && `• ${file.room}`}</p>
                    <a href={file.downloadUrl} className="w-full flex items-center justify-center gap-2 text-[#FFD700] hover:bg-[#FFD700]/10 py-3 rounded-lg transition-colors border border-[#FFD700]/20 hover:border-[#FFD700]">
                      <Download size={18} /> <span className="font-bold text-sm">Download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* FLOATING HUD UPLOAD ZONE */}
        <div className="absolute bottom-[70px] md:bottom-[80px] left-1/2 -translate-x-1/2 w-full max-w-xl px-4 z-20 pointer-events-none">
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`pointer-events-auto backdrop-blur-xl border-2 border-dashed rounded-3xl p-4 md:p-6 transition-all group text-center cursor-pointer relative overflow-hidden shadow-2xl
              ${isDragging ? 'bg-[#FFD700]/10 border-[#FFD700]' : 'bg-[#121212]/90 border-gray-700 hover:border-[#FFD700]'}`}
          >
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="absolute bottom-0 left-0 h-1 bg-[#FFD700] transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
            )}
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            <p className="font-medium text-[14px] md:text-base text-gray-400 group-hover:text-[#FFD700] transition-colors relative z-10">
              {uploadProgress > 0 && uploadProgress < 100 ? `Broadcasting... ${uploadProgress}%` : (
                <>Drop files or <span className="text-white underline">browse</span> to send to <span className="text-[#FFD700] font-bold">{activeRoom}</span></>
              )}
            </p>
          </div>
        </div>

        {/* HUD FOOTER */}
        <footer className="absolute bottom-0 w-full h-[56px] bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-gray-800 flex justify-center items-center z-30">
          <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4 text-[9px] md:text-[11px] tracking-[0.15em] uppercase text-center px-4">
            <span className="text-gray-500 font-medium hidden sm:inline">System Architect</span>
            <div className="hidden sm:block w-1 h-1 bg-[#FFD700] rounded-full animate-pulse shadow-[0_0_8px_rgba(255,215,0,0.8)]"></div>
            <span className="text-[#FFD700] font-bold text-[10px] md:text-[12px] tracking-[0.2em] shadow-gold">VEER MADAN</span>
            <div className="hidden sm:block w-1 h-1 bg-[#FFD700] rounded-full shadow-[0_0_8px_rgba(255,215,0,0.8)]"></div>
            <span className="text-gray-500 font-medium hidden sm:inline">IT & Digital Marketing</span>
          </div>
        </footer>

      </main>
    </div>
  );
};

export default App;