import { MarketingPricingPlan } from '@gitroom/frontend/lib/billing/get-pricing-plans-marketing';

const CheckOrDash = ({ value }: { value: boolean }) =>
  value ? (
    <span className="text-ai">&#10003;</span>
  ) : (
    <span className="text-gray">&mdash;</span>
  );

// `plans` comes from the server component (pricing/page.tsx) via
// getMarketingPricingPlans() - same data source as PricingCards, so the
// two never drift from each other the way the old hand-maintained
// MARKETING_TIERS mirror could.
export const PricingComparisonTable = ({
  plans,
}: {
  plans: MarketingPricingPlan[];
}) => {
  const rows: {
    label: string;
    values: (string | boolean)[];
  }[] = [
    {
      label: 'Connected channels',
      values: plans.map((t) => `${t.channel}`),
    },
    {
      label: 'Scheduled posts',
      values: plans.map(() => 'Unlimited'),
    },
    {
      label: 'Team members',
      values: plans.map((t) => t.teamMembers),
    },
    {
      label: 'Auto-posting',
      values: plans.map((t) => t.autoPost),
    },
    {
      label: 'Community features',
      values: plans.map((t) => t.communityFeatures),
    },
    {
      label: 'AI image generations / mo',
      values: plans.map((t) => `${t.imageGenerationCount}`),
    },
    {
      label: 'AI video generations / mo',
      values: plans.map((t) => `${t.generateVideos}`),
    },
    {
      label: 'YouTube Optimizer AI suggestions / mo',
      values: plans.map((t) => `${t.youtubeTextSuggestions}`),
    },
    {
      label: 'Public API access',
      values: plans.map((t) => t.publicApi),
    },
    {
      label: 'Webhooks',
      values: plans.map((t) => `${t.webhooks}`),
    },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-fifth">
            <th className="text-left py-[14px] px-[12px] font-[500] text-gray">
              Feature
            </th>
            {plans.map((tier) => (
              <th
                key={tier.tier}
                className="text-center py-[14px] px-[12px] font-[600] text-textColor"
              >
                {tier.displayName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-fifth/60">
              <td className="text-left py-[12px] px-[12px] text-textColor/75">
                {row.label}
              </td>
              {row.values.map((value, index) => (
                <td
                  key={plans[index].tier}
                  className="text-center py-[12px] px-[12px] text-textColor/90"
                >
                  {typeof value === 'boolean' ? (
                    <CheckOrDash value={value} />
                  ) : (
                    value
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
