import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { label: 'A consulta', href: '#consulta' },
    { label: 'Como funciona', href: '#como-funciona' },
    { label: 'Sobre', href: '#sobre' },
    { label: 'Dúvidas', href: '#duvidas' },
    { label: 'Localização', href: '#localizacao' },
  ];

  return (
    <header className="fixed top-0 w-full bg-primary-beige z-50 border-b border-border-gray">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex flex-col">
          <span className="font-serif text-lg font-medium tracking-wide">Dra. Karyne Magalhães</span>
          <span className="text-xs text-soft-green tracking-wider uppercase">Especialista em Halitose</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a key={link.label} href={link.href} className="text-sm text-secondary-green hover:text-primary-brown transition-colors">
              {link.label}
            </a>
          ))}
          <button 
            onClick={() => window.openQualificationModal?.()}
            className="bg-primary-green text-primary-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-secondary-green transition-colors"
          >
            Fazer avaliação inicial (2 min)
          </button>
        </nav>

        {/* Mobile Toggle */}
        <button className="md:hidden p-2 text-primary-brown" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden bg-primary-beige absolute top-20 left-0 w-full border-b border-border-gray p-6 flex flex-col gap-6 shadow-lg">
          {links.map((link) => (
            <a 
              key={link.label} 
              href={link.href} 
              className="text-base text-secondary-green hover:text-primary-brown"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <button 
            onClick={() => {
              window.openQualificationModal?.();
              setIsOpen(false);
            }}
            className="bg-primary-green text-primary-white px-6 py-3 rounded-full text-sm font-medium w-full mt-2"
          >
            Fazer avaliação inicial (2 min)
          </button>
        </div>
      )}
    </header>
  );
};
