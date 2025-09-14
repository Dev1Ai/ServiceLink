import './globals.css';

export const metadata = {
  title: 'ServiceLink — Marketing',
  description: 'Static marketing site for ServiceLink',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/privacy">Privacy</a>
        </header>
        <main className="site-main">{children}</main>
        <footer className="site-footer">© {new Date().getFullYear()} ServiceLink</footer>
      </body>
    </html>
  );
}
