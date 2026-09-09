'use client';

// Per-block rich text editor for the Mailer Template designer's Text
// block, reusing @tiptap/starter-kit (already installed at the workspace
// root) for the common marks/nodes - Tiptap v3's StarterKit bundles Link
// and Underline itself (new in v3, unlike v2), so Link is configured via
// StarterKit's own `link` option instead of a second, separately-added
// Link extension instance (that would just register the same extension
// name twice and get silently deduped with a console warning). Deliberately does not offer a
// "Variable" insert dropdown: EmailCampaignService.sendNow() (see
// email-campaign.service.ts) sends each template's htmlContent verbatim,
// with only an unsubscribe footer appended -- there is no {{token}}
// substitution pipeline on the backend yet, so a variable-insert button
// here would promise a capability that doesn't exist. Revisit this once
// per-recipient substitution (name, etc.) is actually implemented.

import { useEffect } from 'react';
import clsx from 'clsx';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { MiniButton } from './mini-ui';

export function InlineTextBlockEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
        },
      }),
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'min-h-[60px] text-[13px] leading-relaxed outline-none ' +
          '[&_ul]:list-disc [&_ul]:pl-[20px] [&_ol]:list-decimal [&_ol]:pl-[20px] ' +
          '[&_h2]:text-[18px] [&_h2]:font-[600] [&_h3]:text-[15px] [&_h3]:font-[600] ' +
          '[&_a]:underline [&_p]:my-[4px]',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div onMouseDown={(e) => e.stopPropagation()}>
      <div className="mb-[4px] flex flex-wrap items-center gap-[2px] rounded-[6px] p-[4px] bg-newBgColorInner border border-newTableBorder">
        <Tiny active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <b>B</b>
        </Tiny>
        <Tiny active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <i>I</i>
        </Tiny>
        <Tiny active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline">
          <u>U</u>
        </Tiny>
        <Tiny active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2">
          H2
        </Tiny>
        <Tiny active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3">
          H3
        </Tiny>
        <Tiny active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          •••
        </Tiny>
        <Tiny
          active={editor.isActive('link')}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            const url = window.prompt('Link URL (https://...)');
            if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }}
          title="Link"
        >
          Link
        </Tiny>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

function Tiny({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <MiniButton
      size="xs"
      active={active}
      title={title}
      className={clsx('w-auto px-[6px]')}
      // Toolbar buttons live outside the contenteditable editor DOM node,
      // so a click fires mousedown -> editor blur/selection-loss -> click
      // before onClick's chain().focus()...run() ever runs. Suppressing
      // mousedown's default keeps selection intact through the click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </MiniButton>
  );
}
