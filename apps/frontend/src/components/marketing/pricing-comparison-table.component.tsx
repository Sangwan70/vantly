import { MARKETING_TIERS } from '@gitroom/frontend/components/marketing/pricing-tiers';

const CheckOrDash = ({ value }: { value: boolean }) =>
  value ? (
    <span className="text-ai">&#10003;</span>
  ) : (
    <span className="text-gray">&mdash;</span>
  );

export const PricingComparisonTable = () => {
  const rows: {
    label: string;
    values: (string | boolean)[];
  }[] = [
    {
      label: 'Connected channels',
      values: MARKETING_TIERS.map((t) => `${t.channels}`),
    },
    {
      label: 'Scheduled posts',
      values: MARKETING_TIERS.map(() => 'Unlimited'),
    },
    {
      label: 'Team members',
      values: MARKETING_TIERS.map((t) => t.teamMembers),
    },
    {
      label: 'Auto-posting',
      values: MARKETING_TIERS.map((t) => t.autoPost),
    },
    {
      label: 'Community features',
      values: MARKETING_TIERS.map((t) => t.communityFeatures),
    },
    {
      label: 'AI image generations / mo',
      values: MARKETING_TIERS.map((t) => `${t.imageGenerations}`),
    },
    {
      label: 'AI video generations / mo',
      values: MARKETING_TIERS.map((t) => `${t.videoGenerations}`),
    },
    {
      label: 'YouTube Optimizer AI suggestions / mo',
      values: MARKETING_TIERS.map((t) => `${t.youtubeAiSuggestions}`),
    },
    {
      label: 'Public API access',
      values: MARKETING_TIERS.map(() => true),
    },
    {
      label: 'Webhooks',
      values: MARKETING_TIERS.map((t) => `${t.webhooks}`),
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
            {MARKETING_TIERS.map((tier) => (
              <th
                key={tier.key}
                className="text-center py-[14px] px-[12px] font-[600] text-textColor"
              >
                {tier.name}
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
                  key={MARKETING_TIERS[index].key}
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
