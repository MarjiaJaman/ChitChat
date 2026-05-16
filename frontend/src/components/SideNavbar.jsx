import { useState, useEffect, useRef } from 'react';

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

function formatPreviewTime(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatPreviewContent(content) {
  if (!content) return '';
  if (content.startsWith('__IMG__:')) return 'Photo';
  if (content.startsWith('__PHOTOS__:')) return 'Photos';
  if (content.startsWith('__PDF__:')) return 'Attachment';
  if (content.startsWith('__CALL__:')) {
    try {
      const { type } = JSON.parse(content.slice(9));
      return type === 'missed' ? 'Missed Call' : 'Audio Call';
    } catch { return 'Audio Call'; }
  }
  const words = content.trim().split(/\s+/);
  return words.length > 5 ? words.slice(0, 5).join(' ') + '...' : content;
}

export default function SideNavbar({
  me, filteredUsers, search, setSearch,
  onOpenProfile, onLogout,
  selectedUser, onSelectUser, onlineUsers = new Set(), previews = {}
}) {
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const itemRefs = useRef([]);

  // Reset highlight when search or list changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [search, filteredUsers.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && itemRefs.current[highlightedIndex]) {
      itemRefs.current[highlightedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  function handleSearchKeyDown(e) {
    if (filteredUsers.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, filteredUsers.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredUsers.length) {
        onSelectUser(filteredUsers[highlightedIndex]);
        setHighlightedIndex(-1);
        setSearch('');
      }
    } else if (e.key === 'Escape') {
      setHighlightedIndex(-1);
    }
  }

  return (
    <aside className="sidebar">

      <div className="sidebar-brand-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span>ChitChat</span>
      </div>

      <button className="profile-btn" onClick={onOpenProfile}>
        <Avatar photo={me?.profilePhoto} name={me?.fullName} className="sidebar-avatar" />
        <span className="profile-btn-name">{me?.fullName || 'My Profile'}</span>
        <svg className="profile-btn-chevron" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" width="16" height="16">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>

      <div className="search-wrap">
        <div className="search-box">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch('')}>×</button>
          )}
        </div>
      </div>

      <ul className="user-list">
        {filteredUsers.length === 0 ? (
          <li className="user-list-empty">
            {search ? 'No users found' : 'No other users yet'}
          </li>
        ) : (
          filteredUsers.map((u, idx) => {
            const name = u.full_name || u.fullName || 'Unknown';
            const isOnline = onlineUsers.has(String(u.id));
            const isActive = selectedUser?.id === u.id;
            const isHighlighted = highlightedIndex === idx;
            const preview = previews[String(u.id)];
            const previewTime = formatPreviewTime(preview?.sentAt);
            const unreadCount = preview?.unreadCount || 0;
            const hasUnread = unreadCount > 0;
            const previewText = hasUnread
              ? formatPreviewContent(preview.firstUnreadContent)
              : formatPreviewContent(preview?.content);
            return (
              <li
                key={u.id}
                ref={el => itemRefs.current[idx] = el}
                className={`user-item${isActive ? ' active' : ''}${isHighlighted ? ' highlighted' : ''}`}
                onClick={() => { onSelectUser(u); setHighlightedIndex(-1); }}
              >
                <div className="user-avatar-wrap">
                  <Avatar photo={u.profile_photo || u.profilePhoto} name={name} className="user-avatar" />
                  {isOnline && <span className="online-dot" />}
                </div>
                <div className="user-info">
                  <span className={`user-name${hasUnread ? ' unread' : ''}`}>{name}</span>
                  {(previewText || previewTime) && (
                    <div className="user-preview-line">
                      <span className={`user-preview-text${hasUnread ? ' unread' : ''}`}>
                        {previewText}
                      </span>
                      {hasUnread && unreadCount > 1 && (
                        <span className="user-unread-badge">+{unreadCount - 1}</span>
                      )}
                      {previewTime && <><span className="user-preview-dot">·</span><span className="user-preview-time">{previewTime}</span></>}
                    </div>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      <button className="btn-logout" onClick={onLogout}>Logout</button>
    </aside>
  );
}
