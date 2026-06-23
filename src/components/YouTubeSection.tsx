import React from 'react';
import { Youtube } from 'lucide-react';

export const YouTubeSection = () => {
  return (
    <section className="py-16 md:py-24 bg-primary-beige/30 border-t border-border-gray/30">
      <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary-beige border border-border-gray/50 mb-6 shadow-sm">
            <Youtube size={28} strokeWidth={1.5} className="text-accent-copper" />
          </div>
          
          <h2 className="text-3xl md:text-4xl font-serif text-primary-brown mb-4 font-normal">
            Conteúdo para entender melhor a halitose
          </h2>
          
          <p className="text-lg md:text-xl text-primary-brown/90 mb-6 font-medium">
            A Dra. Karyne também produz conteúdos educativos sobre mau hálito, saúde bucal e diagnóstico da halitose.
          </p>
          
          <p className="text-base md:text-lg text-secondary-green leading-relaxed mb-8">
            No canal, você encontra explicações em linguagem acessível sobre as possíveis causas do mau hálito, avaliação clínica, saliva, hábitos e cuidados relacionados à halitose.
          </p>
          
          <a 
            href="https://www.youtube.com/@KaryneMagalhaes"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border border-primary-brown/20 bg-primary-white text-primary-brown font-medium hover:bg-primary-beige hover:border-primary-brown/30 transition-all shadow-sm w-full sm:w-auto"
          >
            <Youtube size={20} className="text-accent-copper" />
            Conhecer o canal no YouTube
          </a>
        </div>
        
        <div className="w-full aspect-video rounded-2xl overflow-hidden shadow-lg border border-border-gray/50">
          <iframe 
            className="w-full h-full"
            src="https://www.youtube.com/embed/w4e5FCo5y5A?si=11Do_eAVhqxV0upa" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            loading="lazy"
            allowFullScreen
          ></iframe>
        </div>
      </div>
    </section>
  );
};

