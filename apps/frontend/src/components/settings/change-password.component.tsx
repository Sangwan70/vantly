'use client';

import React, { useCallback, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { classValidatorResolver } from '@hookform/resolvers/class-validator';
import { ChangePasswordDto } from '@gitroom/nestjs-libraries/dtos/users/change-password.dto';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const ChangePasswordComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toast = useToaster();
  const resolver = useMemo(
    () => classValidatorResolver(ChangePasswordDto),
    []
  );
  const form = useForm({ resolver });

  const submit = useCallback(async (val: any) => {
    const response = await fetch('/user/change-password', {
      method: 'POST',
      body: JSON.stringify(val),
    });

    if (!response.ok) {
      const { message } = await response
        .json()
        .catch(() => ({ message: undefined }));
      toast.show(
        message || t('password_change_failed', 'Could not change password'),
        'warning'
      );
      return;
    }

    form.reset({ oldPassword: '', password: '', repeatPassword: '' });
    toast.show(t('password_updated', 'Password updated'), 'success');
  }, []);

  return (
    <div className="flex flex-col gap-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
      <h3 className="text-[20px]">
        {t('change_password', 'Change Password')}
      </h3>
      <FormProvider {...form}>
        <form
          onSubmit={form.handleSubmit(submit)}
          className="flex flex-col gap-[16px]"
        >
          <Input
            label={t('current_password', 'Current Password')}
            name="oldPassword"
            type="password"
            placeholder=""
            autoComplete="current-password"
          />
          <Input
            label={t('new_password', 'New Password')}
            name="password"
            type="password"
            placeholder=""
            autoComplete="new-password"
          />
          <Input
            label={t('repeat_new_password', 'Repeat New Password')}
            name="repeatPassword"
            type="password"
            placeholder=""
            autoComplete="new-password"
          />
          <div>
            <Button type="submit">
              {t('update_password', 'Update Password')}
            </Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
};
