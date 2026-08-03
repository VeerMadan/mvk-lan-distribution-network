import React from 'react';
import { X, HardDrive, Lock, Download, ShieldCheck, Cpu } from 'lucide-react';

const getAvatarGradient = (name: string) => {
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const c1 = `hsl(${hash % 360}, 70%, 50%)`; const c2 = `hsl(${(hash * 2) % 360}, 70%, 20%)`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
};

export default function Sidebar(props: any) {
  const {
    isMobileMenuOpen, setIsMobileMenuOpen, activeRoom, attemptRoomJoin, rooms,
    storageUsed, STORAGE_LIMIT, hasUpdate, commitsBehind, setShowCredits, displayUsername
  } = props;

  const godMode = false; // Set to true if you ever bring back the red vortex

  return (
    <>
      {isMobileMenuOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)} />}

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
              <span className="flex items-center gap-1.5"><HardDrive size={12} /> Cloud Storage</span>
              <span className={storageUsed >= STORAGE_LIMIT ? 'text-red-400' : 'text-gray-300'}>{storageUsed.toFixed(1)} GB</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div className={`h-full rounded-full ${storageUsed >= 90 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${Math.min((storageUsed / STORAGE_LIMIT) * 100, 100)}%` }}></div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto relative z-10 pb-[100px] flex flex-col no-scrollbar">
          <div className="text-[10px] font-bold tracking-widest text-gray-500 uppercase px-3 mb-2 mt-2">Locations</div>
          <div>
            {rooms.map((room: any) => (
              <button key={room.name} onClick={() => attemptRoomJoin(room.name)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all mac-click ${activeRoom === room.name ? 'bg-white/15 text-white shadow-sm' : 'hover:bg-white/5 text-gray-400'}`}>
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
    </>
  );
}