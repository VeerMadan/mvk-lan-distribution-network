import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Activity, X, Download, Trash2, MessageSquare, Send, FolderPlus, Share2, Users, Sun, Moon, Menu, ChevronRight } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from 'axios';

// Component Imports
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';

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
const playError = () => { playTone(200, 'square', 0.1, 0.05); setTimeout(() => playTone(150, 'square', 0.2, 0.05), 100); };

const App = () => {
  // --- CORE SYSTEM STATE ---
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [username, setUsername] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [authStep, setAuthStep] = useState<'name' | 'setup_pin' | 'challenge'>('name');
  const [authPin, setAuthPin] = useState('');
  const [pinErrorText, setPinErrorText] = useState('');
  
  // --- VAULT DATA STATE ---
  const [activeRoom, setActiveRoom] = useState('General');
  const [isOnline, setIsOnline] = useState(false);
  const [roomItems, setRoomItems] = useState<any[]>([]); 
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  
  // --- UI & MODAL STATE ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingRoom, setPendingRoom] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [customAlert, setCustomAlert] = useState<{title: string, msg: string} | null>(null);
  const [adminAuthModal, setAdminAuthModal] = useState(false);
  const [pendingAdminName, setPendingAdminName] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderTarget, setNewFolderTarget] = useState('Everyone');
  
  // --- UPLOAD & FILE OPERATIONS ---
  const [isDragging, setIsDragging] = useState(false);
  const [stagingFiles, setStagingFiles] = useState<File[]>([]);
  const [stagedTarget, setStagedTarget] = useState<string>('Everyone');
  const [stagedExpiry, setStagedExpiry] = useState<number>(24);
  const [networkUploads, setNetworkUploads] = useState<Record<string, {user: string, progress: number, fileName: string}>>({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{url: string, name: string, type: 'image' | 'pdf' | 'video'} | null>(null);
  const [filesToDelete, setFilesToDelete] = useState<string[]>([]);
  const [deletingItemIds, setDeletingItemIds] = useState<string[]>([]);
  const [contextMenu, setContextMenu] = useState<{show: boolean, x: number, y: number, file: any | null}>({show: false, x: 0, y: 0, file: null});

  // --- COMM-LINK ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [roomMessages, setRoomMessages] = useState<any[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  
  const [storageUsed, setStorageUsed] = useState(0); 
  const STORAGE_LIMIT = 100; 
  const [hasUpdate, setHasUpdate] = useState(false);
  const [commitsBehind, setCommitsBehind] = useState(0); 
  const [showCredits, setShowCredits] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const displayUsername = username;
  const isAdminSession = displayUsername === 'SYSTEM ADMIN' || displayUsername.toLowerCase() === 'veer_dev';

  const rooms = [
    { name: 'General', icon: <Share2 size={18} />, locked: false },
    { name: 'Digital Team', icon: <Activity size={18} />, locked: true },
    { name: 'Sales & Mktg', icon: <Users size={18} />, locked: true },
    { name: 'Admin Only', icon: <ShieldCheck size={18} />, locked: true },
  ];

  // Dark Mode Engine
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) playClick();
      setContextMenu(prev => ({...prev, show: false})); 
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  useEffect(() => {
    let id = localStorage.getItem('mvk_device_id');
    if (!id) { id = Math.random().toString(36).substring(2, 15); localStorage.setItem('mvk_device_id', id); }
    setDeviceId(id);
  }, []);

  // --- AUTHENTICATION API ---
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

      if (res.data.status === 'challenge') { setIsConnecting(false); setAuthStep('challenge'); playError(); } 
      else if (res.data.requiresPinSetup) { setIsConnecting(false); setAuthStep('setup_pin'); playSuccess(); } 
      else { playSuccess(); socket.auth = { username: resolvedName }; socket.connect(); }
    } catch (err: any) { 
      setIsConnecting(false); 
      setCustomAlert({title: 'Clearance Denied', msg: err.response?.data?.error || "Network connection failed."});
      playError();
    }
  };

  const executeAdminLogin = async () => {
    setIsConnecting(true);
    try {
      const res = await axios.post(`${SERVER_URL}/api/auth/pin`, { username: pendingAdminName, pin: adminPinInput, action: 'verify' });
      if (res.data.status === 'success') {
        setAdminAuthModal(false); playSuccess(); socket.auth = { username: pendingAdminName }; socket.connect();
      }
    } catch (err: any) {
      setIsConnecting(false); playError(); setAdminAuthModal(false);
      setCustomAlert({title: 'SYSTEM BREACH DETECTED', msg: err.response?.data?.error || 'Invalid Admin Protocol'});
      setUsername(''); setAdminPinInput('');
    }
  };

  const submitAuthPin = async (action: 'setup' | 'verify') => {
    if (authPin.length !== 4) return;
    setIsConnecting(true); setPinErrorText('');
    try {
      const res = await axios.post(`${SERVER_URL}/api/auth/pin`, { username, deviceId, pin: authPin, action });
      if (res.data.status === 'success') { playSuccess(); socket.auth = { username }; socket.connect(); }
    } catch (err) {
      setIsConnecting(false); setAuthPin(''); setPinErrorText('Incorrect PIN. Intrusion logged.'); playError();
    }
  };

  const attemptRoomJoin = (targetRoom: string) => {
    if (targetRoom === activeRoom) { setIsMobileMenuOpen(false); return; }
    if (ROOM_PINS[targetRoom] && !isAdminSession) { setPendingRoom(targetRoom); setShowPinModal(true); setIsMobileMenuOpen(false); return; }
    setActiveRoom(targetRoom); setSearchQuery(''); setIsMobileMenuOpen(false); setSelectedFiles([]);
  };

  const submitPin = (instantPin?: string) => {
    const pinToTest = typeof instantPin === 'string' ? instantPin : pinInput;
    if (pinToTest === ROOM_PINS[pendingRoom]) {
      setPinError(''); playSuccess();
      setActiveRoom(pendingRoom); setSearchQuery(''); setCurrentFolderId(null);
      setShowPinModal(false); setPinInput('');
    } else { 
      const errorRoasts = [
        "Hold up, hacker man. Wrong PIN.", "Access Denied. The Beast Server rejects your offering.",
        "Error 403: Did you type that with your elbows?", "Nice try. Are you sure you work here?",
        "Invalid PIN. The cyber police have been notified... jk, try again.", "How dumb you can be, can't you even guess a 4-digit code? Pathetic.",
        "My grandmother types faster and guesses better than you.", "Are you randomly hitting the numpad? Focus.",
        "Security alert triggered. Initiating self-destruct... 3... 2... kidding. Try again.", "Did you forget your PIN or did the PIN forget you?",
        "4 digits. FOUR. You had one job.", "I've seen monkeys solve puzzles faster. Just saying."
      ];
      setPinError(errorRoasts[Math.floor(Math.random() * errorRoasts.length)]); 
      setPinInput(''); playError(); 
    }
  };

  // --- SOCKET SYNC ---
  useEffect(() => {
    axios.get(`${SERVER_URL}/api/storage`).then(res => setStorageUsed(res.data.storageUsed)).catch(() => {});
    axios.get(`${SERVER_URL}/api/check-updates`).then(res => { if (res.data.updateAvailable) { setHasUpdate(true); setCommitsBehind(res.data.commits); } }).catch(() => {});

    const onConnect = () => { setIsOnline(true); setIsConnecting(false); setIsNameSet(true); };
    socket.on('connect', onConnect); socket.on('disconnect', () => setIsOnline(false));

    socket.on('incoming-transfer', (data) => {
       setRoomItems((prev) => {
         if (data.room !== activeRoom) return prev;
         if (prev.some(f => (f.downloadUrl && f.downloadUrl === data.downloadUrl) || (f.isFolder && f.id === data.id))) return prev;
         return [data, ...prev];
       });
       axios.get(`${SERVER_URL}/api/storage`).then(res => setStorageUsed(res.data.storageUsed));
    });
    
    socket.on('force-db-sync', (freshHistory) => {
      const validRoomItems = freshHistory.filter((f: any) => f.room === activeRoom && (!f.targetRecipient || f.targetRecipient === 'Everyone' || f.targetRecipient === displayUsername || f.sender === displayUsername));
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
      socket.off('connect'); socket.off('disconnect'); socket.off('incoming-transfer'); socket.off('force-db-sync'); socket.off('storage-update'); socket.off('file-deleted'); socket.off('chat-history'); socket.off('new-chat-message'); socket.off('room-users-update'); socket.off('network-upload-progress'); socket.off('network-upload-complete');
    };
  }, [activeRoom, username, displayUsername]);

  useEffect(() => {
    if (isOnline && isNameSet) { setRoomItems([]); setRoomMessages([]); setSelectedFiles([]); socket.emit('join-department', { room: activeRoom, username: displayUsername }); socket.emit('request-master-sync'); }
  }, [activeRoom, isOnline, isNameSet, displayUsername]);

  // --- ACTIONS ---
  const triggerDownload = (e: React.MouseEvent, url: string, fileName: string) => {
    e.preventDefault(); e.stopPropagation();
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.target = '_blank'; 
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleCopyLink = (url: string) => {
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url);
    else {
      const textArea = document.createElement("textarea"); textArea.value = url;
      textArea.style.position = "fixed"; textArea.style.left = "-999999px"; document.body.appendChild(textArea); textArea.focus(); textArea.select();
      try { document.execCommand('copy'); } catch (err) {} document.body.removeChild(textArea);
    }
    showToast('Link Copied to Clipboard!');
  };

  const showToast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3000); };

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
    setStagingFiles([]); setStagedTarget('Everyone'); setStagedExpiry(24);

    let targetParentId = currentFolderId;
    if (isFolderUpload) {
      const newFolderId = Math.random().toString(36).substring(7);
      socket.emit('create-folder', { id: newFolderId, folderName: autoFolderName, room: activeRoom, sender: displayUsername, parentId: currentFolderId, targetRecipient: stagedTarget });
      targetParentId = newFolderId; 
    }

    let successCount = 0;
    for (let i = 0; i < filesToUpload.length; i++) {
      const formData = new FormData();
      formData.append('room', activeRoom); formData.append('sender', displayUsername); formData.append('targetRecipient', stagedTarget); formData.append('expiryHours', stagedExpiry.toString()); formData.append('parentId', targetParentId || 'null'); formData.append('file', filesToUpload[i]);
      const uploadId = Math.random().toString(36).substring(7);

      try {
        const res = await axios.post(`${SERVER_URL}/api/upload`, formData, {
          onUploadProgress: (e) => {
            const p = Math.round(((i * 100) + Math.round((e.loaded * 100) / (e.total || 1))) / filesToUpload.length);
            setUploadProgress(p); socket.emit('upload-progress', { room: activeRoom, id: uploadId, user: displayUsername, progress: p, fileName: filesToUpload[i].name });
          }
        });
        socket.emit('file-ready', res.data); socket.emit('upload-complete', { room: activeRoom, id: uploadId });
        setRoomItems(prev => [res.data, ...prev]); successCount++;
      } catch (error) { socket.emit('upload-complete', { room: activeRoom, id: uploadId }); playError(); }
    }
    setUploadProgress(0); 
    if (successCount > 0) { playSuccess(); socket.emit('trigger-global-sync'); }
  };

  const confirmBatchDelete = () => {
    if (filesToDelete.length === 0) return;
    setDeletingItemIds(filesToDelete);
    setTimeout(async () => {
      try {
        await axios.post(`${SERVER_URL}/api/files/delete`, { targets: filesToDelete, requester: displayUsername, isAdmin: isAdminSession });
        showToast(`Purged ${filesToDelete.length} Assets.`); setFilesToDelete([]); setSelectedFiles([]); setDeletingItemIds([]);
      } catch (error) { playError(); setDeletingItemIds([]); }
    }, 600); 
  };

  const getBreadcrumbs = () => {
    const crumbs = []; let curr = currentFolderId;
    while (curr) {
      const folder = roomItems.find(f => f.savedAs === curr && f.isFolder);
      if (folder) { crumbs.unshift(folder); curr = folder.parentId; } else { break; }
    }
    return crumbs;
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
      showToast('Batch Archive Extracted Successfully');
      setSelectedFiles([]); 
    } catch (error) {
      playError(); showToast('Error generating archive');
    } finally {
      setIsBatchDownloading(false);
    }
  };

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

  const openContextMenu = (e: React.MouseEvent, item: any) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ show: true, x: e.pageX, y: e.pageY, file: item });
  };

  const toggleFileSelection = (e: React.MouseEvent, savedAs: string) => {
    e.stopPropagation();
    setSelectedFiles(prev => prev.includes(savedAs) ? prev.filter(id => id !== savedAs) : [...prev, savedAs]);
  };

  const checkPreviewable = (fileName: string) => {
    if(!fileName) return false;
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mov'].includes(fileName.split('.').pop()?.toLowerCase() || '');
  };

  const promptDelete = (identifier: string) => { 
    setFilesToDelete([identifier]); 
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    socket.emit('send-chat-message', { room: activeRoom, sender: displayUsername, text: chatMessage });
    setChatMessage('');
  };

  const openPreview = (file: any) => {
    const ext = file.fileName.toLowerCase().split('.').pop();
    let type: 'image' | 'pdf' | 'video' = 'image';
    if (ext === 'pdf') type = 'pdf';
    if (['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
    setPreviewFile({ url: `${SERVER_URL}/preview/${encodeURIComponent(file.savedAs || file.fileName)}`, name: file.fileName, type });
  };

  // --- RENDER LOGIN PORTAL ---
  if (!isNameSet) {
    return (
      <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 items-center justify-center font-sans relative overflow-hidden transition-colors">
        
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
           <div className={`absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[140px] opacity-20 bg-blue-500`}></div>
           <div className={`absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] opacity-[0.15] bg-indigo-500`}></div>
        </div>
        
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="glass-card p-8 sm:p-10 rounded-[2.5rem] text-center w-11/12 max-w-sm relative z-10 shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50">
          {authStep === 'name' && (
            <form onSubmit={handleNameLogin} className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-inner">
                <ShieldCheck size={28} className="text-blue-500" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">MVK Vault</h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-8">Sign in to access the network</p>

              <input type="text" autoFocus placeholder="Identity Tag" className="w-full bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all mb-4 text-center font-semibold placeholder:text-zinc-400" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isConnecting} />
              <button type="submit" disabled={isConnecting || !username.trim()} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 mt-2 flex justify-center items-center gap-2">
                {isConnecting ? <Activity size={18} className="animate-spin" /> : 'Continue'}
              </button>
            </form>
          )}

          {authStep === 'setup_pin' && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-inner">
                 <Lock size={28} className="text-blue-500" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">Create PIN</h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 font-medium">Secure your device session.</p>

              <input type="password" maxLength={4} autoFocus placeholder="••••" className="w-full bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all mb-6 text-center text-2xl tracking-[0.5em] font-mono" value={authPin} onChange={(e) => { const val = e.target.value; setAuthPin(val); if (val.length === 4) submitAuthPin('setup'); }} disabled={isConnecting} />
              <button onClick={() => submitAuthPin('setup')} disabled={authPin.length !== 4 || isConnecting} className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">Save PIN</button>
            </div>
          )}

          {authStep === 'challenge' && (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 border border-red-500/20 shadow-inner">
                 <Lock size={28} className="text-red-500" />
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">Enter PIN</h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-4">Unlock <span className="text-zinc-800 dark:text-zinc-200">{username}</span></p>
              <p className="text-red-500 text-xs font-semibold h-4 mb-4">{pinErrorText}</p>

              <input type="password" maxLength={4} autoFocus placeholder="••••" className={`w-full bg-zinc-100/80 dark:bg-zinc-800/80 border text-zinc-900 dark:text-zinc-100 px-4 py-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all mb-6 text-center text-2xl tracking-[0.5em] font-mono ${pinErrorText ? 'border-red-500/50' : 'border-zinc-200 dark:border-zinc-700'}`} value={authPin} onChange={(e) => { setAuthPin(e.target.value); setPinErrorText(''); }} onKeyDown={(e) => e.key === 'Enter' && submitAuthPin('verify')} disabled={isConnecting} />
              
              <div className="flex gap-3 w-full">
                <button onClick={() => { setAuthStep('name'); setUsername(''); setAuthPin(''); setPinErrorText(''); }} className="flex-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-3.5 rounded-xl transition-all active:scale-95">Cancel</button>
                <button onClick={() => submitAuthPin('verify')} disabled={authPin.length !== 4 || isConnecting} className="flex-1 bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50">Unlock</button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Custom Alerts */}
        <AnimatePresence>
          {customAlert && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] px-4 backdrop-blur-md">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="glass-card p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl border border-red-500/30">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-500/30"><ShieldCheck size={28} className="text-red-500" /></div>
                <h2 className="text-zinc-900 dark:text-white text-xl font-bold mb-2">{customAlert.title}</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6 font-medium">{customAlert.msg}</p>
                <button onClick={() => setCustomAlert(null)} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95">Acknowledge</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Admin Override Modal */}
        <AnimatePresence>
          {adminAuthModal && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] px-4 backdrop-blur-md">
              <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="glass-card p-8 rounded-[2rem] w-full max-w-sm text-center shadow-2xl border border-blue-500/30">
                <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/30"><Lock size={28} className="text-blue-500" /></div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">System Override</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 font-medium">Authenticate as Admin</p>

                <input type="password" autoFocus className="w-full bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3.5 mb-6 text-center text-sm outline-none placeholder-zinc-400 font-mono focus:ring-2 focus:ring-blue-500/50" placeholder="Master Password" value={adminPinInput} onChange={(e) => setAdminPinInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeAdminLogin()} />
                <div className="flex gap-3 w-full">
                  <button onClick={() => {setAdminAuthModal(false); setUsername(''); setAdminPinInput('');}} className="flex-1 bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold py-3.5 rounded-xl transition-all active:scale-95">Cancel</button>
                  <button onClick={executeAdminLogin} disabled={!adminPinInput || isConnecting} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all active:scale-95">Verify</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // --- RENDER MAIN APPLICATION ---
  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors antialiased overflow-hidden selection:bg-blue-500 selection:text-white" onDrop={(e) => storageUsed < STORAGE_LIMIT && (e.preventDefault(), setIsDragging(false), e.dataTransfer.files.length > 0 && setStagingFiles(Array.from(e.dataTransfer.files)))} onDragOver={(e) => (e.preventDefault(), setIsDragging(true))} onDragLeave={(e) => (!e.currentTarget.contains(e.relatedTarget as Node) && setIsDragging(false))}>
      
      {/* Ambient iOS Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full blur-[140px] opacity-20 bg-blue-500"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-[150px] opacity-[0.10] bg-indigo-500"></div>
      </div>

      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.95 }} className="fixed top-6 right-6 z-[9999] bg-zinc-900/90 dark:bg-zinc-100/90 text-white dark:text-zinc-900 px-5 py-3.5 rounded-2xl shadow-2xl border border-zinc-700 dark:border-zinc-300 backdrop-blur-xl flex items-center space-x-3 text-xs font-bold">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
        activeRoom={activeRoom} attemptRoomJoin={attemptRoomJoin} rooms={rooms}
        storageUsed={storageUsed} STORAGE_LIMIT={STORAGE_LIMIT}
        hasUpdate={hasUpdate} commitsBehind={commitsBehind}
        setShowCredits={setShowCredits} displayUsername={displayUsername}
      />

      <main className="flex-1 flex flex-col relative w-full overflow-hidden z-10">
        
        {/* iOS Style Floating Header */}
        <header className="shrink-0 mt-4 mx-4 md:mx-8 z-20">
          <div className="glass-pill border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4 w-full">
              <button className="md:hidden text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors" onClick={() => setIsMobileMenuOpen(true)}><Menu size={20} /></button>
              <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide py-1 w-full">
                 <span onClick={() => setCurrentFolderId(null)} className={`text-[13px] font-bold cursor-pointer transition-all ${!currentFolderId ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}>{activeRoom}</span>
                 {getBreadcrumbs().map((crumb, idx, arr) => (
                   <div key={crumb.savedAs} className="flex items-center gap-2">
                     <ChevronRight size={14} className="text-zinc-400" />
                     <span onClick={() => setCurrentFolderId(crumb.savedAs)} className={`text-[13px] font-bold cursor-pointer transition-all max-w-[100px] sm:max-w-[150px] truncate ${idx === arr.length - 1 ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'}`}>{crumb.fileName}</span>
                   </div>
                 ))}
              </div>
            </div>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl bg-zinc-200/50 dark:bg-zinc-800/50 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 transition-all ml-4">
              {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        <Dashboard 
          activeRoom={activeRoom} activeUsers={activeUsers} displayUsername={displayUsername} isAdminSession={isAdminSession}
          roomItems={roomItems} currentFolderId={currentFolderId} setCurrentFolderId={setCurrentFolderId}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} viewMode={viewMode} setViewMode={setViewMode}
          selectedFiles={selectedFiles} setSelectedFiles={setSelectedFiles} networkUploads={networkUploads} uploadProgress={uploadProgress}
          deletingItemIds={deletingItemIds} handleBatchDownload={handleBatchDownload} promptBatchDelete={promptBatchDelete} isBatchDownloading={isBatchDownloading}
          openContextMenu={openContextMenu} toggleFileSelection={toggleFileSelection} checkPreviewable={checkPreviewable} openPreview={openPreview}
          triggerDownload={triggerDownload} handleCopyLink={handleCopyLink} promptDelete={promptDelete} handleExtendExpiry={(f: any) => {socket.emit('extend-expiry', { identifier: f.savedAs || f.fileName, isFolder: f.isFolder, addedHours: 24 }); showToast(`Extended ${f.fileName}`); setContextMenu({ show: false, x: 0, y: 0, file: null });}}
          setShowFolderModal={setShowFolderModal} storageUsed={storageUsed} STORAGE_LIMIT={STORAGE_LIMIT}
          fileInputRef={fileInputRef} folderInputRef={folderInputRef} handleFileSelect={(e: React.ChangeEvent<HTMLInputElement>) => {if (e.target.files && e.target.files.length > 0) setStagingFiles(Array.from(e.target.files)); if (fileInputRef.current) fileInputRef.current.value = ''; if (folderInputRef.current) folderInputRef.current.value = '';}}
        />
      </main>

      {/* --- GLOBAL MODALS & OVERLAYS --- */}

      <AnimatePresence>
        {isDragging && storageUsed < STORAGE_LIMIT && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[500] bg-blue-500/10 border-2 border-blue-500/50 rounded-2xl flex items-center justify-center backdrop-blur-sm pointer-events-none">
             <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="glass-card px-10 py-8 rounded-[2rem] text-center shadow-2xl flex flex-col items-center">
               <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-4"><Download className="text-blue-500 w-8 h-8 animate-bounce" /></div>
               <h2 className="text-2xl font-extrabold text-zinc-900 dark:text-white tracking-tight mb-1">Drop Files Here</h2>
               <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">Release to stage uploads</p>
             </motion.div>
          </motion.div>
        )}

        {showPinModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] px-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="glass-card p-8 rounded-[2rem] w-full max-w-sm shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50">
              <div className="flex justify-center mb-4"><div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"><Lock size={28} className="text-zinc-700 dark:text-zinc-300" /></div></div>
              <h2 className="text-zinc-900 dark:text-white text-xl font-bold mb-1 text-center">Restricted Area</h2>
              <p className="text-center text-sm font-medium h-12 flex items-center justify-center px-2">{pinError ? <span className="text-red-500">{pinError}</span> : <span className="text-zinc-500 dark:text-zinc-400">Enter PIN for {pendingRoom}</span>}</p>
              <input type="password" maxLength={4} value={pinInput} onChange={(e) => { const val = e.target.value; setPinInput(val); if (pinError) setPinError(''); if (val.length === 4) submitPin(val); }} onKeyDown={(e) => e.key === 'Enter' && submitPin()} className={`w-full bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-900 dark:text-white border ${pinError ? 'border-red-500/50' : 'border-zinc-200 dark:border-zinc-700'} rounded-xl px-4 py-3.5 mt-2 mb-6 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-center tracking-[0.5em] text-2xl shadow-inner font-mono`} placeholder="••••" autoFocus />
              <div className="flex gap-3"><button onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }} className="flex-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-3.5 rounded-xl font-bold transition-colors active:scale-95">Cancel</button><button onClick={() => submitPin()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-bold transition-all active:scale-95">Authorize</button></div>
            </motion.div>
          </motion.div>
        )}

        {showFolderModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-[700] px-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="glass-card p-8 rounded-[2rem] w-full max-w-sm shadow-2xl border border-zinc-200/50 dark:border-zinc-800/50">
              <div className="flex items-center gap-3 mb-6"><div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl"><FolderPlus size={20} className="text-blue-500"/></div><h2 className="text-zinc-900 dark:text-white text-xl font-extrabold tracking-tight">New Folder</h2></div>
              <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder Name..." className="w-full bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3.5 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 transition-all mb-4 text-sm font-semibold placeholder:text-zinc-400" autoFocus />
              <select value={newFolderTarget} onChange={(e) => setNewFolderTarget(e.target.value)} className="w-full bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white px-4 py-3.5 rounded-xl outline-none mb-8 text-sm font-semibold appearance-none">
                <option value="Everyone">Visible to: Everyone</option>
                {activeUsers.filter(u => u.username !== displayUsername).map(u => <option key={u.id} value={u.username}>Private to: {u.username}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowFolderModal(false)} className="flex-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-3.5 rounded-xl font-bold transition-colors active:scale-95">Cancel</button>
                <button onClick={handleCreateFolder} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-all active:scale-95">Create</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {stagingFiles.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[600] bg-black/60 flex items-center justify-center backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="glass-card rounded-[2rem] w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50">
              <div className="bg-zinc-100/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 p-6 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                  <div className="bg-blue-600 text-white p-3 rounded-2xl shadow-sm"><Activity size={20} /></div>
                  <div>
                    <h2 className="text-zinc-900 dark:text-white text-lg font-bold tracking-tight leading-tight">Stage Upload</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 text-xs font-semibold">{stagingFiles.length > 0 && !!stagingFiles[0].webkitRelativePath ? `Directory: ${stagingFiles[0].webkitRelativePath.split('/')[0]}` : `${stagingFiles.length} file(s) ready`}</p>
                  </div>
                </div>
                <button onClick={() => setStagingFiles([])} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 p-2 rounded-full transition-colors active:scale-95"><X size={20} /></button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-8 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div>
                  <h3 className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-2">1. Secure Target</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <button onClick={() => setStagedTarget('Everyone')} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border active:scale-95 ${stagedTarget === 'Everyone' ? 'bg-blue-600 text-white border-transparent shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}><Share2 size={20} /><span className="font-bold text-xs">Everyone</span></button>
                    {activeUsers.filter(u => u.username !== displayUsername).map(u => (
                      <button key={u.id} onClick={() => setStagedTarget(u.username)} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all border active:scale-95 ${stagedTarget === u.username ? 'bg-blue-600 text-white border-transparent shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}><Lock size={20} /><span className="font-bold text-xs truncate w-full text-center">{u.username}</span></button>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider mb-3 flex items-center gap-2">2. Expiration Timer</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 12, 24, 168].map(hours => (
                      <button key={hours} onClick={() => setStagedExpiry(hours)} className={`py-4 px-2 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border active:scale-95 ${stagedExpiry === hours ? 'bg-blue-600 text-white border-transparent shadow-md' : 'bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700'}`}><span className="font-bold text-xs">{hours === 168 ? '7 Days' : `${hours}h`}</span></button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-zinc-100/50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 shrink-0 flex gap-4">
                 <button onClick={() => setStagingFiles([])} className="flex-1 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold py-4 rounded-2xl transition-colors active:scale-95">Cancel</button>
                 <button onClick={executeStagedUploads} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"><Send size={18} /> Upload Now</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {filesToDelete.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 flex items-center justify-center z-[250] px-4 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} className="glass-card p-8 rounded-[2rem] w-full max-w-sm shadow-2xl border border-red-500/20">
              <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-500/10 border border-red-500/20"><Trash2 size={28} className="text-red-500" /></div></div>
              <h2 className="text-zinc-900 dark:text-white text-xl font-bold mb-2 text-center">Confirm Deletion</h2>
              <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-8 font-medium">Erase <strong className="text-zinc-900 dark:text-white">{filesToDelete.length} item(s)</strong> permanently?</p>
              <div className="flex gap-3"><button onClick={() => setFilesToDelete([])} className="flex-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-3.5 rounded-xl font-bold transition-colors active:scale-95">Cancel</button><button onClick={confirmBatchDelete} className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3.5 rounded-xl font-bold transition-all active:scale-95">Delete</button></div>
            </motion.div>
          </motion.div>
        )}
        
        {/* RIGHT CLICK CONTEXT MENU */}
        {contextMenu.show && contextMenu.file && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="fixed z-[1000] w-56 glass-card border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl shadow-2xl overflow-hidden py-2" style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 250) }}>
            <div className="px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 mb-2"><p className="text-xs font-bold text-zinc-900 dark:text-white truncate w-full">{contextMenu.file.fileName}</p></div>
            {contextMenu.file.isFolder ? (
              <button onClick={() => setCurrentFolderId(contextMenu.file.savedAs)} className="w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-3 transition-colors"><FolderPlus size={16} /> Open Folder</button>
            ) : (
              <>
                <button onClick={(e) => triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(contextMenu.file.savedAs || contextMenu.file.fileName)}`, contextMenu.file.fileName)} className="w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-3 transition-colors"><Download size={16} /> Download</button>
                <button onClick={() => handleCopyLink(`${SERVER_URL}/download/${encodeURIComponent(contextMenu.file.savedAs || contextMenu.file.fileName)}`)} className="w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-blue-500/10 hover:text-blue-500 flex items-center gap-3 transition-colors"><Share2 size={16} /> Copy Link</button>
              </>
            )}
            {(contextMenu.file.sender === displayUsername || isAdminSession) && (
              <>
                <div className="my-1 border-t border-zinc-200 dark:border-zinc-800"></div>
                <button onClick={() => { socket.emit('extend-expiry', { identifier: contextMenu.file.savedAs || contextMenu.file.fileName, isFolder: contextMenu.file.isFolder, addedHours: 24 }); showToast('Extended 24h'); setContextMenu({ show: false, x: 0, y: 0, file: null }); }} className="w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-green-500/10 hover:text-green-500 flex items-center gap-3 transition-colors">
                  <Clock size={16} /> Extend 24h
                </button>
                <button onClick={() => promptDelete(contextMenu.file.savedAs || contextMenu.file.fileName)} className="w-full text-left px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-red-500/10 hover:text-red-500 flex items-center gap-3 transition-colors"><Trash2 size={16} /> Delete</button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* iMESSAGE STYLE FLOATING CHAT */}
      <div className={`fixed bottom-[100px] md:bottom-6 right-6 z-40 flex flex-col items-end transition-all duration-500`}>
        <div className={`glass-card rounded-[24px] w-[340px] sm:w-[380px] mb-4 shadow-2xl transition-all duration-300 origin-bottom-right flex flex-col overflow-hidden border border-zinc-200/50 dark:border-zinc-800/50 ${isChatOpen ? 'h-[480px] opacity-100 scale-100' : 'h-0 opacity-0 scale-95 pointer-events-none'}`}>
          <div className="h-16 bg-zinc-100/50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-5 shrink-0">
             <div className="flex items-center gap-3"><div className="p-2 rounded-xl bg-blue-600 text-white shadow-sm"><MessageSquare size={16} /></div><span className="text-sm font-bold text-zinc-900 dark:text-white">{activeRoom} Comm-Link</span></div>
             <button onClick={() => setIsChatOpen(false)} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 p-2 rounded-full transition-colors active:scale-95"><X size={16} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-5" ref={chatScrollRef}>
            {roomMessages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-400 text-xs text-center px-4 space-y-3"><Activity size={24} className="opacity-50" /><p className="font-medium">Encrypted channel open.<br/>Waiting for transmissions...</p></div> : roomMessages.map((msg, idx) => {
                const isMe = msg.sender === displayUsername; const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (<div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-file-drop`}><span className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1.5 px-1 font-semibold">{isMe ? 'You' : msg.sender} • {time}</span><div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-[13px] shadow-sm leading-relaxed font-medium ${isMe ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-bl-sm'}`}>{msg.text}</div></div>);
            })}
          </div>
          <form onSubmit={handleSendMessage} className="p-4 bg-zinc-100/50 dark:bg-zinc-800/50 border-t border-zinc-200 dark:border-zinc-800 shrink-0 flex gap-3">
             <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="iMessage..." className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white text-sm rounded-full px-5 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner placeholder-zinc-400 font-medium" />
             <button type="submit" disabled={!chatMessage.trim()} className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-all disabled:opacity-50 active:scale-95 shadow-md flex items-center justify-center"><Send size={16} className="-ml-0.5" /></button>
          </form>
        </div>
        <button onClick={() => setIsChatOpen(!isChatOpen)} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 active:scale-95 ${isChatOpen ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rotate-12' : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-[0_10px_30px_rgba(37,99,235,0.4)]'}`}>{isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}</button>
      </div>
    </div>
  );
};

export default App;