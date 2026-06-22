import { BadgeCheck, Clock, GraduationCap, Users } from "lucide-react";

export const DraKaryne = () => {
  return (
    <section id="sobre" className="py-16 md:py-20 bg-primary-white">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        
        <div className="order-2 md:order-1 flex gap-6 relative">
          <div className="w-1/2 flex flex-col justify-end">
            <img 
              src="https://lh3.googleusercontent.com/d/1sfkIsrKqxvF7oTnkkCPmEFhGplIV51iK" 
              alt="Dra. Karyne em formação e conteúdo" 
              className="w-full h-auto aspect-[3/4] object-cover rounded-2xl shadow-sm border border-border-gray/50 mb-8"
            />
          </div>
          <div className="w-1/2 flex flex-col justify-start">
            <img 
              src="https://lh3.googleusercontent.com/d/1gwopE6RKc1mdWo-mqBjt1_WG_8-XrJxM" 
              alt="Dra. Karyne Magalhães - Especialista" 
              className="w-full h-auto aspect-[3/4] object-cover rounded-2xl shadow-sm border border-border-gray/50 mt-12"
            />
          </div>
        </div>

        <div className="order-1 md:order-2 flex flex-col justify-center">
          <h2 className="text-3xl md:text-5xl font-medium leading-tight text-primary-brown mb-8 font-serif">
            Experiência clínica e formação específica em Halitose.
          </h2>
          
          <div className="space-y-6 text-lg text-secondary-green leading-relaxed mb-10">
            <p>
              Graduada em Odontologia pela Universidade de Uberaba em 2004, a Dra. Karyne Magalhães é especialista em Halitose e em Prótese Dentária, com qualificação específica no diagnóstico e tratamento das alterações do hálito e das disfunções salivares.
            </p>
            <p>
              Além da atuação clínica, é coordenadora e professora do curso “Reconhecendo e tratando o mau hálito” e integra a Associação Brasileira de Halitose como membro e conselheira.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            <div className="flex items-start gap-3 p-4 bg-primary-beige/30 border border-border-gray/50 rounded-xl">
              <BadgeCheck strokeWidth={1.5} className="w-5 h-5 text-accent-copper shrink-0 mt-0.5" />
              <span className="text-sm text-primary-brown font-medium leading-snug">Especialista em Halitose</span>
            </div>
            <div className="flex items-start gap-3 p-4 bg-primary-beige/30 border border-border-gray/50 rounded-xl">
              <Clock strokeWidth={1.5} className="w-5 h-5 text-accent-copper shrink-0 mt-0.5" />
              <span className="text-sm text-primary-brown font-medium leading-snug">Atuação clínica desde 2004</span>
            </div>
            <div className="flex items-start gap-3 p-4 bg-primary-beige/30 border border-border-gray/50 rounded-xl">
              <GraduationCap strokeWidth={1.5} className="w-5 h-5 text-accent-copper shrink-0 mt-0.5" />
              <span className="text-sm text-primary-brown font-medium leading-snug">Professora e coordenadora de formação profissional</span>
            </div>
            <div className="flex items-start gap-3 p-4 bg-primary-beige/30 border border-border-gray/50 rounded-xl">
              <Users strokeWidth={1.5} className="w-5 h-5 text-accent-copper shrink-0 mt-0.5" />
              <span className="text-sm text-primary-brown font-medium leading-snug">Conselheira da Associação Brasileira de Halitose</span>
            </div>
          </div>

          <div className="pt-6 border-t border-border-gray">
            <p className="text-xl text-primary-brown font-serif font-medium">Dra. Karyne Magalhães</p>
            <p className="text-soft-green tracking-wide mt-1 uppercase text-sm">CRO-GO 7954</p>
          </div>
        </div>
        
      </div>
    </section>
  );
};
