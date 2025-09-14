'use client';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = { id: string; message: string; kind?: 'info' | 'success' | 'error' };

const ToastCtx = createContext<{ push: (message: string, kind?: Toast['kind']) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: Toast['kind'] = 'info') => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="toast-container">
        {items.map((t) => {
          const kind = t.kind || 'info';
          const cls = kind === 'success' ? 'toast toast-success' : kind === 'error' ? 'toast toast-error' : 'toast toast-info';
          return (
            <div key={t.id} className={cls}>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
