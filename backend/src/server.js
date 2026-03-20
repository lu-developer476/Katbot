import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { query } from './db.js';
import { generateAssistantReply } from './openai.js';
import { env } from './env.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const { FRONTEND_URL, APP_NAME, SYSTEM_PROMPT } = env;

app.use(
  cors({
    origin: FRONTEND_URL,
  })
);
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await query('select 1');
    res.json({ ok: true, app: APP_NAME });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/chats', async (_req, res) => {
  try {
    const result = await query(
      `select id, title, created_at, updated_at
       from chats
       order by updated_at desc
       limit 20`
    );
    res.json({ chats: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los chats.' });
  }
});

app.post('/api/chats', async (req, res) => {
  try {
    const title = req.body?.title?.trim() || 'Nueva conversación';
    const result = await query(
      `insert into chats (title)
       values ($1)
       returning id, title, created_at, updated_at`,
      [title]
    );

    res.status(201).json({ chat: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'No se pudo crear el chat.' });
  }
});

app.get('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const result = await query(
      `select id, role, content, created_at
       from messages
       where chat_id = $1
       order by created_at asc`,
      [chatId]
    );

    res.json({ messages: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'No se pudieron obtener los mensajes.' });
  }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
  const { chatId } = req.params;
  const content = req.body?.content?.trim();

  if (!content) {
    return res.status(400).json({ error: 'El mensaje está vacío.' });
  }

  try {
    const chatExists = await query('select id from chats where id = $1 limit 1', [chatId]);
    if (chatExists.rowCount === 0) {
      return res.status(404).json({ error: 'El chat no existe.' });
    }

    await query(
      `insert into messages (chat_id, role, content)
       values ($1, 'user', $2)`,
      [chatId, content]
    );

    const history = await query(
      `select role, content
       from messages
       where chat_id = $1
       order by created_at asc`,
      [chatId]
    );

    const promptMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.rows.map((row) => ({ role: row.role, content: row.content })),
    ];

    const assistantReply = await generateAssistantReply(promptMessages);

    await query(
      `insert into messages (chat_id, role, content)
       values ($1, 'assistant', $2)`,
      [chatId, assistantReply]
    );

    await query('update chats set updated_at = now() where id = $1', [chatId]);

    const allMessages = await query(
      `select id, role, content, created_at
       from messages
       where chat_id = $1
       order by created_at asc`,
      [chatId]
    );

    return res.status(201).json({ messages: allMessages.rows });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'No se pudo procesar el mensaje.' });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`${APP_NAME} backend escuchando en http://localhost:${PORT}`);
});
