import { Instagram, Youtube } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="bg-primary-brown text-primary-beige py-16 border-t border-accent-copper/20">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-12">
        <div className="flex flex-col gap-2">
          <span className="font-serif text-2xl font-medium tracking-wide text-primary-white">
            Dra. Karyne Magalhães
          </span>
          <span className="text-sm tracking-widest uppercase text-soft-green mb-4">
            Especialista em Halitose
          </span>
          <p className="text-primary-beige/80 text-sm">CRO-GO 7954</p>
          <p className="text-primary-beige/80 text-sm mt-4">
            Atendimento presencial em Goiânia
          </p>
          <p className="text-primary-beige/80 text-sm leading-relaxed mt-2 max-w-xs">
            Rua Terezina, 40, Ed. Essenciale Premier, Sala 701<br/>
            Alto da Glória, Goiânia - GO<br/>
            CEP 74815-715, Brasil
          </p>
        </div>

        <div className="flex flex-col md:items-end justify-between gap-8">
          <div className="flex gap-6">
            <a 
              href="https://www.instagram.com/dra.karynemagalhaes/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-beige/80 hover:text-primary-white transition-colors flex items-center gap-2 group"
              aria-label="Instagram da Dra. Karyne Magalhães"
            >
              <Instagram strokeWidth={1.5} className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
              <span className="text-sm scale-90 md:scale-100">@dra.karynemagalhaes</span>
            </a>
            <a 
              href="https://www.youtube.com/@KaryneMagalhaes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-beige/80 hover:text-primary-white transition-colors flex items-center gap-2 group"
              aria-label="YouTube da Dra. Karyne Magalhães"
            >
              <Youtube strokeWidth={1.5} className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
              <span className="text-sm scale-90 md:scale-100">YouTube</span>
            </a>
          </div>
          
          <div className="flex gap-6">
            <a href="/politica-de-privacidade" className="text-primary-beige/80 hover:text-primary-white transition-colors text-sm">
              Política de Privacidade
            </a>
          </div>
          
          <div className="flex flex-col gap-2 md:text-right text-xs text-primary-beige/40">
            <p>© {new Date().getFullYear()} Dra. Karyne Magalhães. Todos os direitos reservados.</p>
            <p>
              Desenvolvido por{' '}
              <a href="https://wa.me/5562999465725" target="_blank" rel="noopener noreferrer" className="hover:text-primary-white transition-colors underline underline-offset-2">
                Flávio Corá
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
