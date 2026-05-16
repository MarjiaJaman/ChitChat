import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PasswordField from '../components/PasswordField';
import ChitChatLogo from '../components/ChitChatLogo';
import './Auth.css';

function isStrongPassword(password) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters and include a letter, a number, and a special character.';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    gender: '',
    dateOfBirth: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
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
      ...extraProps,
    };

    let input;
    if (type === 'password') {
      input = <PasswordField {...inputProps} required />;
    } else if (type === 'select') {
      input = (
        <select {...inputProps} required>
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      );
    } else {
      input = <input type={type} {...inputProps} />;
    }

    const isRequired = type !== 'select' && name !== 'dateOfBirth' && name !== 'gender';
    return (
      <div className="form-group">
        <label className="form-label" htmlFor={name}>
          {label} {isRequired && <span className="required-star">*</span>}
        </label>
        {input}
      </div>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (form.password !== form.confirmPassword) {
        throw new Error('Password and confirm password must match.');
      }

      if (!isStrongPassword(form.password)) {
        throw new Error(PASSWORD_REQUIREMENTS_MESSAGE);
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5001'}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          gender: form.gender || null,
          dateOfBirth: form.dateOfBirth || null,
          email: form.email,
          password: form.password,
          confirmPassword: form.confirmPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Signup failed. Please try again.');
      }

      navigate('/', { state: { registered: true } });
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
            Create your free account and start connecting with people in seconds.
          </p>
          <div className="auth-brand-features">
            <div className="auth-brand-feature">
              <div className="auth-brand-feature-icon">🟢</div>
              <span>See who's online and start chatting right away.</span>
            </div>
            <div className="auth-brand-feature">
              <div className="auth-brand-feature-icon">📞</div>
              <span>Crystal-clear audio calls, no app download needed.</span>
            </div>
            <div className="auth-brand-feature">
              <div className="auth-brand-feature-icon">🖼️</div>
              <span>Send photos, PDFs, and links effortlessly.</span>
            </div>
            <div className="auth-brand-feature">
              <div className="auth-brand-feature-icon">🔔</div>
              <span>Unread message previews so you never miss a thing.</span>
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

          <h1 className="form-heading">Create your account</h1>
          <p className="form-subheading">Start chatting in seconds — it's free</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} noValidate>
            {field('fullName', 'Full name', 'text', {
              placeholder: 'Full name',
              autoComplete: 'name',
              autoFocus: true,
            })}
            <div className="form-row">
              {field('gender', 'Gender', 'select', {
                placeholder: 'Gender',
              })}
              {field('dateOfBirth', 'Date of birth', 'date', {
                placeholder: 'Date of birth',
              })}
            </div>
            {field('email', 'Email address', 'email', {
              placeholder: 'Email address',
              autoComplete: 'email',
            })}
            {field('password', 'Password', 'password', {
              placeholder: 'Password',
              autoComplete: 'new-password',
            })}
            {field('confirmPassword', 'Confirm password', 'password', {
              placeholder: 'Confirm password',
              autoComplete: 'new-password',
            })}

            <button type="submit" className="btn btn-primary mt-form" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="form-footer">
            Already have an account?{' '}
            <Link to="/" className="link">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
