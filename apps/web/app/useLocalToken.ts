'use client';
import { useEffect, useState } from 'react';

export function useLocalToken(key = 'jwt') {
  const sessionKey = `${key}:session`;
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const sessionVal = sessionStorage.getItem(sessionKey);
        if (sessionVal) return sessionVal;
        return localStorage.getItem(key) || '';
      } catch {}
    }
    return '';
  });

  useEffect(() => {
    const sync = () => {
      try {
        const fromSession = sessionStorage.getItem(sessionKey) || '';
        const t = fromSession || localStorage.getItem(key) || '';
        setToken((prev) => (prev !== t ? t : prev));
      } catch {}
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== key) return;
      sync();
    };
    sync();
    window.addEventListener('storage', onStorage);
    const interval = setInterval(sync, 500);
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, [key, sessionKey]);

  useEffect(() => {
    const persistLatest = () => {
      try {
        const current = localStorage.getItem(key) || '';
        if (current) sessionStorage.setItem(sessionKey, current);
      } catch {}
    };
    window.addEventListener('beforeunload', persistLatest);
    return () => window.removeEventListener('beforeunload', persistLatest);
  }, [key, sessionKey]);

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem(key, token);
        sessionStorage.setItem(sessionKey, token);
      }
    } catch {}
  }, [key, sessionKey, token]);

  return [token, setToken] as const;
}
