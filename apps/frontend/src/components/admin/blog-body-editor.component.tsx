'use client';

import React, { FC, ReactNode, useEffect } from 'react';
import clsx from 'clsx';
import { useEditor, EditorContent } from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Bold from '@tiptap/extension-bold';
import Underline from '@tiptap/extension-underline';
import { History } from '@tiptap/extension-history';
import Heading from '@tiptap/extension-heading';
import { BulletList, ListItem } from '@tiptap/extension-list';
import Link from '@tiptap/extension-link';

// A lighter, blog-body-focused Tiptap setup - reuses the same extension
// packages as the social-post composer (new-launch/editor.tsx) rather than
// pulling in a new rich-text library, but without that component's
// mention/media/signature coupling which doesn't apply to a blog post.
const ToolbarButton: FC<{
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={clsx(
      'px-[8px] py-[4px] rounded-[4px] text-[13px] min-w-[28px]',
      active ? 'bg-forth text-white' : 'hover:bg-newTableBorder'
    )}
  >
    {children}
  </button>
);

export const BlogBodyEditor: FC<{
  value: string;
  onChange: (html: string) => void;
}> = ({ value, onChange }) => {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Underline,
      History,
      Heading.configure({ levels: [2, 3] }),
      BulletList,
      ListItem,
      Link.configure({ openOnClick: false }),
    ],
    content: value || '<p></p>',
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    immediatelyRender: false,
  });

  // Keep the editor in sync when `value` changes from outside (e.g.
  // switching which post is loaded into the form) without fighting the
  // user's own typing on every keystroke.
  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
      <div className="flex items-center gap-[4px] p-[6px] border-b border-newTableBorder bg-newBgColorInner">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          H3
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={() => {
            const url = window.prompt('Link URL');
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            } else {
              editor.chain().focus().unsetLink().run();
            }
          }}
        >
          Link
        </ToolbarButton>
      </div>
      <EditorContent
        editor={editor}
        className="p-[12px] min-h-[280px] text-[14px] [&_h2]:text-[20px] [&_h2]:font-[600] [&_h2]:mt-[12px] [&_h3]:text-[16px] [&_h3]:font-[600] [&_h3]:mt-[10px] [&_ul]:list-disc [&_ul]:pl-[20px] [&_a]:underline [&_a]:text-forth"
      />
    </div>
  );
};
