import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import SideNavbar from '../components/SideNavbar';
import ChatArea from '../components/ChatArea';
import './Home.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5001';

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function toDateInput(val) {
  if (!val) return '';
  return val.split('T')[0];
}

export default function Home() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);
  const selectedUserRef = useRef(null);

  const [me, setMe] = useState(() => JSON.parse(sessionStorage.getItem('user') || 'null'));
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [peerTyping, setPeerTyping] = useState(false);
  const [previews, setPreviews] = useState({});

  const [callState, setCallState] = useState(null); // null | 'calling' | 'incoming' | 'active'
  const [callPeer, setCallPeer] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callError, setCallError] = useState('');
  const pcRef = useRef(null);
  const ringtoneRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const callPeerRef = useRef(null);
  const callTimerRef = useRef(null);
  const isCallerRef = useRef(false);
  const callStateRef = useRef(null);
  const callStartTimeRef = useRef(null);
  const callingInProgressRef = useRef(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Keep selectedUser ref in sync for socket listeners
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => { callPeerRef.current = callPeer; }, [callPeer]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  useEffect(() => {
    if (callState === 'incoming' || callState === 'calling') {
      startRingtone(callState);
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [callState]);

  // Auto-cancel outgoing call after 30 seconds
  useEffect(() => {
    if (callState !== 'calling') return;
    const t = setTimeout(() => {
      if (isCallerRef.current) sendCallRecord('missed');
      if (callPeerRef.current) socketRef.current?.emit('callEnd', { peerId: callPeerRef.current.id });
      cleanupCall();
      setCallState(null);
    }, 30000);
    return () => clearTimeout(t);
  }, [callState]);

  // Fetch user list
  useEffect(() => {
    fetch(`${API}/api/users`)
      .then(r => r.json())
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  function refreshPreviews() {
    if (!me) return;
    fetch(`${API}/api/messages/previews/${me.id}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const map = {};
        data.forEach(p => { map[String(p.peerId)] = p; });
        setPreviews(map);
      })
      .catch(() => {});
  }

  useEffect(() => { refreshPreviews(); }, [me?.id]);

  // Socket connection
  useEffect(() => {
    if (!me) return;
    const socket = io(API);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('registerUser', me.id);
    });

    socket.on('receiveMessage', (msg) => {
      const sid = msg.senderId ?? msg.sender_id;
      if (String(sid) === String(selectedUserRef.current?.id)) {
        setMessages(prev => [...prev, msg]);
        socket.emit('markAsRead', { messageId: msg.id, userId: me.id });
      }
      refreshPreviews();
    });

    socket.on('messageRead', (messageId) => {
      setMessages(prev => prev.map(m =>
        String(m.id) === String(messageId) ? { ...m, isRead: true } : m
      ));
    });

    socket.on('messageSent', (msg) => {
      setMessages(prev => [...prev, msg]);
      refreshPreviews();
    });

    socket.on('userOnline', (uid) => {
      setOnlineUsers(prev => new Set([...prev, String(uid)]));
    });

    socket.on('userOffline', (uid) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        next.delete(String(uid));
        return next;
      });
    });

    socket.on('userTyping', (uid) => {
      if (String(uid) === String(selectedUserRef.current?.id)) setPeerTyping(true);
    });

    socket.on('userStoppedTyping', (uid) => {
      if (String(uid) === String(selectedUserRef.current?.id)) setPeerTyping(false);
    });

    socket.on('incomingCall', ({ callerId, callerName, callerPhoto, offer }) => {
      setIncomingCallData({ callerId, callerName, callerPhoto, offer });
      setCallPeer({ id: callerId, fullName: callerName, profilePhoto: callerPhoto });
      setCallState('incoming');
    });

    socket.on('callAnswered', async ({ answer }) => {
      if (!pcRef.current) return;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      for (const c of pendingCandidatesRef.current) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingCandidatesRef.current = [];
      setCallState('active');
      startCallTimer();
    });

    socket.on('callRejected', () => {
      if (isCallerRef.current) sendCallRecord('missed');
      cleanupCall(); setCallState(null);
    });
    socket.on('callUnavailable', () => {
      if (isCallerRef.current) sendCallRecord('missed');
      cleanupCall(); setCallState(null);
    });
    socket.on('callEnded', () => {
      if (isCallerRef.current && callStateRef.current === 'active') sendCallRecord('ended', getCallDurationStr());
      cleanupCall(); setCallState(null);
    });

    socket.on('iceCandidate', async ({ candidate }) => {
      if (!pcRef.current) return;
      if (pcRef.current.remoteDescription) {
        try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [me?.id]);

  // Fetch conversation when selected user changes
  useEffect(() => {
    setMessages([]);
    setPeerTyping(false);
    if (!selectedUser || !me) return;
    fetch(`${API}/api/messages/conversation?userId1=${me.id}&userId2=${selectedUser.id}`)
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        setMessages(data);
        data.forEach(msg => {
          const sid = msg.senderId ?? msg.sender_id;
          if (String(sid) === String(selectedUser.id) && !msg.isRead) {
            socketRef.current?.emit('markAsRead', { messageId: msg.id, userId: me.id });
          }
        });
      })
      .catch(() => {});
  }, [selectedUser?.id]);

  function handleSelectUser(u) {
    setSelectedUser(u);
    setPreviews(prev => {
      const key = String(u.id);
      if (!prev[key] || prev[key].unreadCount === 0) return prev;
      return { ...prev, [key]: { ...prev[key], unreadCount: 0, firstUnreadContent: null } };
    });
  }

  const filteredUsers = users
    .filter(u => {
      const name = (u.full_name || u.fullName || '').toLowerCase();
      return u.id !== me?.id && name.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      const timeA = previews[String(a.id)]?.sentAt || a.created_at || a.createdAt || 0;
      const timeB = previews[String(b.id)]?.sentAt || b.created_at || b.createdAt || 0;
      return new Date(timeB) - new Date(timeA);
    });

  function sendMessage(content) {
    if (!selectedUser || !socketRef.current) return;
    socketRef.current.emit('sendMessage', {
      senderId: me.id,
      receiverId: selectedUser.id,
      content,
    });
  }

  function forwardMessage(content, receiverId) {
    if (!socketRef.current) return;
    socketRef.current.emit('sendMessage', {
      senderId: me.id,
      receiverId,
      content,
    });
  }

  async function deleteMessage(id) {
    await fetch(`${API}/api/messages/${id}`, { method: 'DELETE' });
    setMessages(prev => prev.filter(m => m.id !== id));
  }

  function emitTyping() {
    if (!selectedUser || !socketRef.current) return;
    socketRef.current.emit('userTyping', { senderId: me.id, receiverId: selectedUser.id });
  }

  function emitStoppedTyping() {
    if (!selectedUser || !socketRef.current) return;
    socketRef.current.emit('userStoppedTyping', { senderId: me.id, receiverId: selectedUser.id });
  }

  async function openProfile() {
    setProfileError('');
    setEditMode(false);
    setProfileData(null);
    setProfileOpen(true);
    try {
      const res = await fetch(`${API}/api/users/${me.id}`);
      const data = await res.json();
      setProfileData(data);
      setEditForm({
        fullName: data.full_name || data.fullName || '',
        email: data.email || '',
        gender: data.gender || '',
        dateOfBirth: toDateInput(data.date_of_birth || data.dateOfBirth || ''),
        profilePhoto: data.profile_photo || data.profilePhoto || null,
      });
    } catch {
      setProfileError('Failed to load profile.');
    }
  }

  function handlePhotoSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      URL.revokeObjectURL(url);
      setEditForm(f => ({ ...f, profilePhoto: canvas.toDataURL('image/jpeg', 0.85) }));
    };
    img.src = url;
    e.target.value = '';
  }

  async function saveProfile() {
    setSaving(true);
    setProfileError('');
    try {
      const res = await fetch(`${API}/api/users/${me.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setProfileData(data);
      const updated = {
        ...me,
        fullName: data.full_name || data.fullName || me.fullName,
        email: data.email,
        profilePhoto: data.profile_photo || data.profilePhoto || null,
      };
      sessionStorage.setItem('user', JSON.stringify(updated));
      setMe(updated);
      setEditMode(false);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function closeProfile() {
    setProfileOpen(false);
    setEditMode(false);
    setProfileError('');
  }

  function stopRingtone() {
    ringtoneRef.current?.stop();
    ringtoneRef.current = null;
  }

  function startRingtone(type) {
    stopRingtone();
    let active = true;
    let ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }

    function tone(freq, start, dur) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, start);
      gain.gain.setValueAtTime(0.18, start + dur - 0.02);
      gain.gain.linearRampToValueAtTime(0, start + dur);
      osc.start(start);
      osc.stop(start + dur);
    }

    function schedule() {
      if (!active) return;
      const now = ctx.currentTime;
      if (type === 'incoming') {
        // classic double-ring: beep-beep … pause
        tone(480, now, 0.4);
        tone(480, now + 0.55, 0.4);
        setTimeout(schedule, 2600);
      } else {
        // outgoing dial tone: single long beep … pause
        tone(440, now, 1.0);
        setTimeout(schedule, 3200);
      }
    }

    schedule();
    ringtoneRef.current = {
      stop: () => { active = false; try { ctx.close(); } catch {} }
    };
  }

  function makePeerConnection(peerId) {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) socketRef.current?.emit('iceCandidate', { peerId, candidate });
    };
    pc.ontrack = (event) => {
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = event.streams[0];
    };
    pcRef.current = pc;
    return pc;
  }

  function startCallTimer() {
    callStartTimeRef.current = Date.now();
    callTimerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);
  }

  function getCallDurationStr() {
    if (!callStartTimeRef.current) return '00:00';
    const s = Math.floor((Date.now() - callStartTimeRef.current) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function sendCallRecord(type, duration) {
    if (!callPeerRef.current || !socketRef.current) return;
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const payload = type === 'ended' ? { type, duration, time } : { type, time };
    socketRef.current.emit('sendMessage', {
      senderId: me.id,
      receiverId: callPeerRef.current.id,
      content: '__CALL__:' + JSON.stringify(payload),
    });
  }

  function cleanupCall() {
    callingInProgressRef.current = false;
    callPeerRef.current = null;
    callStateRef.current = null;
    stopRingtone();
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    clearInterval(callTimerRef.current);
    pendingCandidatesRef.current = [];
    isCallerRef.current = false;
    callStartTimeRef.current = null;
    setCallDuration(0);
    setIsMuted(false);
    setIncomingCallData(null);
    setCallPeer(null);
  }

  async function startCall() {
    if (!selectedUser || callState || callingInProgressRef.current) return;
    callingInProgressRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = makePeerConnection(selectedUser.id);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      isCallerRef.current = true;
      callPeerRef.current = selectedUser;
      callStateRef.current = 'calling';
      setCallPeer(selectedUser);
      setCallState('calling');
      socketRef.current?.emit('callUser', {
        callerId: me.id,
        receiverId: selectedUser.id,
        callerName: me.fullName,
        callerPhoto: me.profilePhoto || null,
        offer,
      });
    } catch (err) {
      cleanupCall();
      setCallState(null);
      const msg = err?.name === 'NotAllowedError' ? 'Microphone access denied.' : 'Could not start call.';
      setCallError(msg);
      setTimeout(() => setCallError(''), 3000);
    }
  }

  async function acceptCall() {
    if (!incomingCallData) return;
    const { callerId, offer } = incomingCallData;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      const pc = makePeerConnection(callerId);
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      for (const c of pendingCandidatesRef.current) {
        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
      }
      pendingCandidatesRef.current = [];
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      isCallerRef.current = false;
      callStateRef.current = 'active';
      socketRef.current?.emit('callAnswer', { callerId, answer });
      setCallState('active');
      startCallTimer();
    } catch (err) {
      cleanupCall();
      setCallState(null);
      const msg = err?.name === 'NotAllowedError' ? 'Microphone access denied.' : 'Could not accept call.';
      setCallError(msg);
      setTimeout(() => setCallError(''), 3000);
    }
  }

  function rejectCall() {
    if (incomingCallData) socketRef.current?.emit('callReject', { callerId: incomingCallData.callerId });
    cleanupCall();
    setCallState(null);
  }

  function endCall() {
    const state = callStateRef.current;
    if (isCallerRef.current) {
      if (state === 'active') sendCallRecord('ended', getCallDurationStr());
      else if (state === 'calling') sendCallRecord('missed');
    }
    if (callPeerRef.current) socketRef.current?.emit('callEnd', { peerId: callPeerRef.current.id });
    cleanupCall();
    setCallState(null);
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    const next = !isMuted;
    localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setIsMuted(next);
  }

  function formatDuration(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  function logout() {
    socketRef.current?.disconnect();
    sessionStorage.removeItem('user');
    navigate('/');
  }

  return (
    <div className="home-container">
      <SideNavbar
        me={me}
        filteredUsers={filteredUsers}
        search={search}
        setSearch={setSearch}
        onOpenProfile={openProfile}
        onLogout={logout}
        selectedUser={selectedUser}
        onSelectUser={handleSelectUser}
        onlineUsers={onlineUsers}
        previews={previews}
      />

      <ChatArea
        me={me}
        selectedUser={selectedUser}
        messages={messages}
        peerTyping={peerTyping}
        onSendMessage={sendMessage}
        onTyping={emitTyping}
        onStoppedTyping={emitStoppedTyping}
        onDeleteMessage={deleteMessage}
        onForwardMessage={forwardMessage}
        users={users.filter(u => u.id !== me?.id)}
        onlineUsers={onlineUsers}
        onStartCall={startCall}
        callState={callState}
      />

      {/* Hidden remote audio output */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />

      {/* ── Call error toast ── */}
      {callError && (
        <div className="call-error-toast">{callError}</div>
      )}

      {/* ── Incoming call overlay ── */}
      {callState === 'incoming' && incomingCallData && (
        <div className="call-overlay">
          <div className="call-card">
            <div className="call-avatar-pulse">
              <div className="call-avatar-ring" />
              <div className="incoming-avatar">
                {incomingCallData.callerPhoto
                  ? <img src={incomingCallData.callerPhoto} alt="" className="avatar-img" />
                  : <span className="avatar-initials">{getInitials(incomingCallData.callerName)}</span>
                }
              </div>
            </div>
            <p className="call-peer-name">{incomingCallData.callerName}</p>
            <p className="call-subtitle">Incoming audio call…</p>
            <div className="call-card-actions">
              <button className="call-action-btn reject" onClick={rejectCall} title="Decline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="22" height="22">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A2 2 0 0 1 10.68 13.31z"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
              <button className="call-action-btn accept" onClick={acceptCall} title="Accept">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="22" height="22">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Outgoing call overlay ── */}
      {callState === 'calling' && callPeer && (
        <div className="call-overlay">
          <div className="call-card">
            <div className="call-avatar-pulse">
              <div className="call-avatar-ring" />
              <div className="incoming-avatar">
                {callPeer.profilePhoto || callPeer.profile_photo
                  ? <img src={callPeer.profilePhoto || callPeer.profile_photo} alt="" className="avatar-img" />
                  : <span className="avatar-initials">{getInitials(callPeer.fullName || callPeer.full_name)}</span>
                }
              </div>
            </div>
            <p className="call-peer-name">{callPeer.fullName || callPeer.full_name}</p>
            <p className="call-subtitle">Calling…</p>
            <div className="call-card-actions">
              <button className="call-action-btn reject" onClick={endCall} title="Cancel">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="22" height="22">
                  <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A2 2 0 0 1 10.68 13.31z"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Active call bar ── */}
      {callState === 'active' && callPeer && (
        <div className="call-active-bar">
          <div className="call-active-info">
            <div className="call-active-avatar">
              {callPeer.profilePhoto || callPeer.profile_photo
                ? <img src={callPeer.profilePhoto || callPeer.profile_photo} alt="" className="avatar-img" />
                : <span className="avatar-initials">{getInitials(callPeer.fullName || callPeer.full_name)}</span>
              }
            </div>
            <div>
              <p className="call-active-name">{callPeer.fullName || callPeer.full_name}</p>
              <p className="call-active-status">{formatDuration(callDuration)}</p>
            </div>
          </div>
          <div className="call-active-actions">
            <button className={`call-ctrl-btn${isMuted ? ' muted' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                {isMuted
                  ? <><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                  : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                }
              </svg>
            </button>
            <button className="call-ctrl-btn end" onClick={endCall} title="End call">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A2 2 0 0 1 10.68 13.31z"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Profile panel ── */}
      {profileOpen && (
        <div className="profile-overlay" onClick={closeProfile}>
          <div className="profile-panel" onClick={e => e.stopPropagation()}>

            <div className="profile-panel-header">
              <button className="panel-back" onClick={closeProfile} title="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" width="18" height="18">
                  <path d="M19 12H5M12 5l-7 7 7 7"/>
                </svg>
              </button>
              <h2 className="panel-title">My Profile</h2>
              {!editMode && profileData && (
                <button className="panel-edit-btn" onClick={() => setEditMode(true)}>Edit</button>
              )}
              {editMode && <div className="panel-header-spacer" />}
            </div>

            <div className="profile-panel-body">
              {profileError && <div className="profile-error">{profileError}</div>}
              {!profileData && !profileError && <p className="profile-loading">Loading…</p>}

              {profileData && (
                <>
                  <div className={`profile-avatar-lg${editMode ? ' editable' : ''}`}
                    onClick={editMode ? () => fileInputRef.current?.click() : undefined}
                    title={editMode ? 'Click to change photo' : undefined}
                  >
                    {(editMode ? editForm.profilePhoto : (profileData.profile_photo || profileData.profilePhoto))
                      ? <img
                          src={editMode ? editForm.profilePhoto : (profileData.profile_photo || profileData.profilePhoto)}
                          alt="profile"
                          className="avatar-img"
                        />
                      : <span className="avatar-initials">{getInitials(profileData.full_name || profileData.fullName)}</span>
                    }
                    {editMode && (
                      <div className="avatar-upload-overlay">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2" width="20" height="20">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                  />

                  <p className="profile-name-lg">{profileData.full_name || profileData.fullName}</p>

                  {editMode && (
                    <button className="change-photo-btn" onClick={() => fileInputRef.current?.click()}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" width="14" height="14">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      Change photo
                    </button>
                  )}

                  {editMode ? (
                    <div className="profile-edit-form">
                      <div className="pf-group">
                        <label className="pf-label">Full Name</label>
                        <input className="pf-input" value={editForm.fullName}
                          onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))} />
                      </div>
                      <div className="pf-group">
                        <label className="pf-label">Email</label>
                        <input className="pf-input" type="email" value={editForm.email}
                          onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div className="pf-group">
                        <label className="pf-label">Gender</label>
                        <select className="pf-input" value={editForm.gender}
                          onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
                          <option value="">Not specified</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                      <div className="pf-group">
                        <label className="pf-label">Date of Birth</label>
                        <input className="pf-input" type="date" value={editForm.dateOfBirth}
                          onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
                      </div>
                      <div className="pf-actions">
                        <button className="pf-cancel" onClick={() => setEditMode(false)}>Cancel</button>
                        <button className="pf-save" onClick={saveProfile} disabled={saving}>
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="profile-info-list">
                      <div className="pi-row">
                        <span className="pi-label">Email</span>
                        <span className="pi-value">{profileData.email}</span>
                      </div>
                      {profileData.gender && (
                        <div className="pi-row">
                          <span className="pi-label">Gender</span>
                          <span className="pi-value">{profileData.gender}</span>
                        </div>
                      )}
                      {(profileData.date_of_birth || profileData.dateOfBirth) && (
                        <div className="pi-row">
                          <span className="pi-label">Date of Birth</span>
                          <span className="pi-value">
                            {new Date(profileData.date_of_birth || profileData.dateOfBirth)
                              .toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      {profileData.created_at && (
                        <div className="pi-row">
                          <span className="pi-label">Member since</span>
                          <span className="pi-value">
                            {new Date(profileData.created_at)
                              .toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
