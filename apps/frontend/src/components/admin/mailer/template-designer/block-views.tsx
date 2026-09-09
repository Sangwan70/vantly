'use client';

// Per-block-type canvas renderers for the Mailer Template designer,
// ported from vantly-ugc.com's Content Builder BlockViews.tsx. Image
// upload goes through this app's own existing media endpoint
// (`POST /media/upload-simple` on MediaController, see media.controller.ts)
// via useFetch() -- the same call media.settings.component.tsx already
// makes -- rather than vantly-ugc's `/api/admin/content/media` Next.js
// proxy route, which has no equivalent here (this frontend has no
// app/api/* proxy layer at all; see admin-content.component.tsx's own
// notes on that).

import { useRef, useState } from 'react';
import clsx from 'clsx';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  Block,
  BlockAlign,
  ButtonBlock,
  DividerBlock,
  ImageBlock,
  QuoteBlock,
  RawHtmlBlock,
  SocialIconsBlock,
  SocialPlatform,
  SpacerBlock,
  StatsBlock,
  TextBlock,
} from '@gitroom/frontend/lib/mailer-builder/types';
import { InlineTextBlockEditor } from './inline-text-block-editor';
import { MiniButton, MiniTextarea } from './mini-ui';

const MAX_IMAGE_SIZE_MB = 8;
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

interface ViewProps<T extends Block> {
  block: T;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<T>) => void;
  /** Roughly how wide this block's column renders in the canvas at
   * current preview width -- used to clamp image resize/width defaults. */
  columnWidthPx: number;
}

function AlignButtons({ align, onChange }: { align: BlockAlign; onChange: (align: BlockAlign) => void }) {
  const options: { value: BlockAlign; label: string; title: string }[] = [
    { value: 'left', label: '⟸', title: 'Align left' },
    { value: 'center', label: '↔', title: 'Align center' },
    { value: 'right', label: '⟹', title: 'Align right' },
  ];
  return (
    <div className="flex gap-[2px]" onMouseDown={(e) => e.stopPropagation()}>
      {options.map((o) => (
        <MiniButton key={o.value} size="xs" active={align === o.value} title={o.title} onClick={() => onChange(o.value)}>
          {o.label}
        </MiniButton>
      ))}
    </div>
  );
}

export function TextBlockView({ block, onChange }: ViewProps<TextBlock>) {
  return (
    <div style={{ textAlign: block.align, color: block.textColor || undefined }} className="rounded-[4px]">
      <InlineTextBlockEditor value={block.html} onChange={(html) => onChange({ html })} />
    </div>
  );
}

export function ImageBlockView({ block, onChange, selected, columnWidthPx }: ViewProps<ImageBlock>) {
  const fetch = useFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const resizingRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const [liveWidth, setLiveWidth] = useState<number | null>(null);

  const maxWidth = Math.max(columnWidthPx, 80);
  const effectiveWidth = liveWidth ?? (block.width || columnWidthPx);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setUploadError(`Max upload size is ${MAX_IMAGE_SIZE_MB}MB.`);
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/media/upload-simple', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = await res.json();
      onChange({ src: data.path, alt: block.alt || file.name });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload image.');
    } finally {
      setIsUploading(false);
    }
  }

  function startResize(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    resizingRef.current = { startX: e.clientX, startWidth: block.width || columnWidthPx };
  }

  function onResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizingRef.current) return;
    const delta = e.clientX - resizingRef.current.startX;
    const next = Math.min(maxWidth, Math.max(40, Math.round(resizingRef.current.startWidth + delta)));
    setLiveWidth(next);
  }

  function endResize(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizingRef.current) return;
    (e.target as Element).releasePointerCapture(e.pointerId);
    resizingRef.current = null;
    if (liveWidth != null) {
      onChange({ width: liveWidth });
      setLiveWidth(null);
    }
  }

  if (!block.src) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-[8px] rounded-[8px] border border-dashed border-newTableBorder py-[28px] text-[12px] opacity-70"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <MiniButton disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          {isUploading ? 'Uploading…' : 'Upload image'}
        </MiniButton>
        {uploadError && <p className="text-red-400">{uploadError}</p>}
        <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleFileSelected} />
      </div>
    );
  }

  const justify = block.align === 'center' ? 'center' : block.align === 'right' ? 'flex-end' : 'flex-start';

  return (
    <div>
      {selected && (
        <div className="mb-[4px] flex items-center justify-between" onMouseDown={(e) => e.stopPropagation()}>
          <AlignButtons align={block.align} onChange={(align) => onChange({ align })} />
          <MiniButton disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
            Replace
          </MiniButton>
          <input ref={fileInputRef} type="file" accept={ACCEPTED_IMAGE_TYPES} className="hidden" onChange={handleFileSelected} />
        </div>
      )}
      {uploadError && <p className="mb-[4px] text-[11px] text-red-400">{uploadError}</p>}
      <div style={{ display: 'flex', justifyContent: justify }}>
        <div className="relative inline-block" style={{ width: effectiveWidth }}>
          <img
            src={block.src}
            alt={block.alt}
            width={effectiveWidth}
            className={clsx('block w-full select-none rounded-[4px]', selected && 'ring-2 ring-forth')}
            draggable={false}
          />
          {selected && (
            <div
              className="absolute -bottom-[6px] -right-[6px] h-[14px] w-[14px] cursor-ew-resize rounded-[3px] border border-white bg-forth shadow"
              onPointerDown={startResize}
              onPointerMove={onResizeMove}
              onPointerUp={endResize}
              title="Drag to resize"
            />
          )}
          {selected && (
            <div className="absolute -bottom-[20px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-[4px] bg-black px-[6px] py-[2px] text-[10px] text-white">
              {Math.round(effectiveWidth)}px
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ButtonBlockView({ block, selected }: ViewProps<ButtonBlock>) {
  const justify = block.align === 'center' ? 'center' : block.align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <div style={{ display: 'flex', justifyContent: justify }}>
      <span
        className={clsx('inline-block select-none rounded px-[24px] py-[10px] text-[13px] font-[600]', selected && 'ring-2 ring-forth')}
        style={{ backgroundColor: block.bgColor, color: block.textColor, borderRadius: block.borderRadius }}
      >
        {block.label || 'Button'}
      </span>
    </div>
  );
}

export function DividerBlockView({ block }: ViewProps<DividerBlock>) {
  return <div style={{ borderTop: `${block.thickness}px solid ${block.color}`, margin: `${block.spacing}px 0` }} />;
}

export function SpacerBlockView({ block, selected }: ViewProps<SpacerBlock>) {
  return (
    <div
      style={{ height: block.height }}
      className={clsx(
        'flex items-center justify-center rounded-[4px] border border-dashed text-[10px] opacity-60',
        selected ? 'border-forth' : 'border-newTableBorder'
      )}
    >
      Spacer · {block.height}px
    </div>
  );
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  facebook: 'f',
  instagram: 'IG',
  linkedin: 'in',
  twitter: 'X',
  youtube: 'YT',
  website: 'W',
};

export function QuoteBlockView({ block }: ViewProps<QuoteBlock>) {
  return (
    <div style={{ textAlign: block.align, borderLeft: `4px solid ${block.accentColor}`, paddingLeft: 16 }} className="py-[4px]">
      <p className="whitespace-pre-line text-[14px] italic leading-relaxed">{block.quote || 'Quote text'}</p>
      <p className="mt-[8px] text-[12px] font-[600] opacity-70">&mdash; {block.attribution || 'Attribution'}</p>
    </div>
  );
}

export function SocialIconsBlockView({ block }: ViewProps<SocialIconsBlock>) {
  const justify = block.align === 'center' ? 'center' : block.align === 'right' ? 'flex-end' : 'flex-start';
  return (
    <div style={{ display: 'flex', justifyContent: justify, gap: 8 }}>
      {block.links.map((link) => (
        <span
          key={link.id}
          className="flex h-[32px] w-[32px] select-none items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ backgroundColor: block.badgeColor }}
          title={link.url}
        >
          {PLATFORM_LABELS[link.platform]}
        </span>
      ))}
    </div>
  );
}

export function StatsBlockView({ block }: ViewProps<StatsBlock>) {
  return (
    <div style={{ display: 'flex' }}>
      {block.items.map((item) => (
        <div key={item.id} className="flex-1 px-[4px] text-center">
          <div className="text-[22px] font-bold leading-tight" style={{ color: block.accentColor }}>
            {item.value || '0'}
          </div>
          <div className="mt-[4px] text-[11px] uppercase tracking-wide opacity-70">{item.label || 'Label'}</div>
        </div>
      ))}
    </div>
  );
}

export function RawHtmlBlockView({ block, selected, onChange }: ViewProps<RawHtmlBlock>) {
  if (!selected) {
    return (
      <div
        className="rounded-[4px] border border-dashed border-newTableBorder p-[4px]"
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    );
  }
  return (
    <div onMouseDown={(e) => e.stopPropagation()}>
      <p className="mb-[4px] text-[10px] uppercase opacity-70">Raw HTML -- imported content or manually written markup</p>
      <MiniTextarea rows={6} className="font-mono" value={block.html} onChange={(e) => onChange({ html: e.target.value })} />
    </div>
  );
}
