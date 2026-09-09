export const dynamic = 'force-dynamic';
import { AdminPaymentGatewayComponent } from '@gitroom/frontend/components/admin/admin-payment-gateway.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Vantly' : 'Gitroom'} Admin Payment Gateway`,
  description: '',
};

export default async function Page() {
  return (
    <div className="bg-newBgColorInner flex-1 min-w-0 flex-col flex p-[20px] gap-[12px]">
      <AdminPaymentGatewayComponent />
    </div>
  );
}
