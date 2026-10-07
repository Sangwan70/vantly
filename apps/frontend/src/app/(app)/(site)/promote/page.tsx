export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { Promote } from '@gitroom/frontend/components/promote/promote.component';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Vantly' : 'Gitroom'} Promote`,
  description: '',
};
export default async function Index() {
  return <Promote />;
}
