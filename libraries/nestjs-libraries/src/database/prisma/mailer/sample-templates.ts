import { EmailTemplateDto } from '@gitroom/nestjs-libraries/dtos/mailer/email-template.dto';

// Plain, table-based email-safe HTML (works in Outlook/Gmail/etc without
// relying on modern CSS) - not authored in the drag-and-drop Template
// Designer, since these ship before that builder exists. Reopening one of
// these in the Designer later falls back to its Source-code mode (see
// BlogBodyEditor's sibling in the Designer, InspectorPanel's visual/source
// toggle) exactly like any hand-written HTML template would.
const WRAP = (body: string) => `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F1015;padding:32px 0;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#16171D;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#E6E6EA;">
      ${body}
    </table>
  </td></tr>
</table>`;

const ROW = (inner: string, padding = '32px') =>
  `<tr><td style="padding:${padding};">${inner}</td></tr>`;

const BUTTON = (text: string, href = '#') =>
  `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#7C5CFC;border-radius:8px;"><a href="${href}" style="display:inline-block;padding:12px 24px;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;">${text}</a></td></tr></table>`;

export const SAMPLE_TEMPLATES: EmailTemplateDto[] = [
  {
    name: 'Welcome Email',
    subject: 'Welcome to Vantly!',
    htmlContent: WRAP(
      ROW(
        `<h1 style="margin:0 0 16px;font-size:24px;">Welcome aboard 👋</h1>
         <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#B8B9C4;">Thanks for joining Vantly. Connect your first channel and schedule your first post in just a couple of minutes.</p>
         ${BUTTON('Go to your dashboard')}`
      )
    ),
  },
  {
    name: 'Product Announcement',
    subject: "Here's what's new in Vantly",
    htmlContent: WRAP(
      ROW(
        `<h1 style="margin:0 0 16px;font-size:22px;">New: [feature name]</h1>
         <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#B8B9C4;">Describe what shipped and why it matters, in a sentence or two.</p>
         ${BUTTON('See what changed')}`
      )
    ),
  },
  {
    name: 'Monthly Newsletter',
    subject: 'Your monthly Vantly digest',
    htmlContent: WRAP(
      ROW(
        `<h1 style="margin:0 0 20px;font-size:22px;">This month at Vantly</h1>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#B8B9C4;"><strong style="color:#E6E6EA;">Highlight one</strong> - a sentence about it.</p>
         <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#B8B9C4;"><strong style="color:#E6E6EA;">Highlight two</strong> - a sentence about it.</p>
         <p style="margin:20px 0 0;font-size:15px;line-height:1.6;color:#B8B9C4;">Thanks for being part of Vantly.</p>`
      )
    ),
  },
  {
    name: 'Re-engagement',
    subject: 'We miss you at Vantly',
    htmlContent: WRAP(
      ROW(
        `<h1 style="margin:0 0 16px;font-size:22px;">It's been a while</h1>
         <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#B8B9C4;">Your channels are still connected and ready - come schedule something new.</p>
         ${BUTTON('Open Vantly')}`
      )
    ),
  },
];
