import React from 'react';
import { X, HardDrive, Lock, Download, ShieldCheck, LogOut } from 'lucide-react';

const getAvatarGradient = (name: string) => {
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const c1 = `hsl(${hash % 360}, 55%, 45%)`; const c2 = `hsl(${(hash * 2) % 360}, 55%, 22%)`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
};

// Room name -> clearance tier, purely visual (server remains source of truth for access)
const railFor = (room: any) => {
  if (!room.locked) return 'rail-open';
  if (room.name.toLowerCase().includes('admin')) return 'rail-admin';
  return 'rail-locked';
};

export default function Sidebar(props: any) {
  const {
    isMobileMenuOpen, setIsMobileMenuOpen, activeRoom, attemptRoomJoin, rooms,
    storageUsed, STORAGE_LIMIT, hasUpdate, commitsBehind, setShowCredits, displayUsername,
    handleSignOut
  } = props;

  const storagePct = Math.min((storageUsed / STORAGE_LIMIT) * 100, 100);

  return (
    <>
      {isMobileMenuOpen && (
        <div className="fixed inset-0 vault-scrim z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside
        className={`fixed md:relative z-50 h-full w-64 flex flex-col shrink-0 transition-transform duration-200 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ backgroundColor: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        {/* Identity */}
        <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                <ShieldCheck size={15} className="text-white" />
              </div>
              <div>
                <h1 className="text-[14px] font-bold tracking-tight" style={{ color: 'var(--text)' }}>MVK Vault</h1>
                <p className="vault-mono text-[10px] tracking-wide" style={{ color: 'var(--text-faint)' }}>LAN DISTRIBUTION</p>
              </div>
            </div>
            <button className="md:hidden p-1 rounded" style={{ color: 'var(--text-dim)' }} onClick={() => setIsMobileMenuOpen(false)}>
              <X size={18} />
            </button>
          </div>

          {/* Storage */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-medium mb-1.5" style={{ color: 'var(--text-dim)' }}>
              <span className="flex items-center gap-1.5"><HardDrive size={11} /> Storage</span>
              <span className="vault-mono" style={{ color: storageUsed >= STORAGE_LIMIT ? 'var(--danger)' : 'var(--text-dim)' }}>
                {storageUsed.toFixed(1)} / {STORAGE_LIMIT} GB
              </span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-sunken)' }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${storagePct}%`, backgroundColor: storagePct >= 90 ? 'var(--danger)' : 'var(--accent)' }}
              />
            </div>
          </div>
        </div>

        {/* Directory tree */}
        <nav className="flex-1 px-3 pt-4 overflow-y-auto no-scrollbar flex flex-col">
          <div className="vault-mono text-[10px] font-semibold tracking-widest uppercase px-3 mb-2" style={{ color: 'var(--text-faint)' }}>
            Rooms
          </div>
          <div className="space-y-0.5">
            {rooms.map((room: any) => {
              const active = activeRoom === room.name;
              return (
                <button
                  key={room.name}
                  onClick={() => attemptRoomJoin(room.name)}
                  className={`vault-nav-item w-full flex items-center justify-between px-3 py-2 rounded-md text-left ${active ? 'is-active' : ''} ${railFor(room)}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="shrink-0" style={{ color: active ? 'var(--accent)' : 'var(--text-faint)' }}>{room.icon}</span>
                    <span className="font-medium text-[13px] truncate" style={{ color: active ? 'var(--text)' : undefined }}>{room.name}</span>
                  </div>
                  {room.locked && !active && <Lock size={11} className="shrink-0" style={{ color: 'var(--text-faint)' }} />}
                </button>
              );
            })}
          </div>

          <div className="mt-auto flex flex-col gap-2 pt-4 pb-4">
            {hasUpdate && (
              <div className="mx-1 p-3 rounded-md vault-sunken" style={{ borderLeft: '2px solid var(--accent)' }}>
                <div className="flex items-center gap-2 font-semibold text-[11px] mb-0.5" style={{ color: 'var(--accent)' }}>
                  <Download size={11} /> Update available
                </div>
                <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{commitsBehind} commit(s) behind main.</p>
              </div>
            )}
            <button
              onClick={() => setShowCredits(true)}
              className="vault-nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left"
            >
              <ShieldCheck size={15} className="shrink-0" style={{ color: 'var(--text-faint)' }} />
              <span className="font-medium text-[13px]">System details</span>
            </button>
          </div>
        </nav>

        {/* Session footer */}
        <div className="shrink-0 h-14 flex items-center justify-between px-5" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-semibold text-white text-[11px] shrink-0"
              style={{ background: getAvatarGradient(displayUsername) }}
            >
              {displayUsername.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold" style={{ color: 'var(--text)' }}>{displayUsername}</div>
              <div className="flex items-center gap-1.5 text-[10px] vault-mono" style={{ color: 'var(--text-faint)' }}>
                <span className="w-1.5 h-1.5 rounded-full vault-dot-live" /> ONLINE
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="vault-btn p-2 rounded-md transition-colors shrink-0"
            style={{ color: 'var(--text-dim)' }}
            title="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>
    </>
  );
}