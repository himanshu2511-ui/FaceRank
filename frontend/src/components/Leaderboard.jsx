import { useEffect, useState } from 'react';
import axios from 'axios';
import { Crown, Flame, Star } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TIER_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'];

function RankBadge({ rank }) {
    if (rank === 1) return <Crown size={18} color="#ffd700" />;
    if (rank === 2) return <Crown size={16} color="#c0c0c0" />;
    if (rank === 3) return <Crown size={16} color="#cd7f32" />;
    return <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>#{rank}</span>;
}

export default function Leaderboard() {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const me = localStorage.getItem('username');

    const fetchLeaderboard = async () => {
        try {
            const { data } = await axios.get(`${API}/leaderboard`);
            setLeaders(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard();
        const t = setInterval(fetchLeaderboard, 10000);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="glass" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
                <Flame size={22} color="var(--accent-3)" />
                <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Global Leaderboard</h2>
                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Updates every 10s
                </span>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    Loading rankings…
                </div>
            ) : leaders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🏆</div>
                    <p style={{ color: 'var(--text-muted)' }}>No scores yet — be the first to rank!</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {leaders.map((entry, i) => {
                        const isMe = entry.username === me;
                        const borderColor = i < 3 ? TIER_COLORS[i] : 'var(--glass-border)';
                        const score = typeof entry.total_score === 'number' ? entry.total_score : 0;
                        return (
                            <div key={entry.username} style={{
                                display: 'flex', alignItems: 'center', gap: '16px',
                                padding: '14px 20px', borderRadius: 'var(--radius-sm)',
                                background: isMe ? 'rgba(177,126,255,0.08)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isMe ? 'var(--accent-1)' : borderColor}`,
                                transition: 'transform 0.15s',
                                cursor: 'default',
                            }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'translateX(4px)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                            >
                                <div style={{ width: '30px', display: 'flex', justifyContent: 'center' }}>
                                    <RankBadge rank={entry.rank} />
                                </div>

                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {entry.username}
                                        {isMe && <span style={{ fontSize: '0.7rem', color: 'var(--accent-1)', background: 'rgba(177,126,255,0.15)', padding: '2px 8px', borderRadius: '99px' }}>YOU</span>}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                        {new Date(entry.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                {/* Score bar */}
                                <div style={{ flex: 2, maxWidth: '200px' }}>
                                    <div className="score-bar-track">
                                        <div className="score-bar-fill" style={{
                                            width: `${score}%`,
                                            background: i === 0 ? 'linear-gradient(90deg,#ffd700,#ffb347)' :
                                                i === 1 ? 'linear-gradient(90deg,#c0c0c0,#e8e8e8)' :
                                                    i === 2 ? 'linear-gradient(90deg,#cd7f32,#e0a060)' :
                                                        'linear-gradient(90deg,var(--accent-1),var(--accent-2))',
                                        }} />
                                    </div>
                                </div>

                                <div style={{
                                    fontWeight: 700, fontSize: '1.1rem', minWidth: '60px', textAlign: 'right',
                                    color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'var(--text-primary)',
                                }}>
                                    {score.toFixed(1)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
