import { Search, CheckSquare, List, LayoutGrid, Folder, FileText, Film, FileArchive, FileImage, Headphones, Code, Check, Link, Trash2, Eye, Download, Activity, FolderPlus, FilePlus, FolderUp, X, Lock } from 'lucide-react';

const SERVER_URL = window.location.origin;

const getAvatarGradient = (name: string) => {
  let hash = 0; for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const c1 = `hsl(${hash % 360}, 55%, 45%)`; const c2 = `hsl(${(hash * 2) % 360}, 55%, 22%)`;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
};

const getFileProps = (filename: string) => {
  if (!filename) return { icon: FileText, color: 'var(--text-dim)' };
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return { icon: FileText, color: 'var(--danger)' };
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) return { icon: Film, color: 'var(--accent)' };
  if (['zip', 'rar', '7z', 'tar'].includes(ext)) return { icon: FileArchive, color: 'var(--warning)' };
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return { icon: FileImage, color: '#A374E0' };
  if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return { icon: Headphones, color: '#E06AA3' };
  if (['js', 'html', 'css', 'ts', 'json', 'py', 'java'].includes(ext)) return { icon: Code, color: 'var(--success)' };
  return { icon: FileText, color: 'var(--accent)' };
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
          <div className="mb-6 w-full max-w-5xl mx-auto">
            <h3 className="vault-mono text-[10px] font-semibold tracking-widest uppercase mb-2.5" style={{ color: 'var(--text-faint)' }}>
              Online — {activeUsers.length}
            </h3>
            <div className="flex flex-wrap gap-2">
              {activeUsers.map((user: any) => (
                <div key={user.id} className="flex items-center gap-2 vault-panel px-2.5 py-1.5 rounded-full">
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ background: getAvatarGradient(user.username) }}>
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-[12px] font-medium" style={{ color: 'var(--text-dim)' }}>
                    {user.username}{user.username === displayUsername ? ' (you)' : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div key={activeRoom + (currentFolderId || 'root')} className="w-full max-w-5xl mx-auto animate-fade-up">

          {Object.keys(networkUploads).length > 0 && (
            <div className="mb-6 space-y-2">
              <h3 className="vault-mono text-[10px] font-semibold tracking-widest uppercase flex items-center gap-2" style={{ color: 'var(--accent)' }}>
                <Activity size={11} className="animate-pulse" /> Transmissions in progress
              </h3>
              {Object.values(networkUploads).map((upload: any, idx) => (
                <div key={idx} className="vault-panel p-3.5 rounded-lg">
                  <div className="flex justify-between text-[12px] mb-2">
                    <span style={{ color: 'var(--text-dim)' }}>
                      <strong style={{ color: 'var(--text)' }}>{upload.user}</strong> is sending{' '}
                      <span style={{ color: 'var(--text)' }} className="font-medium truncate max-w-[150px] inline-block align-bottom">{upload.fileName}</span>
                    </span>
                    <span className="vault-mono" style={{ color: 'var(--text)' }}>{upload.progress}%</span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-sunken)' }}>
                    <div className="h-full rounded-full transition-all duration-300" style={{ width: `${upload.progress}%`, backgroundColor: 'var(--accent)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {(roomItems.length > 0 || currentFolderId) && (
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center mb-5">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2" size={14} style={{ color: 'var(--text-faint)' }} />
                <input
                  type="text" placeholder="Search this room…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="vault-input w-full pl-9 pr-3 py-2 rounded-md text-[13px] transition-all"
                />
              </div>
              <div className="flex vault-panel rounded-md p-0.5 w-full sm:w-auto justify-center">
                <button
                  onClick={() => setSelectedFiles(selectedFiles.length === filteredItems.length && filteredItems.length > 0 ? [] : filteredItems.map((i: any) => i.savedAs))}
                  className={`vault-btn flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold ${selectedFiles.length > 0 ? '' : ''}`}
                  style={selectedFiles.length > 0 ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' } : { color: 'var(--text-dim)' }}
                >
                  <CheckSquare size={13} /> <span className="hidden sm:inline">Select all</span>
                </button>
                <div className="w-px my-1" style={{ backgroundColor: 'var(--border)' }} />
                <button onClick={() => setViewMode('list')} className="vault-btn flex-1 sm:flex-none flex justify-center px-3 py-1.5 rounded"
                  style={viewMode === 'list' ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' } : { color: 'var(--text-faint)' }}>
                  <List size={14} />
                </button>
                <button onClick={() => setViewMode('grid')} className="vault-btn flex-1 sm:flex-none flex justify-center px-3 py-1.5 rounded"
                  style={viewMode === 'grid' ? { backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' } : { color: 'var(--text-faint)' }}>
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>
          )}

          {filteredItems.length === 0 ? (
            <div className="text-center mt-28 text-[13px] font-medium" style={{ color: 'var(--text-faint)' }}>
              {searchQuery ? 'No results found.' : 'This room is empty. Drop a file or add a folder to get started.'}
            </div>
          ) : viewMode === 'list' ? (
            <div className="vault-panel rounded-lg overflow-hidden">
              <div className="hidden sm:flex items-center px-4 py-2.5 vault-mono text-[10px] font-semibold tracking-widest uppercase" style={{ color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface-raised)' }}>
                <div className="w-8" />
                <div className="flex-1">Name</div>
                <div className="w-28">Size</div>
                <div className="w-32">Sender</div>
                <div className="w-24 text-right pr-2">Actions</div>
              </div>

              {filteredItems.map((item: any, idx: number) => {
                const fp = item.isFolder ? { icon: Folder, color: 'var(--text)' } : getFileProps(item.fileName);
                const IconComp = fp.icon;
                const isSelected = selectedFiles.includes(item.savedAs);
                const rail = item.isFolder
                  ? (item.targetRecipient && item.targetRecipient !== 'Everyone' ? 'rail-locked' : 'rail-none')
                  : 'rail-none';

                return (
                  <div
                    key={idx}
                    style={{ animationDelay: `${idx * 0.015}s`, backgroundColor: isSelected ? 'var(--accent-soft)' : undefined }}
                    onContextMenu={(e) => openContextMenu(e, item)}
                    className={`vault-row ${rail} flex items-center justify-between group relative px-3 sm:px-4 py-2.5 ${deletingItemIds.includes(item.savedAs || item.fileName) ? 'anim-purge' : 'animate-row-in'}`}
                  >
                    <div
                      onClick={(e) => toggleFileSelection(e, item.savedAs || item.fileName)}
                      className="w-4 h-4 flex items-center justify-center rounded border shrink-0 mr-3 cursor-pointer transition-all"
                      style={isSelected
                        ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }
                        : { borderColor: 'var(--border-strong)', opacity: 0 }}
                    >
                      <Check size={11} className={isSelected ? 'opacity-100 text-white' : 'opacity-0'} strokeWidth={3} />
                    </div>

                    <div
                      className="flex items-center gap-3 flex-1 overflow-hidden cursor-pointer"
                      onClick={() => item.isFolder ? setCurrentFolderId(item.savedAs) : toggleFileSelection({ stopPropagation: () => {} } as any, item.savedAs)}
                    >
                      <div className="shrink-0" style={{ color: fp.color }}><IconComp size={17} /></div>
                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center">
                        <div className="flex-1 flex items-center gap-2 sm:pr-4">
                          <p className="text-[13.5px] font-medium truncate" style={{ color: 'var(--text)' }}>{item.fileName}</p>
                          {item.targetRecipient && item.targetRecipient !== 'Everyone' && <Lock size={11} className="shrink-0" style={{ color: 'var(--text-faint)' }} />}
                        </div>
                        <div className="w-28 vault-mono text-[11px] hidden sm:block" style={{ color: 'var(--text-faint)' }}>
                          {item.isFolder ? '—' : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                        </div>
                        <div className="w-32 text-[11px] hidden sm:block truncate pr-4" style={{ color: 'var(--text-faint)' }}>{item.sender}</div>
                      </div>
                    </div>

                    <div className={`flex items-center gap-0.5 transition-opacity ${isSelected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                      {!item.isFolder && (
                        <button onClick={(e) => { e.stopPropagation(); handleCopyLink(`${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`); }}
                          className="vault-btn hidden sm:block p-1.5 rounded-md" style={{ color: 'var(--text-faint)' }}>
                          <Link size={15} />
                        </button>
                      )}
                      {(item.sender === displayUsername || isAdminSession) && (
                        <button onClick={(e) => { e.stopPropagation(); promptDelete(item.savedAs || item.fileName); }}
                          className="vault-btn p-1.5 rounded-md opacity-0 group-hover:opacity-100" style={{ color: 'var(--danger)' }}>
                          <Trash2 size={15} />
                        </button>
                      )}
                      {!item.isFolder && checkPreviewable(item.fileName) && (
                        <button onClick={(e) => { e.stopPropagation(); openPreview(item); }} className="vault-btn p-1.5 rounded-md" style={{ color: 'var(--text-dim)' }}>
                          <Eye size={15} />
                        </button>
                      )}
                      {!item.isFolder && (
                        <button onClick={(e) => { e.stopPropagation(); triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`, item.fileName); }}
                          className="vault-btn p-1.5 rounded-md" style={{ color: 'var(--text)' }}>
                          <Download size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item: any, idx: number) => {
                const fp = item.isFolder ? { icon: Folder, color: 'var(--text)' } : getFileProps(item.fileName);
                const IconComp = fp.icon;
                const isSelected = selectedFiles.includes(item.savedAs);
                const rail = item.isFolder
                  ? (item.targetRecipient && item.targetRecipient !== 'Everyone' ? 'rail-locked' : 'rail-none')
                  : 'rail-none';

                return (
                  <div
                    key={idx}
                    style={{ animationDelay: `${idx * 0.02}s` }}
                    onContextMenu={(e) => openContextMenu(e, item)}
                    onClick={() => item.isFolder && !isSelected ? setCurrentFolderId(item.savedAs) : toggleFileSelection({ stopPropagation: () => {} } as any, item.savedAs)}
                    className={`vault-item ${rail} p-4 rounded-lg flex flex-col items-center text-center group relative cursor-pointer ${deletingItemIds.includes(item.savedAs || item.fileName) ? 'anim-purge' : 'animate-row-in'} ${isSelected ? 'is-selected' : ''}`}
                  >
                    <div
                      onClick={(e) => toggleFileSelection(e, item.savedAs || item.fileName)}
                      className="absolute left-3 top-3 w-4 h-4 flex items-center justify-center rounded border z-20 cursor-pointer transition-all"
                      style={isSelected
                        ? { backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }
                        : { borderColor: 'var(--border-strong)', opacity: 0 }}
                    >
                      <Check size={11} className={isSelected ? 'opacity-100 text-white' : 'opacity-0'} strokeWidth={3} />
                    </div>

                    <div className="p-3 rounded-lg mb-2.5" style={{ backgroundColor: 'var(--surface-sunken)', color: fp.color }}>
                      <IconComp size={22} />
                    </div>
                    <p className="text-[12.5px] font-medium w-full mb-0.5 truncate px-1" style={{ color: 'var(--text)' }}>{item.fileName}</p>
                    <p className="vault-mono text-[10.5px] mb-2.5" style={{ color: 'var(--text-faint)' }}>
                      {item.isFolder ? 'Folder' : `${(item.size / 1024 / 1024).toFixed(1)} MB`}
                    </p>

                    {!item.isFolder && (
                      <div className={`w-full flex gap-1 mt-auto transition-opacity ${isSelected ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); triggerDownload(e, `${SERVER_URL}/download/${encodeURIComponent(item.savedAs || item.fileName)}`, item.fileName); }}
                          className="vault-btn flex-1 py-1.5 rounded-md text-[11px] font-semibold"
                          style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--text)' }}
                        >
                          Download
                        </button>
                        {checkPreviewable(item.fileName) && (
                          <button onClick={(e) => { e.stopPropagation(); openPreview(item); }} className="vault-btn w-8 flex justify-center items-center rounded-md" style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--text-dim)' }}>
                            <Eye size={13} />
                          </button>
                        )}
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
      <div className={`absolute bottom-[86px] left-1/2 -translate-x-1/2 z-30 transition-all duration-300 ${selectedFiles.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 pointer-events-none'}`}>
        <div className="vault-toolbar p-1.5 pr-2 pl-3 rounded-full flex items-center justify-between">
          <div className="flex items-center gap-2 mr-3">
            <div className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] text-white" style={{ backgroundColor: 'var(--accent)' }}>{selectedFiles.length}</div>
            <span className="font-semibold text-[12.5px] hidden sm:block" style={{ color: 'var(--text)' }}>Selected</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handleBatchDownload} disabled={isBatchDownloading} className={`vault-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold ${isBatchDownloading ? 'opacity-50' : ''}`} style={{ backgroundColor: 'var(--surface-sunken)', color: 'var(--text)' }}>
              {isBatchDownloading ? <Activity size={13} className="animate-spin" /> : <Download size={13} />}
              <span className="hidden sm:inline">Download</span>
            </button>
            <button onClick={promptBatchDelete} className="vault-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11.5px] font-semibold" style={{ backgroundColor: 'var(--danger-soft)', color: 'var(--danger)' }}>
              <Trash2 size={13} /> <span className="hidden sm:inline">Delete</span>
            </button>
            <div className="w-px h-4 mx-1" style={{ backgroundColor: 'var(--border)' }} />
            <button onClick={() => setSelectedFiles([])} className="vault-btn p-1.5 rounded-full" style={{ color: 'var(--text-faint)' }}>
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* MAIN UPLOAD DOCK */}
      <div className="absolute bottom-[24px] left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center w-full px-4">
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="mb-3 vault-toolbar p-2.5 rounded-full flex items-center gap-3 pointer-events-auto w-full max-w-sm">
            <Activity size={14} className="shrink-0 animate-pulse" style={{ color: 'var(--accent)' }} />
            <div className="flex-1 w-full h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--surface-sunken)' }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%`, backgroundColor: 'var(--accent)' }} />
            </div>
            <span className="vault-mono text-[11px] font-bold" style={{ color: 'var(--text)' }}>{uploadProgress}%</span>
          </div>
        )}

        <div className="vault-toolbar p-1.5 flex items-center gap-1 rounded-full pointer-events-auto">
          <button onClick={() => setShowFolderModal(true)} disabled={storageUsed >= STORAGE_LIMIT} className={`vault-btn px-4 py-2 rounded-full flex items-center gap-2 ${storageUsed >= STORAGE_LIMIT ? 'opacity-40' : ''}`} style={{ color: 'var(--text-dim)' }}>
            <FolderPlus size={16} />
            <span className="font-medium text-[12.5px] hidden sm:inline">New folder</span>
          </button>
          <div className="w-px h-5 mx-0.5" style={{ backgroundColor: 'var(--border)' }} />
          <button onClick={() => storageUsed < STORAGE_LIMIT && fileInputRef.current?.click()} disabled={storageUsed >= STORAGE_LIMIT} className={`vault-btn px-4 py-2 rounded-full flex items-center gap-2 ${storageUsed >= STORAGE_LIMIT ? 'opacity-40' : ''}`} style={{ color: 'var(--text-dim)' }}>
            <FilePlus size={16} />
            <span className="font-medium text-[12.5px] hidden sm:inline">Files</span>
            <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
          </button>
          <button onClick={() => storageUsed < STORAGE_LIMIT && folderInputRef.current?.click()} disabled={storageUsed >= STORAGE_LIMIT} className={`vault-btn px-4 py-2 rounded-full flex items-center gap-2 ${storageUsed >= STORAGE_LIMIT ? 'opacity-40' : ''}`} style={{ color: 'var(--text-dim)' }}>
            <FolderUp size={16} />
            <span className="font-medium text-[12.5px] hidden sm:inline">Folder</span>
            {/* @ts-ignore */}
            <input type="file" webkitdirectory="" directory="" className="hidden" ref={folderInputRef} onChange={handleFileSelect} />
          </button>
        </div>
      </div>
    </>
  );
}