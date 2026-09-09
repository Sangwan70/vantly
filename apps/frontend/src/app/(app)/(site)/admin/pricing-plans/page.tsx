export const dynamic = 'force-dynamic';
import { AdminPricingPlansComponent } from '@gitroom/frontend/components/admin/admin-pricing-plans.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Vantly' : 'Gitroom'} Admin Plans & Pricing`,
  description: '',
};

export default async function Page() {
  return (
    <div className="bg-newBgColorInner flex-1 min-w-0 flex-col flex p-[20px] gap-[12px]">
      <AdminPricingPlansComponent />
    </div>
  );
}
