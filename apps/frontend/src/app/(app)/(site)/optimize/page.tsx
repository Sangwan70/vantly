export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { YoutubeOptimizer } from '@gitroom/frontend/components/youtube-optimizer/youtube.optimizer';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Vantly' : 'Gitroom'} Optimize`,
  description: '',
};
export default async function Index() {
  return <YoutubeOptimizer />;
}
