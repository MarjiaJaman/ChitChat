import { useState, useEffect, useRef } from 'react';
import './ChatArea.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function Avatar({ photo, name, className }) {
  return (
    <div className={className}>
      {photo
        ? <img src={photo} alt={name || ''} className="avatar-img" />
        : <span className="avatar-initials">{getInitials(name)}</span>
      }
    </div>
  );
}

async function uploadToMinio(base64data, filename, mimeType) {
  const res = await fetch(`${API}/api/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64data, name: filename, type: mimeType }),
  });
  if (!res.ok) throw new Error('Upload failed');
  const { url } = await res.json();
  return url;
}

const URL_REGEX = /^https?:\/\/\S+$/i;

function MessageContent({ content, onOpenPdf, onOpenPhoto, isMine, onStartCall }) {
  if (content.startsWith('__CALL__:')) {
    try {
      const { type, duration, time } = JSON.parse(content.slice(9));
      const missed = type === 'missed';
      return (
        <div className="msg-call">
          <div className="msg-call-top">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              width="16" height="16" className={missed ? 'call-icon-missed' : 'call-icon-done'}>
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <div className="msg-call-text">
              <span className="msg-call-title">{missed ? 'Missed Audio Call' : 'Audio Call'}</span>
              {!missed && duration && <span className="msg-call-duration">{duration}</span>}
            </div>
          </div>
          <span className="msg-call-time">{time}</span>
          <button className="msg-call-back" onClick={onStartCall}>
            {missed ? (isMine ? 'Call Again' : 'Call Back') : 'Call Back'}
          </button>
        </div>
      );
    } catch { return <span>{content}</span>; }
  }
  // MinIO image
  if (content.startsWith('__IMG__:')) {
    const url = content.slice(8);
    return <img src={url} className="msg-image" alt="photo" onClick={() => onOpenPhoto(url)} />;
  }
  // Multi-photo bundle (URLs)
  if (content.startsWith('__PHOTOS__:')) {
    try {
      const photos = JSON.parse(content.slice(11));
      const extra = photos.length - 1;
      return (
        <div className="msg-photos-thumb" onClick={() => onOpenPhoto(photos[0])}>
          <img src={photos[0]} className="msg-image" alt="photos" />
          {extra > 0 && <span className="msg-photos-badge">+{extra}</span>}
        </div>
      );
    } catch { return <span>{content}</span>; }
  }
  // PDF (MinIO URL)
  if (content.startsWith('__PDF__:')) {
    try {
      const { name, url } = JSON.parse(content.slice(8));
      return (
        <button className="msg-pdf" onClick={() => onOpenPdf({ name, url })}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="msg-pdf-name">{name}</span>
          <span className="msg-pdf-hint">Tap to view</span>
        </button>
      );
    } catch { return <span>{content}</span>; }
  }
  // Plain URL → clickable link
  if (URL_REGEX.test(content.trim())) {
    return (
      <a href={content.trim()} target="_blank" rel="noopener noreferrer" className="msg-link">
        {content.trim()}
      </a>
    );
  }
  return <span>{content}</span>;
}

function PdfViewerModal({ name, url, onClose }) {
  const proxyUrl = `${API}/api/proxy?url=${encodeURIComponent(url)}`;
  return (
    <div className="pdf-overlay" onClick={onClose}>
      <div className="pdf-modal" onClick={e => e.stopPropagation()}>
        <div className="pdf-modal-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span className="pdf-modal-name">{name}</span>
          <button className="pdf-close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="pdf-modal-body">
          <iframe src={proxyUrl} title={name} className="pdf-iframe" />
        </div>
      </div>
    </div>
  );
}

async function downloadPhoto(url) {
  const res = await fetch(url);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = url.split('/').pop() || 'photo.jpg';
  a.click();
  URL.revokeObjectURL(a.href);
}

function GalleryModal({ photos, initialIndex = 0, onClose }) {
  const [current, setCurrent] = useState(initialIndex);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight') setCurrent(c => Math.min(photos.length - 1, c + 1));
      if (e.key === 'ArrowLeft') setCurrent(c => Math.max(0, c - 1));
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [photos.length, onClose]);

  return (
    <div className="gallery-overlay" onClick={onClose}>
      <div className="gallery-toolbar" onClick={e => e.stopPropagation()}>
        <button className="gallery-tool-btn" onClick={() => downloadPhoto(photos[current])} title="Download">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
        </button>
        <button className="gallery-tool-btn" onClick={onClose} title="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <img src={photos[current]} className="img-viewer" alt="photo" onClick={e => e.stopPropagation()} />
      {current > 0 && (
        <button className="gallery-nav gallery-prev" onClick={e => { e.stopPropagation(); setCurrent(c => c - 1); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="22" height="22">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      )}
      {current < photos.length - 1 && (
        <button className="gallery-nav gallery-next" onClick={e => { e.stopPropagation(); setCurrent(c => c + 1); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="22" height="22">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      )}
      {photos.length > 1 && (
        <div className="gallery-dots" onClick={e => e.stopPropagation()}>
          {photos.map((_, i) => (
            <span key={i} className={`gallery-dot${i === current ? ' active' : ''}`} onClick={() => setCurrent(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatArea({ me, selectedUser, messages, peerTyping, onSendMessage, onTyping, onStoppedTyping, onDeleteMessage, onForwardMessage, users = [], onlineUsers = new Set(), onStartCall, callState }) {
  const [text, setText] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [pdfViewer, setPdfViewer] = useState(null);
  const [galleryViewer, setGalleryViewer] = useState(null);
  const [photoError, setPhotoError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);

  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const photoInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const attachMenuRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping]);

  useEffect(() => {
    setText('');
    setProfileOpen(false);
    setAttachOpen(false);
    setLinkMode(false);
    setLinkUrl('');
    setPdfViewer(null);
    setGalleryViewer(null);
    setPhotoError('');
    setContextMenu(null);
    setForwardMsg(null);
  }, [selectedUser?.id]);

  useEffect(() => {
    if (!attachOpen) return;
    function handleClick(e) {
      if (!attachMenuRef.current?.contains(e.target)) setAttachOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [attachOpen]);

  useEffect(() => {
    if (!contextMenu) return;
    function handleClick() { setContextMenu(null); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [contextMenu]);

  function handleInput(e) {
    setText(e.target.value);
    onTyping?.();
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => onStoppedTyping?.(), 1500);
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setText('');
    clearTimeout(typingTimeoutRef.current);
    onStoppedTyping?.();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function openPhoto(src) {
    const all = [];
    messages.forEach(msg => {
      if (msg.content.startsWith('__IMG__:')) {
        all.push(msg.content.slice(8));
      } else if (msg.content.startsWith('__PHOTOS__:')) {
        try { all.push(...JSON.parse(msg.content.slice(11))); } catch {}
      }
    });
    const idx = all.indexOf(src);
    setGalleryViewer({ photos: all, initialIndex: Math.max(0, idx) });
  }

  async function handlePhotoSelect(e) {
    const all = Array.from(e.target.files || []);
    if (!all.length) return;
    if (all.length > 10) {
      setPhotoError('Maximum 10 photos. Only the first 10 will be sent.');
      setTimeout(() => setPhotoError(''), 4000);
    }
    const files = all.slice(0, 10);
    e.target.value = '';
    setAttachOpen(false);
    setUploading(true);
    try {
      const urls = await Promise.all(files.map(file => new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        img.onload = async () => {
          const maxSize = 800;
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(objectUrl);
          try {
            const url = await uploadToMinio(canvas.toDataURL('image/jpeg', 0.8), `photo_${Date.now()}.jpg`, 'image/jpeg');
            resolve(url);
          } catch (err) { reject(err); }
        };
        img.onerror = reject;
        img.src = objectUrl;
      })));
      if (urls.length === 1) {
        onSendMessage('__IMG__:' + urls[0]);
      } else {
        onSendMessage('__PHOTOS__:' + JSON.stringify(urls));
      }
    } catch {
      setPhotoError('Upload failed. Please try again.');
      setTimeout(() => setPhotoError(''), 4000);
    } finally {
      setUploading(false);
    }
  }

  async function handlePdfSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setAttachOpen(false);
    setUploading(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const url = await uploadToMinio(base64, file.name, 'application/pdf');
      onSendMessage('__PDF__:' + JSON.stringify({ name: file.name, url }));
    } catch {
      setPhotoError('Upload failed. Please try again.');
      setTimeout(() => setPhotoError(''), 4000);
    } finally {
      setUploading(false);
    }
  }

  function sendLink() {
    const url = linkUrl.trim();
    if (!url) return;
    onSendMessage(url);
    setLinkUrl('');
    setLinkMode(false);
  }

  function handleLinkKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); sendLink(); }
    if (e.key === 'Escape') { setLinkMode(false); setLinkUrl(''); }
  }

  if (!selectedUser) {
    return (
      <main className="chat-area">
        <div className="chat-placeholder">
          <div className="chat-placeholder-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="30" height="30">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <h3>Welcome to ChitChat</h3>
          <p>Select a conversation to start messaging</p>
        </div>
      </main>
    );
  }

  const name = selectedUser.full_name || selectedUser.fullName || 'Unknown';
  const photo = selectedUser.profile_photo || selectedUser.profilePhoto || null;
  const gender = selectedUser.gender || null;
  const dob = selectedUser.date_of_birth || selectedUser.dateOfBirth || null;
  const memberSince = selectedUser.created_at || selectedUser.createdAt || null;

  return (
    <main className="chat-area chat-active">

      {/* Header */}
      {(() => {
        const isOnline = onlineUsers.has(String(selectedUser.id));
        const showStatus = peerTyping || isOnline;
        return (
          <div className="chat-header" onClick={() => setProfileOpen(true)}>
            <div className="chat-header-avatar-wrap">
              <Avatar photo={photo} name={name} className="chat-header-avatar" />
              {isOnline && <span className="chat-header-dot" />}
            </div>
            <div className="chat-header-info">
              <span className="chat-header-name">{name}</span>
              {showStatus && (
                <span className={`chat-header-status${peerTyping ? ' typing' : ''}`}>
                  {peerTyping ? 'typing…' : 'Online'}
                </span>
              )}
            </div>
            <button
              className="header-call-btn"
              onClick={e => { e.stopPropagation(); onStartCall?.(); }}
              disabled={!!callState}
              title="Audio call"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </button>
          </div>
        );
      })()}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-no-messages">No messages yet. Say hello! 👋</div>
        )}
        {messages.map(msg => {
          const senderId = msg.senderId ?? msg.sender_id;
          const isMine = String(senderId) === String(me.id);
          const time = msg.sentAt || msg.sent_at || msg.createdAt || msg.created_at;
          const isImage = msg.content.startsWith('__IMG__:') || msg.content.startsWith('__PHOTOS__:');
          const isPdf = msg.content.startsWith('__PDF__:');
          return (
            <div key={msg.id} className={`chat-msg ${isMine ? 'mine' : 'theirs'}`}
              onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, msg }); }}>
              <div className={`chat-bubble${isImage ? ' bubble-image' : ''}${isPdf ? ' bubble-pdf' : ''}`}>
                <MessageContent content={msg.content} onOpenPdf={setPdfViewer} onOpenPhoto={openPhoto} isMine={isMine} onStartCall={onStartCall} />
              </div>
              {time && (
                <span className="chat-time">
                  {new Date(time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMine && (
                    msg.isRead
                      ? <svg className="msg-tick read" viewBox="0 0 18 9" fill="none" strokeWidth="2.2" width="18" height="9">
                          <polyline points="1,4.5 4,7.5 11,1.5" stroke="#22c55e"/>
                          <polyline points="7,4.5 10,7.5 17,1.5" stroke="#22c55e"/>
                        </svg>
                      : <svg className="msg-tick" viewBox="0 0 12 9" fill="none" strokeWidth="2.2" width="12" height="9">
                          <polyline points="1,4.5 4,7.5 11,1.5" stroke="#b0b0b0"/>
                        </svg>
                  )}
                </span>
              )}
            </div>
          );
        })}
        {peerTyping && (
          <div className="chat-msg theirs">
            <div className="chat-bubble typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="chat-input-bar">
        <input ref={photoInputRef} type="file" accept="image/*" multiple
          onChange={handlePhotoSelect} style={{ display: 'none' }} />
        <input ref={pdfInputRef} type="file" accept="application/pdf"
          onChange={handlePdfSelect} style={{ display: 'none' }} />

        <div className="attach-wrap" ref={attachMenuRef}>
          <button className="attach-btn" disabled={uploading}
            onClick={() => { setAttachOpen(o => !o); setLinkMode(false); }} title="Attach">
            {uploading
              ? <span className="attach-spinner" />
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
            }
          </button>
          {attachOpen && (
            <div className="attach-menu">
              <button className="attach-option" onClick={() => photoInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Photo
              </button>
              <button className="attach-option" onClick={() => pdfInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                Attachment
              </button>
              <button className="attach-option" onClick={() => { setLinkMode(true); setAttachOpen(false); }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Link
              </button>
            </div>
          )}
        </div>

        {linkMode ? (
          <input className="chat-input" placeholder="Paste or type a URL…"
            value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown} autoFocus />
        ) : (
          <input className="chat-input" placeholder={`Message ${name}…`}
            value={text} onChange={handleInput}
            onKeyDown={handleKeyDown} autoComplete="off" />
        )}

        <button className="chat-send-btn"
          onClick={linkMode ? sendLink : handleSend}
          disabled={uploading || (linkMode ? !linkUrl.trim() : !text.trim())}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>

      {/* Toasts */}
      {photoError && <div className="photo-error">{photoError}</div>}
      {uploading && <div className="photo-error">Uploading…</div>}

      {/* Gallery viewer */}
      {galleryViewer && (
        <GalleryModal
          photos={galleryViewer.photos}
          initialIndex={galleryViewer.initialIndex}
          onClose={() => setGalleryViewer(null)}
        />
      )}

      {/* PDF viewer */}
      {pdfViewer && (
        <PdfViewerModal name={pdfViewer.name} url={pdfViewer.url} onClose={() => setPdfViewer(null)} />
      )}

      {/* Context menu */}
      {contextMenu && (
        <div className="ctx-menu" style={{ top: contextMenu.y, left: contextMenu.x }}
          onMouseDown={e => e.stopPropagation()}>
          <button className="ctx-item ctx-delete"
            onClick={() => { onDeleteMessage?.(contextMenu.msg.id); setContextMenu(null); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            Delete
          </button>
          <button className="ctx-item ctx-forward"
            onClick={() => { setForwardMsg(contextMenu.msg); setContextMenu(null); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="15" height="15">
              <polyline points="15 17 20 12 15 7"/><path d="M4 18v-2a4 4 0 0 1 4-4h12"/>
            </svg>
            Forward
          </button>
        </div>
      )}

      {/* Forward modal */}
      {forwardMsg && (
        <div className="forward-overlay" onClick={() => setForwardMsg(null)}>
          <div className="forward-modal" onClick={e => e.stopPropagation()}>
            <div className="forward-modal-header">
              <span className="forward-modal-title">Forward to…</span>
              <button className="forward-close-btn" onClick={() => setForwardMsg(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="forward-user-list">
              {users.map(u => {
                const uname = u.full_name || u.fullName || 'Unknown';
                const uphoto = u.profile_photo || u.profilePhoto || null;
                return (
                  <button key={u.id} className="forward-user-item"
                    onClick={() => { onForwardMessage?.(forwardMsg.content, u.id); setForwardMsg(null); }}>
                    <Avatar photo={uphoto} name={uname} className="forward-user-avatar" />
                    <span className="forward-user-name">{uname}</span>
                  </button>
                );
              })}
              {users.length === 0 && <p className="forward-empty">No other users.</p>}
            </div>
          </div>
        </div>
      )}

      {/* Peer profile panel */}
      {profileOpen && (
        <div className="peer-profile-overlay" onClick={() => setProfileOpen(false)}>
          <div className="peer-profile-panel" onClick={e => e.stopPropagation()}>
            <div className="peer-profile-header">
              <button className="peer-panel-back" onClick={() => setProfileOpen(false)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="18" height="18">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
              </button>
              <h2 className="peer-panel-title">Profile</h2>
            </div>
            <div className="peer-profile-body">
              <Avatar photo={photo} name={name} className="peer-avatar-lg" />
              <p className="peer-name-lg">{name}</p>
              <div className="peer-info-list">
                <div className="pi-row">
                  <span className="pi-label">Email</span>
                  <span className="pi-value">{selectedUser.email}</span>
                </div>
                {gender && (
                  <div className="pi-row">
                    <span className="pi-label">Gender</span>
                    <span className="pi-value">{gender}</span>
                  </div>
                )}
                {dob && (
                  <div className="pi-row">
                    <span className="pi-label">Date of Birth</span>
                    <span className="pi-value">
                      {new Date(dob).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                )}
                {memberSince && (
                  <div className="pi-row">
                    <span className="pi-label">Member since</span>
                    <span className="pi-value">
                      {new Date(memberSince).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
