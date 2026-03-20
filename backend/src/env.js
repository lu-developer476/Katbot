const DEFAULT_ENV = {
  FRONTEND_URL: 'http://localhost:3000',
  OPENAI_MODEL: 'gpt-4.1-mini',
  APP_NAME: 'Kabot',
  SYSTEM_PROMPT:
    'Eres Kabot, un asistente útil, claro, rápido y confiable. Responde en español salvo que el usuario pida otro idioma.',
};

function readEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function normalizeUrl(value) {
  return new URL(value).toString().replace(/\/+$/, '');
}

function ensureFrontendUrls(name, value) {
  const normalizedUrls = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      try {
        return normalizeUrl(entry);
      } catch {
        console.error(
          `Error de configuración: cada origen en ${name} debe ser una URL válida. Valor recibido: ${entry || '(vacío)'}.`
        );
        process.exit(1);
      }
    });

  if (normalizedUrls.length === 0) {
    console.error(
      `Error de configuración: la variable ${name} debe incluir al menos una URL válida separada por comas.`
    );
    process.exit(1);
  }

  return normalizedUrls.join(',');
}

function ensureRequired(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    console.error(
      `Error de configuración: falta la variable obligatoria ${name}. Revisá tu archivo .env o las variables del entorno de despliegue.`
    );
    process.exit(1);
  }

  return value;
}

export const env = {
  DATABASE_URL: ensureRequired('DATABASE_URL'),
  OPENAI_API_KEY: ensureRequired('OPENAI_API_KEY'),
  FRONTEND_URL: ensureFrontendUrls('FRONTEND_URL', readEnv('FRONTEND_URL', DEFAULT_ENV.FRONTEND_URL)),
  OPENAI_MODEL: readEnv('OPENAI_MODEL', DEFAULT_ENV.OPENAI_MODEL),
  APP_NAME: readEnv('APP_NAME', DEFAULT_ENV.APP_NAME),
  SYSTEM_PROMPT: readEnv('SYSTEM_PROMPT', DEFAULT_ENV.SYSTEM_PROMPT),
};
