'use client';
import { useEffect, useState } from 'react';

export function useLocalToken(key = 'jwt') {
  const [token, setToken] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem(key) || '';
      } catch {}
    }
    return '';
  });

  useEffect(() => {
    try {
      const t = localStorage.getItem(key) || '';
      setToken(t);
    } catch {}
  }, [key]);

  useEffect(() => {
    try {
      if (token) {
        localStorage.setItem(key, token);
      }
    } catch {}
  }, [key, token]);

  return [token, setToken] as const;
}

