import { useNavigate } from 'react-router-dom';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h3>💬 Messenger</h3>
        </div>
        <ul className="conversation-list">
          {['Alice', 'Bob', 'Charlie'].map((name) => (
            <li key={name} className="conversation-item">
              <div className="avatar">{name[0]}</div>
              <div className="conversation-info">
                <span className="conversation-name">{name}</span>
                <span className="conversation-preview">Click to chat...</span>
              </div>
            </li>
          ))}
        </ul>
        <button className="btn-logout" onClick={() => navigate('/')}>Logout</button>
      </aside>

      <main className="chat-area">
        <div className="chat-placeholder">
          <span>👈 Select a conversation to start chatting</span>
        </div>
      </main>
    </div>
  );
}
