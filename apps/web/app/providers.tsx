"use client";
import React from "react";
import { ToastProvider } from "./components/Toast";
import { CspWatcher } from "./components/CspWatcher";

const isStaticExport = process.env.NEXT_OUTPUT === "export";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {!isStaticExport && <CspWatcher />}
      {children}
    </ToastProvider>
  );
}
