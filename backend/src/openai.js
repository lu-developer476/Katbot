import OpenAI from 'openai';
import { env } from './env.js';

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

export async function generateAssistantReply(messages) {
  const completion = await openai.chat.completions.create({
    model: env.OPENAI_MODEL,
    messages,
    temperature: 0.7,
  });

  return completion.choices?.[0]?.message?.content?.trim() || 'No pude generar una respuesta.';
}
