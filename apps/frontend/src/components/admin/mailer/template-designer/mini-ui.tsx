'use client';

// Small UI primitives for the Mailer Template Designer, styled with this
// app's own design tokens (textColor/newBgColorInner/newTableBorder/forth
// -- the same tokens admin-content.component.tsx and blog-body-editor
// use) rather than a separate hardcoded palette, so the designer looks
// like the rest of the admin panel instead of a foreign widget.

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

export function MiniButton({
  active,
  size = 'sm',
  className,
  disabled,
  title,
  onClick,
  onMouseDown,
  children,
  type = 'button',
}: {
  active?: boolean;
  size?: 'sm' | 'xs';
  className?: string;
  disabled?: boolean;
  title?: string;
  onClick?: (e: React.MouseEvent) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  type?: 'button' | 'submit';
}) {
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      className={clsx(
        'inline-flex items-center justify-center gap-[4px] rounded-[6px] border text-[12px] whitespace-nowrap disabled:opacity-40 cursor-pointer',
        size === 'xs' ? 'h-[22px] w-[22px] p-0' : 'h-[28px] px-[8px]',
        active
          ? 'bg-forth text-white border-forth'
          : 'bg-newBgColorInner text-textColor border-newTableBorder hover:bg-tableBorder',
        className
      )}
    >
      {children}
    </button>
  );
}

export function MiniInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return (
    <input
      {...rest}
      className={clsx(
        'h-[28px] w-full rounded-[6px] px-[8px] text-[12px] outline-none bg-newBgColorInner text-textColor border border-newTableBorder',
        className
      )}
    />
  );
}

export function MiniTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      {...rest}
      className={clsx(
        'w-full rounded-[6px] p-[8px] text-[12px] outline-none bg-newBgColorInner text-textColor border border-newTableBorder',
        className
      )}
    />
  );
}

export function MiniLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] opacity-70">{children}</label>;
}

export function MiniSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={clsx(
        'h-[28px] rounded-[6px] px-[6px] text-[12px] outline-none bg-newBgColorInner text-textColor border border-newTableBorder',
        className
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

/** A simple click-to-toggle dropdown menu -- closes on outside click or
 * Escape. This repo has no Radix/shadcn dropdown primitive installed. */
export function MiniDropdown({
  trigger,
  children,
  align = 'start',
}: {
  trigger: React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: 'start' | 'end';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      {open && (
        <div
          className={clsx(
            'absolute top-full z-50 mt-[4px] min-w-[180px] rounded-[8px] p-[4px] shadow-xl bg-newBgColorInner border border-newTableBorder',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function MiniDropdownItem({
  onSelect,
  className,
  children,
}: {
  onSelect: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="menuitem"
      onClick={onSelect}
      className={clsx(
        'flex cursor-pointer items-center gap-[8px] rounded-[6px] px-[8px] py-[6px] text-[12px] hover:bg-tableBorder text-textColor',
        className
      )}
    >
      {children}
    </div>
  );
}
