// app/layout.tsx
import './globals.css';

export const metadata = {
  title: 'Halloween Escaperoom',
  description: 'Telia Halloween Escaperoom — lagbaserad timer och ledtrådar'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-xl p-4">{children}</div>
      </body>
    </html>
  );
}
