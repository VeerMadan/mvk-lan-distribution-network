import { useState } from 'react';
import { Search, CheckSquare, List, LayoutGrid, Folder, FileText, Film, FileArchive, FileImage, Headphones, Code, Check, Link, Trash2, Eye, Download, Activity, FolderPlus, FilePlus, FolderUp, X, Cpu, Lock } from 'lucide-react';

const SERVER_URL = window.location.origin;

const getAvatarGradient = (name: string) => {
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const c1 = `hsl(${hash % 360}, 70%, 50%)`; const c2 = `hsl(${(hash * 2) % 360}, 70%, 20%)`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
};

const getFileProps = (filename: string) => {
  if (!filename) return { icon: FileText, color: 'text-gray-400', bg: 'bg-gray-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(255,255,255,0.05)]' };
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return { icon: FileText, color: 'text-red-400', bg: 'bg-red-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(248,113,113,0.1)]' };
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return { icon: Film, color: 'text-blue-400', bg: 'bg-blue-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(59,130,246,0.1)]' };
  if (['zip', 'rar', '7z', 'tar'].includes(ext)) return { icon: FileArchive, color: 'text-amber-400', bg: 'bg-amber-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(251,191,36,0.1)]' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return { icon: FileImage, color: 'text-purple-400', bg: 'bg-purple-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(192,132,252,0.1)]' };
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return { icon: Headphones, color: 'text-pink-400', bg: 'bg-pink-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(244,114,182,0.1)]' };
  if (['js', 'html', 'css', 'ts', 'json', 'py', 'java'].includes(ext)) return { icon: Code, color: 'text-emerald-400', bg: 'bg-emerald-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(52,211,153,0.1)]' };
  return { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-400/10', shadow: 'hover:shadow-[0_10px_30px_rgba(59,130,246,0.1)]' };
};

export default function Dashboard(props: any) {
  const {
    activeRoom, activeUsers, displayUsername, isAdminSession,
    roomItems, currentFolderId, setCurrentFolderId,
    searchQuery, setSearchQuery, viewMode, setViewMode,
    selectedFiles, setSelectedFiles, networkUploads, uploadProgress,
    deletingItemIds, handleBatchDownload, promptBatchDelete, isBatchDownloading,
    openContextMenu, toggleFileSelection, checkPreviewable, openPreview,
    triggerDownload, handleCopyLink, promptDelete,
    setShowFolderModal, storageUsed, STORAGE_LIMIT,
    fileInputRef, folderInputRef, handleFileSelect
  } = props;

  const filteredItems = roomItems.filter((item: any) => {
    if (!item.fileName) return false;
    const matchesSearch = item.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFolder = currentFolderId ? item.parentId === currentFolderId : !item.parentId;
    return matchesSearch && matchesFolder;
  });

  return (
    <>
      <section className="flex-1 overflow-y-auto p-4 md:p-8 pb-[180px] md:pb-[200px] relative no-scrollbar">
        {activeRoom !== 'Admin Only' && !currentFolderId && (
          <div className="mb-8 w-full max-w-5xl mx-auto">
            <h3 className="text-[11px] text-gray-500 font-semibold tracking-wider uppercase mb-3">Online ({activeUsers.length})</h3>
            <div className="flex flex-wrap gap-2">
              {activeUsers.map((user: any) => (
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
              {Object.values(networkUploads).map((upload: any, idx) => (
                <div key={idx} className="mac-glass p-4 rounded-2xl shadow-sm">
                  <div className="flex justify-between text-xs mb-2"><span className="text-gray-300"><strong className="text-white">{upload.user}</strong> is sending <span className="text-white font-medium truncate max-w-[150px] inline-block align-bottom">{upload.fileName}</span></span><span className="text-white font-mono">{upload.progress}%</span></div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden"><div className="bg-blue-500 h-full rounded-full transition-all duration-300" style={{ width: `${upload.progress}%` }}></div></div>
                </div>
              ))}
            </div>
          )}

          {(roomItems.length > 0 || currentFolderId) && (
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
              <div className="relative w-full sm:w-80"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input type="text" placeholder={`Search...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white/5 border border-white/10 text-white pl-10 pr-4 py-2 rounded-full focus:outline-none focus:bg-white/10 transition-all text-sm placeholder:text-gray-500" /></div>
              <div className="flex bg-white/5 rounded-full p-1 w-full sm:w-auto justify-center border border-white/5 shadow-sm">
                <button onClick={() => setSelectedFiles(selectedFiles.length === filteredItems.length && filteredItems.length > 0 ? [] : filteredItems.map((i: any) => i.savedAs))} className={`flex items-center gap-2 px-4 py-1.5 rounded-full transition-all ${selectedFiles.length > 0 ? `bg-white/20 text-white shadow-sm` : 'text-gray-400 hover:text-white'}`}><CheckSquare size={14} /> <span className="text-[13px] font-semibold hidden sm:inline">Select All</span></button>
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

              {filteredItems.map((item: any, idx: number) => {
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
              {filteredItems.map((item: any, idx: number) => {
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

      {/* FLOATING BATCH ACTION BAR */}
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
    </>
  );
}