import React, { useRef, useState } from 'react';
import { Menu, X } from 'lucide-react';

export const Header = ({ directToWhatsapp = false }: { directToWhatsapp?: boolean }) => {
  const [isOpen, setIsOpen] = useState(false);
  const mobileToggle = useRef<HTMLButtonElement>(null);

  const links = [
    { label: 'A consulta', href: '#consulta' },
    { label: 'Como funciona', href: '#como-funciona' },
    { label: 'Sobre', href: '#sobre' },
    { label: 'Dúvidas', href: '#duvidas' },
    { label: 'Localização', href: '#localizacao' },
  ];

  return (
    <header onKeyDown={(event) => {
      if (event.key !== 'Escape' || !isOpen || event.defaultPrevented) return;
      event.preventDefault();
      setIsOpen(false);
      mobileToggle.current?.focus();
    }} className="fixed top-0 w-full bg-primary-beige z-50 border-b border-border-gray">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-serif text-lg font-medium tracking-wide">Dra. Karyne Magalhães</span>
          <span className="text-xs text-soft-green tracking-wider uppercase">Especialista em Halitose</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a key={link.label} href={link.href} data-ga-event="clique_navegacao" data-ga-destino={link.href.slice(1)} data-ga-local="menu_desktop" className="text-sm text-secondary-green hover:text-primary-brown transition-colors">
              {link.label}
            </a>
          ))}
          <button 
            onClick={() => window.openQualificationModal?.('menu_desktop')}
            className="bg-primary-green text-primary-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-secondary-green transition-colors"
          >
            {directToWhatsapp ? 'Falar pelo WhatsApp' : 'Fazer avaliação inicial (2 min)'}
          </button>
        </nav>

        {/* Mobile Toggle */}
        <button
          ref={mobileToggle}
          type="button"
          className="md:hidden p-2 text-primary-brown"
          aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={isOpen}
          aria-controls="mobile-navigation"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      <nav
        id="mobile-navigation"
        aria-label="Menu principal"
        className={isOpen ? 'md:hidden bg-primary-beige absolute top-20 left-0 w-full border-b border-border-gray p-6 flex flex-col gap-6 shadow-lg' : 'hidden'}
      >
          {links.map((link) => (
            <a 
              key={link.label} 
              href={link.href} 
              data-ga-event="clique_navegacao" data-ga-destino={link.href.slice(1)} data-ga-local="menu_mobile"
              className="text-base text-secondary-green hover:text-primary-brown"
              onClick={() => {
                setIsOpen(false);
                const section = document.getElementById(link.href.slice(1));
                if (section) {
                  section.tabIndex = -1;
                  section.focus({ preventScroll: true });
                }
              }}
            >
              {link.label}
            </a>
          ))}
          <button 
            onClick={() => {
              mobileToggle.current?.focus();
              window.openQualificationModal?.('menu_mobile');
              setIsOpen(false);
            }}
            className="bg-primary-green text-primary-white px-6 py-3 rounded-full text-sm font-medium w-full mt-2"
          >
            {directToWhatsapp ? 'Falar pelo WhatsApp' : 'Fazer avaliação inicial (2 min)'}
          </button>
      </nav>
    </header>
  );
};
