import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { faqItems } from '../content/faqData';

export const FAQ = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="duvidas" className="py-16 md:py-20 bg-primary-beige">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl md:text-5xl font-medium leading-tight text-primary-brown mb-16 text-center font-serif">
          Perguntas Frequentes
        </h2>

        <div className="space-y-4">
          {faqItems.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className={`bg-primary-white rounded-2xl border transition-colors ${isOpen ? 'border-primary-brown border-opacity-30' : 'border-border-gray hover:border-primary-brown/20'}`}
              >
                <button
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  aria-controls={`faq-answer-${idx}`}
                  className="flex items-center justify-between w-full p-6 md:p-8 text-left focus:outline-none"
                >
                  <span className="text-lg text-primary-brown font-medium pr-6">{item.q}</span>
                  {isOpen ? (
                    <ChevronUp size={24} className="text-soft-green flex-shrink-0" />
                  ) : (
                    <ChevronDown size={24} className="text-soft-green flex-shrink-0" />
                  )}
                </button>
                <div
                  id={`faq-answer-${idx}`}
                  aria-hidden={!isOpen}
                  className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 md:px-8 pb-6 md:pb-8 text-secondary-green text-lg leading-relaxed pt-2 whitespace-pre-wrap">
                      {item.a}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
