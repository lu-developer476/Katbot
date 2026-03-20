# Kabot

Kabot es un chatbot full stack con identidad visual.

## Stack

- **Frontend:** React + Next.js 15
- **Backend:** Node.js + Express
- **IA:** OpenAI API
- **Base de datos:** PostgreSQL (Supabase)
- **Deploy:** Vercel (frontend) + Render (backend)

## Estructura

```bash
kabot/
├── frontend/   # Next.js app
└── backend/    # Express API
```

## Flujo

1. El usuario escribe en el frontend.
2. El frontend envía el prompt al backend.
3. El backend guarda la conversación en PostgreSQL.
4. El backend consulta OpenAI.
5. El backend persiste la respuesta y la devuelve al frontend.

## Ventana de contexto enviada al modelo

- Kabot sigue guardando **todo** el historial del chat en PostgreSQL.
- Al consultar OpenAI, el backend envía siempre el `SYSTEM_PROMPT` más una ventana reciente de mensajes del chat.
- Esa ventana se controla con la constante `CHAT_CONTEXT_WINDOW_SIZE` en `backend/src/server.js` y por defecto usa los últimos `16` mensajes.
- Los mensajes se mantienen en orden cronológico para no romper el contexto reciente.
- Este recorte solo reduce tokens, costo y latencia hacia OpenAI; no cambia lo que se almacena ni lo que luego se puede recuperar desde la base.

## Variables de entorno

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

- `NEXT_PUBLIC_API_URL` es **obligatoria** y debe ser una URL válida.
- Si falta o es inválida, el frontend muestra un mensaje visible en pantalla, deshabilita el formulario y no intenta hacer requests al backend.

### Backend (`backend/.env`)

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require
OPENAI_API_KEY=sk-...
FRONTEND_URL=http://localhost:3000,https://mi-frontend.vercel.app
OPENAI_MODEL=gpt-4.1-mini
APP_NAME=Kabot
SYSTEM_PROMPT=Eres Kabot, un asistente útil, claro, rápido y confiable. Responde en español salvo que el usuario pida otro idioma.
```

#### Variables requeridas del backend

- `DATABASE_URL`: conexión a PostgreSQL.
- `OPENAI_API_KEY`: credencial de OpenAI.

Si falta cualquiera de esas dos variables, el backend registra un error claro en español y termina inmediatamente con código de salida `1`.

#### Variables opcionales del backend (con defaults seguros)

- `FRONTEND_URL` → `http://localhost:3000` (acepta una o varias URLs separadas por comas)
- `OPENAI_MODEL` → `gpt-4.1-mini`
- `APP_NAME` → `Kabot`
- `SYSTEM_PROMPT` → prompt base en español incluido en el proyecto

`FRONTEND_URL` también se valida como URL. Si está presente pero es inválida, el backend no arranca.

Formato de `FRONTEND_URL`:

- Acepta una o varias URLs separadas por comas.
- Se recortan espacios alrededor de cada origen.
- Se normalizan barras finales automáticamente.
- Ejemplo válido para desarrollo + producción: `FRONTEND_URL=http://localhost:3000, https://mi-frontend.vercel.app/`.
- Requests sin header `Origin` siguen permitidos para health checks y llamadas server-to-server.
- Cualquier origen fuera de la lista se rechaza con un error `403` claro.

## Base de datos

Ejecutá este SQL en Supabase:

```sql
create extension if not exists pgcrypto;

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Nueva conversación',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_chat_id_created_at on messages(chat_id, created_at);
```

También está incluido en `backend/sql/schema.sql`.

## Desarrollo local

### 1) Frontend

```bash
cd frontend
npm install
npm run dev
```

### 2) Backend

```bash
cd backend
npm install
npm run dev
```

## Deploy en Vercel

- Root Directory: `frontend`
- Framework Preset: `Next.js`
- Variable:
  - `NEXT_PUBLIC_API_URL=https://TU-BACKEND.onrender.com`

## Deploy en Render

- Root Directory: `backend`
- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`

Variables recomendadas para producción:

- `PORT=10000`
- `NODE_ENV=production`
- `DATABASE_URL=postgresql://...`
- `OPENAI_API_KEY=...`
- `FRONTEND_URL=http://localhost:3000,https://TU-FRONTEND.vercel.app`
- `OPENAI_MODEL=gpt-4.1-mini`
- `APP_NAME=Kabot`
- `SYSTEM_PROMPT=Eres Kabot...`

Recordá que `DATABASE_URL` y `OPENAI_API_KEY` son obligatorias para iniciar el backend, mientras que las demás usan defaults o validaciones seguras.

## Endpoints

- `GET /health`
- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages`

## Endurecimiento básico del backend

- El backend ahora agrega headers HTTP defensivos básicos (`X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`) sin complejizar la app.
- `express.json` está limitado a `100kb`, por lo que bodies enormes se rechazan antes de llegar a la lógica de negocio.
- Los mensajes de usuario se validan antes de guardarse y antes de enviarse a OpenAI.
- Se rechazan mensajes vacíos, no textuales o de más de `4000` caracteres con errores `400` claros.
- Requests con JSON inválido responden `400` y rutas inexistentes responden un `404` JSON consistente.
- Si el body completo supera el límite configurado, la API responde `413 Payload Too Large`.
