import { useState, useEffect, useRef } from 'react';
import { Send, Users } from 'lucide-react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

export default function ChatBox() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [online, setOnline] = useState([]);
    const [connected, setConnected] = useState(false);
    const ws = useRef(null);
    const endRef = useRef(null);
    const username = localStorage.getItem('username') || 'Guest';

    useEffect(() => {
        const connect = () => {
            ws.current = new WebSocket(`${WS_URL}/ws/chat/${username}`);
            ws.current.onopen = () => setConnected(true);
            ws.current.onclose = () => { setConnected(false); setTimeout(connect, 3000); };
            ws.current.onerror = () => ws.current?.close();
            ws.current.onmessage = (ev) => {
                const payload = JSON.parse(ev.data);
                setOnline(payload.users || []);
                setMessages(prev => [...prev.slice(-199), payload]);
            };
        };
        connect();
        return () => { ws.current?.close(); };
    }, [username]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = (e) => {
        e.preventDefault();
        if (!input.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN) return;
        ws.current.send(input.trim());
        setInput('');
    };

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            {/* Chat panel */}
            <div className="glass" style={{ display: 'flex', flexDirection: 'column', height: '560px' }}>
                {/* Header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? 'var(--accent-2)' : '#666' }} />
                    <span style={{ fontWeight: 600 }}>Global Chat</span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {connected ? 'Live' : 'Reconnecting…'}
                    </span>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {messages.map((msg, i) => {
                        if (msg.type === 'system') {
                            return (
                                <div key={i} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '4px 0' }}>
                                    {msg.message}
                                </div>
                            );
                        }
                        const isMe = msg.from === username;
                        return (
                            <div key={i} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                <div style={{ maxWidth: '72%' }}>
                                    {!isMe && (
                                        <div style={{ fontSize: '0.72rem', color: 'var(--accent-1)', marginBottom: '3px', fontWeight: 600 }}>
                                            {msg.from}
                                        </div>
                                    )}
                                    <div style={{
                                        padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                        background: isMe ? 'linear-gradient(135deg,var(--accent-1),var(--accent-3))' : 'rgba(255,255,255,0.07)',
                                        color: '#fff', fontSize: '0.9rem', lineHeight: 1.4,
                                        boxShadow: isMe ? '0 0 12px rgba(177,126,255,0.25)' : 'none',
                                    }}>
                                        {msg.message}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {messages.length === 0 && (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                            No messages yet — say hi! 👋
                        </div>
                    )}
                    <div ref={endRef} />
                </div>

                {/* Input */}
                <form onSubmit={send} style={{ padding: '14px 16px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '10px' }}>
                    <input
                        className="input-field"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={connected ? 'Type a message…' : 'Connecting…'}
                        disabled={!connected}
                        style={{ flex: 1, padding: '10px 14px' }}
                    />
                    <button type="submit" className="btn-primary" disabled={!connected || !input.trim()} style={{ padding: '10px 16px' }}>
                        <Send size={16} />
                    </button>
                </form>
            </div>

            {/* Online users */}
            <div className="glass" style={{ padding: '20px', height: '560px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <Users size={15} color="var(--accent-2)" />
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Online</span>
                    <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--accent-2)' }}>{online.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {online.map(u => (
                        <div key={u} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: 'var(--radius-sm)', background: u === username ? 'rgba(177,126,255,0.1)' : 'rgba(255,255,255,0.03)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-2)', flexShrink: 0 }} />
                            <span style={{ fontSize: '0.85rem', color: u === username ? 'var(--accent-1)' : 'var(--text-primary)', fontWeight: u === username ? 600 : 400 }}>
                                {u === username ? `${u} (you)` : u}
                            </span>
                        </div>
                    ))}
                    {online.length === 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No one online yet</span>
                    )}
                </div>
            </div>
        </div>
    );
}
