import React, { useState } from 'react';
import axios from 'axios';
import { ShieldAlert, Users, Activity, Lock, Skull, Terminal, RefreshCw, Radio } from 'lucide-react';
const SERVER_URL = `https://127.0.0.1:3000`;
const App = () => {
  const [adminKey, setAdminKey] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  
  const [users, setUsers] = useState<Record<string, any>>({});
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // --- 1. AUTHENTICATION ---
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true); setAuthError('');
    try {
      // Test the key against the backend
      const res = await axios.get(`${SERVER_URL}/api/admin/users`, { headers: { 'x-overlord-key': adminKey } });
      setUsers(res.data);
      setIsAuthenticated(true);
    } catch (err: any) {
      setAuthError('INVALID MASTER KEY. INTRUSION ATTEMPT LOGGED.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // --- 2. DATA SYNCING ---
  const fetchUsers = async () => {
    setIsSyncing(true);
    try {
      const res = await axios.get(`${SERVER_URL}/api/admin/users`, { headers: { 'x-overlord-key': adminKey } });
      setUsers(res.data);
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- 3. MATRIX CLEARANCE TOGGLES ---
  const toggleClearance = async (username: string, room: string) => {
    const user = users[username];
    const currentClearances = user.allowedRooms || [];
    
    let newClearances;
    if (currentClearances.includes(room)) {
      newClearances = currentClearances.filter((r: string) => r !== room);
    } else {
      newClearances = [...currentClearances, room];
    }

    // Optimistic UI update
    setUsers({ ...users, [username]: { ...user, allowedRooms: newClearances } });

    try {
      await axios.post(`${SERVER_URL}/api/admin/users/update`, 
        { targetUser: username, updates: { allowedRooms: newClearances } },
        { headers: { 'x-overlord-key': adminKey } }
      );
    } catch (err) {
      alert("Failed to update database.");
      fetchUsers(); // Revert on fail
    }
  };

  // --- 4. CHAOS PROTOCOL ---
  const triggerChaos = async (username: string, prankType: string) => {
    try {
      await axios.post(`${SERVER_URL}/api/admin/chaos-protocol`, 
        { targetUser: username, prankType },
        { headers: { 'x-overlord-key': adminKey } }
      );
      // We will build the frontend listeners for these later!
      alert(`Chaos payload [${prankType}] deployed to ${username}!`);
    } catch (err) {
      alert("Chaos deployment failed.");
    }
  };

  // --- RENDER: AUTH GATE ---
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B0D10] text-[#E8EAED] font-sans">
        <div className="vault-elevated p-10 rounded-2xl w-full max-w-sm text-center border border-[#363C44] shadow-2xl bg-[#14171B]">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-red-500/10 border border-red-500/30">
              <ShieldAlert size={32} className="text-red-500" />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight mb-2 text-white">OVERLORD TERMINAL</h1>
          <p className="text-[12px] text-gray-400 font-mono mb-8 tracking-widest">AWAITING MASTER DECRYPTION KEY</p>
          
          <form onSubmit={handleAuth}>
            <input 
              type="password" autoFocus placeholder="Enter Master Key" 
              className="w-full px-4 py-3 rounded-lg mb-4 text-center font-mono bg-[#0E1013] border border-[#363C44] focus:border-red-500 focus:outline-none text-white transition-colors"
              value={adminKey} onChange={(e) => setAdminKey(e.target.value)} disabled={isAuthenticating}
            />
            {authError && <p className="text-[11px] font-bold text-red-500 mb-4 tracking-wider">{authError}</p>}
            <button type="submit" disabled={isAuthenticating || !adminKey} className="w-full py-3 rounded-lg font-bold bg-red-600 hover:bg-red-700 text-white transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)]">
              {isAuthenticating ? 'DECRYPTING...' : 'INITIALIZE SYSTEM'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const activeUserData = selectedUser ? users[selectedUser] : null;

  // --- RENDER: OVERLORD DASHBOARD ---
  return (
    <div className="flex h-screen bg-[#0B0D10] text-[#E8EAED] font-sans overflow-hidden">
      
      {/* SIDEBAR: USER LIST */}
      <div className="w-80 border-r border-[#262B31] bg-[#14171B] flex flex-col z-10">
        <div className="h-16 flex items-center justify-between px-6 border-b border-[#262B31] bg-[#1B1F24]">
          <div className="flex items-center gap-3">
            <Terminal size={18} className="text-[#D4AF37]" />
            <span className="font-bold tracking-wider text-[13px] text-[#D4AF37]">SYSTEM OVERLORD</span>
          </div>
          <button onClick={fetchUsers} className={`p-2 rounded hover:bg-white/5 ${isSyncing ? 'animate-spin text-[#D4AF37]' : 'text-gray-400'}`}>
            <RefreshCw size={14} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {Object.keys(users).map(username => (
            <button 
              key={username} 
              onClick={() => setSelectedUser(username)}
              className={`w-full text-left px-4 py-3 rounded-xl flex items-center justify-between transition-all ${selectedUser === username ? 'bg-[#D4AF37]/10 border border-[#D4AF37]/30' : 'bg-transparent hover:bg-white/5 border border-transparent'}`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1B1F24] flex items-center justify-center border border-[#363C44]">
                  <Users size={14} className={selectedUser === username ? 'text-[#D4AF37]' : 'text-gray-400'} />
                </div>
                <div>
                  <p className="font-bold text-[13px] text-white capitalize">{username}</p>
                  <p className="text-[10px] text-gray-500 font-mono tracking-wider">{users[username].currentDevice ? 'DEVICE LOCKED' : 'AWAITING LOGIN'}</p>
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${users[username].pin ? 'bg-green-500' : 'bg-gray-600 shadow-[0_0_8px_rgba(34,197,94,0.5)]'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* MAIN PANEL: USER MATRIX & CHAOS */}
      <div className="flex-1 flex flex-col relative bg-[#0B0D10]">
        {!activeUserData ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4">
            <Radio size={48} className="opacity-20" />
            <p className="font-mono text-[12px] tracking-widest">SELECT A TARGET FROM THE ROSTER</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-y-auto p-8 max-w-5xl mx-auto w-full">
            
            <header className="mb-8">
              <h1 className="text-3xl font-extrabold text-white capitalize tracking-tight mb-2">{selectedUser}</h1>
              <p className="font-mono text-[12px] text-[#D4AF37] tracking-widest bg-[#D4AF37]/10 inline-block px-3 py-1 rounded border border-[#D4AF37]/20">
                ACTIVE DEVICE: {activeUserData.currentDevice || 'NONE'}
              </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* CLEARANCE MATRIX */}
              <div className="bg-[#14171B] border border-[#262B31] rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <Lock size={18} className="text-white" />
                  <h2 className="font-bold text-[14px] text-white">Network Clearances</h2>
                </div>
                
                <div className="space-y-3">
                  {['Digital Team', 'Sales & Mktg', 'Admin Only'].map(room => {
                    const hasAccess = activeUserData.allowedRooms?.includes(room) || activeUserData.allowedRooms?.includes('*');
                    return (
                      <div key={room} className="flex items-center justify-between p-4 rounded-xl bg-[#1B1F24] border border-[#262B31]">
                        <span className="font-bold text-[13px] text-gray-300">{room}</span>
                        <button 
                          onClick={() => toggleClearance(selectedUser!, room)}
                          className={`px-4 py-1.5 rounded-lg font-bold text-[11px] transition-all ${hasAccess ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}
                        >
                          {hasAccess ? 'ACCESS GRANTED' : 'LOCKED'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* CHAOS PROTOCOL */}
              <div className="bg-[#14171B] border border-[#262B31] rounded-2xl p-6 shadow-xl relative overflow-hidden">
                {/* Warning Strip */}
                <div className="absolute top-0 left-0 w-full h-1 bg-red-600" />
                
                <div className="flex items-center gap-3 mb-6">
                  <Skull size={18} className="text-red-500" />
                  <h2 className="font-bold text-[14px] text-red-500">Chaos Protocol</h2>
                </div>
                <p className="text-[12px] text-gray-400 mb-6 font-medium">Inject live WebSocket payloads into the target's active session. Target will experience immediate anomalies.</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => triggerChaos(selectedUser!, 'flip')} className="p-3 bg-[#1B1F24] hover:bg-red-900/20 border border-[#262B31] hover:border-red-500/50 rounded-xl text-left transition-colors">
                    <span className="block font-bold text-[12px] text-white mb-1">Gravity Inversion</span>
                    <span className="block text-[10px] text-gray-500">Flips screen 180°</span>
                  </button>
                  <button onClick={() => triggerChaos(selectedUser!, 'ghost')} className="p-3 bg-[#1B1F24] hover:bg-red-900/20 border border-[#262B31] hover:border-red-500/50 rounded-xl text-left transition-colors">
                    <span className="block font-bold text-[12px] text-white mb-1">Ghost Typist</span>
                    <span className="block text-[10px] text-gray-500">Injects fake keystrokes</span>
                  </button>
                  <button onClick={() => triggerChaos(selectedUser!, 'rickroll')} className="p-3 bg-[#1B1F24] hover:bg-red-900/20 border border-[#262B31] hover:border-red-500/50 rounded-xl text-left transition-colors">
                    <span className="block font-bold text-[12px] text-white mb-1">Protocol: Astley</span>
                    <span className="block text-[10px] text-gray-500">Force-opens YouTube tab</span>
                  </button>
                  <button onClick={() => triggerChaos(selectedUser!, 'purge')} className="p-3 bg-[#1B1F24] hover:bg-red-900/20 border border-[#262B31] hover:border-red-500/50 rounded-xl text-left transition-colors">
                    <span className="block font-bold text-[12px] text-red-400 mb-1">Fake System Purge</span>
                    <span className="block text-[10px] text-gray-500">Triggers critical error UI</span>
                  </button>
                </div>
              </div>

              {/* ACTIVITY LOG (Spans both columns) */}
              <div className="bg-[#14171B] border border-[#262B31] rounded-2xl p-6 shadow-xl lg:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <Activity size={18} className="text-[#D4AF37]" />
                  <h2 className="font-bold text-[14px] text-white">Live Activity Ledger</h2>
                </div>
                
                <div className="space-y-1">
                  {activeUserData.activityLog && activeUserData.activityLog.length > 0 ? (
                    activeUserData.activityLog.map((log: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-4 py-2 border-b border-[#262B31] last:border-0">
                        <span className="text-[11px] text-gray-500 font-mono w-20 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[13px] font-medium text-gray-300">{log.action}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-gray-500 font-mono">No activity logged for this user.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;