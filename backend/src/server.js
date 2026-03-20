import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { query, pool } from './db.js';
import { generateAssistantReply } from './openai.js';
import { env } from './env.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const HOST = '0.0.0.0';
const CHAT_CONTEXT_WINDOW_SIZE = 16;
const JSON_BODY_LIMIT = '100kb';
const MAX_USER_MESSAGE_LENGTH = 4000;
const { FRONTEND_URL, APP_NAME, SYSTEM_PROMPT } = env;
const allowedOrigins = new Set(
  FRONTEND_URL.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => origin.replace(/\/+$/, ''))
);

function logInfo(message, details) {
  if (details) {
    console.log(`[${APP_NAME}] ${message}`, details);
    return;
  }

  console.log(`[${APP_NAME}] ${message}`);
}

function logError(message, error, details) {
  if (details) {
    console.error(`[${APP_NAME}] ${message}`, details);
  } else {
    console.error(`[${APP_NAME}] ${message}`);
  }

  if (error) {
    console.error(error);
  }
}

function buildPromptMessages(historyRows) {
  // Limitamos el historial enviado al modelo para bajar costo y latencia sin dejar de guardar todo en la base.
  const recentMessages = historyRows.slice(-CHAT_CONTEXT_WINDOW_SIZE);

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...recentMessages.map((row) => ({ role: row.role, content: row.content })),
  ];
}

function validateUserMessage(rawContent) {
  if (typeof rawContent !== 'string') {
    return { valid: false, error: 'El mensaje debe ser texto.' };
  }

  const content = rawContent.trim();

  if (!content) {
    return { valid: false, error: 'El mensaje está vacío.' };
  }

  if (content.length > MAX_USER_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `El mensaje supera el máximo permitido de ${MAX_USER_MESSAGE_LENGTH} caracteres.`,
    };
  }

  return { valid: true, content };
}

function sendError(res, statusCode, clientMessage, logContext, error) {
  if (statusCode >= 500) {
    logError(logContext, error);
  }

  return res.status(statusCode).json({ error: clientMessage });
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.trim().replace(/\/+$/, '');

    if (allowedOrigins.has(normalizedOrigin)) {
      return callback(null, true);
    }

    return callback(
      new Error(
        `CORS blocked for origin ${origin}. Allowed origins: ${Array.from(allowedOrigins).join(', ')}`
      )
    );
  },
};

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(cors(corsOptions));
app.use(express.json({ limit: JSON_BODY_LIMIT }));

app.get('/health', async (_req, res) => {
  try {
    await query('select 1');
    res.json({ ok: true, app: APP_NAME, uptimeSeconds: Math.round(process.uptime()) });
  } catch (error) {
    return sendError(res, 500, 'La base de datos no está disponible.', 'Healthcheck falló.', error);
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
    return sendError(res, 500, 'No se pudieron obtener los chats.', 'Error al listar chats.', error);
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
    return sendError(res, 500, 'No se pudo crear el chat.', 'Error al crear un chat.', error);
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
    return sendError(
      res,
      500,
      'No se pudieron obtener los mensajes.',
      `Error al obtener mensajes del chat ${req.params.chatId}.`,
      error
    );
  }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
  const { chatId } = req.params;
  const validation = validateUserMessage(req.body?.content);

  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const { content } = validation;

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

    const promptMessages = buildPromptMessages(history.rows);
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
    return sendError(
      res,
      500,
      'No se pudo procesar el mensaje.',
      `Error al procesar un mensaje del chat ${chatId}.`,
      error
    );
  }
});

app.use((_req, res) => {
  return res.status(404).json({ error: 'Ruta no encontrada.' });
});

app.use((err, req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: `El body supera el límite permitido de ${JSON_BODY_LIMIT}.` });
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'El body JSON es inválido.' });
  }

  if (err.message?.startsWith('CORS blocked for origin')) {
    logError(`Solicitud bloqueada por CORS en ${req.method} ${req.originalUrl}.`, null, {
      origin: req.headers.origin || 'sin origin',
    });
    return res.status(403).json({ error: err.message });
  }

  logError(`Error no controlado en ${req.method} ${req.originalUrl}.`, err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
});

const server = app.listen(PORT, HOST, () => {
  logInfo(`Backend listo en http://${HOST}:${PORT}`);
  logInfo('Configuración de runtime', {
    node: process.version,
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    allowedOrigins: Array.from(allowedOrigins),
  });
});

async function shutdown(signal) {
  logInfo(`Señal ${signal} recibida. Cerrando servidor...`);

  server.close(async (serverError) => {
    if (serverError) {
      logError('Error al cerrar el servidor HTTP.', serverError);
      process.exit(1);
      return;
    }

    try {
      await pool.end();
      logInfo('Conexiones a PostgreSQL cerradas. Proceso finalizado.');
      process.exit(0);
    } catch (poolError) {
      logError('Error al cerrar el pool de PostgreSQL.', poolError);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logError('Unhandled promise rejection.', reason);
});

process.on('uncaughtException', (error) => {
  logError('Uncaught exception.', error);
  process.exit(1);
});
