'use client';

import { useState } from 'react';
import clsx from 'clsx';

export interface FaqItem {
  question: string;
  answer: string;
}

export const FaqAccordion = ({ items }: { items: FaqItem[] }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <div className="flex flex-col gap-[12px]">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div
            key={item.question}
            className="border border-fifth rounded-[12px] bg-newBgColorInner overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-[16px] text-left px-[20px] py-[18px] text-[15px] font-[600] text-textColor"
            >
              <span>{item.question}</span>
              <span
                className={clsx(
                  'shrink-0 text-[20px] leading-none text-gray transition-transform duration-200',
                  isOpen && 'rotate-45'
                )}
              >
                +
              </span>
            </button>
            <div
              className={clsx(
                'px-[20px] overflow-hidden transition-[max-height] duration-300 ease-in-out',
                isOpen ? 'max-h-[500px] pb-[18px]' : 'max-h-0'
              )}
            >
              <p className="text-[14px] leading-[1.7] text-textColor/70">
                {item.answer}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
