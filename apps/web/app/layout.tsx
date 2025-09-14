import { ReactNode } from 'react';
import './globals.css';
import { ToastProvider } from './components/Toast';
import { CspWatcher } from './components/CspWatcher';
import { TokenPanel } from './TokenPanel';

export const dynamic = 'force-static';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <CspWatcher />
          <div className="navbar">
            <a href="/">Home</a>
            <a href="/realtime">Realtime</a>
            <a href="/jobs">Jobs</a>
            <a href="/quotes">My Quotes</a>
            <a href="/assignments">My Assignments</a>
            <a href="/providers/near">Providers Near</a>
            <a href="/providers/categories">Providers Categories</a>
            <a href="/providers/search">Providers Search</a>
            <a href="/metrics">Metrics</a>
            <TokenPanel />
          </div>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
