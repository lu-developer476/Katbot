import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateAssistantReply(messages) {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    messages,
    temperature: 0.7,
  });

  return completion.choices?.[0]?.message?.content?.trim() || 'No pude generar una respuesta.';
}
