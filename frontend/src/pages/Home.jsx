import { useEffect, useState, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import axios from 'axios';
import { Camera, Trophy, MessageSquare, LogOut, Zap } from 'lucide-react';
import Leaderboard from '../components/Leaderboard';
import ChatBox from '../components/ChatBox';
import '../styles/global.css';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const RATING_MAP = [
    { min: 90, label: 'LEGENDARY', color: '#ffd700', emoji: '👑' },
    { min: 80, label: 'EXCEPTIONAL', color: '#b17eff', emoji: '🔥' },
    { min: 70, label: 'ELITE', color: '#00e5ff', emoji: '⚡' },
    { min: 60, label: 'ATTRACTIVE', color: '#7fff72', emoji: '✨' },
    { min: 50, label: 'AVERAGE', color: '#ffb347', emoji: '😐' },
    { min: 0, label: 'BELOW AVG', color: '#ff3eb5', emoji: '💀' },
];

function getRating(score) {
    return RATING_MAP.find(r => score >= r.min) || RATING_MAP[RATING_MAP.length - 1];
}

function ScoreBar({ label, value }) {
    return (
        <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {label.replace(/_/g, ' ')}
                </span>
                <span style={{
                    fontSize: '0.82rem', fontWeight: 600,
                    color: value >= 70 ? 'var(--accent-2)' : value >= 50 ? '#ffb347' : 'var(--accent-3)'
                }}>
                    {value?.toFixed(1)}
                </span>
            </div>
            <div className="score-bar-track">
                <div className="score-bar-fill" style={{ width: `${value || 0}%` }} />
            </div>
        </div>
    );
}

export default function Home() {
    const [tab, setTab] = useState('scan');
    const [scoreData, setScoreData] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [noFace, setNoFace] = useState(false);
    const [rank, setRank] = useState(null);
    const webcamRef = useRef(null);
    const username = localStorage.getItem('username') || 'User';

    const logout = () => {
        localStorage.clear();
        window.location.href = '/auth';
    };

    const captureAndAnalyze = useCallback(async () => {
        if (analyzing || tab !== 'scan') return;
        const img = webcamRef.current?.getScreenshot();
        if (!img) return;
        setAnalyzing(true);
        try {
            const res = await fetch(img);
            const blob = await res.blob();
            const form = new FormData();
            form.append('file', new File([blob], 'face.jpg', { type: 'image/jpeg' }));
            const token = localStorage.getItem('token');
            const { data } = await axios.post(`${API}/analyze`, form, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setScoreData(data);
            setNoFace(false);
        } catch (err) {
            if (err.response?.status === 422) setNoFace(true);
        } finally {
            setAnalyzing(false);
        }
    }, [analyzing, tab]);

    useEffect(() => {
        const t = setInterval(captureAndAnalyze, 1800);
        return () => clearInterval(t);
    }, [captureAndAnalyze]);

    // Fetch user rank after score updates
    useEffect(() => {
        if (!scoreData) return;
        axios.get(`${API}/leaderboard/user/${username}`)
            .then(r => setRank(r.data.rank))
            .catch(() => { });
    }, [scoreData, username]);

    const rating = scoreData ? getRating(scoreData.total_score) : null;

    const NAV = [
        { id: 'scan', label: 'Scan', icon: Camera },
        { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
        { id: 'chat', label: 'Chat', icon: MessageSquare },
    ];

    return (
        <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1, padding: '20px' }}>
            {/* Header */}
            <header className="glass" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 24px', marginBottom: '24px', maxWidth: '1200px', margin: '0 auto 24px',
            }}>
                <h1 className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 700 }}>FaceRank</h1>

                <nav style={{ display: 'flex', gap: '8px' }}>
                    {NAV.map(({ id, label, icon: Icon }) => (
                        <button key={id} onClick={() => setTab(id)} style={{
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
                            borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', fontWeight: 500,
                            background: tab === id ? 'rgba(177,126,255,0.15)' : 'transparent',
                            color: tab === id ? 'var(--accent-1)' : 'var(--text-secondary)',
                            border: `1px solid ${tab === id ? 'var(--accent-1)' : 'transparent'}`,
                            transition: 'all 0.18s',
                        }}>
                            <Icon size={15} />
                            <span style={{ display: 'none' }} className="md-show">{label}</span>
                        </button>
                    ))}
                </nav>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {rank ? `#${rank}` : ''} <strong style={{ color: 'var(--text-primary)' }}>{username}</strong>
                    </span>
                    <button onClick={logout} className="btn-ghost" style={{ padding: '8px 12px' }}>
                        <LogOut size={15} />
                    </button>
                </div>
            </header>

            {/* Main */}
            <main style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {tab === 'scan' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        {/* Camera panel */}
                        <div className="glass" style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-lg)', minHeight: '420px' }}>
                            <Webcam
                                ref={webcamRef}
                                audio={false}
                                screenshotFormat="image/jpeg"
                                screenshotQuality={0.85}
                                videoConstraints={{ facingMode: 'user', width: 640, height: 480 }}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 'var(--radius-lg)' }}
                            />

                            {/* Overlay corners */}
                            {['tl', 'tr', 'bl', 'br'].map(pos => (
                                <div key={pos} style={{
                                    position: 'absolute',
                                    top: pos.startsWith('t') ? '16px' : 'auto',
                                    bottom: pos.startsWith('b') ? '16px' : 'auto',
                                    left: pos.endsWith('l') ? '16px' : 'auto',
                                    right: pos.endsWith('r') ? '16px' : 'auto',
                                    width: '20px', height: '20px',
                                    borderTop: pos.startsWith('t') ? `2px solid var(--accent-1)` : 'none',
                                    borderBottom: pos.startsWith('b') ? `2px solid var(--accent-1)` : 'none',
                                    borderLeft: pos.endsWith('l') ? `2px solid var(--accent-1)` : 'none',
                                    borderRight: pos.endsWith('r') ? `2px solid var(--accent-1)` : 'none',
                                }} />
                            ))}

                            {/* Score badge */}
                            {scoreData && (
                                <div style={{
                                    position: 'absolute', top: '16px', left: '50%', transform: 'translateX(-50%)',
                                    background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
                                    border: `1px solid ${rating.color}40`,
                                    borderRadius: '99px', padding: '6px 20px',
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                }}>
                                    <span style={{ color: rating.color, fontWeight: 700, fontSize: '1.2rem' }}>
                                        {scoreData.total_score.toFixed(1)}
                                    </span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/100</span>
                                </div>
                            )}

                            {/* No face */}
                            {noFace && (
                                <div style={{
                                    position: 'absolute', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
                                    background: 'rgba(0,0,0,0.8)', borderRadius: '8px', padding: '8px 16px',
                                    color: 'var(--accent-3)', fontSize: '0.82rem',
                                }}>
                                    👁 No face detected — center yourself
                                </div>
                            )}

                            {/* Analyzing pulse */}
                            {analyzing && (
                                <div style={{
                                    position: 'absolute', bottom: '24px', right: '24px',
                                    width: '10px', height: '10px', borderRadius: '50%',
                                    background: 'var(--accent-2)',
                                    animation: 'pulse-glow 1s ease-in-out infinite',
                                }} />
                            )}
                        </div>

                        {/* Scores panel */}
                        <div className="glass" style={{ padding: '28px', display: 'flex', flexDirection: 'column' }}>
                            {scoreData ? (
                                <>
                                    {/* Rating badge */}
                                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                        <div style={{ fontSize: '2.5rem', marginBottom: '4px' }}>{rating.emoji}</div>
                                        <div style={{
                                            display: 'inline-block', padding: '6px 20px', borderRadius: '99px',
                                            background: `${rating.color}18`, border: `1px solid ${rating.color}55`,
                                            color: rating.color, fontWeight: 700, letterSpacing: '0.08em', fontSize: '0.9rem',
                                        }}>
                                            {rating.label}
                                        </div>
                                        <div style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            Overall Score
                                        </div>
                                        <div style={{ fontSize: '3.5rem', fontWeight: 700, color: rating.color, lineHeight: 1 }}>
                                            {scoreData.total_score.toFixed(1)}
                                        </div>
                                    </div>

                                    {/* Category bars */}
                                    <div style={{ flex: 1 }}>
                                        {Object.entries(scoreData.scores).map(([key, val]) => (
                                            <ScoreBar key={key} label={key} value={val} />
                                        ))}
                                    </div>

                                    <div style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>
                                        <Zap size={12} style={{ display: 'inline', marginRight: '4px' }} />
                                        Live analysis · updates every 1.8s
                                    </div>
                                </>
                            ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
                                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', border: '2px solid var(--accent-1)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
                                    <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>
                                        Position your face in the camera<br />
                                        <span style={{ fontSize: '0.8rem' }}>Analysis starts automatically</span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {tab === 'leaderboard' && <Leaderboard />}
                {tab === 'chat' && <ChatBox />}
            </main>
        </div>
    );
}
