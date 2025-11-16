"use client";
import { useEffect, useRef, useState } from "react";

type Placement = "top" | "right" | "bottom" | "left";
type Theme = "dark" | "light";

export function TooltipInfo({
  text,
  placement = "bottom",
  theme = "dark",
  minWidth = 260,
  maxWidth = 360,
  trigger = "hover",
  closeOnOutsideClick = true,
}: {
  text: string;
  placement?: Placement;
  theme?: Theme;
  minWidth?: number;
  maxWidth?: number;
  trigger?: "hover" | "click";
  closeOnOutsideClick?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = wrapperRef.current as any;
    if (el && !el.__tid) {
      el.__tid = "tt-" + Math.random().toString(36).slice(2, 10);
    }
  }, []);
  useEffect(() => {
    if (trigger !== "click" || !closeOnOutsideClick) return;
    const onDoc = (e: any) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (wrapperRef.current && !wrapperRef.current.contains(target))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [trigger, closeOnOutsideClick]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus trap within panel when open
  useEffect(() => {
    if (!open || !panelRef.current) return;
    const el = panelRef.current;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = el.querySelectorAll<HTMLElement>(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (!active || active === first || !el.contains(active)) {
          e.preventDefault();
          (last as HTMLElement).focus();
        }
      } else {
        if (!active || active === last || !el.contains(active)) {
          e.preventDefault();
          (first as HTMLElement).focus();
        }
      }
    };
    el.addEventListener("keydown", onKeyDown as any);
    return () => el.removeEventListener("keydown", onKeyDown as any);
  }, [open]);

  // Move focus to close button on open (click mode), and restore to trigger on close
  useEffect(() => {
    if (trigger === "click") {
      if (open && closeBtnRef.current) {
        closeBtnRef.current.focus();
      }
      if (!open && triggerRef.current) {
        triggerRef.current.focus();
      }
    }
  }, [open, trigger]);
  const effPlacement: Placement = placement;
  const themeClass = theme === "dark" ? "tt-theme-dark" : "tt-theme-light";
  const placeClass =
    effPlacement === "top"
      ? "tt-top"
      : effPlacement === "bottom"
        ? "tt-bottom"
        : effPlacement === "right"
          ? "tt-right"
          : "tt-left";

  return (
    <div
      className={`tt-wrap ${open ? "tt-open" : ""} ${themeClass} ${placeClass}`}
      ref={wrapperRef}
      onMouseEnter={trigger === "hover" ? () => setOpen(true) : undefined}
      onMouseLeave={trigger === "hover" ? () => setOpen(false) : undefined}
    >
      <span
        className="tt-trigger"
        onClick={
          trigger === "click"
            ? (e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }
            : undefined
        }
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={
          wrapperRef.current
            ? `${(wrapperRef.current as any).__tid}`
            : undefined
        }
        aria-describedby={
          wrapperRef.current
            ? `${(wrapperRef.current as any).__tid}`
            : undefined
        }
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (trigger === "click") setOpen((v) => !v);
            else setOpen(true);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        ref={triggerRef}
      >
        i
      </span>
      {open && (
        <div
          className="tt-panel"
          onClick={(e) => e.stopPropagation()}
          id={
            (wrapperRef.current && (wrapperRef.current as any).__tid) ||
            undefined
          }
          ref={panelRef}
          role="tooltip"
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Close tooltip"
            className="tt-close"
            ref={closeBtnRef}
          >
            ×
          </button>
          {text}
        </div>
      )}
    </div>
  );
}
