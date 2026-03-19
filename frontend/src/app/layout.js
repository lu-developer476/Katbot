export const metadata = {
  title: 'Kabot',
  description: 'Chatbot con Next.js, Express, OpenAI y Supabase',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
