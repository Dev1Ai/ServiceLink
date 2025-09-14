import './globals.css';
export const metadata = {
  title: 'ServiceLink — Home Services Marketplace',
  description: 'Find trusted local providers for home services. Simple, fast, reliable.',
  openGraph: {
    title: 'ServiceLink — Home Services Marketplace',
    description: 'Find trusted local providers for home services. Simple, fast, reliable.',
    url: 'https://servicelink.example',
    siteName: 'ServiceLink',
    images: [
      {
        url: 'https://servicelink.example/og.png',
        width: 1200,
        height: 630,
        alt: 'ServiceLink',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ServiceLink — Home Services Marketplace',
    description: 'Find trusted local providers for home services. Simple, fast, reliable.',
    images: ['https://servicelink.example/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="site-header" role="banner">
          <nav aria-label="Primary">
            <a href="/">Home</a>
            <a href="/about">About</a>
            <a href="/privacy">Privacy</a>
          </nav>
        </header>
        <main className="site-main" role="main">{children}</main>
        <footer className="site-footer">© {new Date().getFullYear()} ServiceLink</footer>
      </body>
    </html>
  );
}
