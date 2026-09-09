import { Metadata } from 'next';
import { AdminShellComponent } from '@gitroom/frontend/components/admin/admin-shell.component';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Vantly' : 'Gitroom'} Admin`,
  description: '',
};

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-newBgColorInner flex-1 min-w-0 flex">
      <AdminShellComponent>{children}</AdminShellComponent>
    </div>
  );
}
