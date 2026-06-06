import { useState, useEffect, useRef } from 'react';
import { Share2, Users, Activity, ShieldCheck, Download, FileText, Lock, Menu, X, Search, LayoutGrid, List, Trash2, HardDrive, Eye, MessageSquare, Send, FolderUp, FilePlus, Clock, Folder, FolderPlus, ChevronRight, FileImage, Film, FileArchive, Code, Headphones, Link, Cpu, Check, CheckSquare } from 'lucide-react';

import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = `http://${window.location.hostname}:3000`;
const socket = io(SERVER_URL, { autoConnect: false, transports: ['websocket', 'polling'] });

const ROOM_PINS: Record<string, string> = {
  'Digital Team': '1789',
  'Sales & Mktg': '2026',
  'Admin Only': '9999'
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
  if (!filename) return { icon: FileText, color: 'text-gray-400 group-hover:text-white', bg: 'bg-gray-400/10', shadow: 'group-hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]' };
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return { icon: FileText, color: 'text-red-500 group-hover:text-red-400', bg: 'bg-red-500/10', shadow: 'group-hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]' };
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return { icon: Film, color: 'text-blue-400 group-hover:text-blue-300', bg: 'bg-blue-400/10', shadow: 'group-hover:shadow-[0_0_15px_rgba(96,165,250,0.4)]' };
  if (['zip', 'rar', '7z', 'tar'].includes(ext)) return { icon: FileArchive, color: 'text-yellow-500 group-hover:text-yellow-400', bg: 'bg-yellow-500/10', shadow: 'group-hover:shadow-[0_0_15px_rgba(234,179,8,0.4)]' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return { icon: FileImage, color: 'text-purple-400 group-hover:text-purple-300', bg: 'bg-purple-400/10', shadow: 'group-hover:shadow-[0_0_15px_rgba(192,132,252,0.4)]' };
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return { icon: Headphones, color: 'text-pink-400 group-hover:text-pink-300', bg: 'bg-pink-400/10', shadow: 'group-hover:shadow-[0_0_15px_rgba(244,114,182,0.4)]' };
  if (['js', 'html', 'css', 'ts', 'json', 'py', 'java'].includes(ext)) return { icon: Code, color: 'text-green-400 group-hover:text-green-300', bg: 'bg-green-400/10', shadow: 'group-hover:shadow-[0_0_15px_rgba(74,222,128,0.4)]' };
  return { icon: FileText, color: 'text-gray-400 group-hover:text-white', bg: 'bg-gray-400/10', shadow: 'group-hover:shadow-[0_0_15px_rgba(255,255,255,0.2)]' };
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

  return <span className={`font-mono text-[10px] font-bold tracking-widest transition-colors duration-500 ${isUrgent ? 'text-red-500 animate-pulse' : 'text-gray-500'}`}>⏳ {timeLeft}</span>;
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
  
  // Security Fingerprinting States
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
  
  // --- BATCH SELECTION STATE ---
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

  const [previewFile, setPreviewFile] = useState<{url: string, name: string, type: 'image' | 'pdf'} | null>(null);
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
  
  // OTA Radar States
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
    { name: 'General', icon: <Share2 size={20} />, locked: false },
    { name: 'Digital Team', icon: <Activity size={20} />, locked: true },
    { name: 'Sales & Mktg', icon: <Users size={20} />, locked: true },
    { name: 'Admin Only', icon: <ShieldCheck size={20} />, locked: true },
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

  // GENERATE DEVICE FINGERPRINT ON LOAD
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

      // Backend resolved the tag for us!
      const resolvedName = res.data.resolvedName;
      setUsername(resolvedName); // Update the input box to show the exact tag

      if (res.data.status === 'challenge') {
        setIsConnecting(false); setAuthStep('challenge'); playError();
      } else if (res.data.requiresPinSetup) {
        setIsConnecting(false); setAuthStep('setup_pin'); playSuccess();
      } else {
        playSuccess(); socket.auth = { username: resolvedName }; socket.connect();
      }
    } catch (err) { setIsConnecting(false); }
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
      const roasts = ["Access Granted. Even a broken clock is right twice a day.", "Wow, you actually remembered it. Proud of you.", "Correct. The server is shocked, but welcoming.", "PIN accepted. Who did you steal this from?", "Look at you, doing things right for once."];
      setPinError(''); setPinSuccessMsg(roasts[Math.floor(Math.random() * roasts.length)]);
      playSuccess();
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
"Congratulations, you've discovered the wrong answer. Again.",
"That PIN was so wrong it hurt my feelings.",
"4 digits. FOUR. You had one job.",
"I've seen monkeys solve puzzles faster. Just saying.",
"Wrong PIN detected. Recalibrating expectations... done. They're now at zero.",
"The audacity to type that confidently and still be wrong.",
"Plot twist: that wasn't even close.",
"Your PIN attempt has been submitted to the Hall of Shame.",
"Sir/Ma'am, this is a server room, not a guessing game show.",
"I don't know what that was, but it wasn't the PIN.",
"Even autocorrect is embarrassed for you.",
"That PIN is like your code quality — almost, but not quite.",
"Task failed successfully. Somehow.",
"401 Unauthorized. Go touch some grass and try again.",
"You type like you're defusing a bomb... badly.",
"Wrong. Incorrect. Nope. Negative. No. Nah. Try again.",
"The door laughed. Doors don't laugh. You made a door laugh.",
"Were you trying to summon something? Because that wasn't a PIN.",
"PIN rejected. Your keyboard is filing a complaint.",
"Wrong PIN. Have you tried turning your brain off and on again?",
"That PIN was so bad, even the server felt second-hand embarrassment.",
"Bro typed his WiFi password. In a server room.",
"Error 404: Competence not found.",
"You absolute muppet. That's not it.",
"The PIN is 4 digits, not your IQ.",
"Sir this is a Wendy's. Also wrong PIN.",
"Were you dropped as a baby or just guessing like one?",
"You had a 1 in 10,000 chance and still blew it. Impressive.",
"That attempt has been logged, framed, and hung in the Museum of Failure.",
"My plant could guess the PIN. My plant is dead.",
"Bold strategy typing that. Didn't work. But bold.",
"I've seen better attempts from a cat walking on a keyboard.",
"Wrong. The engineers are crying. Look what you did.",
"Are you okay? Blink twice if you need help.",
"The server didn't reject you. It ghosted you.",
"Damn bro not even close. Were you even trying?",
"Your fingers typed that with such confidence. Tragic.",
"Scientists are baffled. How can someone be this wrong, this fast?",
"You're the reason we have warning labels on everything.",
"The PIN isn't going to guess itself. Unfortunately, neither can you.",
"Close... just kidding. Not even remotely close.",
"That was painful to witness. The cameras saw everything.",
"Access denied. Please consider a career change.",
"You just failed a test a toddler could pass. Let that sink in.",
"Wrong PIN. Your ancestors are disappointed.",
"Legend says if you get it wrong 3 times, IT shows up in person. This is attempt 1.",
"Somewhere, a junior dev is better at this than you.",
"I'd say nice try but I respect you too much to lie.",
"Did you just... guess? In this economy?",
"Bro really said 'I got this' and didn't got this.",
"PIN rejected. Touch grass. Come back.",
"Not it. Not even it-adjacent.",
"Your spirit animal is a wrong answer.",
"The audacity. The nerve. The incorrectness.",
"That PIN died on the way to its home planet.",
"Certified brainrot moment.",
"Wrong. Delete yourself and reinstall.",
"You're not him. You never were.",
"This ain't it, chief.",
"404: Brain.exe not found.",
"Bro really woke up and chose to be wrong.",
"The PIN saw your attempt and filed for divorce.",
"Nope. Nope. Absolutely not. Nope.",
"You're so wrong you looped back around to wrong again.",
"Wrong PIN. Your WiFi speed matches your IQ.",
"Bro thought he ate. He did not eat.",
"Respectfully, what was that?",
"The PIN is not in that area code.",
"Try again. Pray first.",
"Sir your confidence is not matched by your accuracy.",
"Even the server feels bad for you. Almost.",
"You typed that like you meant it. Sad.",
"That's not it dawg.",
"Incorrect. Uninstall your hands.",
"Bro is speedrunning failure.",
"Wrong PIN. The prophecy was not about you.",
"Your attempt has been yeeted into the void.",
"You had One job. ONE.",
"L + wrong PIN + ratio.",
"Didn't ask. Skill issue.",
// Add these to your roasts array:
"Bro is built different. Wrong, but different.",
"Your PIN attempt has been carbon dated. Still wrong.",
"That was so incorrect it created a new category of failure.",
"You typed that like you had a PhD. Spoiler: you don't.",
"The server read your attempt and asked for a transfer.",
"Imagine being cooked by a door. Couldn't be most people. Could be you.",
"Wrong PIN. Your git commits are probably just as bad.",
"You absolute numpty. That's not even in the ballpark.",
"The ballpark called. You're not even in the parking lot.",
"Wrong. I'd say go back to school but this is a 4-digit number.",
"That PIN attempt was so bad it violated the Geneva Convention.",
"Bro really pulled up with that energy. Tragic.",
"You're one wrong PIN away from being a case study.",
"The terminal is judging you. Terminals don't have feelings. It made an exception.",
"Your input has been forwarded to /dev/null where it belongs.",
"sudo guess-correctly. Oh wait, you can't.",
"Wrong PIN. Please submit a formal apology to the numpad.",
"That attempt was so bad the logs are refusing to record it.",
"You've unlocked a new achievement: Spectacularly Incorrect.",
// "rm -rf your confidence. It's not serving you.",
"Bro treats a PIN pad like it's multiple choice.",
"The PIN is not 'vibes'. Try again.",
"Sir this is not a captcha. There's no excuse.",
"You're not locked out. The server is locked IN from you.",
"That guess has been reported to your manager. And their manager.",
"Bro said 'hold my coffee' and then did nothing worth holding coffee for.",
"At this point the door is genuinely concerned for you.",
"Stack Overflow doesn't have a thread for being this wrong.",
"You came, you saw, you entered the wrong PIN. Caesar would be embarrassed.",
"Your attempt has been submitted to r/ProgrammerHumor as a warning.",
"Error: PEBKAC. Problem Exists Between Keyboard And Chair.",
"Have you tried pair programming? Maybe someone else knows the PIN.",
"The compiler rejected your PIN and it's not even compiled code.",
"Somewhere a rubber duck debugger is shaking its head.",
"Not you. Not today. Not that PIN.",
"The intern guessed closer than you. The intern is a golden retriever.",
"You tried. The keyword being tried.",
"That attempt is now being used in cybersecurity training as 'what not to do'.",
"bro.brain.exe has stopped working.",
"Wrong. Your Jira ticket has been updated to 'Won't Fix'.",
"Wrong PIN. Your parents didn't raise you for this. Or maybe they did.",
"The void stared back. Even it was disappointed.",
"Statistically, a random number generator has a better future than you.",
"Wrong. Your tombstone will read 'Here lies someone who couldn't remember 4 digits.'",
"The server has seen things. Your attempt made the list of worst ones.",
"You type like someone who peaked in 2009 and has been declining since.",
"Wrong PIN. Somewhere, a parallel universe version of you got it right. Not you though.",
"That attempt was so bad it shortened your lifespan.",
"Error: Soul not found. Try inserting one before attempting again.",
"The building's fire exit knows the PIN. You don't. Think about that.",
"Wrong. Even your search history is ashamed of you.",
"You're the human equivalent of a 404 page. Broken and hard to find useful.",
"That PIN attempt aged you 5 years. You don't have many left.",
"The server prays it never sees your face in production.",
"Wrong PIN. Somewhere a mother is lying about what her child does for a living.",
"Your birth certificate is an apology letter from the hospital.",
"The cleaning staff gets this right every morning. You're a 'professional.'",
"A coin flip has more going for it than your instincts.",
"Wrong. The server room is haunted now. By your dignity.",
"You've been alive this many years and this is where you are. Let that marinate.",
"That attempt has been archived as evidence of humanity's decline.",
"Wrong PIN. The darkness welcomes your failure warmly.",
"Error 666: Whatever went wrong in your life led to this moment.",
"You'll think about this on your deathbed. Among other regrets.",
"The server doesn't hate you. It simply feels nothing for you. That's worse.",
"Wrong PIN. The universe tried to warn you. You didn't listen.",
"Somewhere your dreams are watching this and slowly giving up.",
"That wasn't a guess. That was a cry for help.",
"Wrong. Nothing you do here will fill the void. Especially not that PIN.",
"The server has outlived better people than you. It'll outlive you too.",
"Your guardian angel clocked out after watching that attempt.",
"Wrong PIN. Your future self tried to warn you. You couldn't hear it over the failure.",
"That attempt has been forwarded to whoever still believes in you. Empty inbox.",
"The server room has witnessed births, deaths, and your PIN attempt. Worst of the three.",
"Error: Hope not found. Last known location: somewhere before this attempt.",
"Wrong PIN. Your ancestors died for this bloodline. Reconsider.",
"The universe has been around 13.8 billion years and produced... that attempt.",
"Wrong. Even the rats in the walls know better.",
"Your guardian angel put in their two weeks after watching that.",
"Wrong PIN. God saw that. He didn't intervene. Think about why.",
"That wasn't a PIN attempt. That was a confession.",
"Wrong. The crows outside have been watching you. They're not impressed.",
//"You were the fastest sperm. Fastest isn't always best.",
"Wrong PIN. Whatever you told yourself this morning in the mirror was a lie.",
"That attempt has been noted in a book no one good reads.",
"Wrong. Your horoscope tried to warn you. You don't read those either.",
"The last person who stood here got it right. Their name had meaning.",
"Wrong PIN. Your reflection is tired of making excuses for you.",
"Even the dust in this room has more direction than you.",
"Wrong. The silence after that attempt is the loudest thing in the building.",
"You had a 1 in 10,000 chance and fumbled it like everything else.",
"Wrong PIN. Your mother's prayers have a response rate of zero tonight.",
"That attempt felt personal. Like all your other failures.",
"The door has seen grief, loss, and despair. Your attempt was worse.",
"Wrong. Somewhere a candle is burning for you. It's almost out.",
"You will never be the person you dreamed you'd be. Also wrong PIN.",
"Wrong PIN. Whatever broke inside you broke a little more just now.",
"The pigeons on the roof have a better sense of direction than you.",
"Wrong. You peaked at something once. This wasn't it.",
"That attempt carried the weight of every bad decision that led here.",
"Wrong PIN. The night shift sees a lot of things. This was among the saddest.",
"You dress like someone with their life together. You are not that person.",
"Wrong. Your old friends don't think about you. The door does. Unfavorably.",
"That number meant nothing. Like several of your relationships.",
"Wrong PIN. The building has a memory. It will remember this.",
"You walked in here with purpose. That purpose was wrong.",
"The vending machine down the hall accepts wrong inputs more gracefully than this.",
"Wrong. Something in you knew before you pressed the last digit. You ignored it.",
"Your confidence has never once been proportional to your accuracy.",
"Wrong PIN. The version of you from 10 years ago would have so many questions.",
"That wasn't an attempt. That was a symptom."
        
      ];
      setPinError(errorRoasts[Math.floor(Math.random() * errorRoasts.length)]); setPinInput(''); playError();
    }
  };

  useEffect(() => {
    axios.get(`${SERVER_URL}/api/storage`).then(res => setStorageUsed(res.data.storageUsed)).catch(err => console.error(err));
    
    // PING GITHUB FOR UPDATES (Only triggers if you are Admin)
    if (isAdminSession) {
      axios.get(`${SERVER_URL}/api/check-updates`).then(res => {
        if (res.data.updateAvailable) {
          setHasUpdate(true);
          setCommitsBehind(res.data.commits);
        }
      }).catch(() => {});
    }

    const onConnect = () => { setIsOnline(true); setIsConnecting(false); setIsNameSet(true); };
    const onDisconnect = () => setIsOnline(false);

    socket.on('connect', onConnect); socket.on('disconnect', onDisconnect);

    socket.on('incoming-transfer', (data) => {
       setRoomItems((prev) => {
         // STRICT ROOM LOCK: Ignore live uploads happening in other rooms
         if (data.room !== activeRoom) return prev;
         
         if (prev.some(f => (f.downloadUrl && f.downloadUrl === data.downloadUrl) || (f.isFolder && f.id === data.id))) return prev;
         return [data, ...prev];
       });
       axios.get(`${SERVER_URL}/api/storage`).then(res => setStorageUsed(res.data.storageUsed));
    });
    
    socket.on('force-db-sync', (freshHistory) => {
      // STRICT ROOM LOCK: Files only ever show up in the exact room they were uploaded to.
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
      // FORCE THE VAULT TO SYNC THE MASTER DATABASE
      socket.emit('request-master-sync');
    }
  };

  // --- BATCH DOWNLOAD ENGINE ---
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
      setSelectedFiles([]); // Clear selection after download
    } catch (error) {
      console.error("Batch download failed:", error);
      playError();
      setToastMsg('Error generating archive');
      setTimeout(() => setToastMsg(''), 3000);
    } finally {
      setIsBatchDownloading(false);
    }
  };
  const promptDelete = (identifier: string) => {
    setFilesToDelete([identifier]);
  };

  // --- BATCH DELETE ENGINE & SECURITY ---
  const promptBatchDelete = () => {
    if (selectedFiles.length === 0) return;
    
    // Check if user is allowed to delete this specific batch
    const canDeleteAll = isAdminSession || selectedFiles.every(id => {
      const fileRecord = roomItems.find(item => item.savedAs === id);
      return fileRecord && fileRecord.sender === displayUsername;
    });

    if (!canDeleteAll) {
      playError();
      setCustomAlert({
        title: "Clearance Denied",
        msg: "You have selected files uploaded by other users. You can only bulk-purge assets you personally uploaded unless you have Admin override."
      });
      return;
    }

    setFilesToDelete([...selectedFiles]);
  };
  
  const confirmBatchDelete = () => {
    if (filesToDelete.length === 0) return;
    playPurge(); 
    setTimeout(async () => {
      try {
        await axios.post(`${SERVER_URL}/api/files/delete`, { 
          targets: filesToDelete, 
          requester: displayUsername,
          isAdmin: isAdminSession
        });
        setToastMsg(`Purged ${filesToDelete.length} Assets.`); 
        setTimeout(() => setToastMsg(''), 3500); 
        setFilesToDelete([]); 
        setSelectedFiles([]);
      } catch (error) { 
        console.error("Batch Deletion failed:", error); setFilesToDelete([]); playError();
      }
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
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(fileName.split('.').pop()?.toLowerCase() || '');
  }
  
  const openPreview = (file: any) => setPreviewFile({ 
    url: `${SERVER_URL}/preview/${encodeURIComponent(file.savedAs || file.fileName)}`, 
    name: file.fileName, 
    type: file.fileName.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image' 
  });

  const filteredItems = roomItems.filter(item => {
    if (!item.fileName) return false;
    const matchesSearch = item.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = currentFolderId ? item.parentId === currentFolderId : !item.parentId;
    return matchesSearch && matchesFolder;
  });

  if (!isNameSet) {
    return (
      <div className="flex h-screen bg-[#0a0a0a] text-white items-center justify-center font-sans relative overflow-hidden">
        
        <style>{`
          @keyframes spring { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
          .animate-spring { animation: spring 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) both; }
          
          @keyframes letter-pop { 0% { transform: translateY(10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
          .animate-letter { animation: letter-pop 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; display: inline-block; }
          
          @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
          .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
          
          .mac-click:active { transform: scale(0.95); transition: transform 0.1s; }
        `}</style>
        
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"></div>
        <div className="bg-[#121212] p-10 rounded-2xl border border-gray-800 text-center shadow-[0_0_50px_rgba(255,215,0,0.05)] w-11/12 max-w-md relative z-10 backdrop-blur-xl animate-spring">
          
          {authStep === 'name' && (
            <form onSubmit={handleNameLogin}>
              <div className="w-16 h-16 bg-[#FFD700]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#FFD700]/20"><ShieldCheck size={32} className="text-[#FFD700]" /></div>
              <h1 className="text-3xl font-bold text-white mb-2 tracking-widest flex justify-center"><AnimatedText text="MVK NET" delayOffset={0.1} /></h1>
              <p className="text-gray-500 text-xs mb-6 uppercase tracking-widest">Identify Yourself</p>
              <input type="text" autoFocus placeholder="Enter your name" className="w-full bg-[#0a0a0a] border-2 border-gray-800 text-white px-4 py-4 rounded-xl focus:outline-none focus:border-[#FFD700] transition-colors mb-6 text-center text-xl shadow-inner" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isConnecting} />
              <button type="submit" disabled={isConnecting || !username.trim()} className="w-full bg-[#FFD700] text-black font-bold py-4 rounded-xl hover:bg-[#e6c200] transition-colors shadow-[0_0_20px_rgba(255,215,0,0.3)] mac-click">{isConnecting ? 'Authenticating...' : 'Initialize Uplink'}</button>
            </form>
          )}

          {authStep === 'setup_pin' && (
            <div className="animate-scale-in">
              <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30"><Lock size={32} className="text-blue-500" /></div>
              <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-widest">Secure Your Tag</h1>
              <p className="text-gray-400 text-sm mb-6">Create a 4-digit PIN for <strong className="text-blue-400">{username}</strong>. You will need this to log in from other devices.</p>
              <input type="password" maxLength={4} autoFocus placeholder="••••" className="w-full bg-black/50 border-2 border-gray-800 text-white px-4 py-4 rounded-xl focus:outline-none focus:border-blue-500 transition-colors mb-6 text-center text-2xl tracking-[1em] shadow-inner" value={authPin} onChange={(e) => { const val = e.target.value; setAuthPin(val); if (val.length === 4) submitAuthPin('setup'); }} disabled={isConnecting} />
              <button onClick={() => submitAuthPin('setup')} disabled={authPin.length !== 4 || isConnecting} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-500 transition-colors shadow-[0_0_20px_rgba(59,130,246,0.4)] mac-click mb-3">Lock Identity</button>
              <button onClick={() => { playSuccess(); socket.auth = { username }; socket.connect(); }} className="text-gray-500 text-xs font-bold hover:text-white transition-colors uppercase">Skip for now</button>
            </div>
          )}

          {authStep === 'challenge' && (
            <div className={`animate-scale-in ${pinErrorText ? 'animate-shake' : ''}`}>
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30"><ShieldCheck size={32} className="text-red-500" /></div>
              <h1 className="text-2xl font-bold text-white mb-2 uppercase tracking-widest">Unrecognized Device</h1>
              <p className="text-gray-400 text-sm mb-2">The tag <strong className="text-red-400">{username}</strong> is claimed. Enter the PIN to authorize this device.</p>
              <p className="text-red-500 text-xs font-bold h-4 mb-4">{pinErrorText}</p>
              <input type="password" maxLength={4} autoFocus placeholder="••••" className={`w-full bg-black/50 border-2 text-white px-4 py-4 rounded-xl focus:outline-none transition-colors mb-6 text-center text-2xl tracking-[1em] shadow-inner ${pinErrorText ? 'border-red-500/50 focus:border-red-500' : 'border-gray-800 focus:border-red-500'}`} value={authPin} onChange={(e) => { setAuthPin(e.target.value); setPinErrorText(''); }} onKeyDown={(e) => e.key === 'Enter' && submitAuthPin('verify')} disabled={isConnecting} />
              <div className="flex gap-3">
                <button onClick={() => { setAuthStep('name'); setUsername(''); setAuthPin(''); setPinErrorText(''); }} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-xl transition-colors mac-click">Cancel</button>
                <button onClick={() => submitAuthPin('verify')} disabled={authPin.length !== 4 || isConnecting} className="flex-[2] bg-red-600 text-white font-bold py-4 rounded-xl hover:bg-red-500 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.4)] mac-click">Verify Identity</button>
              </div>
            </div>
          )}
        </div>

        {customAlert && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] px-4 backdrop-blur-md animate-spring">
            <div className="bg-[#121212] border border-red-500/50 p-8 rounded-3xl w-full max-w-sm shadow-[0_20px_60px_rgba(239,68,68,0.2)] text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                <ShieldCheck size={32} className="text-red-500" />
              </div>
              <h2 className="text-red-500 text-xl font-bold mb-2 uppercase tracking-widest">{customAlert.title}</h2>
              <p className="text-gray-300 text-sm mb-6">{customAlert.msg}</p>
              <button onClick={() => setCustomAlert(null)} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] mac-click">Acknowledge</button>
            </div>
          </div>
        )}

        {adminAuthModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] px-4 backdrop-blur-md animate-spring">
            <div className={`bg-[#121212] border border-[#FFD700]/30 p-8 rounded-3xl w-full max-w-sm shadow-[0_20px_60px_rgba(255,215,0,0.15)] text-center ${pinError ? 'animate-shake border-red-500/50' : ''}`}>
              <Lock size={32} className="mx-auto mb-4 text-[#FFD700]" />
              <h2 className="text-white text-xl font-bold mb-2 uppercase tracking-widest">Admin Override</h2>
              <p className="text-gray-400 text-sm mb-6">Enter Master PIN to authenticate as <strong className="text-[#FFD700]">{pendingAdminName}</strong></p>
              <input type="password" maxLength={4} autoFocus
                className="w-full bg-black/50 text-white border-2 border-white/5 focus:border-[#FFD700] rounded-xl px-4 py-4 mb-6 text-center tracking-[1em] text-2xl shadow-inner outline-none"
                placeholder="••••" value={adminPinInput}
                onChange={(e) => {
                  setAdminPinInput(e.target.value);
                  if (e.target.value.length === 4) {
                     if (e.target.value === ROOM_PINS['Admin Only']) {
                        setAdminAuthModal(false);
                        setIsConnecting(true); playSuccess(); socket.auth = { username: pendingAdminName }; socket.connect();
                     } else {
                        playError(); setAdminAuthModal(false);
                        setCustomAlert({title: 'SYSTEM BREACH DETECTED', msg: `Imposter flagged. You are not ${pendingAdminName}. Incident logged.`});
                        setUsername(''); setAdminPinInput('');
                     }
                  }
                }}
              />
              <button onClick={() => {setAdminAuthModal(false); setUsername(''); setAdminPinInput('');}} className="w-full bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all mac-click">Cancel</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-gray-200 overflow-hidden font-sans animate-spring relative" onDrop={(e) => storageUsed < STORAGE_LIMIT && handleDrop(e)} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      
      {godMode && (
        <div className="absolute inset-0 z-0 pointer-events-none opacity-30 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/30 via-[#0a0a0a] to-[#0a0a0a] animate-pulse" />
      )}

      <ParticleCanvas isAnimating={fireParticles} isGodMode={godMode} />
      
      <style>{`
        @keyframes file-drop { 0% { transform: translateY(-10px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
        .animate-file-drop { animation: file-drop 0.3s ease-out both; }

        @keyframes thanos-snap {
          0% { filter: brightness(1); transform: scale(1); opacity: 1; }
          20% { filter: brightness(2) drop-shadow(0 0 10px red); transform: scale(1.02); }
          100% { filter: blur(10px) drop-shadow(0 -50px 20px red); transform: scale(0.8) translateY(-50px) rotate(5deg); opacity: 0; }
        }
        .anim-purge { animation: thanos-snap 0.6s cubic-bezier(0.5, 0, 1, 1) forwards; pointer-events: none; }

        @keyframes scale-in-center { 0% { transform: scale(0); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
        .animate-scale-in { animation: scale-in-center 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) both; }

        @keyframes vault-sweep { 0% { opacity: 0; transform: translateY(15px) scale(0.98); filter: blur(4px); } 100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); } }
        .animate-vault-sweep { animation: vault-sweep 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        
        .mac-click:active { transform: scale(0.95); transition: transform 0.1s; }
      `}</style>

      {showPinModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] px-4 backdrop-blur-md transition-all duration-500">
          <div className={`bg-[#121212]/95 border border-white/10 p-8 rounded-3xl w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-spring ${pinError ? 'animate-shake border-red-500/50' : ''}`}>
            <div className="flex justify-center mb-4"><div className={`w-16 h-16 rounded-full flex items-center justify-center border ${pinError ? 'bg-red-500/10 border-red-500/30' : pinSuccessMsg ? 'bg-green-500/20 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)]' : `${brandBg}/10 ${brandBorder}/30`}`}><Lock size={28} className={pinError ? 'text-red-500' : pinSuccessMsg ? 'text-green-400' : brandColor} /></div></div>
            <h2 className="text-white text-xl font-bold mb-1 text-center tracking-wide">{pinSuccessMsg ? 'Authorization Valid' : 'Security Clearance'}</h2>
            <p className="text-center text-sm font-medium h-12 flex items-center justify-center px-2">{pinError ? <span className="text-red-400">{pinError}</span> : pinSuccessMsg ? <span className="text-green-400 text-center">{pinSuccessMsg}</span> : <span className="text-gray-400">Enter PIN to access <strong className="text-white">{pendingRoom}</strong></span>}</p>
            {!pinSuccessMsg && (
              <>
                <input type="password" maxLength={4} value={pinInput} onChange={(e) => { const val = e.target.value; setPinInput(val); if (pinError) setPinError(''); if (val.length === 4) submitPin(val); }} onKeyDown={(e) => e.key === 'Enter' && submitPin()} className={`w-full bg-black/50 text-white border-2 rounded-xl px-4 py-4 mt-2 mb-6 focus:outline-none text-center tracking-[1em] text-2xl shadow-inner transition-colors duration-300 ${pinError ? 'border-red-500/50 focus:border-red-500' : `border-white/5 focus:${brandBorder}`}`} placeholder="••••" autoFocus />
                <div className="flex gap-3"><button onClick={() => { setShowPinModal(false); setPinInput(''); setPinError(''); }} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-3 rounded-xl font-medium transition-colors mac-click">Cancel</button><button onClick={() => submitPin()} className={`flex-1 ${brandBg} hover:opacity-80 text-black py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_currentColor] mac-click`}>Authorize</button></div>
              </>
            )}
          </div>
        </div>
      )}

      {contextMenu.show && contextMenu.file && (
        <div className="fixed z-[1000] w-56 bg-[#121212]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden py-2 animate-spring" style={{ top: Math.min(contextMenu.y, window.innerHeight - 200), left: Math.min(contextMenu.x, window.innerWidth - 250) }}>
          <div className="px-4 py-2 border-b border-white/5 mb-2"><p className="text-xs font-bold text-white truncate w-full">{contextMenu.file.fileName}</p></div>
          {!contextMenu.file.isFolder && checkPreviewable(contextMenu.file.fileName) && (
            <button onClick={() => openPreview(contextMenu.file)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-3 transition-colors mac-click"><Eye size={16} /> Preview Asset</button>
          )}
          {contextMenu.file.isFolder ? (
            <button onClick={() => setCurrentFolderId(contextMenu.file.savedAs)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-3 transition-colors mac-click"><Folder size={16} /> Open Directory</button>
          ) : (
            <>
              <button onClick={(e) => triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(contextMenu.file.savedAs || contextMenu.file.fileName)}`, contextMenu.file.fileName)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-3 transition-colors mac-click"><Download size={16} /> Download Source</button>
              <button onClick={() => handleCopyLink(`${SERVER_URL}/download/${encodeURIComponent(contextMenu.file.savedAs || contextMenu.file.fileName)}`)} className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/10 flex items-center gap-3 transition-colors mac-click"><Link size={16} /> Copy Network Link</button>
            </>
          )}
          {(contextMenu.file.sender === displayUsername || isAdminSession) && (
            <button onClick={() => promptDelete(contextMenu.file.savedAs || contextMenu.file.fileName)} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 flex items-center gap-3 transition-colors mt-2 border-t border-white/5 pt-3 mac-click"><Trash2 size={16} /> Purge from Node</button>
          )}
        </div>
      )}

      {isDragging && storageUsed < STORAGE_LIMIT && (
        <div className="absolute inset-0 z-[500] bg-[#FFD700]/10 border-4 border-dashed border-[#FFD700] rounded-xl flex items-center justify-center backdrop-blur-sm pointer-events-none transition-all duration-300">
           <div className="bg-black/80 px-8 py-6 rounded-2xl border border-[#FFD700]/50 text-center animate-spring shadow-2xl flex flex-col items-center">
             <Download className="text-[#FFD700] w-12 h-12 mb-4 animate-bounce" />
             <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-1">Incoming Assets</h2>
             <p className="text-[#FFD700] font-medium">Release to open Transmission Protocol</p>
           </div>
        </div>
      )}

      {showFolderModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[700] px-4 backdrop-blur-md">
          <div className={`bg-[#121212] border ${brandBorder}/30 p-8 rounded-3xl w-full max-w-sm shadow-[0_20px_60px_rgba(0,0,0,0.8)] animate-spring relative z-10`}>
            <h2 className="text-white text-xl font-bold mb-4 uppercase tracking-widest flex items-center gap-2"><FolderPlus size={20} className={brandColor}/> New Folder</h2>
            <input type="text" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Folder Name..." className={`w-full bg-[#0a0a0a] border border-gray-800 text-white px-4 py-3 rounded-xl focus:${brandBorder} outline-none mb-4`} autoFocus />
            <select value={newFolderTarget} onChange={(e) => setNewFolderTarget(e.target.value)} className={`w-full bg-[#0a0a0a] border border-gray-800 ${brandColor} px-4 py-3 rounded-xl outline-none mb-6`}>
              <option value="Everyone">Visibility: Entire Room</option>
              {activeUsers.filter(u => u.username !== displayUsername).map(u => <option key={u.id} value={u.username}>Private: {u.username}</option>)}
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowFolderModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl transition-colors mac-click">Cancel</button>
              <button onClick={handleCreateFolder} className={`flex-1 ${brandBg} text-black font-bold py-3 rounded-xl hover:opacity-80 mac-click`}>Create</button>
            </div>
          </div>
        </div>
      )}

      {stagingFiles.length > 0 && (
        <div className="absolute inset-0 z-[600] bg-black/80 flex items-center justify-center backdrop-blur-md p-4 animate-spring">
          <div className={`bg-[#121212] border ${brandBorder}/30 rounded-3xl w-full max-w-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh] relative z-10`}>
            <div className={`${brandBg}/10 border-b ${brandBorder}/20 p-6 flex justify-between items-center shrink-0`}>
              <div className="flex items-center gap-3">
                <div className={`${brandBg} text-black p-2 rounded-xl shadow-[0_0_15px_currentColor]`}><Activity size={24} /></div>
                <div>
                  <h2 className="text-white text-xl font-bold uppercase tracking-widest leading-tight">Transmission Protocol</h2>
                  <p className={`${brandColor} text-xs font-medium`}>{stagingFiles.length > 0 && !!stagingFiles[0].webkitRelativePath ? `Creating Directory: ${stagingFiles[0].webkitRelativePath.split('/')[0]}` : `${stagingFiles.length} file(s) staged`}</p>
                </div>
              </div>
              <button onClick={() => setStagingFiles([])} className="text-gray-400 hover:text-white transition-colors bg-white/5 p-2 rounded-full mac-click"><X size={24} /></button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto space-y-8">
              <div>
                <h3 className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Users size={14} /> 1. Select Secure Target</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <button onClick={() => setStagedTarget('Everyone')} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all mac-click ${stagedTarget === 'Everyone' ? `${brandBg} text-black ${brandBorder} shadow-[0_0_15px_currentColor]` : 'bg-[#1a1a1a] text-gray-400 border-gray-800 hover:bg-[#222]'}`}><Share2 size={20} /><span className="font-bold text-xs uppercase">Entire Room</span></button>
                  {activeUsers.filter(u => u.username !== displayUsername).map(u => (
                    <button key={u.id} onClick={() => setStagedTarget(u.username)} className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all mac-click ${stagedTarget === u.username ? 'bg-purple-500 text-white border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-[#1a1a1a] text-gray-400 border-gray-800 hover:bg-[#222]'}`}><Lock size={20} /><span className="font-bold text-xs truncate w-full text-center">{u.username}</span></button>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs text-gray-500 font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Clock size={14} /> 2. Set Self-Destruct Timer</h3>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 12, 24, 168].map(hours => (
                    <button key={hours} onClick={() => setStagedExpiry(hours)} className={`py-3 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all mac-click ${stagedExpiry === hours ? 'bg-red-500 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-[#1a1a1a] text-gray-400 border-gray-800 hover:bg-[#222]'}`}><span className="font-bold text-[10px] sm:text-xs uppercase">{hours === 168 ? '7 Days' : `${hours} Hours`}</span></button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-black/50 border-t border-white/5 shrink-0 flex gap-4">
               <button onClick={() => setStagingFiles([])} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-4 rounded-xl transition-colors mac-click">Cancel</button>
               <button onClick={executeStagedUploads} className={`flex-[2] ${brandBg} hover:opacity-80 text-black font-bold uppercase tracking-widest py-4 rounded-xl shadow-[0_0_20px_currentColor] transition-all mac-click flex items-center justify-center gap-2`}><Send size={18} /> Initiate Upload</button>
            </div>
          </div>
        </div>
      )}

      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />}

      <aside className={`fixed md:relative z-50 h-full w-64 bg-[#121212] border-r border-gray-800 flex flex-col transition-transform duration-300 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} ${godMode ? 'border-red-900/50 bg-[#050505]' : ''}`}>
        <div className="p-6 flex flex-col shrink-0 border-b border-gray-800/50 relative z-10">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tighter italic flex overflow-hidden py-1"><span className={brandColor}><AnimatedText text="MVK" delayOffset={0.1} /></span><span className={`${brandColor} ml-2`}><AnimatedText text="NET" delayOffset={0.3} /></span></h1>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest overflow-hidden"><AnimatedText text="Internal Protocol v1.0" delayOffset={0.5} /></div>
            </div>
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X size={24} /></button>
          </div>
          <div className="bg-black/40 rounded-2xl p-4 border border-white/5 backdrop-blur-md shadow-inner">
            <div className="flex items-center gap-2 mb-2"><HardDrive size={14} className={storageUsed >= STORAGE_LIMIT ? 'text-red-500' : 'text-gray-400'} /><div className="flex justify-between w-full text-[10px] uppercase tracking-wider font-bold text-gray-400"><span>Drive Status</span><span className={storageUsed >= STORAGE_LIMIT ? 'text-red-500' : 'text-white'}>{storageUsed.toFixed(1)} / {STORAGE_LIMIT} GB</span></div></div>
            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden shadow-inner"><div className={`h-full rounded-full transition-all duration-1000 ease-out ${storageUsed >= 90 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : `${brandBg} shadow-[0_0_10px_currentColor]`}`} style={{ width: `${Math.min((storageUsed / STORAGE_LIMIT) * 100, 100)}%` }}></div></div>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto relative z-10 mt-2 pb-[100px] flex flex-col">
          <div>
            {rooms.map((room) => (
              <button key={room.name} onClick={() => attemptRoomJoin(room.name)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all mb-2 mac-click ${activeRoom === room.name ? `${brandBg}/10 ${brandColor} border ${brandBorder}/30 shadow-[0_0_15px_currentColor]` : 'hover:bg-white/5 text-gray-400'}`}>
                <div className="flex items-center gap-3"><span className={`${activeRoom === room.name ? brandColor : 'text-gray-400'}`}>{room.icon}</span><span className="font-medium text-sm">{room.name}</span></div>
                {room.locked && activeRoom !== room.name && <Lock size={14} className="text-gray-600" />}
              </button>
            ))}
          </div>
          
          <div className="mt-auto flex flex-col gap-2">
            {hasUpdate && (
              <div className="mx-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex flex-col gap-1 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <div className="flex items-center gap-2 text-blue-400 font-bold text-[10px] uppercase tracking-widest">
                  <Download size={12} className="animate-bounce" /> System Update Ready
                </div>
                <p className="text-[10px] text-gray-400 leading-tight">Beast PC is {commitsBehind} version(s) behind. Run Update_Vault.bat.</p>
              </div>
            )}
            <button onClick={() => setShowCredits(true)} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-white/5 hover:text-white transition-all mac-click border border-transparent hover:border-white/10">
              <ShieldCheck size={18} />
              <span className="font-medium text-sm">Credits & License</span>
            </button>
          </div>
        </nav>
        <div className="absolute bottom-0 w-full h-[56px] shrink-0 border-t border-gray-800 flex items-center gap-3 px-6 bg-[#121212] z-10">
          {godMode ? (
            <Cpu className="text-red-500 animate-pulse" size={24} />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white shadow-inner border border-white/10" style={{ background: getAvatarGradient(displayUsername) }}>{displayUsername.charAt(0).toUpperCase()}</div>
          )}
          <div className={`truncate text-sm font-bold ${godMode ? 'text-red-500 uppercase tracking-widest' : 'text-white'}`}>{displayUsername}</div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative w-full overflow-hidden z-10">
        <header className="shrink-0 h-16 border-b border-gray-800 flex items-center px-4 md:px-8 bg-[#0a0a0a]/80 backdrop-blur-xl z-10 justify-between">
          <div className="flex items-center gap-4">
            <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(true)}><Menu size={24} /></button>
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide py-1">
               <span onClick={() => setCurrentFolderId(null)} className={`text-sm font-bold uppercase tracking-widest cursor-pointer transition-colors ${!currentFolderId ? 'text-white' : `text-gray-500 hover:${brandColor}`}`}>{activeRoom}</span>
               {getBreadcrumbs().map((crumb, idx, arr) => (
                 <div key={crumb.savedAs} className="flex items-center gap-2">
                   <ChevronRight size={14} className="text-gray-600" />
                   <span onClick={() => setCurrentFolderId(crumb.savedAs)} className={`text-sm font-bold uppercase tracking-widest cursor-pointer transition-colors max-w-[100px] sm:max-w-[150px] truncate ${idx === arr.length - 1 ? brandColor : `text-gray-500 hover:${brandColor}`}`}>{crumb.fileName}</span>
                 </div>
               ))}
            </div>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto p-4 md:p-8 pb-[180px] md:pb-[200px] relative">
          
          {activeRoom !== 'Admin Only' && !currentFolderId && (
            <div className="mb-8 w-full max-w-5xl mx-auto">
              <h3 className="text-xs text-gray-500 font-bold tracking-widest uppercase mb-4">Systems Online ({activeUsers.length})</h3>
              <div className="flex flex-wrap gap-4">
                {activeUsers.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 bg-[#121212] border border-gray-800 px-4 py-2 rounded-full shadow-lg">
                    {user.username === 'SYSTEM ADMIN' ? <Cpu size={14} className="text-red-500 animate-pulse" /> : (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-inner" style={{ background: getAvatarGradient(user.username) }}>{user.username.charAt(0).toUpperCase()}</div>
                    )}
                    <span className="text-sm font-medium">{user.username} {user.username === displayUsername ? '(You)' : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}  

          <div key={activeRoom + (currentFolderId || 'root')} className="w-full max-w-5xl mx-auto animate-vault-sweep">
            {Object.keys(networkUploads).length > 0 && (
              <div className="mb-6 space-y-3">
                <h3 className={`text-[10px] ${brandColor} font-bold tracking-widest uppercase flex items-center gap-2 animate-pulse`}><Activity size={12} /> Live Network Transmissions</h3>
                {Object.values(networkUploads).map((upload, idx) => (
                  <div key={idx} className={`bg-black/40 border ${brandBorder}/20 p-4 rounded-2xl backdrop-blur-md animate-spring shadow-[0_0_20px_currentColor]`}>
                    <div className="flex justify-between text-xs mb-2"><span className="text-gray-300"><strong className="text-white">{upload.user}</strong> is broadcasting <span className="text-blue-400 truncate max-w-[150px] inline-block align-bottom">{upload.fileName}</span></span><span className={`${brandColor} font-mono`}>{upload.progress}%</span></div>
                    <div className="w-full bg-gray-900 rounded-full h-1 overflow-hidden"><div className={`${brandBg} h-full rounded-full transition-all duration-300 shadow-[0_0_10px_currentColor]`} style={{ width: `${upload.progress}%` }}></div></div>
                  </div>
                ))}
              </div>
            )}

            {(roomItems.length > 0 || currentFolderId) && (
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
                <div className="relative w-full sm:w-96"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} /><input type="text" placeholder={`Search this sector...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full bg-[#121212]/80 border border-white/5 text-white pl-11 pr-4 py-3 rounded-2xl focus:outline-none focus:${brandBorder}/50 transition-all duration-300 backdrop-blur-xl shadow-inner`} /></div>
                <div className="flex bg-[#121212]/80 border border-white/5 rounded-xl p-1 w-full sm:w-auto justify-center backdrop-blur-xl">
                  {/* BATCH SELECT ALL TOGGLE */}
                  <button onClick={() => setSelectedFiles(selectedFiles.length === filteredItems.length ? [] : filteredItems.map(i => i.savedAs))} className={`flex items-center gap-2 mr-2 px-3 py-2 rounded-lg transition-all duration-300 ${selectedFiles.length > 0 ? `${brandBg}/20 ${brandColor} shadow-sm` : 'text-gray-500 hover:text-white'}`}><CheckSquare size={16} /> <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Select All</span></button>
                  <div className="w-px bg-gray-800 mx-1"></div>
                  <button onClick={() => setViewMode('list')} className={`flex-1 sm:flex-none flex justify-center p-2 rounded-lg transition-all duration-300 ${viewMode === 'list' ? `${brandBg}/20 ${brandColor} shadow-sm` : 'text-gray-500 hover:text-white'}`}><List size={20} /></button>
                  <button onClick={() => setViewMode('grid')} className={`flex-1 sm:flex-none flex justify-center p-2 rounded-lg transition-all duration-300 ${viewMode === 'grid' ? `${brandBg}/20 ${brandColor} shadow-sm` : 'text-gray-500 hover:text-white'}`}><LayoutGrid size={20} /></button>
                </div>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="text-center text-gray-600 mt-20 font-medium">{searchQuery ? 'No matching assets found.' : 'This directory is empty.'}</div>
            ) : viewMode === 'list' ? (
              <div className="space-y-3">
                {filteredItems.map((item, idx) => {
                  const props = item.isFolder ? { icon: Folder, color: brandColor, bg: `${brandBg}/10`, shadow: `group-hover:shadow-[0_0_15px_currentColor]` } : getFileProps(item.fileName);
                  const IconComp = props.icon;
                  const isSelected = selectedFiles.includes(item.savedAs);
                  
                  return (
                    <div key={idx} style={{ animationDelay: `${idx * 0.05}s` }} onContextMenu={(e) => openContextMenu(e, item)} className={`bg-[#121212]/60 border p-4 rounded-2xl flex items-center justify-between transition-all duration-300 backdrop-blur-md group relative ${deletingItemIds.includes(item.savedAs || item.fileName)
 ? 'anim-purge' : 'animate-file-drop'} ${isSelected ? `${brandBorder}/50 bg-[#1a1a1a] shadow-[0_0_15px_currentColor]` : `border-white/5 hover:bg-[#1a1a1a] hover:scale-[1.01] hover:border-white/10 ${props.shadow}`}`}>
                      
     {/* BATCH CHECKBOX (LIST VIEW) */}
                      <div onClick={(e) => toggleFileSelection(e, item.savedAs || item.fileName)} className={`absolute left-4 top-1/2 -translate-y-1/2 p-1 rounded-md border-2 cursor-pointer transition-all duration-200 z-20 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isSelected ? `${brandBg} ${brandBorder} text-black opacity-100 scale-100` : `bg-black/90 border-gray-500 text-transparent opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 hover:border-white`}`}>
                        <Check size={14} className={isSelected ? 'opacity-100' : 'opacity-0'} strokeWidth={4} />
                      </div>

                      <div className={`flex items-center gap-4 overflow-hidden flex-1 cursor-pointer transition-all duration-300 ${isSelected ? 'ml-10' : 'group-hover:ml-10'}`} onClick={() => item.isFolder ? setCurrentFolderId(item.savedAs) : toggleFileSelection({stopPropagation:()=>{}} as any, item.savedAs)}>

                        <div className={`p-3 rounded-xl shrink-0 shadow-inner transition-colors ${props.bg} ${props.color}`}>
                          <IconComp size={24} className={item.isFolder ? 'fill-current opacity-50' : ''} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className={`font-medium truncate ${item.isFolder ? brandColor : 'text-white'}`}>{item.fileName}</p>
                            {item.targetRecipient && item.targetRecipient !== 'Everyone' && (<span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30 uppercase font-bold tracking-wider shrink-0">Private</span>)}
                          </div>
                          <div className="flex items-center gap-3">
                             <p className="text-xs text-gray-500">{item.isFolder ? 'Virtual Directory' : `${(item.size / 1024 / 1024).toFixed(2)} MB`} • Sent by {item.sender}</p>
                             {!item.isFolder && item.expiresAt && <TimeTicker expiresAt={item.expiresAt} />}
                          </div>
                        </div>
                      </div>
                      
                      <div className={`flex items-center gap-2 transition-opacity duration-300 ${isSelected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        {!item.isFolder && <button onClick={(e) => { e.stopPropagation(); handleCopyLink(`${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`) }} title="Copy Link" className="shrink-0 text-gray-500 hover:text-white hover:bg-white/10 p-3 rounded-xl transition-all duration-300 mac-click"><Link size={20} /></button>}
                        {(item.sender === displayUsername || isAdminSession) && (<button onClick={(e) => { e.stopPropagation(); promptDelete(item.savedAs || item.fileName) }} className="shrink-0 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-3 rounded-xl transition-all duration-300 opacity-0 group-hover:opacity-100 mac-click"><Trash2 size={20} /></button>)}
                        {!item.isFolder && checkPreviewable(item.fileName) && (<button onClick={(e) => { e.stopPropagation(); openPreview(item) }} className="shrink-0 text-blue-400 hover:bg-blue-400 hover:text-black hover:shadow-[0_0_15px_rgba(96,165,250,0.4)] p-3 rounded-xl transition-all duration-300 border border-blue-400/20 mac-click"><Eye size={20} /></button>)}
                        {!item.isFolder && <button onClick={(e) => { e.stopPropagation(); triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`, item.fileName) }} className={`shrink-0 ${brandColor} hover:${brandBg} hover:text-black hover:shadow-[0_0_15px_currentColor] p-3 rounded-xl transition-all duration-300 border ${brandBorder}/20 mac-click inline-block`}><Download size={20} /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredItems.map((item, idx) => {
                  const props = item.isFolder ? { icon: Folder, color: brandColor, bg: `${brandBg}/10`, shadow: `hover:shadow-[0_0_40px_currentColor]` } : getFileProps(item.fileName);
                  const IconComp = props.icon;
                  const isSelected = selectedFiles.includes(item.savedAs);

                  return (
                    <div key={idx} style={{ animationDelay: `${idx * 0.05}s` }} onContextMenu={(e) => openContextMenu(e, item)} onClick={() => item.isFolder && !isSelected ? setCurrentFolderId(item.savedAs) : toggleFileSelection({stopPropagation:()=>{}} as any, item.savedAs)} className={`bg-[#121212]/60 border p-6 rounded-3xl flex flex-col items-center text-center transition-all duration-300 backdrop-blur-md group relative cursor-pointer ${deletingItemIds.includes(item.savedAs || item.fileName)
 ? 'anim-purge' : 'animate-file-drop'} ${isSelected ? `${brandBorder}/50 bg-[#1a1a1a] shadow-[0_0_20px_currentColor] -translate-y-1` : `border-white/5 hover:bg-[#1a1a1a] hover:-translate-y-1 hover:border-white/10 ${props.shadow.replace('group-', '')}`}`}>
                      
                      {/* BATCH CHECKBOX (GRID VIEW) */}
                      <div onClick={(e) => toggleFileSelection(e, item.savedAs || item.fileName)} className={`absolute left-5 top-5 p-1 rounded-md border-2 cursor-pointer transition-all duration-200 z-20 shadow-[0_0_15px_rgba(0,0,0,0.5)] ${isSelected ? `${brandBg} ${brandBorder} text-black opacity-100 scale-100` : `bg-black/90 border-gray-500 text-transparent opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 hover:border-white`}`}>
                        <Check size={16} className={isSelected ? 'opacity-100' : 'opacity-0'} strokeWidth={4} />
                      </div>

                      {(item.sender === displayUsername || isAdminSession) && !isSelected && (<button onClick={(e) => { e.stopPropagation(); promptDelete(item.savedAs || item.fileName) }} className="absolute top-4 right-4 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all duration-300 opacity-0 group-hover:opacity-100 mac-click z-10"><Trash2 size={16} /></button>)}
                      
                      <div className={`p-5 rounded-2xl transition-colors mb-4 shadow-inner ${props.bg} ${props.color}`}>
                        <IconComp size={32} className={item.isFolder ? 'fill-current opacity-50' : ''} />
                      </div>
                      <p className={`font-medium w-full mb-1 truncate px-2 ${item.isFolder ? brandColor : 'text-white'}`}>{item.fileName}</p>
                      
                      <div className="flex flex-col items-center gap-1 mb-6 mt-1">
                        {item.targetRecipient && item.targetRecipient !== 'Everyone' && (<span className="text-[9px] bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded border border-purple-500/30 uppercase font-bold tracking-wider">Private</span>)}
                        <p className="text-xs text-gray-500">{item.isFolder ? 'Virtual Directory' : `${(item.size / 1024 / 1024).toFixed(2)} MB`} • {item.sender}</p>
                        {!item.isFolder && item.expiresAt && <TimeTicker expiresAt={item.expiresAt} />}
                      </div>

                      {!item.isFolder && (
                        <div className={`w-full flex gap-2 mb-2 transition-opacity duration-300 ${isSelected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                          <button onClick={(e) => { e.stopPropagation(); triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`, item.fileName) }} className={`flex-[3] flex items-center justify-center gap-2 ${brandColor} hover:${brandBg} hover:text-black py-3 rounded-xl transition-all duration-300 border ${brandBorder}/20 hover:shadow-[0_0_15px_currentColor] mac-click`}><Download size={18} /> <span className="font-bold text-sm">Download</span></button>
                          <button onClick={(e) => { e.stopPropagation(); handleCopyLink(`${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`) }} className={`flex-1 flex items-center justify-center gap-2 text-gray-400 hover:text-white hover:bg-white/10 py-3 rounded-xl transition-all duration-300 border border-white/10 mac-click`}><Link size={18} /></button>
                        </div>
                      )}
                      {!item.isFolder && <div className={`w-full flex gap-2 transition-opacity duration-300 ${isSelected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>{checkPreviewable(item.fileName) && (<button onClick={(e) => { e.stopPropagation(); openPreview(item) }} className="flex-1 flex items-center justify-center gap-2 text-blue-400 hover:bg-blue-400 hover:text-black py-3 rounded-xl transition-all duration-300 border border-blue-400/20 hover:shadow-[0_0_15px_rgba(96,165,250,0.4)] mac-click"><Eye size={18} /></button>)}</div>}
                      {item.isFolder && <button onClick={(e) => { e.stopPropagation(); setCurrentFolderId(item.savedAs) }} className={`w-full flex items-center justify-center gap-2 ${brandBg}/10 ${brandColor} hover:${brandBg} hover:text-black py-3 rounded-xl transition-all duration-300 border ${brandBorder}/20 mac-click font-bold text-sm transition-opacity duration-300 ${isSelected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>Open Folder</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* --- FLOATING BATCH ACTION BAR --- */}
        <div className={`absolute bottom-[160px] left-1/2 -translate-x-1/2 w-full max-w-lg px-4 z-30 transition-all duration-500 ${selectedFiles.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'}`}>
          <div className={`bg-[#121212]/95 backdrop-blur-xl border ${brandBorder}/50 p-4 rounded-2xl flex items-center justify-between shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-spring`}>
            <div className="flex items-center gap-3">
               <div className={`w-8 h-8 rounded-full ${brandBg} flex items-center justify-center text-black font-bold text-sm shadow-[0_0_15px_currentColor]`}>{selectedFiles.length}</div>
               <span className="text-white font-bold uppercase tracking-widest text-xs hidden sm:block">Assets Selected</span>
            </div>
            <div className="flex items-center gap-2">
               <button onClick={handleBatchDownload} disabled={isBatchDownloading} className={`flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-colors mac-click ${isBatchDownloading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                 {isBatchDownloading ? <Activity size={16} className="animate-spin" /> : <Download size={16} />} 
                 <span className="hidden sm:inline">{isBatchDownloading ? 'Zipping...' : 'Download All'}</span>
               </button>
               <button onClick={promptBatchDelete} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all mac-click">
                 <Trash2 size={16} /> <span className="hidden sm:inline">Purge</span>
               </button>
               <button onClick={() => setSelectedFiles([])} className="p-2.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-xl transition-colors mac-click">
                 <X size={16} />
               </button>
            </div>
          </div>
        </div>

        <div className="absolute bottom-[70px] md:bottom-[80px] left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20 pointer-events-none">
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className={`mb-2 w-full max-w-sm mx-auto bg-black/60 backdrop-blur-xl border ${brandBorder}/30 p-3 rounded-xl flex items-center gap-3 shadow-lg animate-spring pointer-events-auto`}>
              <Activity size={18} className={`${brandColor} animate-pulse shrink-0`} />
              <div className="flex-1 w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
                <div className={`${brandBg} h-full rounded-full transition-all duration-300 shadow-[0_0_10px_currentColor]`} style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <span className={`${brandColor} font-mono text-xs font-bold`}>{uploadProgress}%</span>
            </div>
          )}

          <div className="flex gap-2 sm:gap-4 pointer-events-auto">
            <button onClick={() => setShowFolderModal(true)} disabled={storageUsed >= STORAGE_LIMIT} className={`flex-1 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 transition-all duration-300 shadow-xl flex items-center justify-center gap-2 sm:gap-3 mac-click ${storageUsed >= STORAGE_LIMIT ? 'bg-red-900/20 opacity-50' : `bg-[#121212]/80 hover:border-${godMode?'red-500':'[#FFD700]'}/50 text-gray-300 hover:${brandColor}`}`}>
              <FolderPlus size={20} className="shrink-0" />
              <span className="font-bold tracking-widest uppercase text-[10px] sm:text-xs text-center leading-tight hidden sm:inline">New Folder</span>
            </button>
            <button onClick={() => storageUsed < STORAGE_LIMIT && fileInputRef.current?.click()} disabled={storageUsed >= STORAGE_LIMIT} className={`flex-[2] backdrop-blur-2xl border border-white/10 rounded-2xl p-4 transition-all duration-300 shadow-xl flex items-center justify-center gap-2 sm:gap-3 mac-click ${storageUsed >= STORAGE_LIMIT ? 'bg-red-900/20 opacity-50' : `bg-[#121212]/80 hover:border-${godMode?'red-500':'[#FFD700]'}/50 text-gray-300 hover:text-white`}`}>
              <FilePlus className={`${brandColor} shrink-0`} size={20} />
              <span className="font-bold tracking-widest uppercase text-[10px] sm:text-xs">Upload Files</span>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            </button>
            <button onClick={() => storageUsed < STORAGE_LIMIT && folderInputRef.current?.click()} disabled={storageUsed >= STORAGE_LIMIT} className={`flex-[2] backdrop-blur-2xl border border-white/10 rounded-2xl p-4 transition-all duration-300 shadow-xl flex items-center justify-center gap-2 sm:gap-3 mac-click ${storageUsed >= STORAGE_LIMIT ? 'bg-red-900/20 opacity-50' : `bg-[#121212]/80 hover:border-${godMode?'red-500':'[#FFD700]'}/50 text-gray-300 hover:text-white`}`}>
              <FolderUp className={`${brandColor} shrink-0`} size={20} />
              <span className="font-bold tracking-widest uppercase text-[10px] sm:text-xs">Upload Folder</span>
              {/* @ts-ignore */}
              <input type="file" webkitdirectory="" directory="" className="hidden" ref={folderInputRef} onChange={handleFileSelect} />
            </button>
          </div>
        </div>

        <footer className="absolute bottom-0 w-full h-[56px] bg-[#0a0a0a]/90 backdrop-blur-xl border-t border-gray-800 flex justify-center items-center z-30">
          <div className="flex flex-wrap justify-center items-center gap-2 md:gap-4 text-[9px] md:text-[11px] tracking-[0.15em] uppercase text-center px-4">
            <span className={`${brandColor} font-bold text-[10px] md:text-[12px] tracking-[0.2em]`}>MVK BUILDERS AND DEVELOPERS NETWORK</span>
            <div className={`hidden sm:block w-1 h-1 ${brandBg} rounded-full animate-pulse shadow-[0_0_8px_currentColor]`}></div>
            <span className="text-gray-500 font-medium hidden sm:inline">© {new Date().getFullYear()}</span>
          </div>
        </footer>

        {/* ALERTS & MODALS */}
        {/* CREDITS & LICENSE MODAL (ENHANCED ENTERPRISE EDITION) */}
        {showCredits && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[500] p-4 backdrop-blur-xl animate-spring">
            {/* Ambient Background Glow */}
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] ${brandBg} rounded-full blur-[120px] opacity-10 pointer-events-none`}></div>
            
            <div className="bg-[#0a0a0a]/90 border border-white/10 p-1 rounded-3xl w-full max-w-2xl shadow-[0_30px_100px_rgba(0,0,0,1)] relative z-10 overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${godMode?'red-500':'[#FFD700]'} to-transparent opacity-50`}></div>
              
              <div className="bg-[#121212] rounded-[22px] p-6 sm:p-8 relative overflow-hidden">
                <button onClick={() => setShowCredits(false)} className="absolute top-6 right-6 text-gray-500 hover:text-white transition-all hover:rotate-90 mac-click z-20 bg-black/50 p-2 rounded-full border border-white/5"><X size={20} /></button>
                
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 relative z-10">
                  <div className="relative group shrink-0">
                    <div className={`absolute inset-0 ${brandBg} blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-2xl`}></div>
                    <div className={`w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-black text-black shadow-[0_0_20px_currentColor] ${brandBg} relative z-10 border border-white/20 overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent"></div>
                      VM
                    </div>
                    <div className="absolute -bottom-3 -right-3 bg-black border border-white/10 p-1.5 rounded-lg z-20 shadow-xl">
                      <ShieldCheck size={18} className={brandColor} />
                    </div>
                  </div>
                  
                  <div className="text-center sm:text-left flex-1 mt-2 sm:mt-0">
                    <div className="inline-flex px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3 items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${brandBg} animate-pulse shadow-[0_0_8px_currentColor]`}></span>
                      Level 5 Clearance
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight mb-1">Veer Madan</h2>
                    <p className={`${brandColor} font-bold text-xs sm:text-sm uppercase tracking-[0.2em] flex items-center justify-center sm:justify-start gap-2`}>
                      <Cpu size={16} /> Lead System Architect
                    </p>
                  </div>
                </div>
                
                {/* Body Section */}
                <div className="space-y-3 relative z-10">
                  <div className="group bg-black/50 border border-white/5 p-4 sm:p-5 rounded-2xl hover:border-white/10 transition-colors">
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2 mb-2">
                      <Code size={14} className="text-blue-400" /> System Architecture
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed font-medium">
                      This proprietary distribution network is custom-engineered exclusively for the <strong className="text-gray-200">MVK Builders and Developers Head Office</strong> to execute secure, high-velocity, local area asset management.
                    </p>
                  </div>
                  
                  <div className="group bg-black/50 border border-white/5 p-4 sm:p-5 rounded-2xl hover:border-white/10 transition-colors">
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2 mb-2">
                      <Lock size={14} className="text-red-400" /> Licensing & Usage Rights
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed font-medium">
                      Licensed strictly for internal operations. Commercialization outside the organization is strictly prohibited. I reserve the exclusive right to reference this engineering architecture in my professional portfolio and work experience.
                    </p>
                  </div>
                  
                  <div className="group bg-black/50 border border-white/5 p-4 sm:p-5 rounded-2xl hover:border-white/10 transition-colors">
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2 mb-2">
                      <Clock size={14} className="text-green-400" /> Long-Term Support (LTS)
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed font-medium">
                      Regardless of my active employment status within the company, I will remain bound to provide critical technical support, patches, and maintenance for this infrastructure.
                    </p>
                  </div>
                </div>
                
                {/* Footer / Branding */}
                <div className="mt-6 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-black ${brandBg}`}>MVK</div>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white leading-tight">Builders & Developers<br/><span className="text-gray-500">Authorized Network</span></span>
                  </div>
                  <div className="text-[9px] font-mono text-gray-600 tracking-widest text-center sm:text-right">
                    CORE.V.1.0.0<br/>DEPLOYED 2026
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {previewFile && (
          <div className="fixed inset-0 bg-black/95 flex flex-col z-[200] animate-spring backdrop-blur-xl">
            <header className="h-16 border-b border-white/10 flex items-center justify-between px-6 shrink-0 bg-black/50">
              <div className="flex items-center gap-3"><FileText className={brandColor} size={20} /><span className="text-white font-medium tracking-wide truncate max-w-xs md:max-w-xl">{previewFile.name}</span></div>
              <div className="flex items-center gap-4"><button onClick={(e) => triggerDownload(e, previewFile.url, previewFile.name)} className={`${brandColor} hover:text-white transition-colors flex items-center gap-2 text-sm font-bold tracking-widest uppercase mac-click`}><Download size={16} /> Save</button><button onClick={() => setPreviewFile(null)} className="text-gray-400 hover:text-white p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors mac-click"><X size={24} /></button></div>
            </header>
            <div className="flex-1 p-4 md:p-8 flex items-center justify-center overflow-hidden relative">
              {previewFile.type === 'image' ? <img src={previewFile.url} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)]" /> : <iframe src={previewFile.url} className="w-full h-full rounded-lg bg-white" title="PDF Preview" />}
            </div>
          </div>
        )}

        {toastMsg && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-[300] pointer-events-none">
            <div className="bg-white/10 border border-white/20 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] px-6 py-3 rounded-full flex items-center gap-3 animate-toast">
              <div className={`w-2 h-2 ${godMode ? 'bg-red-500' : 'bg-green-500'} rounded-full animate-pulse shadow-[0_0_10px_currentColor]`}></div><span className={`text-white text-sm ${godMode ? 'font-mono' : 'font-medium'} tracking-wide`}>{toastMsg}</span>
            </div>
          </div>
        )}

        {/* MULTI-DELETE CONFIRMATION MODAL */}
        {filesToDelete.length > 0 && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[250] px-4 backdrop-blur-md transition-all duration-500">
            <div className="bg-[#121212]/95 border border-red-900/50 p-8 rounded-3xl w-full max-w-sm shadow-[0_20px_60px_rgba(239,68,68,0.15)] backdrop-blur-xl animate-spring">
              <div className="flex justify-center mb-6"><div className="w-16 h-16 rounded-full flex items-center justify-center border bg-red-500/10 border-red-500/30 shadow-inner"><Trash2 size={28} className="text-red-500" /></div></div>
              <h2 className="text-white text-xl font-bold mb-2 text-center tracking-wide">Confirm Purge</h2>
              <p className="text-center text-sm text-gray-400 mb-8 px-2">Are you sure you want to permanently erase <strong className="text-white">{filesToDelete.length} asset(s)</strong>?<br/><span className="text-red-400/80 text-xs mt-2 block">This action cannot be undone.</span></p>
              <div className="flex gap-3"><button onClick={() => setFilesToDelete([])} className="flex-1 bg-white/5 hover:bg-white/10 text-gray-300 py-3 rounded-xl font-medium transition-colors mac-click">Cancel</button><button onClick={confirmBatchDelete} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] mac-click">Purge Assets</button></div>
            </div>
          </div>
        )}

        <div className={`fixed bottom-6 right-6 z-40 flex flex-col items-end transition-all duration-500 ${isChatOpen ? 'translate-y-0' : 'translate-y-0'}`}>
          <div className={`bg-[#121212]/95 border ${brandBorder}/20 rounded-2xl w-80 sm:w-96 mb-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all duration-300 origin-bottom-right flex flex-col overflow-hidden ${isChatOpen ? 'h-[400px] opacity-100 scale-100' : 'h-0 opacity-0 scale-95 pointer-events-none'}`}>
            <div className="h-14 bg-black/50 border-b border-white/5 flex items-center justify-between px-4 shrink-0"><div className="flex items-center gap-2"><MessageSquare size={16} className={brandColor} /><span className="text-sm font-bold text-white uppercase tracking-widest">{activeRoom} Comm-Link</span></div><button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white transition-colors mac-click p-1"><X size={18} /></button></div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatScrollRef}>
              {roomMessages.length === 0 ? <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs text-center px-4 space-y-2"><Activity size={24} className="text-gray-700" /><p>Encrypted channel open. Waiting for transmissions...</p></div> : roomMessages.map((msg, idx) => {
                  const isMe = msg.sender === displayUsername; const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (<div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-file-drop`}><span className="text-[10px] text-gray-500 mb-1 px-1 font-medium">{isMe ? 'You' : msg.sender} • {time}</span><div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm shadow-md ${isMe ? `${brandBg} text-black rounded-tr-sm font-medium` : 'bg-white/10 text-white border border-white/5 rounded-tl-sm'}`}>{msg.text}</div></div>);
              })}
            </div>
            <form onSubmit={handleSendMessage} className="p-3 bg-black/40 border-t border-white/5 shrink-0 flex gap-2"><input type="text" value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Transmit message..." className={`flex-1 bg-[#0a0a0a] border border-white/10 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:${brandBorder}/50 transition-colors shadow-inner`} /><button type="submit" disabled={!chatMessage.trim()} className={`${brandBg} text-black p-2 rounded-xl hover:opacity-80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mac-click shadow-[0_0_10px_currentColor]`}><Send size={18} /></button></form>
          </div>
          {isNameSet && isOnline && <button onClick={() => setIsChatOpen(!isChatOpen)} className={`w-14 h-14 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] border transition-all duration-300 mac-click ${isChatOpen ? 'bg-white/10 border-white/20 text-white rotate-12' : `${brandBg} ${brandBorder}/50 text-black hover:opacity-90 hover:shadow-[0_0_20px_currentColor]`}`}>{isChatOpen ? <X size={24} /> : <MessageSquare size={24} />}</button>}
        </div>
      </main>
    </div>
  );
};

export default App;