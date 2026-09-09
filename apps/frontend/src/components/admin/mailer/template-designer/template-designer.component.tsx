'use client';

// Drag-and-drop visual body builder for the admin Mailer Templates editor
// (rows -> columns -> Text/Image/Button/Divider/Spacer/Quote/Social/Stats
// blocks, drag reordering, column resize, themes, reusable saved blocks,
// Source Code fallback) -- ported from vantly-ugc.com's admin Content
// Builder (components/admin/content-builder/ContentBuilder.tsx), which
// itself ported the same shape from AutoGPT's own Mailer template visual
// builder. Same drop-in contract as the plain-HTML textarea it replaces
// (`value`/`onChange` of the final HTML string) -- this is purely a
// friendlier way to produce the same `EmailTemplate.htmlContent` string a
// raw-HTML textarea always produced. See lib/mailer-builder/serialize.ts
// for exactly what HTML shape each block renders as (`<table>`-based,
// matching real email clients).

import { useEffect, useRef, useState } from 'react';
import { BuilderState, Selection } from '@gitroom/frontend/lib/mailer-builder/types';
import { deserializeBuilderState, serializeBuilderState } from '@gitroom/frontend/lib/mailer-builder/serialize';
import { useBuilderActions } from '@gitroom/frontend/lib/mailer-builder/use-builder-actions';
import { THEME_PRESETS } from '@gitroom/frontend/lib/mailer-builder/themes';
import { Canvas } from './canvas';
import { InspectorPanel } from './inspector-panel';
import { MiniButton, MiniDropdown, MiniDropdownItem, MiniTextarea } from './mini-ui';

const DEVICE_WIDTH = { desktop: 640, mobile: 375 } as const;

export function TemplateDesigner({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const [builderState, setBuilderState] = useState<BuilderState>(() => deserializeBuilderState(value).state);
  const [mode, setMode] = useState<'visual' | 'source'>('visual');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [selection, setSelection] = useState<Selection>(null);
  const [sourceText, setSourceText] = useState(value);
  const lastEmittedRef = useRef(value);

  const actions = useBuilderActions(setBuilderState, setSelection);

  useEffect(() => {
    if (mode !== 'visual') return;
    const html = serializeBuilderState(builderState);
    if (html !== lastEmittedRef.current) {
      lastEmittedRef.current = html;
      onChange(html);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [builderState, mode]);

  // External value changes (e.g. switching which template is open in the
  // editor) rehydrate the builder, same guard pattern used elsewhere in
  // this app to avoid fighting the admin's own typing.
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    setSourceText(value);
    if (mode === 'visual') {
      setBuilderState(deserializeBuilderState(value).state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handleSourceChange(text: string) {
    setSourceText(text);
    lastEmittedRef.current = text;
    onChange(text);
  }

  function switchToSource() {
    setSourceText(serializeBuilderState(builderState));
    setMode('source');
  }

  function switchToVisual() {
    setBuilderState(deserializeBuilderState(sourceText).state);
    setSelection(null);
    setMode('visual');
  }

  return (
    <div className="rounded-[8px] border border-newTableBorder overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-[8px] p-[8px] bg-newBgColorInner border-b border-newTableBorder">
        <div className="flex gap-[4px]">
          <MiniButton active={mode === 'visual'} onClick={switchToVisual}>
            Visual
          </MiniButton>
          <MiniButton active={mode === 'source'} onClick={switchToSource}>
            Source Code
          </MiniButton>
        </div>

        {mode === 'visual' && (
          <div className="flex gap-[4px]">
            <MiniDropdown trigger={<MiniButton>Theme</MiniButton>}>
              {(close) => (
                <>
                  {THEME_PRESETS.map((theme) => (
                    <MiniDropdownItem
                      key={theme.id}
                      onSelect={() => {
                        actions.applyTheme(theme);
                        close();
                      }}
                    >
                      <span className="h-[14px] w-[14px] shrink-0 rounded-full border border-newTableBorder" style={{ backgroundColor: theme.accent }} />
                      {theme.name}
                    </MiniDropdownItem>
                  ))}
                </>
              )}
            </MiniDropdown>
            <MiniButton active={device === 'desktop'} title="Desktop preview width" onClick={() => setDevice('desktop')}>
              Desktop
            </MiniButton>
            <MiniButton active={device === 'mobile'} title="Mobile preview width" onClick={() => setDevice('mobile')}>
              Mobile
            </MiniButton>
          </div>
        )}
      </div>

      {mode === 'source' ? (
        <div className="p-[8px]">
          <MiniTextarea
            value={sourceText}
            onChange={(e) => handleSourceChange(e.target.value)}
            rows={16}
            className="font-mono"
            placeholder="<p>Write raw HTML here...</p>"
          />
          <p className="mt-[4px] text-[11px] opacity-60">
            This is the exact HTML saved to the template and sent to recipients (an unsubscribe link is appended automatically
            at send time -- see EmailCampaignService.sendNow). Switching back to Visual wraps this as a single editable
            &quot;Raw HTML&quot; block if it wasn&apos;t produced by this designer.
          </p>
        </div>
      ) : (
        <div className="flex">
          <div className="flex-1 overflow-x-auto p-[16px]" onClick={() => setSelection(null)}>
            <Canvas state={builderState} actions={actions} selection={selection} onSelect={setSelection} canvasWidth={DEVICE_WIDTH[device]} />
          </div>
          <div className="w-[256px] shrink-0 border-l border-newTableBorder bg-newBgColorInner">
            <InspectorPanel state={builderState} selection={selection} actions={actions} />
          </div>
        </div>
      )}
    </div>
  );
}
