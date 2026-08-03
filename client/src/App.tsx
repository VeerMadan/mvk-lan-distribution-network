import { useState, useEffect, useRef } from 'react';
import { Share2, Users, Activity, ShieldCheck, Download, FileText, Lock, Menu, X, Search, LayoutGrid, List, Trash2, HardDrive, Eye, MessageSquare, Send, FolderUp, FilePlus, Clock, Folder, FolderPlus, ChevronRight, FileImage, Film, FileArchive, Code, Headphones, Link, Cpu, Check, CheckSquare } from 'lucide-react';

import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL, { autoConnect: false, transports: ['websocket', 'polling'] });

const ROOM_PINS: Record<string, string> = {
  'Digital Team': '1789',
  'Sales & Mktg': '2026',
  'Admin Only': 'v33r_m4k'
};

const playTone = (freq: number, type: OscillatorType, duration: number, vol = 0.05) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + duration);
  } catch (e) {}
};
const playClick = () => playTone(800, 'sine', 0.05, 0.02);
const playSuccess = () => { playTone(400, 'sine', 0.1, 0.05); setTimeout(() => playTone(600, 'sine', 0.2, 0.05), 100); };
const playPurge = () => playTone(100, 'sawtooth', 0.5, 0.1);
const playError = () => { playTone(200, 'square', 0.1, 0.05); setTimeout(() => playTone(150, 'square', 0.2, 0.05), 100); };
const playBeastSiren = () => { playTone(60, 'sawtooth', 1.5, 0.2); setTimeout(() => playTone(50, 'sawtooth', 2.0, 0.3), 1500); };

const getAvatarGradient = (name: string) => {
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const c1 = `hsl(${hash % 360}, 70%, 50%)`; const c2 = `hsl(${(hash * 2) % 360}, 70%, 20%)`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
};

const getFileProps = (filename: string) => {
  if (!filename) return { icon: FileText, color: 'text-gray-400 group-hover:text-white', bg: 'bg-gray-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(255,255,255,0.05)]' };
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return { icon: FileText, color: 'text-red-400', bg: 'bg-red-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(248,113,113,0.1)]' };
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return { icon: Film, color: 'text-blue-400', bg: 'bg-blue-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(96,165,250,0.1)]' };
  if (['zip', 'rar', '7z', 'tar'].includes(ext)) return { icon: FileArchive, color: 'text-yellow-400', bg: 'bg-yellow-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(250,204,21,0.1)]' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return { icon: FileImage, color: 'text-purple-400', bg: 'bg-purple-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(192,132,252,0.1)]' };
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return { icon: Headphones, color: 'text-pink-400', bg: 'bg-pink-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(244,114,182,0.1)]' };
  if (['js', 'html', 'css', 'ts', 'json', 'py', 'java'].includes(ext)) return { icon: Code, color: 'text-green-400', bg: 'bg-green-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(74,222,128,0.1)]' };
  return { icon: FileText, color: 'text-gray-400', bg: 'bg-gray-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(255,255,255,0.05)]' };
};

const TimeTicker = ({ expiresAt }: { expiresAt: number }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const int = setInterval(() => {
      const diff = expiresAt - Date.now();
      if (diff <= 0) { setTimeLeft('PURGING...'); setIsUrgent(true); } 
      else {
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${h}h ${m}m ${s}s`);
        setIsUrgent(h < 1); 
      }
    }, 1000);
    return () => clearInterval(int);
  }, [expiresAt]);

  return <span className={`font-mono text-[10px] font-semibold tracking-widest transition-colors duration-500 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-400'}`}>⏳ {timeLeft}</span>;
};

const AnimatedText = ({ text, delayOffset = 0 }: { text: string, delayOffset?: number }) => (
  <span className="inline-flex">
    {text.split('').map((char, index) => (
      <span key={index} className="animate-letter" style={{ animationDelay: `${delayOffset + index * 0.04}s`, width: char === ' ' ? '0.25em' : 'auto' }}>
        {char}
      </span>
    ))}
  </span>
);

class Particle {
  x: number; y: number; vx: number; vy: number; size: number; color: string; alpha: number; gravity: number; friction: number;
  constructor(x: number, y: number, isGodMode: boolean) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 30; this.vy = (Math.random() - 1) * 30 - 10; 
    this.size = Math.random() * 8 + 3;
    const colors = isGodMode ? ['#ef4444', '#b91c1c', '#7f1d1d', '#1f2937', '#ffffff'] : ['#ffffff', '#cccccc', '#999999', '#666666', '#FFD700'];
    this.color = colors[Math.floor(Math.random() * colors.length)];
    this.alpha = 1; this.gravity = 0.8; this.friction = 0.98; 
  }
  update(floor: number) {
    this.vy += this.gravity; this.vx *= this.friction;
    this.x += this.vx; this.y += this.vy;
    this.alpha -= 0.008; 
    if (this.y + this.size > floor) { this.y = floor - this.size; this.vy *= -0.6; }
  }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save(); ctx.globalAlpha = Math.max(0, this.alpha);
    ctx.fillStyle = this.color; ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }
}

const ParticleCanvas = ({ isAnimating, isGodMode }: { isAnimating: boolean, isGodMode: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationFrameId = useRef<number>(0);

  useEffect(() => {
    if (isAnimating && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      particles.current = Array.from({ length: 150 }).map(() => new Particle(window.innerWidth / 2, window.innerHeight / 2, isGodMode));

      const render = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let activeParticles = false;
        particles.current.forEach(p => { p.update(canvas.height); p.draw(ctx); if (p.alpha > 0) activeParticles = true; });
        if (activeParticles) animationFrameId.current = requestAnimationFrame(render);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
      render();
    }
    return () => { if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current); };
  }, [isAnimating, isGodMode]);
  return <canvas ref={canvasRef} className="fixed inset-0 z-[9999] pointer-events-none" />;
};

const App = () => {
  const [username, setUsername] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const [deviceId, setDeviceId] = useState('');
  const [authStep, setAuthStep] = useState<'name' | 'setup_pin' | 'challenge'>('name');
  const [authPin, setAuthPin] = useState('');
  const [pinErrorText, setPinErrorText] = useState('');
  const [activeRoom, setActiveRoom] = useState('General');
  const [isOnline, setIsOnline] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [roomItems, setRoomItems] = useState<any[]>([]); 
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingRoom, setPendingRoom] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');
  
  const [customAlert, setCustomAlert] = useState<{title: string, msg: string} | null>(null);
  const [adminAuthModal, setAdminAuthModal] = useState(false);
  const [pendingAdminName, setPendingAdminName] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');

  const [previewFile, setPreviewFile] = useState<{url: string, name: string, type: 'image' | 'pdf' | 'video'} | null>(null);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [deletingItemIds, ] = useState<string[]>([]);

  const [toastMsg, setToastMsg] = useState('');
  
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderTarget, setNewFolderTarget] = useState('Everyone');

  const [stagingFiles, setStagingFiles] = useState<File[]>([]);
  const [stagedTarget, setStagedTarget] = useState<string>('Everyone');
  const [stagedExpiry, setStagedExpiry] = useState<number>(24);
  const [networkUploads, setNetworkUploads] = useState<Record<string, {user: string, progress: number, fileName: string}>>({});
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fireParticles, setFireParticles] = useState(false);

  const [godMode, setGodMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{show: boolean, x: number, y: number, file: any | null}>({show: false, x: 0, y: 0, file: null});

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [roomMessages, setRoomMessages] = useState<any[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [storageUsed, setStorageUsed] = useState(85.5); 
  const STORAGE_LIMIT = 100; 
  
  const [hasUpdate, setHasUpdate] = useState(false);
  const [commitsBehind, setCommitsBehind] = useState(0); 

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const brandColor = godMode ? 'text-red-500' : 'text-[#FFD700]';
  const brandBorder = godMode ? 'border-red-500' : 'border-[#FFD700]';
  const brandBg = godMode ? 'bg-red-500' : 'bg-[#FFD700]';
  const displayUsername = godMode ? 'SYSTEM ADMIN' : username;
  const isAdminSession = godMode || displayUsername === 'SYSTEM ADMIN' || displayUsername.toLowerCase() === 'veer_dev';

  const rooms = [
    { name: 'General', icon: <Share2 size={18} />, locked: false },
    { name: 'Digital Team', icon: <Activity size={18} />, locked: true },
    { name: 'Sales & Mktg', icon: <Users size={18} />, locked: true },
    { name: 'Admin Only', icon: <ShieldCheck size={18} />, locked: true },
  ];

  useEffect(() => {
    let buffer = '';
    const handleKeyDown = (e: KeyboardEvent) => {
      buffer += e.key.toUpperCase();
      if (buffer.length > 5) buffer = buffer.slice(-5);
      if (buffer === 'BEAST' && !godMode) {
        setGodMode(true);
        playBeastSiren();
        setToastMsg('BEAST PROTOCOL INITIATED.');
        setTimeout(() => setToastMsg(''), 4000);
      }
    };
    
    const handleGlobalClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) playClick();
      setContextMenu(prev => ({...prev, show: false})); 
    };
    
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleGlobalClick);
    return () => { window.removeEventListener('keydown', handleKeyDown); document.removeEventListener('click', handleGlobalClick); };
  }, [godMode]);

  useEffect(() => {
    let id = localStorage.getItem('mvk_device_id');
    if (!id) { id = Math.random().toString(36).substring(2, 15); localStorage.setItem('mvk_device_id', id); }
    setDeviceId(id);
  }, []);

  const handleNameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = username.trim();
    const attemptName = finalName.toLowerCase();
    
    if (['system admin', 'veer_dev', 'admin'].includes(attemptName)) {
      setPendingAdminName(finalName); setAdminAuthModal(true); return;
    }
    if (!finalName) return; 

    setIsConnecting(true); setPinErrorText('');
    try {
      const res = await axios.post(`${SERVER_URL}/api/auth/check`, { username: finalName, deviceId });
      
      if (res.data.status === 'needs_tag') {
         setIsConnecting(false); 
         setCustomAlert({title: 'Tag Required', msg: 'Multiple users share this name. Please enter your full tag (e.g. Name#1234).'});
         return;
      }

      const resolvedName = res.data.resolvedName;
      setUsername(resolvedName); 

      if (res.data.status === 'challenge') {
        setIsConnecting(false); setAuthStep('challenge'); playError();
      } else if (res.data.requiresPinSetup) {
        setIsConnecting(false); setAuthStep('setup_pin'); playSuccess();
      } else {
        playSuccess(); socket.auth = { username: resolvedName }; socket.connect();
      }
    } catch (err: any) { 
      setIsConnecting(false); 
      const errorMsg = err.response?.data?.error || "Network connection failed.";
      setCustomAlert({title: 'Clearance Denied', msg: errorMsg});
      playError();
    }
  };

  const executeAdminLogin = async () => {
    setIsConnecting(true);
    try {
      const res = await axios.post(`${SERVER_URL}/api/auth/pin`, {
        username: pendingAdminName,
        pin: adminPinInput,
        action: 'verify'
      });
      if (res.data.status === 'success') {
        setAdminAuthModal(false);
        playSuccess();
        socket.auth = { username: pendingAdminName };
        socket.connect();
      }
    } catch (err: any) {
      setIsConnecting(false);
      playError();
      setAdminAuthModal(false);
      setCustomAlert({title: 'SYSTEM BREACH DETECTED', msg: err.response?.data?.error || 'Invalid Admin Protocol'});
      setUsername('');
      setAdminPinInput('');
    }
  };

  const submitAuthPin = async (action: 'setup' | 'verify') => {
    if (authPin.length !== 4) return;
    setIsConnecting(true); setPinErrorText('');
    try {
      const res = await axios.post(`${SERVER_URL}/api/auth/pin`, { username, deviceId, pin: authPin, action });
      if (res.data.status === 'success') {
        playSuccess(); socket.auth = { username }; socket.connect();
      }
    } catch (err) {
      setIsConnecting(false); setAuthPin(''); setPinErrorText('Incorrect PIN. Intrusion logged.'); playError();
    }
  };

  const attemptRoomJoin = (targetRoom: string) => {
    if (targetRoom === activeRoom) { setIsMobileMenuOpen(false); return; }
    if (ROOM_PINS[targetRoom] && !isAdminSession) {
      setPendingRoom(targetRoom); setShowPinModal(true); setIsMobileMenuOpen(false); return;
    }
    setActiveRoom(targetRoom); setSearchQuery(''); setIsMobileMenuOpen(false); setSelectedFiles([]);
  };

 const submitPin = (instantPin?: string) => {
    const pinToTest = typeof instantPin === 'string' ? instantPin : pinInput;
    if (pinToTest === ROOM_PINS[pendingRoom]) {
      const roasts = ["Access Granted. Welcome to the Vault.", "Authorized.", "Security clearance accepted."];
      setPinError(''); setPinSuccessMsg(roasts[Math.floor(Math.random() * roasts.length)]);
      playSuccess();
      setTimeout(() => {
        setActiveRoom(pendingRoom); setSearchQuery(''); setCurrentFolderId(null);
        setShowPinModal(false); setPinInput(''); setPinSuccessMsg('');
      }, 1500);
    } else {
      setPinError('Invalid Code'); setPinInput(''); playError();
    }
  };

  useEffect(() => {
    axios.get(`${SERVER_URL}/api/storage`).then(res => setStorageUsed(res.data.storageUsed)).catch(err => console.error(err));
    
    axios.get(`${SERVER_URL}/api/check-updates`).then(res => {
      if (res.data.updateAvailable) {
        setHasUpdate(true);
        setCommitsBehind(res.data.commits);
      }
    }).catch(() => {});

    const onConnect = () => { setIsOnline(true); setIsConnecting(false); setIsNameSet(true); };
    const onDisconnect = () => setIsOnline(false);

    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect);

    socket.on('incoming-transfer', (data) => {
       setRoomItems((prev) => {
         if (data.room !== activeRoom) return prev;
         if (prev.some(f => (f.downloadUrl && f.downloadUrl === data.downloadUrl) || (f.isFolder && f.id === data.id))) return prev;
         return [data, ...prev];
       });
       axios.get(`${SERVER_URL}/api/storage`).then(res => setStorageUsed(res.data.storageUsed));
    });
    
    socket.on('force-db-sync', (freshHistory) => {
      const validRoomItems = freshHistory.filter((f: any) => 
        f.room === activeRoom && 
        (!f.targetRecipient || f.targetRecipient === 'Everyone' || f.targetRecipient === displayUsername || f.sender === displayUsername)
      );
      setRoomItems(validRoomItems);
    });

    socket.on('storage-update', (newSize) => setStorageUsed(newSize));
    socket.on('file-deleted', (deletedIdentifier) => { 
      setRoomItems((prev) => prev.filter(item => item.fileName !== deletedIdentifier && item.savedAs !== deletedIdentifier)); 
      setSelectedFiles(prev => prev.filter(id => id !== deletedIdentifier));
    });
    socket.on('chat-history', (history) => setRoomMessages(history || []));
    socket.on('new-chat-message', (msg) => setRoomMessages((prev) => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
    socket.on('room-users-update', (users) => setActiveUsers(users));
    socket.on('network-upload-progress', (data) => setNetworkUploads(prev => ({ ...prev, [data.id]: data })));
    socket.on('network-upload-complete', (uploadId) => setNetworkUploads(prev => { const newUploads = { ...prev }; delete newUploads[uploadId]; return newUploads; }));

    if (socket.connected) onConnect();

    return () => {
      socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); socket.off('incoming-transfer');
      socket.off('force-db-sync'); socket.off('storage-update'); socket.off('file-deleted'); socket.off('chat-history'); socket.off('new-chat-message');
      socket.off('room-users-update'); socket.off('network-upload-progress'); socket.off('network-upload-complete');
    };
  }, [activeRoom, username, godMode, displayUsername]);

  useEffect(() => {
    if (isOnline && isNameSet) {
      setRoomItems([]); setRoomMessages([]); setSelectedFiles([]);
      socket.emit('join-department', { room: activeRoom, username: displayUsername });
      socket.emit('request-master-sync');
    }
  }, [activeRoom, isOnline, isNameSet, displayUsername]);

  const triggerDownload = (e: React.MouseEvent, url: string, fileName: string) => {
    e.preventDefault(); e.stopPropagation();
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.target = '_blank'; 
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleCopyLink = (url: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(url);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed"; textArea.style.left = "-999999px"; textArea.style.top = "-999999px";
      document.body.appendChild(textArea); textArea.focus(); textArea.select();
      try { document.execCommand('copy'); } catch (err) {}
      document.body.removeChild(textArea);
    }
    setToastMsg('Network Link Copied to Clipboard!');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const openContextMenu = (e: React.MouseEvent, item: any) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ show: true, x: e.pageX, y: e.pageY, file: item });
  };

  const toggleFileSelection = (e: React.MouseEvent, savedAs: string) => {
    e.stopPropagation();
    setSelectedFiles(prev => prev.includes(savedAs) ? prev.filter(id => id !== savedAs) : [...prev, savedAs]);
  };

  const getBreadcrumbs = () => {
    const crumbs = []; let curr = currentFolderId;
    while (curr) {
      const folder = roomItems.find(f => f.savedAs === curr && f.isFolder);
      if (folder) { crumbs.unshift(folder); curr = folder.parentId; } else { break; }
    }
    return crumbs;
  };

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolderId = Math.random().toString(36).substring(7);
    const newFolder = { id: newFolderId, folderName: newFolderName, room: activeRoom, sender: displayUsername, parentId: currentFolderId, targetRecipient: newFolderTarget };
    socket.emit('create-folder', newFolder);
    setRoomItems(prev => [{ ...newFolder, isFolder: true, fileName: newFolderName, savedAs: newFolderId, size: 0 }, ...prev]);
    setShowFolderModal(false); setNewFolderName(''); setNewFolderTarget('Everyone');
  };

  const executeStagedUploads = async () => {
    const filesToUpload = [...stagingFiles];
    const isFolderUpload = filesToUpload.length > 0 && !!filesToUpload[0].webkitRelativePath;
    const autoFolderName = isFolderUpload ? filesToUpload[0].webkitRelativePath.split('/')[0] : '';
    const target = stagedTarget; const expiry = stagedExpiry;
    
    setStagingFiles([]); setStagedTarget('Everyone'); setStagedExpiry(24);

    let targetParentId = currentFolderId;

    if (isFolderUpload) {
      const newFolderId = Math.random().toString(36).substring(7);
      const newFolder = { id: newFolderId, folderName: autoFolderName, room: activeRoom, sender: displayUsername, parentId: currentFolderId, targetRecipient: target };
      socket.emit('create-folder', newFolder);
      targetParentId = newFolderId; 
    }

    let successCount = 0;

    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      const formData = new FormData();
      formData.append('room', activeRoom); 
      formData.append('sender', displayUsername);
      formData.append('targetRecipient', target);
      formData.append('expiryHours', expiry.toString());
      formData.append('parentId', targetParentId || 'null');
      formData.append('file', file);
      
      const uploadId = Math.random().toString(36).substring(7);

      try {
        const res = await axios.post(`${SERVER_URL}/api/upload`, formData, {
          onUploadProgress: (progressEvent) => {
            const filePercent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
            const overallPercent = Math.round(((i * 100) + filePercent) / filesToUpload.length);
            setUploadProgress(overallPercent); 
            socket.emit('upload-progress', { room: activeRoom, id: uploadId, user: displayUsername, progress: overallPercent, fileName: file.name });
          }
        });
        
        socket.emit('file-ready', res.data);
        socket.emit('upload-complete', { room: activeRoom, id: uploadId });
        setRoomItems(prev => [res.data, ...prev]);
        successCount++;

      } catch (error) {
        socket.emit('upload-complete', { room: activeRoom, id: uploadId }); playError();
      }
    }

    setUploadProgress(0); 
   if (successCount > 0) {
      playSuccess(); 
      setFireParticles(true);
      setTimeout(() => { setFireParticles(false); }, 3000);
      socket.emit('trigger-global-sync');
    }
  };

  const handleBatchDownload = async () => {
    if (selectedFiles.length === 0) return;
    setIsBatchDownloading(true);
    try {
      const response = await axios.post(`${SERVER_URL}/api/download-batch`, { files: selectedFiles }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'MVK-Vault-Export.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToastMsg('Batch Archive Extracted Successfully');
      setTimeout(() => setToastMsg(''), 3000);
      setSelectedFiles([]); 
    } catch (error) {
      playError(); setToastMsg('Error generating archive'); setTimeout(() => setToastMsg(''), 3000);
    } finally {
      setIsBatchDownloading(false);
    }
  };

  const handleExtendExpiry = (item: any) => {
    socket.emit('extend-expiry', { identifier: item.savedAs || item.fileName, isFolder: item.isFolder, addedHours: 24 });
    setToastMsg(`Life support extended by 24h for ${item.fileName}`);
    setTimeout(() => setToastMsg(''), 3000);
    setContextMenu({ show: false, x: 0, y: 0, file: null });
  };

  const promptDelete = (identifier: string) => { setFilesToDelete([identifier]); };

  const promptBatchDelete = () => {
    if (selectedFiles.length === 0) return;
    const canDeleteAll = isAdminSession || selectedFiles.every(id => {
      const fileRecord = roomItems.find(item => item.savedAs === id);
      return fileRecord && fileRecord.sender === displayUsername;
    });

    if (!canDeleteAll) {
      playError(); setCustomAlert({ title: "Clearance Denied", msg: "You can only bulk-purge assets you personally uploaded unless you have Admin override." });
      return;
    }
    setFilesToDelete([...selectedFiles]);
  };
  
  const confirmBatchDelete = () => {
    if (filesToDelete.length === 0) return;
    playPurge(); 
    setTimeout(async () => {
      try {
        await axios.post(`${SERVER_URL}/api/files/delete`, { targets: filesToDelete, requester: displayUsername, isAdmin: isAdminSession });
        setToastMsg(`Purged ${filesToDelete.length} Assets.`); setTimeout(() => setToastMsg(''), 3500); 
        setFilesToDelete([]); setSelectedFiles([]);
      } catch (error) { playError(); }
    }, 600); 
  };

  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) setStagingFiles(Array.from(e.dataTransfer.files)); };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setStagingFiles(Array.from(e.target.files));
    if (fileInputRef.current) fileInputRef.current.value = ''; 
    if (folderInputRef.current) folderInputRef.current.value = ''; 
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    socket.emit('send-chat-message', { room: activeRoom, sender: displayUsername, text: chatMessage });
    setChatMessage('');
  };

  useEffect(() => { if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight; }, [roomMessages, isChatOpen]);
  
  const checkPreviewable = (fileName: string) => {
    if(!fileName) return false;
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mov'].includes(fileName.split('.').pop()?.toLowerCase() || '');
  }
  
  const openPreview = (file: any) => {
    const ext = file.fileName.toLowerCase().split('.').pop();
    let type: 'image' | 'pdf' | 'video' = 'image';
    if (ext === 'pdf') type = 'pdf';
    if (['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
    setPreviewFile({ url: `${SERVER_URL}/preview/${encodeURIComponent(file.savedAs || file.fileName)}`, name: file.fileName, type });
  };

  const filteredItems = roomItems.filter(item => {
    if (!item.fileName) return false;
    const matchesSearch = item.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = currentFolderId ? item.parentId === currentFolderId : !item.parentId;
    return matchesSearch && matchesFolder;
  });

  if (!isNameSet) {
    return (
      <div className="flex h-screen bg-[#000000] text-white items-center justify-center font-sans relative overflow-hidden">
        {/* Apple Dynamic Ambient Background */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
           <div className={`absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[140px] opacity-20 bg-blue-500`}></div>
           <div className={`absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] opacity-[0.15] bg-[#FFD700]`}></div>
        </div>

        <style>{`
          .mac-glass-modal { background: rgba(28, 28, 30, 0.4); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 24px 48px rgba(0,0,0,0.4); }
          .mac-input { background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08); transition: all 0.2s ease; }
          .mac-input:focus { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.2); box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.05); }
          .mac-btn-primary { background: #ffffff; color: #000000; transition: transform 0.1s ease, opacity 0.2s; }
          .mac-btn-primary:active { transform: scale(0.97); }
          .mac-btn-secondary { background: rgba(255,255,255,0.08); color: #ffffff; transition: transform 0.1s ease, background 0.2s; }
          .mac-btn-secondary:active { transform: scale(0.97); background: rgba(255,255,255,0.12); }
          @keyframes fade-in-up { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
          .animate-fade-in-up { animation: fade-in-up 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
          .mac-click:active { transform: scale(0.95); transition: transform 0.1s; }
        `}</style>
        
        <div className="mac-glass-modal p-8 sm:p-10 rounded-[32px] text-center w-11/12 max-w-sm relative z-10 animate-fade-in-up overflow-hidden">
          
          {authStep === 'name' && (
            <form onSubmit={handleNameLogin} className="flex flex-col items-center w-full">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-sm border border-white/5">
                <ShieldCheck size={28} className="text-white" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">MVK Vault</h1>
              <p className="text-gray-400 text-sm mb-8 font-medium">Sign in to access the network</p>

              <input type="text" autoFocus placeholder="Identity Tag" className="w-full mac-input text-white px-4 py-3.5 rounded-xl outline-none mb-4 text-center font-medium placeholder:text-gray-500" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isConnecting} />

              <button type="submit" disabled={isConnecting || !username.trim()} className="w-full mac-btn-primary font-semibold py-3.5 rounded-xl disabled:opacity-50 mt-2 flex items-center justify-center gap-2">
                {isConnecting ? <Activity size={18} className="animate-spin" /> : 'Continue'}
              </button>
            </form>
          )}

          {authStep === 'setup_pin' && (
            <div className="flex flex-col items-center animate-fade-in-up">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                 <Lock size={28} className="text-blue-400" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Create PIN</h1>
              <p className="text-gray-400 text-sm mb-8 font-medium">Secure your device session.</p>

              <input type="password" maxLength={4} autoFocus placeholder="••••" className="w-full mac-input text-white px-4 py-3.5 rounded-xl outline-none mb-6 text-center text-2xl tracking-[0.5em] font-mono" value={authPin} onChange={(e) => { const val = e.target.value; setAuthPin(val); if (val.length === 4) submitAuthPin('setup'); }} disabled={isConnecting} />

              <button onClick={() => submitAuthPin('setup')} disabled={authPin.length !== 4 || isConnecting} className="w-full bg-blue-500 text-white font-semibold py-3.5 rounded-xl hover:bg-blue-400 transition-all active:scale-97 disabled:opacity-50 mb-3">Save PIN</button>
            </div>
          )}

          {authStep === 'challenge' && (
            <div className="flex flex-col items-center animate-fade-in-up">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20">
                 <Lock size={28} className="text-red-400" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Enter PIN</h1>
              <p className="text-gray-400 text-sm mb-4 font-medium">Unlock <span className="text-white">{username}</span></p>
              
              <p className="text-red-400 text-xs font-semibold h-4 mb-4">{pinErrorText}</p>

              <input type="password" maxLength={4} autoFocus placeholder="••••" className={`w-full mac-input text-white px-4 py-3.5 rounded-xl outline-none mb-6 text-center text-2xl tracking-[0.5em] font-mono ${pinErrorText ? 'border-red-500/50' : ''}`} value={authPin} onChange={(e) => { setAuthPin(e.target.value); setPinErrorText(''); }} onKeyDown={(e) => e.key === 'Enter' && submitAuthPin('verify')} disabled={isConnecting} />

              <div className="flex gap-3 w-full">
                <button onClick={() => { setAuthStep('name'); setUsername(''); setAuthPin(''); setPinErrorText(''); }} className="flex-1 mac-btn-secondary font-semibold py-3.5 rounded-xl">Cancel</button>
                <button onClick={() => submitAuthPin('verify')} disabled={authPin.length !== 4 || isConnecting} className="flex-[2] mac-btn-primary font-semibold py-3.5 rounded-xl disabled:opacity-50">Unlock</button>
              </div>
            </div>
          )}
        </div>

        {/* Custom Error Alerts */}
        {customAlert && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] px-4 backdrop-blur-xl animate-fade-in-up">
            <div className="mac-glass-modal p-8 rounded-[32px] w-full max-w-sm text-center shadow-[0_20px_60px_rgba(239,68,68,0.2)]">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                <ShieldCheck size={28} className="text-red-500" />
              </div>
              <h2 className="text-white text-xl font-semibold mb-2">{customAlert.title}</h2>
              <p className="text-gray-400 text-sm mb-6 font-medium">{customAlert.msg}</p>
              <button onClick={() => setCustomAlert(null)} className="w-full bg-red-500 hover:bg-red-400 text-white font-semibold py-3.5 rounded-xl transition-all active:scale-97">Acknowledge</button>
            </div>
          </div>
        )}

        {/* Apple Style Admin Override Modal */}
        {adminAuthModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] px-4 backdrop-blur-xl animate-fade-in-up">
            <div className="mac-glass-modal p-8 sm:p-10 rounded-[32px] w-full max-w-sm text-center shadow-2xl relative overflow-hidden">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-white/5">
                 <ShieldCheck size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight text-white mb-1">System Override</h2>
              <p className="text-gray-400 text-sm mb-8 font-medium">Authenticate as Admin</p>

              <input type="password" autoFocus
                className="w-full mac-input text-white rounded-xl px-4 py-3.5 mb-6 text-center text-sm outline-none placeholder:text-gray-500 font-mono"
                placeholder="Master Password" value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeAdminLogin()}
              />
              <div className="flex gap-3 w-full">
                <button onClick={() => {setAdminAuthModal(false); setUsername(''); setAdminPinInput('');}} className="flex-1 mac-btn-secondary font-semibold py-3.5 rounded-xl">Cancel</button>
                <button onClick={executeAdminLogin} disabled={!adminPinInput || isConnecting} className="flex-1 mac-btn-primary font-semibold py-3.5 rounded-xl disabled:opacity-50">Verify</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#000000] text-[#e5e5ea] overflow-hidden font-sans relative" style={{ WebkitFontSmoothing: 'antialiased' }} onDrop={(e) => storageUsed < STORAGE_LIMIT && handleDrop(e)} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      
      {/* Pure iOS Dark Mode Ambient Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden bg-[#000000]">
         <div className={`absolute top-[-30%] left-[-20%] w-[70%] h-[70%] rounded-full blur-[180px] opacity-20 ${godMode ? 'bg-red-600' : 'bg-indigo-600'}`}></div>
         <div className={`absolute bottom-[-30%] right-[-20%] w-[70%] h-[70%] rounded-full blur-[200px] opacity-[0.15] ${godMode ? 'bg-red-900' : 'bg-[#FFD700]'}`}></div>
      </div>

      <ParticleCanvas isAnimating={fireParticles} isGodMode={godMode} />
      
      <style>{`
        .mac-sidebar { background: rgba(28, 28, 30, 0.5); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border-right: 1px solid rgba(255, 255, 255, 0.05); }
        .mac-header { background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
        .mac-dock { background: rgba(30, 30, 30, 0.6); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 15px 40px rgba(0,0,0,0.6); border-radius: 9999px; }
        .mac-glass { background: rgba(30, 30, 30, 0.4); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
        .mac-glass-dark { background: rgba(15, 15, 15, 0.6); backdrop-filter: blur(40px); -webkit-backdrop-filter: blur(40px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .mac-list-item { border-bottom: 1px solid rgba(255,255,255,0.03); transition: all 0.2s ease; }
        .mac-list-item:hover { background: rgba(255, 255, 255, 0.05); border-radius: 16px; border-bottom-color: transparent; }
        .mac-click:active { transform: scale(0.96); transition: transform 0.1s; }
        
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }

        @keyframes scale-in-center { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scale-in-center 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }
        @keyframes file-drop { 0% { transform: translateY(-10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .animate-file-drop { animation: file-drop 0.3s ease-out both; }
        @keyframes thanos-snap { 0% { filter: brightness(1); transform: scale(1); opacity: 1; } 100% { filter: blur(10px) drop-shadow(0 -50px 20px red); transform: scale(0.8) translateY(-50px) rotate(5deg); opacity: 0; } }
        .anim-purge { animation: thanos-snap 0.6s cubic-bezier(0.5, 0, 1, 1) forwards; pointer-events: none; }
      `}</style>

      {/* Security PIN Modals */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] px-4 backdrop-blur-xl transition-all duration-500">
          <div className="mac-glass-dark p-8 rounded-[32px] w-full max-w-sm shadow-2xl animate-scale-in">
            <div className="flex justify-center mb-4"><div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10"><Lock size={28} className="text-white" /></div></div>
            <h2 className="text-white text-xl font-semibold mb-1 text-center">{pinSuccessMsg ? 'Authorized' : 'Restricted Room'}</h2>
            <p className="text-center text-sm font-medium h-12 flex items-center justify-center px-2">{pinError ? <span className="text-red-400">{pinError}</span> : pinSuccessMsg ? <span className="text-green-400 text-center">{pinSuccessMsg}</span> : <span className="text-gray-400">Enter PIN for {pendingRoom}</span>}</p>
            {!pinSuccessMsg && (
              <>
                <input type="password" maxLength={4} value={pinInput} onChange={(e) => { const val = e.target.value; setPinInput(val); if (pinError) setPinError(''); if (val.length === 4) submitPin(val); }} onKeyDown={(e) => e.key === 'Enter' && submitPin()} className={`w-full bg-black/40 text-white border border-white/10 rounded-xl px-4 py-3.5 mt-2 mb-6 focus:outline-none text-center tracking-[0.5em] text-2xl shadow-inner font-mono ${pinError ? 'border-red-500/50' : 'focus:border-white/30'}`} placeholder="••••" autoFocus />
                <div className="flex gap-3"><button onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold transition-colors mac-click">Cancel</button><button onClick={() => submitPin()} className="flex-1 bg-white text-black hover:bg-gray-200 py-3 rounded-xl font-semibold transition-all mac-click">Authorize</button></div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Right Click Context Menu */}
      {contextMenu.show && contextMenu.file && (
        <div className="fixed z-[1000] w-56 mac-glass-dark rounded-2xl shadow-2xl overflow-hidden py-2 animate-scale-in" style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 250) }}>
          <div className="px-4 py-2 border-b border-white/5 mb-2"><p className="text-xs font-semibold text-white truncate w-full">{contextMenu.file.fileName}</p></div>
          {!contextMenu.file.isFolder && checkPreviewable(contextMenu.file.fileName) && (
            <button onClick={() => openPreview(contextMenu.file)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-blue-500/50 flex items-center gap-3 transition-colors"><Eye size={16} /> Preview Asset</button>
          )}
          {contextMenu.file.isFolder ? (
            <button onClick={() => setCurrentFolderId(contextMenu.file.savedAs)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-blue-500/50 flex items-center gap-3 transition-colors"><Folder size={16} /> Open Folder</button>
          ) : (
            <>
              <button onClick={(e) => triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(contextMenu.file.savedAs || contextMenu.file.fileName)}`, contextMenu.file.fileName)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-blue-500/50 flex items-center gap-3 transition-colors"><Download size={16} /> Download Source</button>
              <button onClick={() => handleCopyLink(`${SERVER_URL}/download/${encodeURIComponent(contextMenu.file.savedAs || contextMenu.file.fileName)}`)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-blue-500/50 flex items-center gap-3 transition-colors"><Link size={16} /> Copy Link</button>
            </>
          )}
          {(contextMenu.file.sender === displayUsername || isAdminSession) && (
            <>
              <div className="my-1 border-t border-white/5"></div>
              <button onClick={() => handleExtendExpiry(contextMenu.file)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-green-500/50 flex items-center gap-3 transition-colors">
                <Clock size={16} /> Extend 24h
              </button>
              <button onClick={() => promptDelete(contextMenu.file.savedAs || contextMenu.file.fileName)} className="w-full text-left px-4 py-2 text-sm text-red-400 hover:text-white hover:bg-red-500/80 flex items-center gap-3 transition-colors"><Trash2 size={16} /> Delete</button>
            </>
          )}
        </div>
      )}

      {/* Drag Drop Overlay */}
      {isDragging && storageUsed < STORAGE_LIMIT && (
        <div className="absolute inset-0 z-[500] bg-blue-500/10 border-2 border-blue-500/50 rounded-xl flex items-center justify-center backdrop-blur-sm pointer-events-none transition-all">
           <div className="mac-glass-dark px-10 py-8 rounded-[32px] text-center shadow-2xl flex flex-col items-center animate-scale-in">
             <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4"><Download className="text-blue-400 w-8 h-8 animate-bounce" /></div>
             <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">Drop Files Here</h2>
             <p className="text-gray-400 font-medium text-sm">Release to stage uploads</p>
           </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[700] px-4 backdrop-blur-xl">
          <div className="mac-glass-dark p-8 rounded-[32px] w-full max-w-sm shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-6"><div className="p-2 bg-white/10 rounded-xl"><FolderPlus size={20} className="text-white"/></div><h2 className="text-white text-xl font-semibold tracking-tight">New Folder</h2></div>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder Name" className="w-full bg-black/40 border border-white/10 text-white px-4 py-3.5 rounded-xl outline-none focus:border-white/30 transition-all mb-4 text-sm font-medium" autoFocus />
            <select value={newFolderTarget} onChange={(e) => setNewFolderTarget(e.target.value)} className="w-full bg-black/40 border border-white/10 text-white px-4 py-3.5 rounded-xl outline-none mb-8 text-sm font-medium appearance-none">
              <option value="Everyone">Visible to: Everyone</option>
              {activeUsers.filter(u => u.username !== displayUsername).map(u => <option key={u.id} value={u.username}>Private to: {u.username}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowFolderModal(false)} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-xl font-semibold transition-colors mac-click">Cancel</button>
              <button onClick={handleCreateFolder} className="flex-1 bg-white text-black hover:bg-gray-200 font-semibold py-3.5 rounded-xl transition-all mac-click">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Staging & Upload Modal */}
      {stagingFiles.length > 0 && (
        <div className="absolute inset-0 z-[600] bg-black/60 flex items-center justify-center backdrop-blur-xl p-4">
          <div className="mac-glass-dark rounded-[32px] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in overflow-hidden border border-white/10">
            <div className="bg-white/5 border-b border-white/5 p-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="bg-white text-black p-2.5 rounded-xl"><Activity size={20} /></div>
                <div>
                  <h2 className="text-white text-lg font-semibold tracking-tight leading-tight">Stage Upload</h2>
                  <p className="text-gray-400 text-xs font-medium">{stagingFiles.length > 0 && !!stagingFiles[0].webkitRelativePath ? `Directory: ${stagingFiles[0].webkitRelativePath.split('/')[0]}` : `${stagingFiles.length} file(s) staged`}</p>
                </div>
              </div>
              <button onClick={() => setStagingFiles([])} className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-full transition-colors mac-click"><X size={20} /></button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-8 bg-black/20">
              <div>
                <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">1. Secure Target</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button onClick={() => setStagedTarget('Everyone')} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all mac-click border ${stagedTarget === 'Everyone' ? 'bg-white text-black border-transparent shadow-md' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}><Share2 size={20} /><span className="font-semibold text-xs">Everyone</span></button>
                  {activeUsers.filter(u => u.username !== displayUsername).map(u => (
                    <button key={u.id} onClick={() => setStagedTarget(u.username)} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all mac-click border ${stagedTarget === u.username ? 'bg-blue-500 text-white border-transparent shadow-md' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}><Lock size={20} /><span className="font-semibold text-xs truncate w-full text-center">{u.username}</span></button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">2. Expiration Timer</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[1, 12, 24, 168].map(hours => (
                    <button key={hours} onClick={() => setStagedExpiry(hours)} className={`py-4 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all mac-click border ${stagedExpiry === hours ? 'bg-white text-black border-transparent shadow-md' : 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10'}`}><span className="font-semibold text-xs">{hours === 168 ? '7 Days' : `${hours}h`}</span></button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-white/5 border-t border-white/5 shrink-0 flex gap-4">
               <button onClick={() => setStagingFiles([])} className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-4 rounded-2xl transition-colors mac-click">Cancel</button>
               <button onClick={executeStagedUploads} className="flex-[2] bg-white hover:bg-gray-200 text-black font-semibold py-4 rounded-2xl transition-all mac-click flex items-center justify-center gap-2"><Send size={18} /> Upload Now</button>
            </div>
          </div>
        </div>
      )}

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />}

      {/* MAC SIDEBAR */}
      <aside className={`fixed md:relative z-50 h-full w-64 mac-sidebar flex flex-col transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-5 flex flex-col shrink-0 relative z-10">
          <div className="flex justify-between items-center mb-6 pl-2 mt-2">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">MVK Vault</h1>
            </div>
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={20} /></button>
          </div>
          
          <div className="px-2 mb-4">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-400 mb-1.5">
              <span>Cloud Storage</span>
              <span className={storageUsed >= STORAGE_LIMIT ? 'text-red-400' : 'text-gray-300'}>{storageUsed.toFixed(1)} GB</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full rounded-full ${storageUsed >= 90 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${Math.min((storageUsed / STORAGE_LIMIT) * 100, 100)}%` }}></div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto relative z-10 pb-[100px] flex flex-col">
          <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase px-3 mb-2 mt-2">Locations</div>
          <div>
            {rooms.map((room) => (
              <button key={room.name} onClick={() => attemptRoomJoin(room.name)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all mac-click ${activeRoom === room.name ? 'bg-white/15 text-white' : 'hover:bg-white/5 text-gray-400'}`}>
                <div className="flex items-center gap-3"><span className={`${activeRoom === room.name ? 'text-white' : 'text-gray-400'}`}>{room.icon}</span><span className="font-medium text-[13px]">{room.name}</span></div>
                {room.locked && activeRoom !== room.name && <Lock size={12} className="text-gray-500" />}
              </button>
            ))}
          </div>
          
          <div className="mt-auto flex flex-col gap-2 pt-4">
            {hasUpdate && (
              <div className="mx-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl flex flex-col gap-1">
                <div className="flex items-center gap-2 text-blue-400 font-semibold text-xs">
                  <Download size={12} className="animate-bounce" /> Update Ready
                </div>
                <p className="text-[10px] text-gray-400 leading-tight">System is {commitsBehind} versions behind.</p>
              </div>
            )}
            <button onClick={() => setShowCredits(true)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white transition-all mac-click">
              <ShieldCheck size={16} />
              <span className="font-medium text-[13px]">System Details</span>
            </button>
          </div>
        </nav>
        <div className="absolute bottom-0 w-full h-[60px] shrink-0 border-t border-white/5 flex items-center gap-3 px-5 bg-black/20 backdrop-blur-md z-10">
          {godMode ? (
            <Cpu className="text-red-500 animate-pulse" size={24} />
          ) : (
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-semibold text-white text-xs shadow-sm border border-white/10" style={{ background: getAvatarGradient(displayUsername) }}>{displayUsername.charAt(0).toUpperCase()}</div>
          )}
          <div className={`truncate text-[13px] font-semibold ${godMode ? 'text-red-500' : 'text-white'}`}>{displayUsername}</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative w-full overflow-hidden z-10">
        
        {/* MAC HEADER */}
        <header className="shrink-0 h-[60px] mac-header flex items-center px-4 md:px-6 z-10 justify-between">
          <div className="flex items-center gap-4 w-full">
            <button className="md:hidden text-gray-400 hover:text-white transition-colors" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20} /></button>
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide py-1 w-full">
               <span onClick={() => setCurrentFolderId(null)} className={`text-[13px] font-semibold cursor-pointer transition-all ${!currentFolderId ? 'text-white' : `text-gray-400 hover:text-white`}`}>{activeRoom}</span>
               {getBreadcrumbs().map((crumb, idx, arr) => (
                 <div key={crumb.savedAs} className="flex items-center gap-2">
                   <ChevronRight size={14} className="text-gray-600" />
                   <span onClick={() => setCurrentFolderId(crumb.savedAs)} className={`text-[13px] font-semibold cursor-pointer transition-all max-w-[100px] sm:max-w-[150px] truncate ${idx === arr.length - 1 ? 'text-white' : `text-gray-400 hover:text-white`}`}>{crumb.fileName}</span>
                 </div>
               ))}
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 md:p-8 pb-[180px] md:pb-[200px] relative">
          
          {activeRoom !== 'Admin Only' && !currentFolderId && (
            <div className="mb-8 w-full max-w-5xl mx-auto">
              <h3 className="text-[11px] text-gray-500 font-semibold tracking-wider uppercase mb-3">Online ({activeUsers.length})</h3>
              <div className="flex flex-wrap gap-2">
                {activeUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full shadow-sm">
                    {user.username === 'SYSTEM ADMIN' ? <Cpu size={12} className="text-red-500 animate-pulse" /> : (
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: getAvatarGradient(user.username) }}>{user.username.charAt(0).toUpperCase()}</div>
                    )}
                    <span className="text-xs font-medium text-gray-200">{user.username} {user.username === displayUsername ? '(You)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}  

          <div key={activeRoom + (currentFolderId || 'root')} className="w-full max-w-5xl mx-auto animate-scale-in">
            {Object.keys(networkUploads).length > 0 && (
              <div className="mb-6 space-y-3">
                <h3 className={`text-[11px] text-blue-400 font-semibold tracking-wider uppercase flex items-center gap-2 mb-3`}><Activity size={12} className="animate-pulse" /> Transmissions</h3>
                {Object.values(networkUploads).map((upload, idx) => (
                  <div key={idx} className="mac-glass p-4 rounded-2xl shadow-sm">
                    <div className="flex justify-between text-xs mb-2"><span className="text-gray-300"><strong className="text-white">{upload.user}</strong> is sending <span className="text-white font-medium truncate max-w-[150px] inline-block align-bottom">{upload.fileName}</span></span><span className="text-white font-mono">{upload.progress}%</span></div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden"><div className="bg-white h-full rounded-full transition-all duration-300" style={{ width: `${upload.progress}%` }}></div></div>
                  </div>
                ))}
              </div>
            )}

            {(roomItems.length > 0 || currentFolderId) && (
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
                <div className="relative w-full sm:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder={`Search...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 text-white pl-10 pr-4 py-2 rounded-full focus:outline-none focus:bg-white/10 transition-all text-sm placeholder:text-gray-500" /></div>
                <div className="flex bg-white/5 rounded-full p-1 w-full sm:w-auto justify-center border border-white/5">
                  <button onClick={() => setSelectedFiles(selectedFiles.length === filteredItems.length && filteredItems.length > 0 ? [] : filteredItems.map(i => i.savedAs))} className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all ${selectedFiles.length > 0 ? `bg-white/20 text-white shadow-sm` : 'text-gray-400 hover:text-white'}`}><CheckSquare size={14} /> <span className="text-[13px] font-semibold hidden sm:inline">Select All</span></button>
                  <div className="w-px bg-white/10 mx-1 my-1"></div>
                  <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none flex justify-center px-4 py-1.5 rounded-full transition-all ${viewMode === 'list' ? `bg-white/20 text-white shadow-sm` : 'text-gray-400 hover:text-white'}`}><List size={16} /></button>
                  <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none flex justify-center px-4 py-1.5 rounded-full transition-all ${viewMode === 'grid' ? `bg-white/20 text-white shadow-sm` : 'text-gray-400 hover:text-white'}`}><LayoutGrid size={16} /></button>
                </div>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="text-center text-gray-500 mt-32 text-sm font-medium">{searchQuery ? 'No results found.' : 'This folder is empty.'}</div>
            ) : viewMode === 'list' ? (
              <div className="flex flex-col">
                <div className="flex items-center px-4 py-2 text-xs font-semibold text-gray-500 border-b border-white/5 mb-2 hidden sm:flex">
                  <div className="w-8"></div>
                  <div className="flex-1">Name</div>
                  <div className="w-32">Size</div>
                  <div className="w-32">Sender</div>
                  <div className="w-24 text-right pr-4">Actions</div>
                </div>

                {filteredItems.map((item, idx) => {
                  const props = item.isFolder ? { icon: Folder, color: 'text-white', bg: `bg-white/10`, shadow: `` } : getFileProps(item.fileName);
                  const IconComp = props.icon;
                  const isSelected = selectedFiles.includes(item.savedAs);
                  
                  return (
                    <div key={idx} style={{ animationDelay: `${idx * 0.02}s` }} onContextMenu={(e) => openContextMenu(e, item)} className={`mac-list-item flex items-center justify-between group relative p-3 sm:px-4 sm:py-3 ${deletingItemIds.includes(item.savedAs || item.fileName) ? 'anim-purge' : 'animate-file-drop'} ${isSelected ? 'bg-white/10 rounded-2xl border-transparent' : ''}`}>
                      
                      <div onClick={(e) => toggleFileSelection(e, item.savedAs || item.fileName)} className={`absolute left-4 top-1/2 -translate-y-1/2 p-1 rounded border transition-all z-20 cursor-pointer ${isSelected ? `bg-white border-white text-black` : `bg-black/50 border-gray-500 text-transparent opacity-0 group-hover:opacity-100 hover:border-white`}`}>
                        <Check size={12} className={isSelected ? 'opacity-100' : 'opacity-0'} strokeWidth={3} />
                      </div>

                      <div className={`flex items-center gap-4 flex-1 overflow-hidden cursor-pointer transition-all ${isSelected ? 'ml-8' : 'group-hover:ml-8'}`} onClick={() => item.isFolder ? setCurrentFolderId(item.savedAs) : toggleFileSelection({stopPropagation:()=>{}} as any, item.savedAs)}>
                        <div className={`p-2.5 rounded-xl shrink-0 ${props.bg} ${props.color}`}><IconComp size={20} className={item.isFolder ? 'fill-current opacity-80' : ''} /></div>
                        <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center">
                          <div className="flex-1 flex items-center gap-2 sm:pr-4">
                            <p className={`text-[14px] font-medium truncate ${item.isFolder ? 'text-white' : 'text-gray-200'}`}>{item.fileName}</p>
                            {item.targetRecipient && item.targetRecipient !== 'Everyone' && (<Lock size={12} className="text-gray-500 shrink-0" />)}
                          </div>
                          <div className="w-32 text-xs text-gray-500 hidden sm:block">{item.isFolder ? '--' : `${(item.size / 1024 / 1024).toFixed(2)} MB`}</div>
                          <div className="w-32 text-xs text-gray-500 hidden sm:block truncate pr-4">{item.sender}</div>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-1 transition-opacity ${isSelected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        {!item.isFolder && <button onClick={(e) => { e.stopPropagation(); handleCopyLink(`${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`) }} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors mac-click hidden sm:block"><Link size={16} /></button>}
                        {(item.sender === displayUsername || isAdminSession) && (<button onClick={(e) => { e.stopPropagation(); promptDelete(item.savedAs || item.fileName) }} className="text-red-400 hover:text-white hover:bg-red-500/20 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 mac-click"><Trash2 size={16} /></button>)}
                        {!item.isFolder && checkPreviewable(item.fileName) && (<button onClick={(e) => { e.stopPropagation(); openPreview(item) }} className="text-gray-300 hover:text-white hover:bg-white/10 p-2 rounded-full transition-colors mac-click"><Eye size={16} /></button>)}
                        {!item.isFolder && <button onClick={(e) => { e.stopPropagation(); triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`, item.fileName) }} className={`text-white hover:bg-white/10 p-2 rounded-full transition-colors mac-click`}><Download size={16} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredItems.map((item, idx) => {
                  const props = item.isFolder ? { icon: Folder, color: 'text-white', bg: `bg-white/10`, shadow: `` } : getFileProps(item.fileName);
                  const IconComp = props.icon;
                  const isSelected = selectedFiles.includes(item.savedAs);

                  return (
                    <div key={idx} style={{ animationDelay: `${idx * 0.03}s` }} onContextMenu={(e) => openContextMenu(e, item)} onClick={() => item.isFolder && !isSelected ? setCurrentFolderId(item.savedAs) : toggleFileSelection({stopPropagation:()=>{}} as any, item.savedAs)} className={`mac-glass p-5 rounded-[24px] flex flex-col items-center text-center group relative cursor-pointer ${deletingItemIds.includes(item.savedAs || item.fileName) ? 'anim-purge' : 'animate-file-drop'} ${isSelected ? `bg-white/10 border-white/20 shadow-md` : `hover:bg-white/5 ${props.shadow}`}`}>
                      
                      <div onClick={(e) => toggleFileSelection(e, item.savedAs || item.fileName)} className={`absolute left-4 top-4 p-1 rounded border transition-all z-20 cursor-pointer ${isSelected ? `bg-white border-white text-black` : `bg-black/50 border-gray-500 text-transparent opacity-0 group-hover:opacity-100 hover:border-white`}`}>
                        <Check size={12} className={isSelected ? 'opacity-100' : 'opacity-0'} strokeWidth={3} />
                      </div>

                      <div className={`p-4 rounded-2xl mb-3 ${props.bg} ${props.color}`}>
                        <IconComp size={28} className={item.isFolder ? 'fill-current opacity-80' : ''} />
                      </div>
                      <p className={`text-[13px] font-medium w-full mb-1 truncate px-1 ${item.isFolder ? 'text-white' : 'text-gray-200'}`}>{item.fileName}</p>
                      <p className="text-[11px] text-gray-500 mb-2">{item.isFolder ? 'Folder' : `${(item.size / 1024 / 1024).toFixed(1)} MB`}</p>

                      {!item.isFolder && (
                        <div className={`w-full flex gap-1 mt-auto transition-opacity ${isSelected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                          <button onClick={(e) => { e.stopPropagation(); triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`, item.fileName) }} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 rounded-xl text-xs font-semibold transition-colors mac-click">Download</button>
                          {checkPreviewable(item.fileName) && (<button onClick={(e) => { e.stopPropagation(); openPreview(item) }} className="w-10 flex justify-center items-center bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl transition-colors mac-click"><Eye size={14} /></button>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* FLOATING BATCH ACTION BAR (MAC DOCK STYLE) */}
        <div className={`absolute bottom-[90px] left-1/2 -translate-x-1/2 z-30 transition-all duration-500 ${selectedFiles.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
          <div className="mac-glass-dark p-2 pr-3 pl-3 rounded-full flex items-center justify-between shadow-2xl border border-white/10">
            <div className="flex items-center gap-2 mr-4 ml-1">
               <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-black font-bold text-[11px]">{selectedFiles.length}</div>
               <span className="text-white font-semibold text-[13px] hidden sm:block">Selected</span>
            </div>
            <div className="flex items-center gap-1">
               <button onClick={handleBatchDownload} disabled={isBatchDownloading} className={`flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-full text-[12px] font-semibold transition-colors mac-click ${isBatchDownloading ? 'opacity-50' : ''}`}>
                 {isBatchDownloading ? <Activity size={14} className="animate-spin" /> : <Download size={14} />} 
                 <span className="hidden sm:inline">Download</span>
               </button>
               <button onClick={promptBatchDelete} className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white px-4 py-2 rounded-full text-[12px] font-semibold transition-colors mac-click">
                 <Trash2 size={14} /> <span className="hidden sm:inline">Delete</span>
               </button>
               <div className="w-px h-4 bg-white/10 mx-1"></div>
               <button onClick={() => setSelectedFiles([])} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors mac-click">
                 <X size={14} />
               </button>
            </div>
          </div>
        </div>

        {/* MAIN UPLOAD DOCK */}
        <div className="absolute bottom-[30px] left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center w-full px-4">
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mb-4 mac-glass p-3 rounded-2xl flex items-center gap-3 shadow-lg pointer-events-auto w-full max-w-sm">
              <Activity size={16} className="text-white animate-pulse shrink-0" />
              <div className="flex-1 w-full bg-white/10 rounded-full h-1 overflow-hidden">
                <div className="bg-white h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <span className="text-white font-mono text-[11px] font-bold">{uploadProgress}%</span>
            </div>
          )}

          <div className="mac-dock p-1.5 flex items-center gap-1 pointer-events-auto">
            <button onClick={() => setShowFolderModal(true)} disabled={storageUsed >= STORAGE_LIMIT} className={`px-4 py-2.5 rounded-full flex items-center gap-2 transition-colors mac-click ${storageUsed >= STORAGE_LIMIT ? 'opacity-50' : `hover:bg-white/10 text-gray-300 hover:text-white`}`}>
              <FolderPlus size={18} />
              <span className="font-medium text-[13px] hidden sm:inline">New Folder</span>
            </button>
            <div className="w-px h-5 bg-white/10 mx-1"></div>
            <button onClick={() => storageUsed < STORAGE_LIMIT && fileInputRef.current?.click()} disabled={storageUsed >= STORAGE_LIMIT} className={`px-4 py-2.5 rounded-full flex items-center gap-2 transition-colors mac-click ${storageUsed >= STORAGE_LIMIT ? 'opacity-50' : `hover:bg-white/10 text-gray-300 hover:text-white`}`}>
              <FilePlus size={18} />
              <span className="font-medium text-[13px] hidden sm:inline">Files</span>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            </button>
            <button onClick={() => storageUsed < STORAGE_LIMIT && folderInputRef.current?.click()} disabled={storageUsed >= STORAGE_LIMIT} className={`px-4 py-2.5 rounded-full flex items-center gap-2 transition-colors mac-click ${storageUsed >= STORAGE_LIMIT ? 'opacity-50' : `hover:bg-white/10 text-gray-300 hover:text-white`}`}>
              <FolderUp size={18} />
              <span className="font-medium text-[13px] hidden sm:inline">Folder</span>
              {/* @ts-ignore */}
              <input type="file" webkitdirectory="" directory="" className="hidden" ref={folderInputRef} onChange={handleFileSelect} />
            </button>
          </div>
        </div>

        {/* CREDITS & LICENSE MODAL */}
        {showCredits && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500] p-4 backdrop-blur-xl">
            <div className="mac-glass-dark border border-white/10 p-1 rounded-[32px] w-full max-w-xl shadow-2xl relative animate-scale-in overflow-hidden">
              <div className="bg-[#121212]/50 rounded-[28px] p-6 sm:p-8 relative">
                <button onClick={() => setShowCredits(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors bg-white/5 p-2 rounded-full mac-click"><X size={16} /></button>
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold bg-white text-black shadow-lg">VM</div>
                  <div>
                    <div className="inline-flex px-2.5 py-1 bg-white/10 rounded-full text-[10px] uppercase font-bold text-gray-300 mb-2">Level 5 Clearance</div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Veer Madan</h2>
                    <p className="text-gray-400 text-xs font-medium uppercase tracking-wider">Lead System Architect</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl">
                    <h3 className="text-white font-semibold text-xs flex items-center gap-2 mb-1"><Code size={14} /> Architecture</h3>
                    <p className="text-[13px] text-gray-400 leading-relaxed">Proprietary distribution network engineered exclusively for MVK Builders and Developers Head Office.</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl">
                    <h3 className="text-white font-semibold text-xs flex items-center gap-2 mb-1"><Lock size={14} /> Licensing</h3>
                    <p className="text-[13px] text-gray-400 leading-relaxed">Licensed strictly for internal operations. Commercialization outside the organization is strictly prohibited.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FILE PREVIEW MODAL */}
        {previewFile && (
          <div className="fixed inset-0 bg-black/80 flex flex-col z-[200] animate-scale-in backdrop-blur-3xl">
            <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-black/20">
              <div className="flex items-center gap-3"><span className="text-white font-medium text-sm truncate max-w-xs md:max-w-xl">{previewFile.name}</span></div>
              <div className="flex items-center gap-4"><button onClick={(e) => triggerDownload(e, previewFile.url, previewFile.name)} className="bg-white hover:bg-gray-200 text-black px-4 py-2 rounded-full text-xs font-semibold transition-colors mac-click">Download</button><button onClick={() => setPreviewFile(null)} className="text-gray-400 hover:text-white p-2 bg-white/10 rounded-full transition-colors mac-click"><X size={16} /></button></div>
            </header>
            <div className="flex-1 p-4 md:p-8 flex items-center justify-center overflow-hidden">
              {(previewFile.type as string) === 'video' ? (
                <video src={previewFile.url} controls autoPlay className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" />
              ) : (previewFile.type as string) === 'image' ? (
                <img src={previewFile.url} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
              ) : (
                <iframe src={previewFile.url} className="w-full h-full rounded-2xl bg-white shadow-2xl" title="PDF Preview" />
              )}
            </div>
          </div>
        )}

        {/* TOAST ALERTS */}
        {toastMsg && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[300] pointer-events-none animate-fade-in-up">
            <div className="mac-glass-dark px-5 py-2.5 rounded-full flex items-center gap-2 shadow-2xl">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div><span className="text-white text-[13px] font-medium">{toastMsg}</span>
            </div>
          </div>
        )}

        {/* MULTI-DELETE CONFIRMATION MODAL */}
        {filesToDelete.length > 0 && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] px-4 backdrop-blur-xl">
            <div className="mac-glass-dark p-8 rounded-[32px] w-full max-w-sm shadow-2xl animate-scale-in border border-red-500/20">
              <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-500/10 border border-red-500/20"><Trash2 size={28} className="text-red-400" /></div></div>
              <h2 className="text-white text-xl font-semibold mb-2 text-center">Confirm Deletion</h2>
              <p className="text-center text-sm text-gray-400 mb-8 px-2">Erase <strong className="text-white">{filesToDelete.length} item(s)</strong> permanently?</p>
              <div className="flex gap-3"><button onClick={() => setFilesToDelete([])} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3.5 rounded-xl font-semibold transition-colors mac-click">Cancel</button><button onClick={confirmBatchDelete} className="flex-1 bg-red-500 hover:bg-red-400 text-white py-3.5 rounded-xl font-semibold transition-all mac-click">Delete</button></div>
            </div>
          </div>
        )}

        {/* iMESSAGE STYLE CHAT ENGINE */}
        <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end transition-all`}>
          <div className={`mac-glass-dark rounded-[24px] w-[340px] sm:w-[380px] mb-4 shadow-2xl transition-all duration-300 origin-bottom-right flex flex-col overflow-hidden ${isChatOpen ? 'h-[480px] opacity-100 scale-100' : 'h-0 opacity-0 scale-95 pointer-events-none'}`}>
            <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0 bg-white/5">
               <div className="flex items-center gap-2"><div className="p-1.5 rounded-full bg-white/10 text-white"><MessageSquare size={14} /></div><span className="text-[13px] font-semibold text-white">{activeRoom} Comm-Link</span></div>
               <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white transition-colors p-1.5 bg-white/5 rounded-full mac-click"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/20" ref={chatScrollRef}>
              {roomMessages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs text-center px-4 space-y-2"><p>Encrypted channel open.</p></div> : roomMessages.map((msg, idx) => {
                  const isMe = msg.sender === displayUsername; const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (<div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-file-drop`}><span className="text-[9px] text-gray-500 mb-1 px-1">{isMe ? 'You' : msg.sender} • {time}</span><div className={`px-4 py-2.5 max-w-[80%] text-[13px] leading-relaxed ${isMe ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm' : 'bg-white/10 text-gray-200 border border-white/5 rounded-2xl rounded-bl-sm'}`}>{msg.text}</div></div>);
              })}
            </div>
            <form onSubmit={handleSendMessage} className="p-3 bg-white/5 border-t border-white/5 shrink-0 flex gap-2">
               <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="iMessage..." className="flex-1 bg-black/40 border border-white/10 text-white text-[13px] rounded-full px-4 py-2 focus:outline-none focus:border-white/30 transition-colors placeholder:text-gray-500" />
               <button type="submit" disabled={!chatMessage.trim()} className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-500 transition-all disabled:opacity-50 mac-click flex items-center justify-center"><Send size={14} className="-ml-0.5" /></button>
            </form>
          </div>
          {isNameSet && isOnline && <button onClick={() => setIsChatOpen(!isChatOpen)} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 mac-click backdrop-blur-xl border ${isChatOpen ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-white text-black hover:scale-105'}`}>{isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}</button>}
        </div>
      </main>
    </div>
  );
};

export default App;