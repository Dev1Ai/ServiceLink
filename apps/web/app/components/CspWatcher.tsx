"use client";
import { useEffect } from "react";
import { useToast } from "./Toast";

export function CspWatcher() {
  const { push } = useToast();
  useEffect(() => {
    const handler = (e: SecurityPolicyViolationEvent) => {
      // Surface a concise toast and also log the full details
      push(`CSP blocked: ${e.violatedDirective}`, "error");
      // eslint-disable-next-line no-console
      console.error("[CSP]", {
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI,
        effectiveDirective: (e as any).effectiveDirective,
        disposition: e.disposition,
        lineNumber: e.lineNumber,
        columnNumber: e.columnNumber,
        sourceFile: e.sourceFile,
        originalPolicy: e.originalPolicy,
      });
    };
    window.addEventListener("securitypolicyviolation", handler as any);
    return () =>
      window.removeEventListener("securitypolicyviolation", handler as any);
  }, [push]);
  return null;
}
