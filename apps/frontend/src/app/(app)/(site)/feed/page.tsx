export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { YoutubeFeed } from '@gitroom/frontend/components/youtube-optimizer/youtube.feed';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';
export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Vantly' : 'Gitroom'} Feed`,
  description: '',
};
export default async function Index() {
  return <YoutubeFeed />;
}
