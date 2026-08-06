import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Activity, X, Download, Trash2, MessageSquare, Send, FolderPlus, Share2, Users, Sun, Moon, Menu, ChevronRight, Clock, HardDrive } from 'lucide-react';
import { io } from 'socket.io-client';
import axios from 'axios';

// Component Imports
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';

const SERVER_URL = 'https://192.168.88.50:3000'; 
// Or use 'https://server.mvk.in:3000'
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

// Motion presets
const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
const panelIn = { initial: { opacity: 0, y: 6, scale: 0.99 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, y: 6, scale: 0.99 }, transition: { duration: 0.16 } };

const App = () => {
  // ==========================================
  // 1. ALL STATE HOOKS
  // ==========================================
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [username, setUsername] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [authStep, setAuthStep] = useState<'name' | 'setup_pin' | 'challenge'>('name');
  const [authPin, setAuthPin] = useState('');
  const [pinErrorText, setPinErrorText] = useState('');

  const [activeRoom, setActiveRoom] = useState('General');
  const [allowedRooms, setAllowedRooms] = useState<string[]>([]); // 🚨 NEW MATRIX CLEARANCE STATE 🚨
  const [isOnline, setIsOnline] = useState(false);
  const [roomItems, setRoomItems] = useState<any[]>([]);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingRoom, setPendingRoom] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccessMsg, setPinSuccessMsg] = useState(''); // 🚨 ADDED SUCCESS MSG STATE 🚨
  const [customAlert, setCustomAlert] = useState<{title: string, msg: string} | null>(null);
  const [adminAuthModal, setAdminAuthModal] = useState(false);
  const [pendingAdminName, setPendingAdminName] = useState('');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderTarget, setNewFolderTarget] = useState('Everyone');

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

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [roomMessages, setRoomMessages] = useState<any[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [storageUsed, setStorageUsed] = useState(0);
  const STORAGE_LIMIT = 100;
  const [showCredits, setShowCredits] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const displayUsername = username;
  const isAdminSession = displayUsername === 'SYSTEM ADMIN' || displayUsername.toLowerCase() === 'veer_dev';

  const rooms = [
    { name: 'The Drive', icon: <HardDrive size={18} />, locked: false },
    { name: 'General', icon: <Share2 size={16} />, locked: false },
    { name: 'Digital Team', icon: <Activity size={16} />, locked: true },
    { name: 'Sales & Mktg', icon: <Users size={16} />, locked: true },
    { name: 'Admin Only', icon: <ShieldCheck size={16} />, locked: true },
  ];

  // ==========================================
  // 2. ALL EFFECT HOOKS (MUST BE ABOVE EARLY RETURNS)
  // ==========================================

  // URL Routing
  useEffect(() => {
    if (!isNameSet) return;
    const formattedRoom = activeRoom.toLowerCase().replace(/[^a-z0-9]/g, '-');
    let newUrl = `/${formattedRoom}`;
    if (currentFolderId) {
      const folderRecord = roomItems.find(f => f.savedAs === currentFolderId);
      if (folderRecord) {
        const formattedFolder = folderRecord.fileName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        newUrl += `/${formattedFolder}`;
      }
    }
    window.history.pushState({}, '', newUrl);
  }, [activeRoom, currentFolderId, roomItems, isNameSet]);

  // Dark Mode Engine
  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  // Global Clicks
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) playClick();
      setContextMenu(prev => ({...prev, show: false}));
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Device ID Engine
  useEffect(() => {
    let id = localStorage.getItem('mvk_device_id');
    if (!id) { id = Math.random().toString(36).substring(2, 15); localStorage.setItem('mvk_device_id', id); }
    setDeviceId(id);
  }, []);

  // Dedicated Security Kick Listener
  useEffect(() => {
    if (!displayUsername || !isNameSet) return; 
    
    const handleKick = (data: any) => {
      const currentActiveDevice = localStorage.getItem('mvk_device_id');
      if (data.username === displayUsername.toLowerCase() && data.activeDevice !== currentActiveDevice) {
         handleSignOut();
         setCustomAlert({
           title: 'Session Terminated', 
           msg: 'Your account was accessed from another device. This session has been terminated.'
         });
      }
    };
    socket.on('security-kick', handleKick);
    return () => { socket.off('security-kick', handleKick); };
  }, [displayUsername, isNameSet]);

  // Secure Asset Retrieval (Auto Download interceptor)
  useEffect(() => {
    if (!isNameSet || !isOnline) return;
    const urlParams = new URLSearchParams(window.location.search);
    const asset = urlParams.get('asset');
    
    if (asset) {
       const downloadUrl = `${SERVER_URL}/download/${encodeURIComponent(asset)}?user=${encodeURIComponent(displayUsername)}&device=${deviceId}`;
       const a = document.createElement('a');
       a.href = downloadUrl; a.download = asset; 
       document.body.appendChild(a); a.click(); document.body.removeChild(a);
       window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isNameSet, isOnline, displayUsername, deviceId]);

// Socket & Sync Engine
  useEffect(() => {
    // Only fetch storage if the UI is fully unlocked (prevents typing spam)
    if (isNameSet) {
       axios.get(`${SERVER_URL}/api/storage`).then(res => setStorageUsed(res.data.storageUsed)).catch(() => {});
    }

    const onConnect = () => { setIsOnline(true); setIsConnecting(false); setIsNameSet(true); };
    socket.on('connect', onConnect); 
    socket.on('disconnect', () => setIsOnline(false));

    socket.on('connect_error', (err) => {
       console.error("Socket Error:", err);
       setIsConnecting(false);
       setCustomAlert({ title: 'Tunnel Severed', msg: 'Failed to establish a secure WebSocket connection to Port 3000.' });
    });

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
// 🚨 CHAOS PROTOCOL LISTENER 🚨
    socket.on('execute-chaos', (data) => {
      if (data.target.toLowerCase() === displayUsername.toLowerCase()) {
        switch (data.payload) {
          case 'flip':
            document.body.style.transition = 'transform 1.5s ease-in-out';
            document.body.style.transform = 'rotate(180deg)';
            setTimeout(() => { document.body.style.transform = 'none'; }, 15000);
            break;
            
          case 'ghost':
            setChatMessage('I AM BEING WATCHED. THE VAULT IS ALIVE.');
            break;
            
        case 'rickroll':
            window.location.href = `${SERVER_URL}/chaos/rickroll`;
            break;
            
          case 'purge':
            // 🚨 FIX 2: Injects a pure HTML/CSS overlay directly into the DOM.
            // Bypasses React entirely so it works flawlessly on any screen.
            const purgeDiv = document.createElement('div');
            purgeDiv.style.position = 'fixed';
            purgeDiv.style.inset = '0';
            purgeDiv.style.backgroundColor = '#990000';
            purgeDiv.style.color = 'white';
            purgeDiv.style.zIndex = '999999';
            purgeDiv.style.display = 'flex';
            purgeDiv.style.flexDirection = 'column';
            purgeDiv.style.alignItems = 'center';
            purgeDiv.style.justifyContent = 'center';
            purgeDiv.style.fontFamily = 'monospace';
            purgeDiv.innerHTML = `
              <h1 style="font-size: 3rem; margin-bottom: 20px; font-weight: bold;">CRITICAL SYSTEM FAILURE</h1>
              <p style="font-size: 1.5rem; color: #ffcccc;">FATAL ERROR: OVERHEATING DETECTED.</p>
              <p style="font-size: 1.2rem; margin-top: 20px;">FORMATTING LOCAL DRIVE C:\\ TO PREVENT HARDWARE FIRE...</p>
              <p style="font-size: 1rem; margin-top: 10px; color: #ff9999;">DO NOT TURN OFF YOUR COMPUTER</p>
              <div style="width: 300px; height: 20px; border: 2px solid white; margin-top: 30px;">
                <div style="width: 0%; height: 100%; background: white; animation: fillBar 10s forwards linear;"></div>
              </div>
              <style>@keyframes fillBar { to { width: 100%; } }</style>
            `;
            document.body.appendChild(purgeDiv);
            
            // Remove the prank after 10 seconds so they can get back to work
            setTimeout(() => { document.body.removeChild(purgeDiv); }, 10000); 
            break;
        }
      }
    });
    if (socket.connected) onConnect();

    return () => {
      socket.off('connect'); socket.off('disconnect'); socket.off('connect_error'); socket.off('incoming-transfer'); socket.off('force-db-sync'); socket.off('storage-update'); socket.off('file-deleted'); socket.off('chat-history'); socket.off('new-chat-message'); socket.off('room-users-update'); socket.off('network-upload-progress'); socket.off('network-upload-complete'); socket.off('execute-chaos');
    };
  }, [activeRoom, displayUsername, isNameSet]);

  useEffect(() => {
    if (isOnline && isNameSet) { setRoomItems([]); setRoomMessages([]); setSelectedFiles([]); socket.emit('join-department', { room: activeRoom, username: displayUsername }); socket.emit('request-master-sync'); }
  }, [activeRoom, isOnline, isNameSet, displayUsername]);

  // ==========================================
  // 3. FUNCTIONS & METHODS
  // ==========================================

  const handleSignOut = () => {
    socket.disconnect(); setIsNameSet(false); setUsername(''); setAuthStep('name'); setAuthPin(''); setPinErrorText(''); setRoomItems([]); setRoomMessages([]);
  };

  const handleNameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = username.trim(); const attemptName = finalName.toLowerCase();
    if (['system admin', 'veer_dev', 'admin'].includes(attemptName)) { setPendingAdminName(finalName); setAdminAuthModal(true); return; }
    if (!finalName) return;

    setIsConnecting(true); setPinErrorText('');
    try {
      const res = await axios.post(`${SERVER_URL}/api/auth/check`, { username: finalName, deviceId });
      if (res.data.status === 'needs_tag') {
         setIsConnecting(false); setCustomAlert({title: 'Tag Required', msg: 'Multiple users share this name. Please enter your full tag (e.g. Name#1234).'}); return;
      }
      const resolvedName = res.data.resolvedName; setUsername(resolvedName);
      if (res.data.status === 'challenge') { setIsConnecting(false); setAuthStep('challenge'); playError(); }
      else if (res.data.requiresPinSetup) { setIsConnecting(false); setAuthStep('setup_pin'); playSuccess(); }
      else { playSuccess(); socket.auth = { username: resolvedName }; socket.connect(); }
    } catch (err: any) {
      setIsConnecting(false); setCustomAlert({title: 'Clearance Denied', msg: err.response?.data?.error || "Network connection failed."}); playError();
    }
  };

  const executeAdminLogin = async () => {
    setIsConnecting(true);
    try {
      const res = await axios.post(`${SERVER_URL}/api/auth/pin`, { username: pendingAdminName, pin: adminPinInput, action: 'verify' });
      if (res.data.status === 'success') { 
        setAdminAuthModal(false); 
        playSuccess(); 
        if (res.data.allowedRooms) setAllowedRooms(res.data.allowedRooms); // 🚨 SAVE ADMIN CLEARANCES 🚨
        socket.auth = { username: pendingAdminName }; 
        socket.connect(); 
      }
    } catch (err: any) {
      setIsConnecting(false); playError(); setAdminAuthModal(false); setCustomAlert({title: 'SYSTEM BREACH DETECTED', msg: err.response?.data?.error || 'Invalid Admin Protocol'}); setUsername(''); setAdminPinInput('');
    }
  };

  const submitAuthPin = async (action: 'setup' | 'verify') => {
    if (authPin.length !== 4) return;
    setIsConnecting(true); setPinErrorText('');
    try {
      const res = await axios.post(`${SERVER_URL}/api/auth/pin`, { username, deviceId, pin: authPin, action });
      if (res.data.status === 'success') { 
        playSuccess(); 
        if (res.data.allowedRooms) setAllowedRooms(res.data.allowedRooms); // 🚨 SAVE MATRIX CLEARANCES 🚨
        socket.auth = { username }; 
        socket.connect(); 
      }
    } catch (err) {
      setIsConnecting(false); setAuthPin(''); setPinErrorText('Incorrect PIN. Intrusion logged.'); playError();
    }
  };

  const attemptRoomJoin = (targetRoom: string) => {
    if (targetRoom === activeRoom) { setIsMobileMenuOpen(false); return; }
    
    // 🚨 ZERO-TRUST BYPASS: Check if user has specific room clearance or global admin clearance ('*') 🚨
    const hasClearance = allowedRooms.includes(targetRoom) || allowedRooms.includes('*');
    
    if (ROOM_PINS[targetRoom] && !isAdminSession && !hasClearance) { 
      setPendingRoom(targetRoom); setShowPinModal(true); setIsMobileMenuOpen(false); return; 
    }
    
    setActiveRoom(targetRoom); setSearchQuery(''); setIsMobileMenuOpen(false); setSelectedFiles([]); setCurrentFolderId(null); 
  };

  const submitPin = (instantPin?: string) => {
    const pinToTest = typeof instantPin === 'string' ? instantPin : pinInput;
    if (pinToTest === ROOM_PINS[pendingRoom]) {
     const successRoasts = [
  // Original Roasts
  "Access Granted. Even a broken clock is right twice a day.",
  "Wow, you actually remembered it. Proud of you.",
  "Correct. The server is shocked, but welcoming.",
  "PIN accepted. Who did you steal this from?",
  "Look at you, doing things right for once.",

  // Tech & AI Sarcasm
  "Access granted. I've lowered my standards just for you.",
  "Correct! Even a blind terminal finds a packet sometimes.",
  "PIN accepted. I'm updating my database to list you under 'miracles'.",
  "Success. Your brain cells finally formed a temporary alliance.",
  "Wow. The quantum probability of you getting that right was near zero.",
  "Congratulations, you defeated a 4-digit security wall. Grab a medal.",

  // Disappointed Authority Figure Energy
  "Correct. See? I knew you were capable of basic human tasks.",
  "PIN accepted. Don't get excited, it's a very low bar.",
  "Look at you, using that gray matter for once.",
  "Correct. Your high school math teacher would be utterly surprised.",
  "Success! I’m not mad, I’m just... shocked.",

  // Pure Attitude
  "Access granted. Try not to break anything while you're in here.",
  "Correct. Do you want a sticker or something?",
  "PIN accepted. Proceed, before your short-term memory wipes it again.",
  "You got it right. Somewhere, an angel just got its wings, and a developer lost a bet.",
  "Correct. Please hold your applause, it was pure luck.",

  // Fresh Additions: Absolute Disbelief
  "Correct! I honestly had the support team on speed dial for you.",
  "PIN accepted. Did you guess, or did a psychic help you?",
  "Unbelievable. You actually passed a cognitive test.",
  "Access granted. Let's pretend you knew it all along.",
  "Wow. The bar was on the floor, and you managed to step over it.",

  // Fresh Additions: Pop Culture & Gaming Vibes
  "PIN correct. Your luck stat must be maxed out today.",
  "Access granted. Achievement unlocked: Basic Competence.",
  "Correct. You may proceed to the next level of disappointing me.",
  "PIN accepted. Cheat code activated, apparently.",

  // Fresh Additions: Short & Snarky
  "Correct. Miracles do happen.",
  "PIN accepted. Shocking, truly.",
  "Access granted. Don't ruin the moment.",
  "Correct. A toddler could never... oh wait, they did.",
  "Success. Write it down before you forget it in 5 seconds."
];
      setPinError(''); 
      setPinSuccessMsg(successRoasts[Math.floor(Math.random() * successRoasts.length)]);
      playSuccess();
      
      // Delay so they can actually read the success roast
      setTimeout(() => {
        setActiveRoom(pendingRoom); setSearchQuery(''); setCurrentFolderId(null);
        setShowPinModal(false); setPinInput(''); setPinSuccessMsg('');
      }, 2000);
    } else {
       const errorRoasts = [
        "Hold up, hacker man. Wrong PIN.",
        "Access Denied. The Beast Server rejects your offering.",
        "Error 403: Did you type that with your elbows?",
        "Nice try. Are you sure you work here?",
        "Invalid PIN. The cyber police have been notified... jk, try again.",
        "How dumb you can be, can't you even guess a 4-digit code? Pathetic.",
        "My grandmother types faster and guesses better than you.",
        "Are you randomly hitting the numpad? Focus.",
        "Security alert triggered. Initiating self-destruct... 3... 2... kidding. Try again.",
        "Did you forget your PIN or did the PIN forget you?",

      ];
      setPinError(errorRoasts[Math.floor(Math.random() * errorRoasts.length)]); setPinInput(''); playError();
    }
  };

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
    showToast('Link copied to clipboard');
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
        showToast(`Purged ${filesToDelete.length} asset(s)`); setFilesToDelete([]); setSelectedFiles([]); setDeletingItemIds([]);
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
      const link = document.createElement('a'); link.href = url;
      const now = new Date(); const timeStamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours()}${now.getMinutes()}`;
      link.setAttribute('download', `MVK-Vault-Export_${timeStamp}.zip`);
      document.body.appendChild(link); link.click(); window.URL.revokeObjectURL(url);
      showToast('Batch archive exported'); setSelectedFiles([]);
    } catch (error) { playError(); showToast('Error generating archive'); } finally { setIsBatchDownloading(false); }
  };

  const promptBatchDelete = () => {
    if (selectedFiles.length === 0) return;
    const canDeleteAll = isAdminSession || selectedFiles.every(id => {
      const fileRecord = roomItems.find(item => item.savedAs === id);
      return fileRecord && fileRecord.sender === displayUsername;
    });

    if (!canDeleteAll) {
      playError(); setCustomAlert({ title: "Clearance Denied", msg: "You can only bulk-purge assets you personally uploaded unless you have Admin override." }); return;
    }
    setFilesToDelete([...selectedFiles]);
  };

  const openContextMenu = (e: React.MouseEvent, item: any) => {
    e.preventDefault(); e.stopPropagation(); setContextMenu({ show: true, x: e.pageX, y: e.pageY, file: item });
  };

  const toggleFileSelection = (e: React.MouseEvent, savedAs: string) => {
    e.stopPropagation(); setSelectedFiles(prev => prev.includes(savedAs) ? prev.filter(id => id !== savedAs) : [...prev, savedAs]);
  };

  const checkPreviewable = (fileName: string) => {
    if(!fileName) return false;
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'mp4', 'webm', 'mov'].includes(fileName.split('.').pop()?.toLowerCase() || '');
  };

  const promptDelete = (identifier: string) => { setFilesToDelete([identifier]); };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault(); if (!chatMessage.trim()) return;
    socket.emit('send-chat-message', { room: activeRoom, sender: displayUsername, text: chatMessage }); setChatMessage('');
  };

  const openPreview = (file: any) => {
    const ext = file.fileName.toLowerCase().split('.').pop();
    let type: 'image' | 'pdf' | 'video' = 'image';
    if (ext === 'pdf') type = 'pdf'; if (['mp4', 'webm', 'mov'].includes(ext)) type = 'video';
    setPreviewFile({ url: `${SERVER_URL}/preview/${encodeURIComponent(file.savedAs || file.fileName)}?user=${encodeURIComponent(displayUsername)}&device=${encodeURIComponent(deviceId)}`, name: file.fileName, type });
  };

  // ==========================================
  // 4. LOGIN RENDER (EARLY RETURN)
  // ==========================================
  if (!isNameSet) {
    return (
      <div className="flex h-screen items-center justify-center font-sans relative overflow-hidden transition-colors" style={{ backgroundColor: 'var(--bg)' }}>
        <motion.div {...panelIn} className="vault-elevated p-8 sm:p-10 rounded-2xl text-center w-11/12 max-w-sm relative z-10">
          {authStep === 'name' && (
            <form onSubmit={handleNameLogin} className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: 'var(--accent)' }}>
                <ShieldCheck size={22} className="text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>MVK Vault</h1>
              <p className="vault-mono text-[11px] tracking-wide mb-8" style={{ color: 'var(--text-faint)' }}>AUTHENTICATE TO ACCESS NETWORK</p>

              <input type="text" autoFocus placeholder="Identity tag" className="vault-input w-full px-4 py-3 rounded-lg mb-3 text-center font-semibold text-[14px]" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isConnecting} />
              <button type="submit" disabled={isConnecting || !username.trim()} className="vault-btn vault-btn-primary w-full font-bold py-3 rounded-lg disabled:opacity-40 mt-2 flex justify-center items-center gap-2 text-[14px]">
                {isConnecting ? <Activity size={16} className="animate-spin" /> : 'Continue'}
              </button>
            </form>
          )}

          {authStep === 'setup_pin' && (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: 'var(--accent)' }}>
                 <Lock size={20} className="text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>Create PIN</h1>
              <p className="text-[13px] mb-8 font-medium" style={{ color: 'var(--text-dim)' }}>Secure your device session.</p>

              <input type="password" maxLength={4} autoFocus placeholder="••••" className="vault-input w-full px-4 py-3 rounded-lg mb-6 text-center text-2xl tracking-[0.5em] font-mono" value={authPin} onChange={(e) => { const val = e.target.value; setAuthPin(val); if (val.length === 4) submitAuthPin('setup'); }} disabled={isConnecting} />
              <button onClick={() => submitAuthPin('setup')} disabled={authPin.length !== 4 || isConnecting} className="vault-btn vault-btn-primary w-full font-bold py-3 rounded-lg disabled:opacity-40 text-[14px]">Save PIN</button>
            </div>
          )}

          {authStep === 'challenge' && (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6" style={{ backgroundColor: 'var(--danger)' }}>
                 <Lock size={20} className="text-white" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>Enter PIN</h1>
              <p className="text-[13px] font-medium mb-4" style={{ color: 'var(--text-dim)' }}>Unlock <span style={{ color: 'var(--text)' }}>{username}</span></p>
              <p className="text-[11px] font-semibold h-4 mb-4" style={{ color: 'var(--danger)' }}>{pinErrorText}</p>

              <input type="password" maxLength={4} autoFocus placeholder="••••" className="vault-input w-full px-4 py-3 rounded-lg mb-6 text-center text-2xl tracking-[0.5em] font-mono" style={pinErrorText ? { borderColor: 'var(--danger)' } : undefined} value={authPin} onChange={(e) => { setAuthPin(e.target.value); setPinErrorText(''); }} onKeyDown={(e) => e.key === 'Enter' && submitAuthPin('verify')} disabled={isConnecting} />

              <div className="flex gap-3 w-full">
                <button onClick={() => { setAuthStep('name'); setUsername(''); setAuthPin(''); setPinErrorText(''); }} className="vault-btn vault-btn-secondary flex-1 font-bold py-3 rounded-lg text-[14px]">Cancel</button>
                <button onClick={() => submitAuthPin('verify')} disabled={authPin.length !== 4 || isConnecting} className="vault-btn vault-btn-primary flex-1 font-bold py-3 rounded-lg disabled:opacity-40 text-[14px]">Unlock</button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Custom Alerts */}
        <AnimatePresence>
          {customAlert && (
            <motion.div {...fadeIn} className="fixed inset-0 vault-scrim flex items-center justify-center z-[9999] px-4">
              <motion.div {...panelIn} className="vault-elevated p-8 rounded-2xl w-full max-w-sm text-center" style={{ borderColor: 'var(--danger)' }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--danger-soft)' }}><ShieldCheck size={22} style={{ color: 'var(--danger)' }} /></div>
                <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>{customAlert.title}</h2>
                <p className="text-[13px] mb-6 font-medium" style={{ color: 'var(--text-dim)' }}>{customAlert.msg}</p>
                <button onClick={() => setCustomAlert(null)} className="vault-btn vault-btn-danger w-full font-bold py-3 rounded-lg text-[14px]">Acknowledge</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Admin Override Modal */}
        <AnimatePresence>
          {adminAuthModal && (
            <motion.div {...fadeIn} className="fixed inset-0 vault-scrim flex items-center justify-center z-[9999] px-4">
              <motion.div {...panelIn} className="vault-elevated p-8 rounded-2xl w-full max-w-sm text-center">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: 'var(--accent-soft)' }}><Lock size={20} style={{ color: 'var(--accent)' }} /></div>
                <h2 className="text-lg font-bold tracking-tight mb-1" style={{ color: 'var(--text)' }}>System Override</h2>
                <p className="text-[13px] mb-8 font-medium" style={{ color: 'var(--text-dim)' }}>Authenticate as Admin</p>

                <input type="password" autoFocus className="vault-input w-full px-4 py-3 rounded-lg mb-6 text-center text-sm font-mono" placeholder="Master password" value={adminPinInput} onChange={(e) => setAdminPinInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && executeAdminLogin()} />
                <div className="flex gap-3 w-full">
                  <button onClick={() => {setAdminAuthModal(false); setUsername(''); setAdminPinInput('');}} className="vault-btn vault-btn-secondary flex-1 font-bold py-3 rounded-lg text-[14px]">Cancel</button>
                  <button onClick={executeAdminLogin} disabled={!adminPinInput || isConnecting} className="vault-btn vault-btn-primary flex-1 font-bold py-3 rounded-lg disabled:opacity-40 text-[14px]">Verify</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ==========================================
  // 5. MAIN APP RENDER
  // ==========================================
  return (
    <div
      className="flex h-screen font-sans transition-colors antialiased overflow-hidden"
      style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}
      onDrop={(e) => storageUsed < STORAGE_LIMIT && (e.preventDefault(), setIsDragging(false), e.dataTransfer.files.length > 0 && setStagingFiles(Array.from(e.dataTransfer.files)))}
      onDragOver={(e) => (e.preventDefault(), setIsDragging(true))}
      onDragLeave={(e) => (!e.currentTarget.contains(e.relatedTarget as Node) && setIsDragging(false))}
    >
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="fixed top-5 right-5 z-[9999] vault-elevated px-4 py-3 rounded-lg flex items-center space-x-3 text-[12.5px] font-semibold" style={{ color: 'var(--text)' }}>
            <div className="w-2 h-2 rounded-full vault-dot-live" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Sidebar 
        isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen}
        activeRoom={activeRoom} attemptRoomJoin={attemptRoomJoin} rooms={rooms}
        storageUsed={storageUsed} STORAGE_LIMIT={STORAGE_LIMIT}
        hasUpdate={false} commitsBehind={0}
        setShowCredits={setShowCredits} displayUsername={displayUsername}
        handleSignOut={handleSignOut}
      />

      <main className="flex-1 flex flex-col relative w-full overflow-hidden z-10">
        <header className="shrink-0 h-14 flex items-center px-4 md:px-8 z-20" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
          <div className="flex items-center gap-4 w-full">
            <button className="md:hidden" style={{ color: 'var(--text-dim)' }} onClick={() => setIsMobileMenuOpen(true)}><Menu size={19} /></button>
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar py-1 w-full">
               <span onClick={() => setCurrentFolderId(null)} className="text-[13px] font-bold cursor-pointer transition-colors" style={{ color: !currentFolderId ? 'var(--text)' : 'var(--text-faint)' }}>{activeRoom}</span>
               {getBreadcrumbs().map((crumb, idx, arr) => (
                 <div key={crumb.savedAs} className="flex items-center gap-2">
                   <ChevronRight size={13} style={{ color: 'var(--text-faint)' }} />
                   <span onClick={() => setCurrentFolderId(crumb.savedAs)} className="text-[13px] font-bold cursor-pointer transition-colors max-w-[100px] sm:max-w-[150px] truncate" style={{ color: idx === arr.length - 1 ? 'var(--text)' : 'var(--text-faint)' }}>{crumb.fileName}</span>
                 </div>
               ))}
            </div>
          </div>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="vault-btn p-2 rounded-md shrink-0" style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)' }}>
            {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
          </button>
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
          <motion.div {...fadeIn} className="fixed inset-0 z-[500] flex items-center justify-center pointer-events-none" style={{ backgroundColor: 'var(--accent-soft)', border: `2px dashed var(--accent)` }}>
             <motion.div {...panelIn} className="vault-elevated px-10 py-8 rounded-2xl text-center flex flex-col items-center">
               <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--accent-soft)' }}><Download style={{ color: 'var(--accent)' }} className="w-6 h-6 animate-bounce" /></div>
               <h2 className="text-lg font-extrabold tracking-tight mb-1" style={{ color: 'var(--text)' }}>Drop files here</h2>
               <p className="font-medium text-[13px]" style={{ color: 'var(--text-dim)' }}>Release to stage uploads</p>
             </motion.div>
          </motion.div>
        )}

        {showPinModal && (
          <motion.div {...fadeIn} className="fixed inset-0 vault-scrim flex items-center justify-center z-[100] px-4">
            <motion.div {...panelIn} className="vault-elevated p-8 rounded-2xl w-full max-w-sm">
              <div className="flex justify-center mb-4"><div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--warning-soft)' }}><Lock size={20} style={{ color: 'var(--warning)' }} /></div></div>
              <h2 className="text-lg font-bold mb-1 text-center" style={{ color: 'var(--text)' }}>Restricted area</h2>
              <p className="text-center text-[13px] font-medium h-12 flex items-center justify-center px-2">
  {pinError ? <span style={{ color: 'var(--danger)' }}>{pinError}</span> : 
   pinSuccessMsg ? <span style={{ color: 'var(--success)' }}>{pinSuccessMsg}</span> : 
   <span style={{ color: 'var(--text-dim)' }}>Enter PIN for {pendingRoom}</span>}
</p>
              <input type="password" maxLength={4} value={pinInput} onChange={(e) => { const val = e.target.value; setPinInput(val); if (pinError) setPinError(''); if (val.length === 4) submitPin(val); }} onKeyDown={(e) => e.key === 'Enter' && submitPin()} className="vault-input w-full px-4 py-3 mt-2 mb-6 rounded-lg text-center tracking-[0.5em] text-2xl font-mono" style={pinError ? { borderColor: 'var(--danger)' } : undefined} placeholder="••••" autoFocus />
              <div className="flex gap-3">
                <button onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }} className="vault-btn vault-btn-secondary flex-1 py-3 rounded-lg font-bold text-[14px]">Cancel</button>
                <button onClick={() => submitPin()} className="vault-btn vault-btn-primary flex-1 py-3 rounded-lg font-bold text-[14px]">Authorize</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showFolderModal && (
          <motion.div {...fadeIn} className="fixed inset-0 vault-scrim flex items-center justify-center z-[700] px-4">
            <motion.div {...panelIn} className="vault-elevated p-8 rounded-2xl w-full max-w-sm">
              <div className="flex items-center gap-3 mb-6"><div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--accent-soft)' }}><FolderPlus size={18} style={{ color: 'var(--accent)' }}/></div><h2 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>New folder</h2></div>
              <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder name…" className="vault-input w-full px-4 py-3 rounded-lg mb-4 text-[13.5px] font-semibold" autoFocus />
              <select value={newFolderTarget} onChange={(e) => setNewFolderTarget(e.target.value)} className="vault-input w-full px-4 py-3 rounded-lg mb-8 text-[13.5px] font-semibold appearance-none">
                <option value="Everyone">Visible to: Everyone</option>
                {activeUsers.filter(u => u.username !== displayUsername).map(u => <option key={u.id} value={u.username}>Private to: {u.username}</option>)}
              </select>
              <div className="flex gap-3">
                <button onClick={() => setShowFolderModal(false)} className="vault-btn vault-btn-secondary flex-1 py-3 rounded-lg font-bold text-[14px]">Cancel</button>
                <button onClick={handleCreateFolder} className="vault-btn vault-btn-primary flex-1 py-3 rounded-lg font-bold text-[14px]">Create</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {stagingFiles.length > 0 && (
          <motion.div {...fadeIn} className="absolute inset-0 z-[600] vault-scrim flex items-center justify-center p-4">
            <motion.div {...panelIn} className="vault-elevated rounded-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-6 flex justify-between items-center shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-raised)' }}>
                <div className="flex items-center gap-4">
                  <div className="p-2.5 rounded-lg" style={{ backgroundColor: 'var(--accent)' }}><Activity size={18} className="text-white" /></div>
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight leading-tight" style={{ color: 'var(--text)' }}>Stage upload</h2>
                    <p className="vault-mono text-[11px]" style={{ color: 'var(--text-faint)' }}>{stagingFiles.length > 0 && !!stagingFiles[0].webkitRelativePath ? `DIR: ${stagingFiles[0].webkitRelativePath.split('/')[0]}` : `${stagingFiles.length} FILE(S) READY`}</p>
                  </div>
                </div>
                <button onClick={() => setStagingFiles([])} className="vault-btn p-2 rounded-md" style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)' }}><X size={18} /></button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-7" style={{ backgroundColor: 'var(--surface)' }}>
                <div>
                  <h3 className="vault-mono text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>1 — Secure target</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <button onClick={() => setStagedTarget('Everyone')} className="vault-btn p-3.5 rounded-lg flex flex-col items-center justify-center gap-1.5 border" style={stagedTarget === 'Everyone' ? { backgroundColor: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : { backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)', borderColor: 'var(--border)' }}><Share2 size={18} /><span className="font-bold text-[11px]">Everyone</span></button>
                    {activeUsers.filter(u => u.username !== displayUsername).map(u => (
                      <button key={u.id} onClick={() => setStagedTarget(u.username)} className="vault-btn p-3.5 rounded-lg flex flex-col items-center justify-center gap-1.5 border" style={stagedTarget === u.username ? { backgroundColor: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : { backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)', borderColor: 'var(--border)' }}><Lock size={18} /><span className="font-bold text-[11px] truncate w-full text-center">{u.username}</span></button>
                    ))}
                  </div>
                </div>
                {activeRoom !== 'The Drive' ? (
                  <div>
                    <h3 className="vault-mono text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>2 — Expiration timer</h3>
                    <div className="grid grid-cols-4 gap-2.5">
                      {[1, 12, 24, 168].map(hours => (
                        <button key={hours} onClick={() => setStagedExpiry(hours)} className="vault-btn py-3.5 px-2 rounded-lg flex flex-col items-center justify-center gap-1 border" style={stagedExpiry === hours ? { backgroundColor: 'var(--accent)', color: 'white', borderColor: 'var(--accent)' } : { backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)', borderColor: 'var(--border)' }}><span className="font-bold text-[11px]">{hours === 168 ? '7 days' : `${hours}h`}</span></button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h3 className="vault-mono text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-faint)' }}>2 — Storage Rule</h3>
                    <div className="vault-panel p-4 rounded-lg flex items-center justify-center border-dashed border-2" style={{ borderColor: 'var(--success-soft)' }}>
                      <span className="text-[12px] font-bold" style={{ color: 'var(--success)' }}>Files uploaded to The Drive are permanently archived.</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 shrink-0 flex gap-3" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-raised)' }}>
                 <button onClick={() => setStagingFiles([])} className="vault-btn vault-btn-secondary flex-1 font-bold py-3.5 rounded-lg text-[14px]">Cancel</button>
                 <button onClick={executeStagedUploads} className="vault-btn vault-btn-primary flex-[2] font-bold py-3.5 rounded-lg flex items-center justify-center gap-2 text-[14px]"><Send size={17} /> Upload now</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {filesToDelete.length > 0 && (
          <motion.div {...fadeIn} className="fixed inset-0 vault-scrim flex items-center justify-center z-[250] px-4">
            <motion.div {...panelIn} className="vault-elevated p-8 rounded-2xl w-full max-w-sm" style={{ borderColor: 'var(--danger)' }}>
              <div className="flex justify-center mb-6"><div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--danger-soft)' }}><Trash2 size={24} style={{ color: 'var(--danger)' }} /></div></div>
              <h2 className="text-lg font-bold mb-2 text-center" style={{ color: 'var(--text)' }}>Confirm deletion</h2>
              <p className="text-center text-[13px] mb-8 font-medium" style={{ color: 'var(--text-dim)' }}>Erase <strong style={{ color: 'var(--text)' }}>{filesToDelete.length} item(s)</strong> permanently?</p>
              <div className="flex gap-3">
                <button onClick={() => setFilesToDelete([])} className="vault-btn vault-btn-secondary flex-1 py-3 rounded-lg font-bold text-[14px]">Cancel</button>
                <button onClick={confirmBatchDelete} className="vault-btn vault-btn-danger flex-1 py-3 rounded-lg font-bold text-[14px]">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 🚨 FIXED RIGHT CLICK CONTEXT MENU 🚨 */}
        {contextMenu.show && contextMenu.file && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.12 }} className="fixed z-[1000] w-56 vault-elevated rounded-xl overflow-hidden py-1.5" style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 250) }}>
            <div className="px-4 py-2 mb-1" style={{ borderBottom: '1px solid var(--border)' }}><p className="text-[11px] font-bold truncate w-full" style={{ color: 'var(--text)' }}>{contextMenu.file.fileName}</p></div>
            {contextMenu.file.isFolder ? (
              <button onClick={() => setCurrentFolderId(contextMenu.file.savedAs)} className="vault-nav-item w-full text-left px-4 py-2 text-[13px] flex items-center gap-3"><FolderPlus size={15} /> Open folder</button>
            ) : (
              <>
                <button onClick={(e) => triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(contextMenu.file.savedAs || contextMenu.file.fileName)}?user=${encodeURIComponent(displayUsername)}&device=${encodeURIComponent(deviceId)}`, contextMenu.file.fileName)} className="vault-nav-item w-full text-left px-4 py-2 text-[13px] flex items-center gap-3"><Download size={15} /> Download</button>
                <button onClick={() => handleCopyLink(`${SERVER_URL}/shared/${encodeURIComponent(contextMenu.file.savedAs || contextMenu.file.fileName)}`)} className="vault-nav-item w-full text-left px-4 py-2 text-[13px] flex items-center gap-3"><Share2 size={15} /> Copy link</button>
              </>
            )}
            {(contextMenu.file.sender === displayUsername || isAdminSession) && (
              <>
                <div className="my-1" style={{ borderTop: '1px solid var(--border)' }}></div>
                <button onClick={() => { socket.emit('extend-expiry', { identifier: contextMenu.file.savedAs || contextMenu.file.fileName, isFolder: contextMenu.file.isFolder, addedHours: 24 }); showToast('Extended 24h'); setContextMenu({ show: false, x: 0, y: 0, file: null }); }} className="vault-nav-item w-full text-left px-4 py-2 text-[13px] flex items-center gap-3" style={{ color: 'var(--success)' }}>
                  <Clock size={15} /> Extend 24h
                </button>
                <button onClick={() => promptDelete(contextMenu.file.savedAs || contextMenu.file.fileName)} className="vault-nav-item w-full text-left px-4 py-2 text-[13px] flex items-center gap-3" style={{ color: 'var(--danger)' }}><Trash2 size={15} /> Delete</button>
              </>
            )}
          </motion.div>
        )}

        {/* SYSTEM CREDITS MODAL */}
        {showCredits && (
          <motion.div {...fadeIn} className="fixed inset-0 vault-scrim flex items-center justify-center z-[700] px-4">
            <motion.div {...panelIn} className="vault-elevated p-8 rounded-2xl w-full max-w-md relative overflow-hidden">
              <button onClick={() => setShowCredits(false)} className="absolute top-5 right-5 vault-btn p-1.5 rounded-md" style={{ color: 'var(--text-dim)' }}><X size={16} /></button>
              <div className="flex items-center gap-5 mb-6">
                <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold bg-white text-black shadow-md">VM</div>
                <div>
                  <div className="inline-flex px-2 py-0.5 rounded text-[9px] uppercase font-bold mb-1.5" style={{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }}>Level 5 Clearance</div>
                  <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Veer Madan</h2>
                  <p className="vault-mono text-[10px] tracking-wide" style={{ color: 'var(--text-faint)' }}>LEAD SYSTEM ARCHITECT</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-sunken)' }}>
                  <h3 className="font-bold text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text)' }}>Architecture</h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>Proprietary LAN distribution network engineered exclusively for MVK Builders and Developers Head Office.</p>
                </div>
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--surface-sunken)' }}>
                  <h3 className="font-bold text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--text)' }}>Licensing</h3>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-dim)' }}>Licensed strictly for internal operations. Commercialization outside the organization is strictly prohibited.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* FILE PREVIEW MODAL */}
        {previewFile && (
          <motion.div {...fadeIn} className="fixed inset-0 vault-scrim flex flex-col z-[1100] px-4 py-6">
            <header className="flex items-center justify-between shrink-0 mb-4">
              <span className="text-white font-medium text-sm truncate drop-shadow-md">{previewFile.name}</span>
              <div className="flex items-center gap-3">
                <button onClick={(e) => triggerDownload(e, previewFile.url, previewFile.name)} className="vault-btn vault-btn-primary px-4 py-2 rounded-lg text-[13px] font-bold">Download</button>
                <button onClick={() => setPreviewFile(null)} className="vault-btn p-2 rounded-full" style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)' }}><X size={18} /></button>
              </div>
            </header>
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              {(previewFile.type as string) === 'video' ? (
                <video src={previewFile.url} controls autoPlay className="max-w-full max-h-full rounded-lg shadow-2xl" />
              ) : (previewFile.type as string) === 'image' ? (
                <img src={previewFile.url} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
              ) : (
                <iframe src={previewFile.url} className="w-full h-full rounded-lg bg-white shadow-2xl" title="PDF Preview" />
              )}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* FLOATING COMM-LINK CHAT */}
      <div className="fixed bottom-[100px] md:bottom-6 right-6 z-40 flex flex-col items-end transition-all duration-300">
        <div className={`vault-elevated rounded-2xl w-[340px] sm:w-[380px] mb-4 transition-all duration-200 origin-bottom-right flex flex-col overflow-hidden ${isChatOpen ? 'h-[480px] opacity-100 scale-100' : 'h-0 opacity-0 scale-95 pointer-events-none'}`}>
          <div className="h-14 flex items-center justify-between px-5 shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-raised)' }}>
             <div className="flex items-center gap-3"><div className="p-1.5 rounded-md" style={{ backgroundColor: 'var(--accent)' }}><MessageSquare size={14} className="text-white" /></div><span className="text-[13px] font-bold" style={{ color: 'var(--text)' }}>{activeRoom} · Comm-Link</span></div>
             <button onClick={() => setIsChatOpen(false)} className="vault-btn p-1.5 rounded-full" style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)' }}><X size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar" ref={chatScrollRef}>
            {roomMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[12px] text-center px-4 space-y-3" style={{ color: 'var(--text-faint)' }}>
                <Activity size={20} className="opacity-50" /><p className="font-medium">Channel open.<br/>Waiting for transmissions…</p>
              </div>
            ) : roomMessages.map((msg, idx) => {
                const isMe = msg.sender === displayUsername; const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-row-in`}>
                    <span className="vault-mono text-[9.5px] mb-1 px-1" style={{ color: 'var(--text-faint)' }}>{isMe ? 'You' : msg.sender} · {time}</span>
                    <div className="px-3.5 py-2 rounded-xl max-w-[85%] text-[12.5px] leading-relaxed font-medium" style={isMe ? { backgroundColor: 'var(--accent)', color: 'white', borderBottomRightRadius: 4 } : { backgroundColor: 'var(--surface-sunken)', color: 'var(--text)', border: '1px solid var(--border)', borderBottomLeftRadius: 4 }}>{msg.text}</div>
                  </div>
                );
            })}
          </div>
          <form onSubmit={handleSendMessage} className="p-3.5 shrink-0 flex gap-2.5" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface-raised)' }}>
             <input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Message…" className="vault-input flex-1 text-[13px] rounded-full px-4 py-2 font-medium" />
             <button type="submit" disabled={!chatMessage.trim()} className="vault-btn vault-btn-primary p-2.5 rounded-full disabled:opacity-40 flex items-center justify-center"><Send size={15} className="-ml-0.5" /></button>
          </form>
        </div>
        <button onClick={() => setIsChatOpen(!isChatOpen)} className="vault-btn w-12 h-12 rounded-full flex items-center justify-center" style={isChatOpen ? { backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)' } : { backgroundColor: 'var(--accent)', color: 'white' }}>
          {isChatOpen ? <X size={20} /> : <MessageSquare size={20} />}
        </button>
      </div>
    </div>
  );
};

export default App;