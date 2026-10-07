'use client';

import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { Button } from '@gitroom/react/form/button';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { LoadingComponent } from '@gitroom/frontend/components/layout/loading';

// Admin Panel -> Users grid. Backed by GET /admin/users (list, search,
// filters, pagination), GET/PUT /admin/users/:id (details, edit),
// POST /admin/users/:id/subscription (complimentary plan grant) and the
// existing ban/unban and impersonate endpoints.

type Tier = 'FREE' | 'STANDARD' | 'TEAM' | 'PRO' | 'ULTIMATE';
const TIERS: Tier[] = ['FREE', 'STANDARD', 'TEAM', 'PRO', 'ULTIMATE'];

interface OrgRow {
  userOrgId: string;
  orgId: string;
  orgName: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'USER';
  disabled: boolean;
  tier: Tier;
  period: 'MONTHLY' | 'YEARLY' | null;
  isLifetime: boolean;
  cancelAt: string | null;
  channels: {
    id: string;
    name: string;
    providerIdentifier: string;
    disabled: boolean;
  }[];
}

interface UserRow {
  id: string;
  name: string | null;
  lastName: string | null;
  email: string;
  providerName: string;
  activated: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
  lastOnline: string;
  ip?: string | null;
  agent?: string | null;
  timezone?: number;
  sendSuccessEmails?: boolean;
  sendFailureEmails?: boolean;
  sendStreakEmails?: boolean;
  orgs: OrgRow[];
}

interface UsersResponse {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

const selectClass =
  'bg-newBgColorInner h-[38px] border border-newTableBorder rounded-[8px] px-[10px] text-[14px] text-textColor';
const inputClass = `${selectClass} w-full`;

const fullName = (u: Pick<UserRow, 'name' | 'lastName'>) =>
  [u.name, u.lastName].filter(Boolean).join(' ').trim();

const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  if (!isFinite(diff)) return '—';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mon = Math.floor(day / 30);
  if (mon < 12) return `${mon}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
};

// The org whose plan represents the user in the grid and whose
// "Impersonate" the row action uses: owner first, then admin, then first.
const primaryOrg = (u: UserRow): OrgRow | undefined =>
  u.orgs.find((o) => o.role === 'SUPERADMIN') ||
  u.orgs.find((o) => o.role === 'ADMIN') ||
  u.orgs[0];

const planLabel = (o?: OrgRow) => {
  if (!o) return 'No org';
  if (o.tier === 'FREE') return 'Free';
  const base = o.tier.charAt(0) + o.tier.slice(1).toLowerCase();
  if (o.isLifetime) return `${base} · Lifetime`;
  return `${base}${o.period ? ` · ${o.period === 'YEARLY' ? 'Yearly' : 'Monthly'}` : ''}`;
};

const Pill: FC<{ tone: 'green' | 'red' | 'blue' | 'gray' | 'purple'; children: ReactNode }> = ({
  tone,
  children,
}) => {
  const tones = {
    green: 'bg-green-500/15 text-green-400',
    red: 'bg-red-500/15 text-red-400',
    blue: 'bg-blue-500/15 text-blue-400',
    gray: 'bg-white/10 text-textColor',
    purple: 'bg-purple-500/15 text-purple-300',
  };
  return (
    <span
      className={`inline-block px-[8px] py-[2px] rounded-full text-[11px] font-[600] whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
};

const CloseButton: FC = () => {
  const modal = useModals();
  return (
    <button
      className="outline-none w-[28px] h-[28px] flex items-center justify-center hover:bg-tableBorder cursor-pointer rounded"
      type="button"
      onClick={() => modal.closeAll()}
    >
      <svg viewBox="0 0 15 15" fill="none" width="16" height="16">
        <path
          d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.193 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.0061 11.5571 12.0061 11.7816 11.7816C12.0062 11.557 12.0062 11.193 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z"
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
};

const ModalFrame: FC<{ title: string; children: ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded-[4px] border border-newTableBorder bg-newBgColorInner px-[16px] pb-[16px] relative w-full max-h-[80vh] overflow-auto text-textColor">
    <div className="sticky top-0 bg-newBgColorInner py-[16px] flex items-center justify-between gap-[12px] z-10 border-b border-newTableBorder mb-[12px]">
      <div className="text-[16px] font-[600]">{title}</div>
      <CloseButton />
    </div>
    {children}
  </div>
);

const Field: FC<{ label: string; children: ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex flex-col gap-[6px]">
    <div className="text-[12px] opacity-70">{label}</div>
    {children}
  </div>
);

const impersonate = async (
  fetch: ReturnType<typeof useFetch>,
  userOrgId: string
) => {
  await fetch('/user/impersonate', {
    method: 'POST',
    body: JSON.stringify({ id: userOrgId }),
  });
  window.location.href = '/launches';
};

/* ------------------------------- Details ------------------------------ */

const DetailsModal: FC<{
  userId: string;
  onEdit: (u: UserRow) => void;
  onPlan: (u: UserRow) => void;
}> = ({ userId, onEdit, onPlan }) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, isLoading } = useSWR<UserRow>(
    `/admin/users/${userId}`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load user');
      return res.json();
    }
  );

  const doImpersonate = useCallback(
    async (userOrgId: string) => {
      try {
        await impersonate(fetch, userOrgId);
      } catch {
        toaster.show('Could not impersonate this user', 'warning');
      }
    },
    [fetch, toaster]
  );

  return (
    <ModalFrame title="User details">
      {isLoading || !data ? (
        <LoadingComponent />
      ) : (
        <div className="flex flex-col gap-[16px]">
          <div className="flex items-start justify-between gap-[12px]">
            <div>
              <div className="text-[18px] font-[600]">
                {fullName(data) || '(no name)'}
              </div>
              <div className="opacity-70 break-all">{data.email}</div>
            </div>
            <div className="flex gap-[6px] flex-wrap justify-end">
              {data.isSuperAdmin && <Pill tone="purple">Super admin</Pill>}
              <Pill tone={data.activated ? 'green' : 'red'}>
                {data.activated ? 'Active' : 'Banned'}
              </Pill>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-[12px] text-[13px]">
            <div>
              <div className="opacity-60">User ID</div>
              <div className="break-all">{data.id}</div>
            </div>
            <div>
              <div className="opacity-60">Sign-in method</div>
              <div>{data.providerName}</div>
            </div>
            <div>
              <div className="opacity-60">Joined</div>
              <div>{new Date(data.createdAt).toLocaleString()}</div>
            </div>
            <div>
              <div className="opacity-60">Last online</div>
              <div>
                {new Date(data.lastOnline).toLocaleString()}{' '}
                <span className="opacity-60">
                  ({relativeTime(data.lastOnline)})
                </span>
              </div>
            </div>
            <div>
              <div className="opacity-60">Last IP</div>
              <div>{data.ip || '—'}</div>
            </div>
            <div>
              <div className="opacity-60">Email notifications</div>
              <div>
                {[
                  data.sendSuccessEmails && 'success',
                  data.sendFailureEmails && 'failure',
                  data.sendStreakEmails && 'streak',
                ]
                  .filter(Boolean)
                  .join(', ') || 'none'}
              </div>
            </div>
            <div className="col-span-2">
              <div className="opacity-60">Browser / device</div>
              <div className="break-all text-[12px]">{data.agent || '—'}</div>
            </div>
          </div>

          <div>
            <div className="text-[14px] font-[600] mb-[8px]">
              Organizations ({data.orgs.length})
            </div>
            <div className="flex flex-col gap-[10px]">
              {data.orgs.map((o) => (
                <div
                  key={o.orgId}
                  className="border border-newTableBorder rounded-[8px] p-[12px] flex flex-col gap-[8px]"
                >
                  <div className="flex items-center justify-between gap-[8px] flex-wrap">
                    <div>
                      <span className="font-[600]">{o.orgName}</span>{' '}
                      <span className="opacity-60 text-[12px]">
                        {o.role}
                        {o.disabled ? ' · disabled' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-[8px]">
                      <Pill tone={o.tier === 'FREE' ? 'gray' : 'blue'}>
                        {planLabel(o)}
                      </Pill>
                      <Button
                        secondary
                        onClick={() => doImpersonate(o.userOrgId)}
                      >
                        Impersonate
                      </Button>
                    </div>
                  </div>
                  {o.cancelAt && (
                    <div className="text-[12px] opacity-70">
                      Set to cancel on{' '}
                      {new Date(o.cancelAt).toLocaleDateString()}
                    </div>
                  )}
                  <div className="text-[12px] opacity-70">
                    {o.channels.length} connected channel
                    {o.channels.length === 1 ? '' : 's'}
                    {o.channels.length > 0 && ': '}
                    {o.channels
                      .map(
                        (c) =>
                          `${c.name} (${c.providerIdentifier}${
                            c.disabled ? ', disabled' : ''
                          })`
                      )
                      .join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-[8px] justify-end">
            <Button secondary onClick={() => onEdit(data)}>
              Edit user
            </Button>
            <Button onClick={() => onPlan(data)}>Manage plan</Button>
          </div>
        </div>
      )}
    </ModalFrame>
  );
};

/* -------------------------------- Edit -------------------------------- */

const EditModal: FC<{ user: UserRow; onDone: () => void }> = ({
  user,
  onDone,
}) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const modal = useModals();
  const [name, setName] = useState(user.name || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [email, setEmail] = useState(user.email);
  const [success, setSuccess] = useState(user.sendSuccessEmails ?? true);
  const [failure, setFailure] = useState(user.sendFailureEmails ?? true);
  const [streak, setStreak] = useState(user.sendStreakEmails ?? true);
  const [saving, setSaving] = useState(false);

  const emailChanged = email.trim().toLowerCase() !== user.email.toLowerCase();

  const save = useCallback(async () => {
    if (emailChanged) {
      const ok = await deleteDialog(
        `Changing the email changes how this person signs in. Make sure ${email.trim()} is correct and that they know about the change.`,
        'Yes, change email',
        'Change email?',
        'No, cancel'
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/admin/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name,
          lastName,
          email: email.trim(),
          sendSuccessEmails: success,
          sendFailureEmails: failure,
          sendStreakEmails: streak,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let message = 'Could not save changes';
        try {
          const parsed = JSON.parse(text);
          if (parsed?.message) {
            message = Array.isArray(parsed.message)
              ? parsed.message.join(', ')
              : parsed.message;
          }
        } catch {
          // keep default message
        }
        toaster.show(message, 'warning');
        setSaving(false);
        return;
      }
      toaster.show('User updated', 'success');
      onDone();
      modal.closeAll();
    } catch {
      toaster.show('Could not save changes', 'warning');
      setSaving(false);
    }
  }, [
    emailChanged,
    email,
    name,
    lastName,
    success,
    failure,
    streak,
    user.id,
    fetch,
    toaster,
    modal,
    onDone,
  ]);

  return (
    <ModalFrame title={`Edit ${user.email}`}>
      <div className="flex flex-col gap-[14px]">
        <div className="grid grid-cols-2 gap-[12px]">
          <Field label="First name">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Email">
          <input
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailChanged && (
            <div className="text-[12px] text-yellow-400">
              Changing the email changes the sign-in identity for this
              account.
            </div>
          )}
        </Field>
        <div className="flex flex-col gap-[8px]">
          <div className="text-[12px] opacity-70">Email notifications</div>
          {(
            [
              ['Post success emails', success, setSuccess],
              ['Post failure emails', failure, setFailure],
              ['Streak emails', streak, setStreak],
            ] as const
          ).map(([label, value, set]) => (
            <label
              key={label}
              className="flex items-center gap-[8px] text-[13px] cursor-pointer"
            >
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => set(e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <div className="flex gap-[8px] justify-end">
          <Button secondary onClick={() => modal.closeAll()}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
};

/* -------------------------------- Plan -------------------------------- */

const PlanModal: FC<{ user: UserRow; onDone: () => void }> = ({
  user,
  onDone,
}) => {
  const fetch = useFetch();
  const toaster = useToaster();
  const modal = useModals();
  const initialOrg = primaryOrg(user);
  const [orgId, setOrgId] = useState(initialOrg?.orgId || '');
  const org = user.orgs.find((o) => o.orgId === orgId);
  const [tier, setTier] = useState<Tier>(
    org?.tier && org.tier !== 'FREE' ? org.tier : 'STANDARD'
  );
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>(
    org?.period || 'MONTHLY'
  );
  const [lifetime, setLifetime] = useState(!!org?.isLifetime);
  const [channels, setChannels] = useState('');
  const [saving, setSaving] = useState(false);

  // Switching organization resets the form to that org's current plan.
  const onOrgChange = (id: string) => {
    setOrgId(id);
    const next = user.orgs.find((o) => o.orgId === id);
    setTier(next?.tier && next.tier !== 'FREE' ? next.tier : 'STANDARD');
    setPeriod(next?.period || 'MONTHLY');
    setLifetime(!!next?.isLifetime);
    setChannels('');
  };

  const save = useCallback(async () => {
    if (!org) return;
    const warn =
      tier === 'FREE'
        ? `This removes the subscription for "${org.orgName}" and moves it to the Free plan. Channels over the Free limit will be disabled.`
        : `This sets "${org.orgName}" to ${tier} (${
            lifetime ? 'lifetime' : period.toLowerCase()
          }) as a complimentary grant, with no payment. If this is lower than its current plan, channels over the new limit will be disabled.`;
    const ok = await deleteDialog(warn, 'Yes, apply', 'Change plan?', 'No, cancel');
    if (!ok) return;

    setSaving(true);
    try {
      const parsedChannels = channels.trim() === '' ? undefined : parseInt(channels, 10);
      const res = await fetch(`/admin/users/${user.id}/subscription`, {
        method: 'POST',
        body: JSON.stringify({
          organizationId: org.orgId,
          tier,
          period,
          isLifetime: lifetime,
          ...(parsedChannels !== undefined && !isNaN(parsedChannels)
            ? { totalChannels: parsedChannels }
            : {}),
        }),
      });
      if (!res.ok) {
        toaster.show('Could not change the plan', 'warning');
        setSaving(false);
        return;
      }
      toaster.show('Plan updated', 'success');
      onDone();
      modal.closeAll();
    } catch {
      toaster.show('Could not change the plan', 'warning');
      setSaving(false);
    }
  }, [org, tier, period, lifetime, channels, user.id, fetch, toaster, modal, onDone]);

  return (
    <ModalFrame title={`Plan for ${user.email}`}>
      <div className="flex flex-col gap-[14px]">
        {user.orgs.length === 0 ? (
          <div className="opacity-70">This user has no organization.</div>
        ) : (
          <>
            <Field label="Organization">
              <select
                className={inputClass}
                value={orgId}
                onChange={(e) => onOrgChange(e.target.value)}
              >
                {user.orgs.map((o) => (
                  <option key={o.orgId} value={o.orgId}>
                    {o.orgName} ({o.role}) — {planLabel(o)}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-[12px]">
              <Field label="Plan">
                <select
                  className={inputClass}
                  value={tier}
                  onChange={(e) => setTier(e.target.value as Tier)}
                >
                  {TIERS.map((t) => (
                    <option key={t} value={t}>
                      {t === 'FREE'
                        ? 'Free (remove subscription)'
                        : t.charAt(0) + t.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Billing period">
                <select
                  className={inputClass}
                  value={period}
                  disabled={tier === 'FREE'}
                  onChange={(e) =>
                    setPeriod(e.target.value as 'MONTHLY' | 'YEARLY')
                  }
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-[8px] text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={lifetime}
                disabled={tier === 'FREE'}
                onChange={(e) => setLifetime(e.target.checked)}
              />
              Lifetime (never expires)
            </label>
            <Field label="Channel limit override (optional)">
              <input
                className={inputClass}
                type="number"
                min={0}
                placeholder="Leave blank to use the plan's default"
                disabled={tier === 'FREE'}
                value={channels}
                onChange={(e) => setChannels(e.target.value)}
              />
            </Field>
            <div className="text-[12px] opacity-70">
              A complimentary grant: it is written straight to the account and
              no payment is taken. It does not start a RazorPay subscription,
              and there is no automatic end date.
            </div>
          </>
        )}
        <div className="flex gap-[8px] justify-end">
          <Button secondary onClick={() => modal.closeAll()}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={!org}>
            Apply plan
          </Button>
        </div>
      </div>
    </ModalFrame>
  );
};

/* -------------------------------- Grid -------------------------------- */

const COLUMNS =
  'grid-cols-[minmax(220px,2fr)_minmax(150px,1.2fr)_90px_130px_110px_minmax(330px,auto)]';

export const AdminUsersGrid: FC = () => {
  const fetch = useFetch();
  const toaster = useToaster();
  const modal = useModals();
  const currentUser = useUser();

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [tier, setTier] = useState('ALL');
  const [sort, setSort] = useState('lastOnline');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setPage(0);
      setSearch(searchInput.trim());
    }, 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  const key = useMemo(() => {
    const q = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      status,
      tier,
      sort,
      dir,
      ...(search ? { search } : {}),
    });
    return `/admin/users?${q.toString()}`;
  }, [page, pageSize, status, tier, sort, dir, search]);

  const { data, isLoading, error, mutate } = useSWR<UsersResponse>(
    key,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load users');
      return res.json();
    },
    { revalidateOnFocus: false }
  );

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  const openEdit = useCallback(
    (u: UserRow) => {
      modal.closeAll();
      modal.openModal({
        closeOnClickOutside: true,
        withCloseButton: false,
        classNames: { modal: 'w-[100%] max-w-[640px] text-textColor' },
        children: <EditModal user={u} onDone={refresh} />,
      });
    },
    [modal, refresh]
  );

  const openPlan = useCallback(
    (u: UserRow) => {
      modal.closeAll();
      modal.openModal({
        closeOnClickOutside: true,
        withCloseButton: false,
        classNames: { modal: 'w-[100%] max-w-[640px] text-textColor' },
        children: <PlanModal user={u} onDone={refresh} />,
      });
    },
    [modal, refresh]
  );

  const openDetails = useCallback(
    (u: UserRow) => {
      modal.openModal({
        closeOnClickOutside: true,
        withCloseButton: false,
        classNames: { modal: 'w-[100%] max-w-[860px] text-textColor' },
        children: (
          <DetailsModal userId={u.id} onEdit={openEdit} onPlan={openPlan} />
        ),
      });
    },
    [modal, openEdit, openPlan]
  );

  const toggleBan = useCallback(
    async (u: UserRow) => {
      const willBan = u.activated;
      const ok = await deleteDialog(
        willBan
          ? `This will immediately block ${u.email} from logging in. It does not delete any data and can be reversed at any time.`
          : `This will restore login access for ${u.email}.`,
        willBan ? 'Yes, ban' : 'Yes, unban',
        willBan ? 'Ban User?' : 'Unban User?',
        'No, cancel'
      );
      if (!ok) return;
      const res = await fetch(
        `/admin/users/${u.id}/${willBan ? 'ban' : 'unban'}`,
        { method: 'POST' }
      );
      if (!res.ok) {
        toaster.show(
          willBan ? 'Could not ban this user' : 'Could not unban this user',
          'warning'
        );
        return;
      }
      toaster.show(willBan ? `${u.email} banned` : `${u.email} unbanned`, 'success');
      refresh();
    },
    [fetch, toaster, refresh]
  );

  const doImpersonate = useCallback(
    async (u: UserRow) => {
      const org = primaryOrg(u);
      if (!org) {
        toaster.show('This user has no organization to impersonate', 'warning');
        return;
      }
      try {
        await impersonate(fetch, org.userOrgId);
      } catch {
        toaster.show('Could not impersonate this user', 'warning');
      }
    },
    [fetch, toaster]
  );

  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('all');
    setTier('ALL');
    setSort('lastOnline');
    setDir('desc');
    setPage(0);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-wrap gap-[12px] items-end bg-newBgColorInner border border-newTableBorder rounded-[8px] p-[12px]">
        <div className="flex flex-col gap-[6px] flex-1 min-w-[240px]">
          <div className="text-[12px] opacity-70">Search</div>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Name, email or user ID"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">Status</div>
          <select
            className={selectClass}
            value={status}
            onChange={(e) => {
              setPage(0);
              setStatus(e.target.value);
            }}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">Plan</div>
          <select
            className={selectClass}
            value={tier}
            onChange={(e) => {
              setPage(0);
              setTier(e.target.value);
            }}
          >
            <option value="ALL">All plans</option>
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t === 'FREE' ? 'Free' : t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">Sort by</div>
          <div className="flex gap-[6px]">
            <select
              className={selectClass}
              value={sort}
              onChange={(e) => {
                setPage(0);
                setSort(e.target.value);
              }}
            >
              <option value="lastOnline">Last online</option>
              <option value="createdAt">Joined</option>
              <option value="name">Name</option>
              <option value="email">Email</option>
            </select>
            <select
              className={selectClass}
              value={dir}
              onChange={(e) => {
                setPage(0);
                setDir(e.target.value as 'asc' | 'desc');
              }}
            >
              <option value="desc">Desc</option>
              <option value="asc">Asc</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-[6px]">
          <div className="text-[12px] opacity-70">Per page</div>
          <select
            className={selectClass}
            value={pageSize}
            onChange={(e) => {
              setPage(0);
              setPageSize(parseInt(e.target.value, 10));
            }}
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <Button secondary onClick={clearFilters}>
          Clear
        </Button>
      </div>

      <div className="text-[13px] opacity-70">
        {data ? `${data.total} user${data.total === 1 ? '' : 's'}` : ''}
      </div>

      {isLoading && !data ? (
        <LoadingComponent />
      ) : error ? (
        <div className="text-red-400">Failed to load users.</div>
      ) : !data || data.items.length === 0 ? (
        <div className="opacity-70">No users match these filters.</div>
      ) : (
        <div className="border border-newTableBorder rounded-[8px] overflow-x-auto">
          <div className="min-w-[1100px]">
            <div
              className={`grid ${COLUMNS} gap-[12px] px-[12px] py-[10px] bg-newBgColorInner text-[12px] uppercase opacity-70 border-b border-newTableBorder`}
            >
              <div>User</div>
              <div>Plan</div>
              <div>Status</div>
              <div>Last online</div>
              <div>Joined</div>
              <div className="text-right">Actions</div>
            </div>
            {data.items.map((u) => {
              const org = primaryOrg(u);
              const isSelf = u.id === currentUser?.id;
              return (
                <div
                  key={u.id}
                  className={`grid ${COLUMNS} gap-[12px] px-[12px] py-[10px] text-[13px] border-b border-newTableBorder last:border-b-0 items-center ${
                    u.activated ? '' : 'bg-red-500/5'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-[600] truncate">
                      {fullName(u) || '(no name)'}
                      {u.isSuperAdmin && (
                        <span className="ml-[6px]">
                          <Pill tone="purple">Admin</Pill>
                        </span>
                      )}
                    </div>
                    <div className="opacity-70 text-[12px] truncate">
                      {u.email}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <Pill tone={org?.tier === 'FREE' || !org ? 'gray' : 'blue'}>
                      {planLabel(org)}
                    </Pill>
                    <div className="opacity-60 text-[12px] truncate mt-[2px]">
                      {org?.orgName}
                      {u.orgs.length > 1 ? ` +${u.orgs.length - 1} more` : ''}
                    </div>
                  </div>
                  <div>
                    <Pill tone={u.activated ? 'green' : 'red'}>
                      {u.activated ? 'Active' : 'Banned'}
                    </Pill>
                  </div>
                  <div title={new Date(u.lastOnline).toLocaleString()}>
                    {relativeTime(u.lastOnline)}
                  </div>
                  <div title={new Date(u.createdAt).toLocaleString()}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex gap-[6px] justify-end flex-wrap">
                    <Button secondary onClick={() => openDetails(u)}>
                      Details
                    </Button>
                    <Button secondary onClick={() => openEdit(u)}>
                      Edit
                    </Button>
                    <Button secondary onClick={() => openPlan(u)}>
                      Plan
                    </Button>
                    <Button
                      secondary
                      disabled={isSelf || !org}
                      onClick={() => doImpersonate(u)}
                    >
                      Impersonate
                    </Button>
                    <Button
                      disabled={isSelf}
                      className={u.activated ? '!bg-red-700' : ''}
                      onClick={() => toggleBan(u)}
                    >
                      {u.activated ? 'Ban' : 'Unban'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-[13px] opacity-70">
          Page {page + 1} of {totalPages}
        </div>
        <div className="flex gap-[8px]">
          <Button
            secondary
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Button disabled={!data?.hasMore} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
