import {
  continueAsNew,
  proxyActivities,
  sleep,
} from '@temporalio/workflow';
import { PromoteActivity } from '@gitroom/orchestrator/activities/promote.activity';

const { syncCompetitor } = proxyActivities<PromoteActivity>({
  startToCloseTimeout: '5 minute',
  retry: {
    maximumAttempts: 3,
    backoffCoefficient: 2,
    initialInterval: '1 minute',
  },
});

// One long-lived workflow per tracked competitor: the first snapshot is taken
// when the competitor is added, so this sleeps first, then snapshots daily.
// Ends itself when the competitor is removed.
export async function promoteSyncWorkflow({
  competitorId,
}: {
  competitorId: string;
}) {
  for (let i = 0; i < 30; i++) {
    await sleep('24 hours');
    const keepGoing = await syncCompetitor(competitorId);
    if (!keepGoing) {
      return false;
    }
  }
  // Keep workflow history bounded.
  await continueAsNew<typeof promoteSyncWorkflow>({ competitorId });
}
