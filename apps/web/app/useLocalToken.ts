'use client';
import { useEffect, useState } from 'react';

export function useLocalToken(key = 'jwt') {
  const [token, setToken] = useState('');
  useEffect(() => {
    try {
      const t = localStorage.getItem(key) || '';
      if (t) setToken(t);
    } catch {}
  }, [key]);
  useEffect(() => {
    try { localStorage.setItem(key, token); } catch {}
  }, [key, token]);
  return [token, setToken] as const;
}

