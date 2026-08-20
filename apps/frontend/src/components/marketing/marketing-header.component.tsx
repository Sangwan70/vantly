import Link from 'next/link';
import { LogoTextComponent } from '@gitroom/frontend/components/ui/logo-text.component';

export const MarketingHeader = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-fifth bg-primary/80 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-[20px] h-[68px] flex items-center justify-between">
        <Link href="/" className="flex items-center text-textColor shrink-0">
          <LogoTextComponent />
        </Link>
        <nav className="hidden md:flex items-center gap-[32px] text-[14px] font-[500] text-textColor/70">
          <Link href="/#features" className="hover:text-textColor transition-colors">
            Features
          </Link>
          <Link href="/#platforms" className="hover:text-textColor transition-colors">
            Platforms
          </Link>
          <Link href="/pricing" className="hover:text-textColor transition-colors">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-textColor transition-colors">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-[8px] md:gap-[12px]">
          <Link
            href="/auth/login"
            className="text-[14px] font-[500] text-textColor/80 hover:text-textColor px-[10px] md:px-[12px] py-[8px] transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/auth"
            className="text-[14px] font-[600] bg-btnPrimary text-white rounded-[8px] px-[14px] md:px-[16px] py-[10px] hover:opacity-90 transition-opacity"
          >
            Get started free
          </Link>
        </div>
      </div>
    </header>
  );
};
