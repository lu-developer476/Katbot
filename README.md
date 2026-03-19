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

## Variables de entorno

### Frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

### Backend (`backend/.env`)

```env
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres?sslmode=require
APP_NAME=Kabot
SYSTEM_PROMPT=Eres Kabot, un asistente útil, claro, rápido y confiable. Responde en español salvo que el usuario pida otro idioma.
```

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

Variables requeridas:

- `PORT=10000`
- `NODE_ENV=production`
- `FRONTEND_URL=https://TU-FRONTEND.vercel.app`
- `OPENAI_API_KEY=...`
- `OPENAI_MODEL=gpt-4.1-mini`
- `DATABASE_URL=postgresql://...`
- `APP_NAME=Kabot`
- `SYSTEM_PROMPT=Eres Kabot...`

## Endpoints

- `GET /health`
- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/:chatId/messages`
- `POST /api/chats/:chatId/messages`
