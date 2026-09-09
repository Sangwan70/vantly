export const dynamic = 'force-dynamic';
import { AdminContentComponent } from '@gitroom/frontend/components/admin/admin-content.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Vantly' : 'Gitroom'} Admin Content`,
  description: '',
};

export default async function Page() {
  return <AdminContentComponent />;
}
