import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import PasswordField from '../components/PasswordField';
import ChitChatLogo from '../components/ChitChatLogo';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const registered = location.state?.registered;

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function field(name, label, type, extraProps = {}) {
    const value = form[name];
    const inputProps = {
      id: name,
      name,
      className: 'form-input',
      value,
      onChange: (e) => setForm((cur) => ({ ...cur, [name]: e.target.value })),
      required: true,
      ...extraProps,
    };

    return (
      <div className="form-group">
        <label className="form-label" htmlFor={name}>
          {label}
        </label>
        {type === 'password' ? <PasswordField {...inputProps} /> : <input type={type} {...inputProps} />}
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || 'Login failed. Please try again.');
      }

      // Store logged-in user in sessionStorage
      sessionStorage.setItem('user', JSON.stringify(data));
      navigate('/home');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-brand-logo">
            <ChitChatLogo size={68} />
          </div>
          <h1 className="auth-brand-name">ChitChat</h1>
          <p className="auth-brand-tagline">
            Real-time messaging, audio calls, and media sharing — all in one place.
          </p>
          <div className="auth-brand-features">
            <div className="auth-brand-feature">
              <div className="auth-brand-feature-icon">💬</div>
              <span>Instant messaging with live typing indicators.</span>
            </div>
            <div className="auth-brand-feature">
              <div className="auth-brand-feature-icon">📞</div>
              <span>One-on-one audio calls with WebRTC technology.</span>
            </div>
            <div className="auth-brand-feature">
              <div className="auth-brand-feature-icon">🖼️</div>
              <span>Share photos, files, and attachments instantly.</span>
            </div>
            <div className="auth-brand-feature">
              <div className="auth-brand-feature-icon">✅</div>
              <span>Read receipts so you always know who's seen your message.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-card">
        <div className="auth-form-wrapper">
          <div className="auth-mobile-brand">
            <ChitChatLogo size={28} />
            <span className="auth-mobile-brand-name">ChitChat</span>
          </div>

          <h1 className="form-heading">Welcome back</h1>
          <p className="form-subheading">Sign in to your account</p>

          {registered && (
            <div className="alert alert-success">Account created! Please sign in.</div>
          )}
          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            {field('email', 'Email address', 'email', {
              placeholder: 'Email address',
              autoComplete: 'email',
              autoFocus: true,
            })}
            {field('password', 'Password', 'password', {
              placeholder: 'Password',
              autoComplete: 'current-password',
            })}

            <button type="submit" className="btn btn-primary mt-form" disabled={submitting}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="form-footer">
            Don't have an account?{' '}
            <Link to="/signup" className="link">Create one</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

