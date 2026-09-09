'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useToaster } from '@gitroom/react/toaster/toaster';

// Impersonate/Ban/Switch-user, moved here from the always-on top bar
// (impersonate.tsx) now that Admin Panel -> Users is the dedicated home
// for them - see impersonate.tsx's own doc comment on why the "Currently
// Impersonating" bar itself stays put instead of moving here too. SwitchUser
// is exported and re-imported by impersonate.tsx, which still needs it
// inside that kept bar - single source of truth, not a copy.

export const ImpersonateUserSearch: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    if (!name) {
      return [];
    }
    return await (await fetch(`/user/impersonate?name=${name}`)).json();
  }, [name]);

  const { data } = useSWR(`/admin-users-impersonate-${name}`, load, {
    refreshWhenHidden: false,
    revalidateOnMount: true,
    revalidateOnReconnect: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    revalidateIfStale: false,
    refreshInterval: 0,
  });

  const mapData = useMemo(() => {
    return data?.map((curr: any) => ({
      id: curr?.id,
      name: curr?.user?.name,
      email: curr?.user?.email,
      orgName: curr?.organization?.name,
      role: curr?.role,
      tier: curr?.organization?.subscription?.subscriptionTier || 'FREE',
    }));
  }, [data]);

  const setUser = useCallback(
    (userId: string) => async () => {
      await fetch(`/user/impersonate`, {
        method: 'POST',
        body: JSON.stringify({ id: userId }),
      });
      window.location.reload();
    },
    []
  );

  return (
    <div className="relative">
      <Input
        autoComplete="off"
        placeholder={t('write_the_user_details', 'Write the user details')}
        name="impersonate"
        disableForm={true}
        label=""
        removeError={true}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      {!!data?.length && (
        <>
          <div
            className="bg-primary/80 fixed start-0 top-0 w-full h-full z-[998]"
            onClick={() => setName('')}
          />
          <div className="absolute top-[100%] w-max min-w-full max-w-[90vw] start-0 bg-sixth border border-customColor6 text-textColor z-[999]">
            {mapData?.map((user: any) => (
              <div
                onClick={setUser(user?.id)}
                key={user?.id}
                className="p-[10px] border-b border-customColor6 hover:bg-tableBorder cursor-pointer whitespace-nowrap truncate"
              >
                {t('user_1', 'user:')}
                {user?.id?.split('-')?.at(-1)} - {user?.name} - {user?.email}{' '}
                - {user?.orgName} ({user?.role} / {user?.tier})
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const BanUser: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const currentUser = useUser();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    email: string;
    activated: boolean;
  } | null>(null);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!name) {
      return [];
    }
    return await (await fetch(`/user/impersonate?name=${name}`)).json();
  }, [name]);

  const { data } = useSWR(`/ban-search-${name}`, load, {
    refreshWhenHidden: false,
    revalidateOnMount: true,
    revalidateOnReconnect: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    revalidateIfStale: false,
    refreshInterval: 0,
  });

  const mapData = useMemo(() => {
    // one row per user, dedupe by user id, drop the requesting admin
    const seen = new Set<string>();
    return (data || [])
      .filter((curr: any) => curr?.user?.id !== currentUser?.id)
      .filter((curr: any) => {
        if (seen.has(curr?.user?.id)) {
          return false;
        }
        seen.add(curr?.user?.id);
        return true;
      })
      .map((curr: any) => ({
        id: curr?.user?.id,
        name: curr?.user?.name,
        email: curr?.user?.email,
        activated: curr?.user?.activated !== false,
      }));
  }, [data, currentUser?.id]);

  const pick = useCallback(
    (item: {
      id: string;
      name: string;
      email: string;
      activated: boolean;
    }) => () => {
      setSelected(item);
      setName('');
    },
    []
  );

  const toggleBan = useCallback(async () => {
    if (!selected) {
      return;
    }
    const willBan = selected.activated;
    if (
      !(await deleteDialog(
        willBan
          ? t(
              'ban_user_confirm',
              `This will immediately block ${selected.email} from logging in. It does not delete any data and can be reversed at any time.`
            )
          : t(
              'unban_user_confirm',
              `This will restore login access for ${selected.email}.`
            ),
        willBan ? t('yes_ban', 'Yes, ban') : t('yes_unban', 'Yes, unban'),
        willBan ? t('ban_user_title', 'Ban User?') : t('unban_user_title', 'Unban User?'),
        t('no_cancel', 'No, cancel')
      ))
    ) {
      return;
    }
    setWorking(true);
    try {
      const res = await fetch(
        `/admin/users/${selected.id}/${willBan ? 'ban' : 'unban'}`,
        {
          method: 'POST',
        }
      );
      if (!res.ok) {
        throw new Error(await res.text().catch(() => ''));
      }
      toaster.show(
        willBan
          ? t('user_banned', 'User banned')
          : t('user_unbanned', 'User unbanned')
      );
      setSelected(null);
    } catch {
      toaster.show(
        t('ban_action_failed', 'The action failed and nothing was changed'),
        'warning'
      );
    } finally {
      setWorking(false);
    }
  }, [selected]);

  return (
    <div className="relative flex items-center gap-[10px]">
      <div className="flex-1 min-w-[220px]">
        <Input
          autoComplete="off"
          placeholder={t('select_user_to_ban', 'Ban/unban a user')}
          name="banUser"
          disableForm={true}
          label=""
          removeError={true}
          value={
            selected
              ? `${selected.name ? `${selected.name} - ` : ''}${selected.email}`
              : name
          }
          onChange={(e) => {
            setSelected(null);
            setName(e.target.value);
          }}
        />
      </div>
      <Button
        onClick={toggleBan}
        loading={working}
        disabled={!selected}
        className={`rounded-[4px] whitespace-nowrap ${
          selected && !selected.activated ? '' : '!bg-red-700'
        }`}
      >
        {selected && !selected.activated
          ? t('unban_user', 'Unban User')
          : t('ban_user', 'Ban User')}
      </Button>
      {!!mapData?.length && !selected && (
        <>
          <div
            className="bg-primary/80 fixed start-0 top-0 w-full h-full z-[998]"
            onClick={() => setName('')}
          />
          <div className="absolute top-[100%] start-0 w-max min-w-full max-w-[90vw] bg-sixth border border-customColor6 text-textColor z-[999]">
            {mapData.map((item: any) => (
              <div
                onClick={pick(item)}
                key={item?.id}
                className="p-[10px] border-b border-customColor6 hover:bg-tableBorder cursor-pointer whitespace-nowrap truncate"
              >
                {t('user_1', 'user:')}
                {item?.id?.split('-')?.at(-1)} -{' '}
                {item?.name ? `${item?.name} - ` : ''}
                {item?.email}
                {!item?.activated &&
                  ` (${t('currently_banned', 'currently banned')})`}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const SwitchUser: FC = () => {
  const fetch = useFetch();
  const t = useT();
  const toaster = useToaster();
  const currentUser = useUser();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [switching, setSwitching] = useState(false);

  const load = useCallback(async () => {
    if (!name) {
      return [];
    }
    return await (await fetch(`/user/impersonate?name=${name}`)).json();
  }, [name]);

  const { data } = useSWR(`/switch-search-${name}`, load, {
    refreshWhenHidden: false,
    revalidateOnMount: true,
    revalidateOnReconnect: false,
    revalidateOnFocus: false,
    refreshWhenOffline: false,
    revalidateIfStale: false,
    refreshInterval: 0,
  });

  const mapData = useMemo(() => {
    // one row per user-organization: dedupe by user id, drop the impersonated user
    const seen = new Set<string>();
    return (data || [])
      .filter((curr: any) => curr?.user?.id !== currentUser?.id)
      .filter((curr: any) => {
        if (seen.has(curr?.user?.id)) {
          return false;
        }
        seen.add(curr?.user?.id);
        return true;
      })
      .map((curr: any) => ({
        id: curr?.user?.id,
        name: curr?.user?.name,
        email: curr?.user?.email,
        orgs: (data || [])
          .filter((org: any) => org?.user?.id === curr?.user?.id)
          .map(
            (org: any) =>
              `${org?.organization?.name} (${org?.role} / ${
                org?.organization?.subscription?.subscriptionTier || 'FREE'
              })`
          )
          .join(', '),
      }));
  }, [data, currentUser?.id]);

  const pick = useCallback(
    (item: { id: string; name: string; email: string }) => () => {
      setSelected(item);
      setName('');
    },
    []
  );

  const doSwitch = useCallback(async () => {
    if (!selected) {
      return;
    }
    if (
      !(await deleteDialog(
        t(
          'switch_user_confirm',
          `This will replace the current account's login with ${selected.email}. All data and the subscription stay with the account — only the login changes, and the new login gains its full access. Switch back to revert.`
        ),
        t('yes_switch', 'Yes, switch'),
        t('switch_user_title', 'Switch User?'),
        t('no_cancel', 'No, cancel')
      ))
    ) {
      return;
    }
    setSwitching(true);
    try {
      const res = await fetch('/user/switch', {
        method: 'POST',
        body: JSON.stringify({ id: selected.id }),
      });
      // customFetch does not throw on HTTP errors
      if (!res.ok) {
        throw new Error(await res.text().catch(() => ''));
      }
      window.location.reload();
    } catch {
      setSwitching(false);
      toaster.show(
        t('switch_user_failed', 'The user switch failed and nothing was changed'),
        'warning'
      );
    }
  }, [selected]);

  return (
    <div className="relative flex items-center gap-[10px]">
      <div className="flex-1 min-w-[220px]">
        <Input
          autoComplete="off"
          placeholder={t('select_user_to_switch_to', 'Select user to switch to')}
          name="switchUser"
          disableForm={true}
          label=""
          removeError={true}
          value={
            selected
              ? `${selected.name ? `${selected.name} - ` : ''}${selected.email}`
              : name
          }
          onChange={(e) => {
            setSelected(null);
            setName(e.target.value);
          }}
        />
      </div>
      <Button
        onClick={doSwitch}
        loading={switching}
        disabled={!selected}
        className="rounded-[4px] whitespace-nowrap"
      >
        {t('switch_user', 'Switch User')}
      </Button>
      {!!mapData?.length && !selected && (
        <>
          <div
            className="bg-primary/80 fixed start-0 top-0 w-full h-full z-[998]"
            onClick={() => setName('')}
          />
          <div className="absolute top-[100%] start-0 w-max min-w-full max-w-[90vw] bg-sixth border border-customColor6 text-textColor z-[999]">
            {mapData.map((item: any) => (
              <div
                onClick={pick(item)}
                key={item?.id}
                className="p-[10px] border-b border-customColor6 hover:bg-tableBorder cursor-pointer whitespace-nowrap truncate"
              >
                {t('user_1', 'user:')}
                {item?.id?.split('-')?.at(-1)} -{' '}
                {item?.name ? `${item?.name} - ` : ''}
                {item?.email}
                {item?.orgs ? ` - ${item?.orgs}` : ''}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export const AdminUsersComponent: FC = () => {
  const user = useUser();

  if (!user?.isSuperAdmin) {
    return (
      <div className="text-textColor p-[20px]">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] text-textColor max-w-[720px]">
      <div className="text-[20px] font-[600]">Users</div>
      <div className="text-[13px] opacity-70">
        Impersonate, ban, or switch the login for any user account. These
        used to live in a toolbar shown at the top of every page - they now
        live here instead, alongside the rest of the Admin Panel.
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[10px]">
        <div className="text-[15px] font-[600]">Impersonate a user</div>
        <div className="text-[12px] opacity-60">
          View the app as this user&apos;s organization. A bar at the top of
          the page shows while impersonating, with a way to stop.
        </div>
        <ImpersonateUserSearch />
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[10px]">
        <div className="text-[15px] font-[600]">Ban / unban a user</div>
        <BanUser />
      </div>

      <div className="border border-newTableBorder rounded-[8px] p-[16px] bg-newBgColorInner flex flex-col gap-[10px]">
        <div className="text-[15px] font-[600]">Switch user login</div>
        <div className="text-[12px] opacity-60">
          Permanently replaces the CURRENT admin login with another user&apos;s
          - different from impersonate above. Confirming shows the full
          warning.
        </div>
        <SwitchUser />
      </div>
    </div>
  );
};
