import { ReactNode } from 'react';
import Link from 'next/link';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';

export const LegalPageLayout = ({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) => {
  return (
    <div className="min-h-screen w-full bg-primary text-textColor">
      <div className="max-w-[760px] mx-auto px-[20px] py-[48px]">
        <Link href="/" className="inline-block mb-[40px]">
          <LogoTextComponent />
        </Link>
        <h1 className="text-[32px] font-[600] -tracking-[0.6px] mb-[8px]">
          {title}
        </h1>
        <p className="text-[13px] text-gray mb-[40px]">
          Last updated: {lastUpdated}
        </p>
        <div className="flex flex-col gap-[24px] text-[14px] leading-[1.7] [&_h2]:text-[18px] [&_h2]:font-[600] [&_h2]:text-textColor [&_h2]:mt-[8px] [&_h2]:mb-[4px] [&_p]:text-textColor/80 [&_li]:text-textColor/80 [&_ul]:list-disc [&_ul]:pl-[20px] [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-[6px] [&_a]:underline [&_a]:hover:font-[600]">
          {children}
        </div>
        <div className="mt-[56px] pt-[24px] border-t border-fifth text-[13px] text-gray">
          <Link href="/privacy" className="underline hover:font-[600]">
            Privacy Policy
          </Link>
          <span className="mx-[10px]">&middot;</span>
          <Link href="/terms" className="underline hover:font-[600]">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
};
