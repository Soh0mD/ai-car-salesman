"use client";

import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";

// Themed dropdown replacing native <select> — the OS-rendered <select> popup ignores our
// dark teal theme and looks out of place. This renders a fully on-brand popup instead.

export interface DropdownOption {
  value: string;
  label: string;
}

export function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  icon,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-semibold"
        style={{
          background: "var(--md-surface-container-low)",
          border: "1.5px solid var(--md-outline-variant)",
          color: selected ? "var(--md-on-surface)" : "var(--md-on-surface-variant)",
        }}
      >
        {icon}
        <span className="flex-1 truncate text-left">{selected ? selected.label : placeholder}</span>
        <IconChevronDown
          size={15}
          aria-hidden
          style={{ color: "var(--md-outline)", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-auto rounded-xl py-1 shadow-xl"
          style={{ background: "var(--md-surface-container-high)", border: "1px solid var(--md-outline-variant)" }}
        >
          {options.map((o) => {
            const on = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={on}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="cursor-pointer px-3.5 py-2.5 text-sm font-semibold transition-colors"
                style={on ? { background: "color-mix(in srgb, var(--md-primary) 16%, transparent)", color: "var(--md-primary)" } : { color: "var(--md-on-surface)" }}
                onMouseEnter={(e) => {
                  if (!on) (e.currentTarget as HTMLElement).style.background = "var(--md-surface-container-highest)";
                }}
                onMouseLeave={(e) => {
                  if (!on) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
