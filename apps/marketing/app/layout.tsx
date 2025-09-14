export const metadata = {
  title: 'ServiceLink — Marketing',
  description: 'Static marketing site for ServiceLink',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <header style={{ padding: '10px 16px', borderBottom: '1px solid #eee', display: 'flex', gap: 12 }}>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/privacy">Privacy</a>
        </header>
        <main style={{ padding: 24 }}>{children}</main>
        <footer style={{ padding: 24, borderTop: '1px solid #eee', color: '#666' }}>© {new Date().getFullYear()} ServiceLink</footer>
      </body>
    </html>
  );
}

