import OpenAI from 'openai';
import { env } from './env.js';

const OPENAI_TIMEOUT_MS = 25000;

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  timeout: OPENAI_TIMEOUT_MS,
});

export async function generateAssistantReply(messages) {
  try {
    const completion = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages,
      temperature: 0.7,
    });

    return completion.choices?.[0]?.message?.content?.trim() || 'No pude generar una respuesta.';
  } catch (error) {
    if (error?.status === 408 || error?.code === 'ETIMEDOUT' || error?.name === 'AbortError') {
      throw new Error('OpenAI tardó demasiado en responder.');
    }

    throw error;
  }
}
