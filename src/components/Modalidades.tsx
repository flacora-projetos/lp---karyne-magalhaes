import { Star } from "lucide-react";

export const Modalidades = ({ directToWhatsapp = false }: { directToWhatsapp?: boolean }) => {
  return (
    <section className="py-16 md:py-20 bg-primary-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          <div className="flex flex-col gap-8">
            <h2 className="text-3xl md:text-4xl font-medium leading-tight text-primary-brown text-balance mb-4">
              Duas formas de avaliar — uma delas investiga mais a fundo.
            </h2>

            <div className="flex flex-col gap-8">
              {/* Recomendada: avaliação completa */}
              <div className="relative bg-primary-brown p-8 md:p-10 rounded-2xl ring-2 ring-accent-copper shadow-lg flex flex-col gap-5">
                <span className="absolute -top-3 left-8 inline-flex items-center gap-1.5 bg-accent-copper text-primary-white text-xs md:text-[13px] font-medium tracking-wide px-3 py-1.5 rounded-full shadow-sm">
                  <Star strokeWidth={2} aria-hidden="true" className="w-3.5 h-3.5 fill-current" />
                  Avaliação mais completa · Recomendada
                </span>

                <div>
                  <h3 className="text-2xl md:text-[28px] font-serif text-primary-beige leading-tight text-balance mb-3">
                    OralChroma + Desafio da Cisteína
                  </h3>
                  <p className="text-primary-white/85 text-lg leading-relaxed text-pretty">
                    Além da medição inicial dos gases, o Desafio da Cisteína avalia o potencial de produção do mau hálito. Isso permite uma investigação mais aprofundada mesmo quando o odor oscila, aparece só em alguns momentos ou não está evidente no dia da consulta.
                  </p>
                </div>

                <p className="text-primary-white/70 text-[15px] leading-relaxed text-pretty border-l-2 border-accent-copper/60 pl-4">
                  É o protocolo com o qual a Dra.&nbsp;Karyne tem maior experiência e especialização, aplicado na sua rotina clínica e no curso que coordena para outros profissionais.
                </p>

                <p className="text-sm text-primary-white/60 font-medium">Duração aproximada: 2&nbsp;horas.</p>
              </div>

              {/* Alternativa mais simples */}
              <div className="bg-primary-white p-6 rounded-2xl border border-border-gray flex flex-col gap-3">
                <p className="text-xs uppercase tracking-wider text-secondary-green font-medium">Alternativa mais simples</p>
                <div>
                  <h3 className="text-xl font-serif text-primary-brown mb-2">OralChroma</h3>
                  <p className="text-secondary-green text-base leading-relaxed text-pretty">
                    Mede os gases do hálito no momento da avaliação. Indicado quando o odor costuma estar presente com mais frequência e já se manifesta no dia da consulta.
                  </p>
                </div>
                <p className="text-sm text-secondary-green/80 font-medium">Duração aproximada: 2&nbsp;horas.</p>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={() => window.openQualificationModal?.()}
                className="bg-primary-green hover:bg-secondary-green text-primary-white px-8 py-4 rounded-full text-base font-medium transition-colors w-full sm:w-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-copper focus-visible:ring-offset-2 focus-visible:ring-offset-primary-white"
              >
                {directToWhatsapp ? 'Agendar pelo WhatsApp' : 'Ver as opções e agendar'}
              </button>
            </div>
          </div>

          <div className="relative">
            <img
              src="/images/oralchroma_equipamento.jpg"
              alt="Máquina de Cromatografia OralChroma"
              loading="lazy"
              className="w-full h-auto object-cover rounded-2xl shadow-sm border border-border-gray"
            />
            <div className="absolute -bottom-8 -left-8 hidden md:block w-48 h-48 border-[6px] border-primary-white rounded-2xl overflow-hidden shadow-sm">
              <img
                src="/images/oralchroma_detalhe.jpg"
                alt="Detalhe do OralChroma"
                loading="lazy"
                className="w-full h-full object-cover bg-primary-white"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
