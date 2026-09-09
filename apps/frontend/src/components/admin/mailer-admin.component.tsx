'use client';

import React, { FC, useCallback, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { Input } from '@gitroom/react/form/input';
import { Select } from '@gitroom/react/form/select';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';
import { TemplateDesigner } from '@gitroom/frontend/components/admin/mailer/template-designer/template-designer.component';

// Admin UI for the Mailer feature set (Templates/Groups/Campaigns/
// Suppressions) - same file-per-feature-area convention as
// admin-content.component.tsx (each SWR call in its own hook per
// CLAUDE.md's rule; useFetch/useToaster/LoadingComponent/@gitroom/react
// form kit throughout, no new frontend dependency introduced).

interface EmailGroupRow {
  id: string;
  name: string;
  description?: string | null;
  type: 'MANUAL' | 'ALL_USERS' | 'SMART';
  memberEmails: string[];
  smartRules?: Record<string, unknown> | null;
  memberCount: number;
}

interface EmailTemplateRow {
  id: string;
  name: string;
  subject: string;
  htmlContent: string;
  isSample: boolean;
  updatedAt: string;
}

interface EmailCampaignRow {
  id: string;
  name: string;
  subject: string;
  templateId?: string | null;
  groupId: string;
  htmlContent: string;
  status: 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';
  scheduledFor?: string | null;
  sentAt?: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

interface EmailSuppressionRow {
  id: string;
  email: string;
  reason: string;
  createdAt: string;
}

const GROUPS_KEY = '/admin/mailer/groups';
const TEMPLATES_KEY = '/admin/mailer/templates';
const CAMPAIGNS_KEY = '/admin/mailer/campaigns';
const SUPPRESSIONS_KEY = '/admin/mailer/suppressions';

const useGroups = () => {
  const fetch = useFetch();
  return useSWR<EmailGroupRow[]>(GROUPS_KEY, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load groups');
    return res.json();
  });
};

const useTemplates = () => {
  const fetch = useFetch();
  return useSWR<EmailTemplateRow[]>(TEMPLATES_KEY, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load templates');
    return res.json();
  });
};

const useCampaigns = () => {
  const fetch = useFetch();
  return useSWR<EmailCampaignRow[]>(CAMPAIGNS_KEY, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load campaigns');
    return res.json();
  });
};

const useSuppressions = () => {
  const fetch = useFetch();
  return useSWR<EmailSuppressionRow[]>(SUPPRESSIONS_KEY, async (url: string) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load suppressions');
    return res.json();
  });
};

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Templates ──────────────────────────────────────────────────────────

const emptyTemplate = (): Partial<EmailTemplateRow> => ({
  name: '',
  subject: '',
  htmlContent: '<p>New template. Start editing below.</p>',
});

const TemplateEditor: FC<{
  template: Partial<EmailTemplateRow>;
  onClose: () => void;
}> = ({ template, onClose }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const [form, setForm] = useState<Partial<EmailTemplateRow>>(template);
  const [saving, setSaving] = useState(false);

  const set = useCallback(
    <K extends keyof EmailTemplateRow>(key: K, value: EmailTemplateRow[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const handleSave = useCallback(async () => {
    if (!form.name || !form.subject) {
      toast.show('Name and subject are required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const body = { name: form.name, subject: form.subject, htmlContent: form.htmlContent || '' };
      if (form.id) {
        await fetch(`${TEMPLATES_KEY}/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await fetch(TEMPLATES_KEY, { method: 'POST', body: JSON.stringify(body) });
      }
      await mutate(TEMPLATES_KEY);
      toast.show('Template saved', 'success');
      onClose();
    } catch {
      toast.show('Failed to save template', 'warning');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleDelete = useCallback(async () => {
    if (!form.id) return;
    if (!window.confirm(`Delete template "${form.name}"?`)) return;
    await fetch(`${TEMPLATES_KEY}/${form.id}`, { method: 'DELETE' });
    await mutate(TEMPLATES_KEY);
    toast.show('Template deleted', 'success');
    onClose();
  }, [form]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-2 gap-[12px]">
        <Input
          label="Name"
          name="templateName"
          disableForm={true}
          value={form.name || ''}
          onChange={(e) => set('name', e.target.value)}
        />
        <Input
          label="Subject line"
          name="templateSubject"
          disableForm={true}
          value={form.subject || ''}
          onChange={(e) => set('subject', e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-[6px]">
        <label className="text-[14px]">Body</label>
        <TemplateDesigner value={form.htmlContent || ''} onChange={(html) => set('htmlContent', html)} />
      </div>
      <div className="flex items-center gap-[8px]">
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        <Button onClick={onClose} secondary={true}>
          Cancel
        </Button>
        {form.id && (
          <Button onClick={handleDelete} secondary={true}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};

const TemplatesTab: FC = () => {
  const { data, isLoading } = useTemplates();
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const [editing, setEditing] = useState<Partial<EmailTemplateRow> | null>(null);

  const handleDuplicate = useCallback(async (id: string, name: string) => {
    await fetch(`${TEMPLATES_KEY}/${id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ name: `${name} (copy)` }),
    });
    await mutate(TEMPLATES_KEY);
    toast.show('Template duplicated', 'success');
  }, []);

  if (isLoading || !data) return <LoadingComponent />;

  if (editing) {
    return <TemplateEditor template={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div>
        <Button onClick={() => setEditing(emptyTemplate())}>New Template</Button>
      </div>
      <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_90px_140px] gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder">
          <div>Name</div>
          <div>Subject</div>
          <div>Sample</div>
          <div />
        </div>
        {data.length === 0 ? (
          <div className="px-[12px] py-[10px] text-[13px] opacity-70">No templates yet.</div>
        ) : (
          data.map((tpl) => (
            <div
              key={tpl.id}
              className="grid grid-cols-[1fr_1fr_90px_140px] gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-center"
            >
              <div>{tpl.name}</div>
              <div className="truncate opacity-80">{tpl.subject}</div>
              <div>{tpl.isSample ? 'Yes' : ''}</div>
              <div className="flex gap-[10px]">
                <button type="button" className="text-forth cursor-pointer" onClick={() => setEditing(tpl)}>
                  Edit
                </button>
                <button
                  type="button"
                  className="text-forth cursor-pointer"
                  onClick={() => handleDuplicate(tpl.id, tpl.name)}
                >
                  Duplicate
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ── Groups ────────────────────────────────────────────────────────────

const emptyGroup = (): Partial<EmailGroupRow> => ({
  name: '',
  description: '',
  type: 'MANUAL',
  memberEmails: [],
});

const GroupEditor: FC<{ group: Partial<EmailGroupRow>; onClose: () => void }> = ({ group, onClose }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const [form, setForm] = useState<Partial<EmailGroupRow>>(group);
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);

  const set = useCallback(
    <K extends keyof EmailGroupRow>(key: K, value: EmailGroupRow[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const handleSave = useCallback(async () => {
    if (!form.name) {
      toast.show('Name is required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        description: form.description || '',
        type: form.type || 'MANUAL',
        memberEmails: form.memberEmails || [],
        smartRules: form.smartRules || undefined,
      };
      if (form.id) {
        await fetch(`${GROUPS_KEY}/${form.id}`, { method: 'PUT', body: JSON.stringify(body) });
      } else {
        await fetch(GROUPS_KEY, { method: 'POST', body: JSON.stringify(body) });
      }
      await mutate(GROUPS_KEY);
      toast.show('Group saved', 'success');
      onClose();
    } catch {
      toast.show('Failed to save group', 'warning');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleDelete = useCallback(async () => {
    if (!form.id) return;
    if (!window.confirm(`Delete group "${form.name}"?`)) return;
    await fetch(`${GROUPS_KEY}/${form.id}`, { method: 'DELETE' });
    await mutate(GROUPS_KEY);
    toast.show('Group deleted', 'success');
    onClose();
  }, [form]);

  const handleImport = useCallback(async () => {
    if (!form.id || !importText.trim()) return;
    setImporting(true);
    try {
      const updated = await (
        await fetch(`${GROUPS_KEY}/${form.id}/import`, { method: 'POST', body: JSON.stringify({ text: importText }) })
      ).json();
      set('memberEmails', updated.memberEmails || []);
      setImportText('');
      await mutate(GROUPS_KEY);
      toast.show('Members imported', 'success');
    } catch {
      toast.show('Failed to import members', 'warning');
    } finally {
      setImporting(false);
    }
  }, [form.id, importText]);

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file || !form.id) return;
      const text = await file.text();
      setImporting(true);
      try {
        const updated = await (
          await fetch(`${GROUPS_KEY}/${form.id}/import`, { method: 'POST', body: JSON.stringify({ text }) })
        ).json();
        set('memberEmails', updated.memberEmails || []);
        await mutate(GROUPS_KEY);
        toast.show('Members imported from file', 'success');
      } catch {
        toast.show('Failed to import members', 'warning');
      } finally {
        setImporting(false);
      }
    },
    [form.id]
  );

  const handleExport = useCallback(async () => {
    if (!form.id) return;
    const csv = await (await fetch(`${GROUPS_KEY}/${form.id}/export`)).text();
    downloadTextFile(`${(form.name || 'group').replace(/\s+/g, '-').toLowerCase()}-members.csv`, csv);
  }, [form.id, form.name]);

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-2 gap-[12px]">
        <Input label="Name" name="groupName" disableForm={true} value={form.name || ''} onChange={(e) => set('name', e.target.value)} />
        <Select
          label="Type"
          name="groupType"
          disableForm={true}
          value={form.type || 'MANUAL'}
          onChange={(e) => set('type', e.target.value as EmailGroupRow['type'])}
        >
          <option value="MANUAL">Manual (imported list)</option>
          <option value="ALL_USERS">All Users (live)</option>
          <option value="SMART">Smart rule (live)</option>
        </Select>
      </div>
      <Input
        label="Description"
        name="groupDescription"
        disableForm={true}
        value={form.description || ''}
        onChange={(e) => set('description', e.target.value)}
      />

      {form.type === 'SMART' && (
        <Select
          label="Rule"
          name="groupSmartRule"
          disableForm={true}
          value={
            (form.smartRules as { hasSubscription?: boolean } | undefined)?.hasSubscription === true
              ? 'subscribed'
              : (form.smartRules as { hasSubscription?: boolean } | undefined)?.hasSubscription === false
              ? 'free'
              : 'subscribed'
          }
          onChange={(e) => set('smartRules', { hasSubscription: e.target.value === 'subscribed' })}
        >
          <option value="subscribed">Has an active subscription</option>
          <option value="free">No active subscription</option>
        </Select>
      )}

      {form.type === 'MANUAL' && form.id && (
        <div className="flex flex-col gap-[8px] border border-newTableBorder rounded-[8px] p-[12px] bg-newBgColorInner">
          <div className="text-[13px] font-[600]">
            Members ({(form.memberEmails || []).length})
          </div>
          <textarea
            className="w-full min-h-[80px] rounded-[6px] p-[8px] text-[12px] bg-newBgColorInner border border-newTableBorder"
            placeholder="Paste emails, one per line or comma-separated..."
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
          />
          <div className="flex items-center gap-[8px]">
            <Button onClick={handleImport} loading={importing} disabled={!importText.trim()}>
              Import pasted
            </Button>
            <label className="h-[40px] px-[16px] rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[14px] flex items-center cursor-pointer">
              Import CSV file
              <input type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={handleImportFile} />
            </label>
            <Button onClick={handleExport} secondary={true} disabled={!form.id}>
              Export CSV
            </Button>
          </div>
        </div>
      )}
      {form.type !== 'MANUAL' && form.id && (
        <div className="flex items-center gap-[8px]">
          <Button onClick={handleExport} secondary={true}>
            Export current members (CSV)
          </Button>
        </div>
      )}

      <div className="flex items-center gap-[8px]">
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
        <Button onClick={onClose} secondary={true}>
          Cancel
        </Button>
        {form.id && (
          <Button onClick={handleDelete} secondary={true}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};

const GroupsTab: FC = () => {
  const { data, isLoading } = useGroups();
  const [editing, setEditing] = useState<Partial<EmailGroupRow> | null>(null);

  if (isLoading || !data) return <LoadingComponent />;

  if (editing) {
    return <GroupEditor group={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div>
        <Button onClick={() => setEditing(emptyGroup())}>New Group</Button>
      </div>
      <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
        <div className="grid grid-cols-[1fr_120px_100px_120px] gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder">
          <div>Name</div>
          <div>Type</div>
          <div>Members</div>
          <div />
        </div>
        {data.map((group) => (
          <div
            key={group.id}
            className="grid grid-cols-[1fr_120px_100px_120px] gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-center"
          >
            <div>
              <div>{group.name}</div>
              {group.description && <div className="text-[11px] opacity-60">{group.description}</div>}
            </div>
            <div className="capitalize">{group.type.toLowerCase().replace('_', ' ')}</div>
            <div>{group.memberCount}</div>
            <div>
              <button type="button" className="text-forth cursor-pointer" onClick={() => setEditing(group)}>
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Campaigns ─────────────────────────────────────────────────────────

const emptyCampaign = (): Partial<EmailCampaignRow> => ({
  name: '',
  subject: '',
  templateId: '',
  groupId: '',
  htmlContent: '',
});

const CampaignEditor: FC<{
  campaign: Partial<EmailCampaignRow>;
  templates: EmailTemplateRow[];
  groups: EmailGroupRow[];
  onClose: () => void;
}> = ({ campaign, templates, groups, onClose }) => {
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();
  const [form, setForm] = useState<Partial<EmailCampaignRow>>(campaign);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState<
    { id: string; email: string; status: string; error?: string | null }[] | null
  >(null);

  const set = useCallback(
    <K extends keyof EmailCampaignRow>(key: K, value: EmailCampaignRow[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    []
  );

  const applyTemplate = useCallback(
    (templateId: string) => {
      set('templateId', templateId);
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) {
        setForm((prev) => ({ ...prev, subject: prev.subject || tpl.subject, htmlContent: tpl.htmlContent }));
      }
    },
    [templates]
  );

  const handleSave = useCallback(async () => {
    if (!form.name || !form.subject || !form.groupId) {
      toast.show('Name, subject and a recipient group are required', 'warning');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        subject: form.subject,
        templateId: form.templateId || undefined,
        groupId: form.groupId,
        htmlContent: form.htmlContent || '',
      };
      let saved: EmailCampaignRow;
      if (form.id) {
        saved = await (
          await fetch(`${CAMPAIGNS_KEY}/${form.id}`, { method: 'PUT', body: JSON.stringify(body) })
        ).json();
      } else {
        saved = await (await fetch(CAMPAIGNS_KEY, { method: 'POST', body: JSON.stringify(body) })).json();
      }
      setForm(saved);
      await mutate(CAMPAIGNS_KEY);
      toast.show('Campaign saved', 'success');
    } catch {
      toast.show('Failed to save campaign', 'warning');
    } finally {
      setSaving(false);
    }
  }, [form]);

  const handleDelete = useCallback(async () => {
    if (!form.id) return;
    if (!window.confirm(`Delete campaign "${form.name}"?`)) return;
    await fetch(`${CAMPAIGNS_KEY}/${form.id}`, { method: 'DELETE' });
    await mutate(CAMPAIGNS_KEY);
    toast.show('Campaign deleted', 'success');
    onClose();
  }, [form]);

  const handleSend = useCallback(async () => {
    if (!form.id) {
      toast.show('Save the campaign before sending', 'warning');
      return;
    }
    const group = groups.find((g) => g.id === form.groupId);
    if (
      !window.confirm(
        `Send "${form.name}" now to ${group ? `"${group.name}"` : 'the selected group'} (${group?.memberCount ?? '?'} recipients)? This cannot be undone.`
      )
    ) {
      return;
    }
    setSending(true);
    try {
      const result = await (await fetch(`${CAMPAIGNS_KEY}/${form.id}/send`, { method: 'POST' })).json();
      toast.show(`Sent: ${result.sentCount} ok, ${result.failedCount} failed`, result.failedCount ? 'warning' : 'success');
      await mutate(CAMPAIGNS_KEY);
      const fresh = await (await fetch(`${CAMPAIGNS_KEY}/${form.id}`)).json();
      setForm(fresh);
    } catch {
      toast.show('Failed to send campaign', 'warning');
    } finally {
      setSending(false);
    }
  }, [form]);

  const loadLogs = useCallback(async () => {
    if (!form.id) return;
    const data = await (await fetch(`${CAMPAIGNS_KEY}/${form.id}/logs`)).json();
    setLogs(data);
  }, [form.id]);

  const isSentOrSending = form.status === 'SENT' || form.status === 'SENDING';

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="grid grid-cols-2 gap-[12px]">
        <Input
          label="Campaign name"
          name="campaignName"
          disableForm={true}
          value={form.name || ''}
          onChange={(e) => set('name', e.target.value)}
          disabled={isSentOrSending}
        />
        <Input
          label="Subject line"
          name="campaignSubject"
          disableForm={true}
          value={form.subject || ''}
          onChange={(e) => set('subject', e.target.value)}
          disabled={isSentOrSending}
        />
      </div>
      <div className="grid grid-cols-2 gap-[12px]">
        <Select
          label="Start from template (optional)"
          name="campaignTemplate"
          disableForm={true}
          value={form.templateId || ''}
          onChange={(e) => applyTemplate(e.target.value)}
          disabled={isSentOrSending}
        >
          <option value="">None -- use body below</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          label="Recipient group"
          name="campaignGroup"
          disableForm={true}
          value={form.groupId || ''}
          onChange={(e) => set('groupId', e.target.value)}
          disabled={isSentOrSending}
        >
          <option value="">Select a group...</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.memberCount})
            </option>
          ))}
        </Select>
      </div>

      {form.status && form.status !== 'DRAFT' && (
        <div className="text-[13px] rounded-[8px] border border-newTableBorder bg-newBgColorInner p-[12px]">
          Status: <span className="font-[600]">{form.status}</span> -- {form.sentCount || 0} sent,{' '}
          {form.failedCount || 0} failed, of {form.totalRecipients || 0} total.
          <button type="button" className="ml-[12px] text-forth cursor-pointer" onClick={loadLogs}>
            View delivery log
          </button>
        </div>
      )}

      {logs && (
        <div className="border border-newTableBorder rounded-[8px] max-h-[200px] overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="flex justify-between px-[10px] py-[6px] text-[12px] border-b border-newTableBorder last:border-b-0">
              <span>{log.email}</span>
              <span className={log.status === 'FAILED' ? 'text-red-400' : 'opacity-70'}>{log.status}</span>
            </div>
          ))}
        </div>
      )}

      {!isSentOrSending && (
        <div className="flex flex-col gap-[6px]">
          <label className="text-[14px]">Body</label>
          <TemplateDesigner value={form.htmlContent || ''} onChange={(html) => set('htmlContent', html)} />
        </div>
      )}

      <div className="flex items-center gap-[8px]">
        {!isSentOrSending && (
          <Button onClick={handleSave} loading={saving}>
            Save draft
          </Button>
        )}
        {form.id && !isSentOrSending && (
          <Button onClick={handleSend} loading={sending} secondary={true}>
            Send now
          </Button>
        )}
        <Button onClick={onClose} secondary={true}>
          {isSentOrSending ? 'Close' : 'Cancel'}
        </Button>
        {form.id && !isSentOrSending && (
          <Button onClick={handleDelete} secondary={true}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
};

const CampaignsTab: FC = () => {
  const { data, isLoading } = useCampaigns();
  const { data: templates } = useTemplates();
  const { data: groups } = useGroups();
  const [editing, setEditing] = useState<Partial<EmailCampaignRow> | null>(null);

  if (isLoading || !data || !templates || !groups) return <LoadingComponent />;

  if (editing) {
    return <CampaignEditor campaign={editing} templates={templates} groups={groups} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <div>
        <Button onClick={() => setEditing(emptyCampaign())}>New Campaign</Button>
      </div>
      <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
        <div className="grid grid-cols-[1fr_110px_150px] gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder">
          <div>Name</div>
          <div>Status</div>
          <div />
        </div>
        {data.length === 0 ? (
          <div className="px-[12px] py-[10px] text-[13px] opacity-70">No campaigns yet.</div>
        ) : (
          data.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1fr_110px_150px] gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-center"
            >
              <div>{c.name}</div>
              <div className="capitalize">{c.status.toLowerCase()}</div>
              <div>
                <button type="button" className="text-forth cursor-pointer" onClick={() => setEditing(c)}>
                  {c.status === 'DRAFT' ? 'Edit' : 'View'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ── Suppressions ──────────────────────────────────────────────────────

const SuppressionsTab: FC = () => {
  const { data, isLoading } = useSuppressions();
  const fetch = useFetch();
  const { mutate } = useSWRConfig();
  const toast = useToaster();

  const handleRemove = useCallback(async (email: string) => {
    if (!window.confirm(`Remove ${email} from the suppression list? They will be able to receive mailer campaigns again.`)) {
      return;
    }
    await fetch(`${SUPPRESSIONS_KEY}/${encodeURIComponent(email)}`, { method: 'DELETE' });
    await mutate(SUPPRESSIONS_KEY);
    toast.show('Removed from suppression list', 'success');
  }, []);

  if (isLoading || !data) return <LoadingComponent />;

  return (
    <div className="flex flex-col gap-[12px]">
      <div className="text-[13px] opacity-70 max-w-[640px]">
        Addresses here never receive a mailer campaign, regardless of group membership - unsubscribed via the one-click
        link in a campaign footer, or added manually. Every group resolution (send, member count, CSV export) filters
        against this list.
      </div>
      <div className="border border-newTableBorder rounded-[8px] overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_160px_100px] gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder">
          <div>Email</div>
          <div>Reason</div>
          <div>Date</div>
          <div />
        </div>
        {data.length === 0 ? (
          <div className="px-[12px] py-[10px] text-[13px] opacity-70">No suppressed addresses.</div>
        ) : (
          data.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[1fr_140px_160px_100px] gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-center"
            >
              <div>{s.email}</div>
              <div className="capitalize opacity-80">{s.reason}</div>
              <div className="opacity-60">{new Date(s.createdAt).toLocaleDateString()}</div>
              <div>
                <button type="button" className="text-forth cursor-pointer" onClick={() => handleRemove(s.email)}>
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ── Root ──────────────────────────────────────────────────────────────

const TABS = [
  { key: 'templates', label: 'Templates' },
  { key: 'groups', label: 'Groups' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'suppressions', label: 'Suppressions' },
] as const;

export const MailerAdminComponent: FC = () => {
  const user = useUser();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('templates');

  if (!user?.isSuperAdmin) {
    return <div className="text-textColor p-[20px]">You do not have access to this page.</div>;
  }

  return (
    <div className="flex flex-col gap-[16px] text-textColor p-[20px]">
      <div className="text-[20px] font-[600]">Mailer</div>
      <div className="flex gap-[8px]">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`h-[32px] px-[12px] rounded-[8px] text-[13px] border cursor-pointer whitespace-nowrap ${
              tab === key
                ? 'bg-forth text-white border-forth'
                : 'bg-newBgColorInner text-textColor border-newTableBorder hover:bg-tableBorder'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'groups' && <GroupsTab />}
      {tab === 'campaigns' && <CampaignsTab />}
      {tab === 'suppressions' && <SuppressionsTab />}
    </div>
  );
};
