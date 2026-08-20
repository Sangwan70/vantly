import Link from 'next/link';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';

export const MarketingFooter = () => {
  return (
    <footer className="border-t border-fifth">
      <div className="max-w-[1200px] mx-auto px-[20px] py-[48px] flex flex-col gap-[32px]">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-[24px]">
          <Link href="/" className="flex items-center text-textColor">
            <LogoTextComponent />
          </Link>
          <nav className="flex flex-wrap items-center gap-x-[24px] gap-y-[8px] text-[13px] text-gray">
            <Link href="/#features" className="hover:text-textColor transition-colors">
              Features
            </Link>
            <Link href="/pricing" className="hover:text-textColor transition-colors">
              Pricing
            </Link>
            <Link href="/privacy" className="hover:text-textColor transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-textColor transition-colors">
              Terms of Service
            </Link>
            <a href="mailto:we@vantly.social" className="hover:text-textColor transition-colors">
              we@vantly.social
            </a>
          </nav>
        </div>
        <p className="text-[13px] text-gray">
          &copy; {new Date().getFullYear()} Vantly. All rights reserved.
        </p>
      </div>
    </footer>
  );
};
