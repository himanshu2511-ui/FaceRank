import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../styles/global.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Auth() {
    const [tab, setTab] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            if (tab === 'register') {
                await axios.post(`${API}/register`, { username, password });
                setTab('login');
                setError('✅ Account created! Please log in.');
                setLoading(false);
                return;
            }
            // Login
            const { data } = await axios.post(
                `${API}/token`,
                new URLSearchParams({ username, password }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );
            localStorage.setItem('token', data.access_token);
            localStorage.setItem('username', username);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.detail || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            position: 'relative',
            zIndex: 1,
        }}>
            {/* logo + tagline */}
            <div style={{ width: '100%', maxWidth: '420px' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h1 className="gradient-text" style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                        FaceRank
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '0.95rem' }}>
                        your face. your rank. their opinion. 🔥
                    </p>
                </div>

                <div className="glass" style={{ padding: '36px 32px' }}>
                    {/* tabs */}
                    <div style={{ display: 'flex', gap: '4px', marginBottom: '32px', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', padding: '4px' }}>
                        {['login', 'register'].map(t => (
                            <button key={t} onClick={() => { setTab(t); setError(''); }}
                                style={{
                                    flex: 1, padding: '10px', borderRadius: '6px', fontWeight: 600,
                                    fontSize: '0.9rem', transition: 'all 0.2s',
                                    background: tab === t ? 'var(--glass-bg)' : 'transparent',
                                    color: tab === t ? 'var(--accent-1)' : 'var(--text-muted)',
                                    border: tab === t ? '1px solid var(--glass-border)' : '1px solid transparent',
                                }}>
                                {t === 'login' ? 'Log In' : 'Sign Up'}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div style={{
                            marginBottom: '20px', padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                            background: error.startsWith('✅') ? 'rgba(0,229,255,0.08)' : 'rgba(255,62,181,0.1)',
                            border: `1px solid ${error.startsWith('✅') ? 'rgba(0,229,255,0.3)' : 'rgba(255,62,181,0.3)'}`,
                            color: error.startsWith('✅') ? 'var(--accent-2)' : 'var(--accent-3)',
                            fontSize: '0.88rem',
                        }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <input
                            className="input-field"
                            type="text"
                            placeholder="Username"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                        />
                        <input
                            className="input-field"
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                        />
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading}
                            style={{ marginTop: '8px', width: '100%', opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? 'Processing…' : tab === 'login' ? '🚀 Enter the Ranking' : '⚡ Create Account'}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Your images are processed in memory & never stored 🔒
                </p>
            </div>
        </div>
    );
}
