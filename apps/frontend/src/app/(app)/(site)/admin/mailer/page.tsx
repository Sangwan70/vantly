export const dynamic = 'force-dynamic';
import { MailerAdminComponent } from '@gitroom/frontend/components/admin/mailer-admin.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Vantly' : 'Gitroom'} Admin Mailer`,
  description: '',
};

export default async function Page() {
  return <MailerAdminComponent />;
}
