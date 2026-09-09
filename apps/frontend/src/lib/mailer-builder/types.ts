// Data model for the admin Mailer Templates drag-and-drop body designer.
//
// Ported from vantly-ugc.com's admin Content Builder (rows -> columns ->
// blocks), which itself ported the same shape from AutoGPT's Mailer
// template visual builder. This is purely a front-end concept: the
// backend never sees a `BuilderState`, only the final HTML string
// produced by `serializeBuilderState()` (see serialize.ts) -- exactly
// what `EmailTemplate.htmlContent` already stores. That HTML string
// carries a leading `<!--MAILER_BUILDER_STATE:{base64 json}-->` comment
// holding the state below, purely so re-opening a template for editing
// can restore the visual block structure instead of falling back to a
// single raw-HTML block.

export type BlockAlign = 'left' | 'center' | 'right';

export interface TextBlock {
  id: string;
  type: 'text';
  /** Rich text HTML from the per-block inline editor. */
  html: string;
  align: BlockAlign;
  textColor: string; // '' = inherit
}

export interface ImageBlock {
  id: string;
  type: 'image';
  src: string;
  alt: string;
  /** px. 0 means "full column width" (100%). */
  width: number;
  align: BlockAlign;
  link: string; // '' = no link
}

export interface ButtonBlock {
  id: string;
  type: 'button';
  label: string;
  url: string;
  align: BlockAlign;
  bgColor: string;
  textColor: string;
  borderRadius: number; // px
}

export interface DividerBlock {
  id: string;
  type: 'divider';
  color: string;
  thickness: number; // px
  spacing: number; // px, top+bottom margin
}

export interface SpacerBlock {
  id: string;
  type: 'spacer';
  height: number; // px
}

export interface QuoteBlock {
  id: string;
  type: 'quote';
  /** Plain text -- line breaks (\n) become <br> at serialize time. */
  quote: string;
  attribution: string;
  align: BlockAlign;
  accentColor: string;
}

export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'youtube'
  | 'website';

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  url: string;
}

/** Rendered as small colored circular badges with a platform initial --
 * not real icon images, so there's no external image dependency. */
export interface SocialIconsBlock {
  id: string;
  type: 'social';
  links: SocialLink[];
  align: BlockAlign;
  badgeColor: string;
}

export interface StatItem {
  id: string;
  value: string;
  label: string;
}

/** 2-4 side-by-side "big number + label" columns. */
export interface StatsBlock {
  id: string;
  type: 'stats';
  items: StatItem[];
  accentColor: string;
}

/** Escape hatch: used for (a) anything typed/pasted via "Source Code"
 * mode, and (b) wrapping a pre-existing template's HTML the first time
 * it's opened in the designer, since arbitrary HTML isn't reverse-parsed
 * back into structured blocks -- only content this designer itself
 * produced (identified by the JSON marker) round-trips as real blocks.
 * Still fully editable and still participates in drag reordering like
 * any other block. */
export interface RawHtmlBlock {
  id: string;
  type: 'raw';
  html: string;
}

export type Block =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | QuoteBlock
  | SocialIconsBlock
  | StatsBlock
  | RawHtmlBlock;

export type BlockType = Block['type'];

/** A distributive `Partial<Block>` -- plain `Partial<Block>` collapses to
 * only the properties common to every block type (id/type), which
 * rejects a patch like `{ label: '...' }` (ButtonBlock-only) at compile
 * time. Routing through this conditional type instead makes TypeScript
 * distribute over the union. */
export type BlockPatch<T extends Block = Block> = T extends unknown
  ? Partial<T>
  : never;

export interface Column {
  id: string;
  /** Percent width, columns in a row should sum to ~100. */
  widthPercent: number;
  blocks: Block[];
}

export interface Row {
  id: string;
  columns: Column[];
  bgColor: string; // '' = transparent
  paddingY: number; // px, applied to each column's top+bottom
}

export interface BuilderState {
  version: 1;
  rows: Row[];
}

export type Selection =
  | { kind: 'row'; rowId: string }
  | { kind: 'block'; blockId: string }
  | null;

let idCounter = 0;
/** Sequential + random suffix -- sequential alone risks collisions across
 * rapid state clones within the same millisecond, Math.random() alone is
 * harder to eyeball while debugging. */
export function newId(): string {
  idCounter += 1;
  return `b${Date.now().toString(36)}${idCounter}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyBuilderState(): BuilderState {
  return { version: 1, rows: [] };
}

export function makeColumn(widthPercent: number): Column {
  return { id: newId(), widthPercent, blocks: [] };
}

const COLUMN_LAYOUTS: Record<1 | 2 | 3, number[]> = {
  1: [100],
  2: [50, 50],
  3: [33.34, 33.33, 33.33],
};

export function makeRow(columnCount: 1 | 2 | 3 = 1): Row {
  return {
    id: newId(),
    columns: COLUMN_LAYOUTS[columnCount].map(makeColumn),
    bgColor: '',
    paddingY: 8,
  };
}

export function makeTextBlock(
  html = '<p>New text block. Click to edit.</p>'
): TextBlock {
  return { id: newId(), type: 'text', html, align: 'left', textColor: '' };
}

export function makeImageBlock(src = '', alt = ''): ImageBlock {
  return {
    id: newId(),
    type: 'image',
    src,
    alt,
    width: 0,
    align: 'center',
    link: '',
  };
}

export function makeButtonBlock(): ButtonBlock {
  return {
    id: newId(),
    type: 'button',
    label: 'Click here',
    url: 'https://',
    align: 'center',
    bgColor: '#6E57F6',
    textColor: '#FFFFFF',
    borderRadius: 8,
  };
}

export function makeDividerBlock(): DividerBlock {
  return {
    id: newId(),
    type: 'divider',
    color: 'rgba(0,0,0,0.12)',
    thickness: 1,
    spacing: 16,
  };
}

export function makeSpacerBlock(): SpacerBlock {
  return { id: newId(), type: 'spacer', height: 24 };
}

export function makeRawBlock(html: string): RawHtmlBlock {
  return { id: newId(), type: 'raw', html };
}

export function makeQuoteBlock(): QuoteBlock {
  return {
    id: newId(),
    type: 'quote',
    quote: 'This changed how our whole team creates content.',
    attribution: 'Jane Doe, Head of Marketing',
    align: 'center',
    accentColor: '#6E57F6',
  };
}

const DEFAULT_SOCIAL_PLATFORMS: SocialPlatform[] = [
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
];

export function makeSocialIconsBlock(): SocialIconsBlock {
  return {
    id: newId(),
    type: 'social',
    links: DEFAULT_SOCIAL_PLATFORMS.map((platform) => ({
      id: newId(),
      platform,
      url: 'https://',
    })),
    align: 'center',
    badgeColor: '#6E57F6',
  };
}

export function makeStatsBlock(): StatsBlock {
  return {
    id: newId(),
    type: 'stats',
    items: [
      { id: newId(), value: '500+', label: 'Creators' },
      { id: newId(), value: '4.9', label: 'Avg. Rating' },
      { id: newId(), value: '24/7', label: 'Support' },
    ],
    accentColor: '#6E57F6',
  };
}
