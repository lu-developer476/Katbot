'use client';

import { useEffect, useMemo, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Error de red');
  }

  return response.json();
}

export default function ChatShell() {
  const [chatId, setChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const disabled = useMemo(() => loading || !input.trim(), [loading, input]);

  useEffect(() => {
    const init = async () => {
      try {
        setError('');
        const chat = await request('/api/chats', { method: 'POST', body: JSON.stringify({}) });
        setChatId(chat.chat.id);
        setMessages([]);
      } catch (err) {
        setError(err.message || 'No se pudo iniciar el chat.');
      }
    };

    init();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (disabled || !chatId) return;

    const prompt = input.trim();
    const optimisticUser = { role: 'user', content: prompt, id: crypto.randomUUID() };

    setMessages((prev) => [...prev, optimisticUser]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const result = await request(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: prompt }),
      });

      setMessages(result.messages);
    } catch (err) {
      setError(err.message || 'No se pudo enviar el mensaje.');
    } finally {
      setLoading(false);
    }
  };

  const resetConversation = async () => {
    try {
      setLoading(true);
      setError('');
      const chat = await request('/api/chats', { method: 'POST', body: JSON.stringify({}) });
      setChatId(chat.chat.id);
      setMessages([]);
      setInput('');
    } catch (err) {
      setError(err.message || 'No se pudo reiniciar la conversación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div style={styles.heroBadge}>KABOT</div>
        <h1 style={styles.title}>Tu chatbot listo para producción.</h1>
        <p style={styles.subtitle}>
          Next.js al frente, Express atrás, OpenAI en el cerebro y PostgreSQL guardando memoria.
          Bastante mejor que un bot con complejo de tostadora.
        </p>
      </section>

      <section style={styles.grid}>
        <aside style={styles.sidebar}>
          <img src="/kabot-mascot.jpg" alt="Mascota de Kabot" style={styles.image} />
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Stack</h2>
            <ul style={styles.list}>
              <li>React / Next.js</li>
              <li>Node.js / Express</li>
              <li>OpenAI API</li>
              <li>PostgreSQL / Supabase</li>
              <li>Deploy en Vercel + Render</li>
            </ul>
          </div>
        </aside>

        <section style={styles.chatPanel}>
          <div style={styles.chatHeader}>
            <div>
              <h2 style={styles.chatTitle}>Consola de conversación</h2>
              <p style={styles.chatHint}>Probá el flujo real del proyecto base.</p>
            </div>
            <button onClick={resetConversation} style={styles.secondaryButton} disabled={loading}>
              Nuevo chat
            </button>
          </div>

          <div style={styles.messagesBox}>
            {messages.length === 0 ? (
              <div style={styles.emptyState}>
                <p style={styles.emptyTitle}>Todavía no hay mensajes.</p>
                <p style={styles.emptyText}>Escribí algo como “Hola Kabot, ¿qué podés hacer?”</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <article
                  key={message.id || `${message.role}-${index}`}
                  style={{
                    ...styles.message,
                    ...(message.role === 'user' ? styles.userMessage : styles.assistantMessage),
                  }}
                >
                  <span style={styles.role}>{message.role === 'user' ? 'Vos' : 'Kabot'}</span>
                  <p style={styles.messageText}>{message.content}</p>
                </article>
              ))
            )}
          </div>

          <form onSubmit={handleSubmit} style={styles.form}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí tu mensaje..."
              rows={4}
              style={styles.textarea}
            />
            <div style={styles.formFooter}>
              <span style={styles.error}>{error}</span>
              <button type="submit" disabled={disabled} style={styles.primaryButton}>
                {loading ? 'Pensando...' : 'Enviar'}
              </button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}

const styles = {
  page: {
    maxWidth: 1280,
    margin: '0 auto',
    padding: '48px 20px 64px',
  },
  hero: {
    marginBottom: 28,
  },
  heroBadge: {
    display: 'inline-flex',
    padding: '6px 12px',
    borderRadius: 999,
    background: 'rgba(110, 168, 254, 0.16)',
    border: '1px solid rgba(110, 168, 254, 0.35)',
    color: '#b8d5ff',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.2em',
  },
  title: {
    margin: '16px 0 12px',
    fontSize: 'clamp(2.2rem, 4vw, 4rem)',
    lineHeight: 1.05,
  },
  subtitle: {
    maxWidth: 760,
    margin: 0,
    color: '#b8c7df',
    fontSize: '1.05rem',
    lineHeight: 1.7,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '340px 1fr',
    gap: 20,
  },
  sidebar: {
    display: 'grid',
    gap: 20,
  },
  image: {
    width: '100%',
    borderRadius: 24,
    border: '1px solid rgba(171, 208, 255, 0.18)',
    boxShadow: '0 18px 60px rgba(0,0,0,0.32)',
  },
  card: {
    borderRadius: 24,
    padding: 20,
    background: 'rgba(9, 18, 33, 0.88)',
    border: '1px solid rgba(171, 208, 255, 0.12)',
  },
  cardTitle: {
    marginTop: 0,
    marginBottom: 12,
  },
  list: {
    margin: 0,
    paddingLeft: 18,
    color: '#d4e3fb',
    lineHeight: 1.8,
  },
  chatPanel: {
    minHeight: 720,
    display: 'grid',
    gridTemplateRows: 'auto 1fr auto',
    gap: 16,
    padding: 20,
    borderRadius: 28,
    background: 'rgba(9, 18, 33, 0.82)',
    border: '1px solid rgba(171, 208, 255, 0.12)',
    boxShadow: '0 18px 60px rgba(0,0,0,0.24)',
  },
  chatHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  chatTitle: {
    margin: 0,
    fontSize: '1.35rem',
  },
  chatHint: {
    margin: '6px 0 0',
    color: '#9fb2cf',
  },
  messagesBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 8,
    overflowY: 'auto',
    minHeight: 420,
  },
  emptyState: {
    margin: 'auto',
    textAlign: 'center',
    color: '#9fb2cf',
  },
  emptyTitle: {
    marginBottom: 8,
    fontSize: '1.05rem',
    color: '#ecf4ff',
  },
  emptyText: {
    margin: 0,
  },
  message: {
    maxWidth: '85%',
    padding: '14px 16px',
    borderRadius: 20,
    border: '1px solid rgba(171, 208, 255, 0.12)',
  },
  userMessage: {
    marginLeft: 'auto',
    background: 'linear-gradient(135deg, rgba(18,95,188,0.46), rgba(27,55,94,0.76))',
  },
  assistantMessage: {
    marginRight: 'auto',
    background: 'rgba(255,255,255,0.04)',
  },
  role: {
    display: 'block',
    marginBottom: 6,
    color: '#9fb2cf',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  messageText: {
    margin: 0,
    lineHeight: 1.65,
    whiteSpace: 'pre-wrap',
  },
  form: {
    display: 'grid',
    gap: 12,
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    minHeight: 110,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(171, 208, 255, 0.16)',
    background: 'rgba(3, 8, 17, 0.95)',
    color: '#f3f7ff',
    outline: 'none',
  },
  formFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'center',
  },
  error: {
    color: '#ff8e8e',
    minHeight: 20,
  },
  primaryButton: {
    border: 0,
    borderRadius: 14,
    padding: '12px 18px',
    background: 'linear-gradient(135deg, #4f94ff, #6fe2ff)',
    color: '#05111f',
    fontWeight: 800,
    cursor: 'pointer',
  },
  secondaryButton: {
    border: '1px solid rgba(171, 208, 255, 0.18)',
    borderRadius: 14,
    padding: '10px 16px',
    background: 'rgba(255,255,255,0.04)',
    color: '#f3f7ff',
    cursor: 'pointer',
  },
};
