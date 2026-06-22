export const Modalidades = () => {
  return (
    <section className="py-16 md:py-20 bg-primary-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          <div className="flex flex-col gap-8">
            <h2 className="text-3xl md:text-4xl font-medium leading-tight text-primary-brown mb-4">
              Duas formas de avaliar, conforme o comportamento do hálito.
            </h2>
            
            <div className="flex flex-col gap-6">
              <div className="bg-primary-beige p-8 rounded-2xl border border-border-gray flex flex-col gap-4">
                <div>
                  <h3 className="text-2xl font-serif text-primary-brown mb-2">OralChroma</h3>
                  <p className="text-secondary-green text-lg leading-relaxed">
                    Indicado quando o odor costuma estar presente com mais frequência. Mede os gases do hálito no momento da avaliação e ajuda a orientar a investigação clínica.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-soft-green font-medium mb-1">Duração aproximada: 2 horas.</p>
                </div>
              </div>

              <div className="bg-primary-brown p-8 rounded-2xl border border-primary-brown flex flex-col gap-4">
                <div>
                  <h3 className="text-2xl font-serif text-primary-beige mb-2 shadow-sm">OralChroma + Desafio da Cisteína</h3>
                  <p className="text-primary-white/80 text-lg leading-relaxed">
                    Indicado especialmente quando o odor oscila, aparece em alguns momentos ou pode estar fraco no dia da consulta. Além da medição inicial, avalia o potencial de produção dos gases relacionados ao mau hálito.
                  </p>
                </div>
                <div>
                  <p className="text-sm text-primary-white/60 font-medium mb-1">Duração aproximada: 2 horas.</p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button 
                onClick={() => window.openQualificationModal?.()}
                className="bg-primary-green hover:bg-secondary-green text-primary-white px-8 py-4 rounded-full text-base font-medium transition-colors w-full sm:w-auto"
              >
                Comparar opções e valores
              </button>
            </div>
          </div>

          <div className="relative">
            <img 
              src="https://lh3.googleusercontent.com/d/1b6IbsEI5w80L_DtstqeBQ28ZIZSh-IIb" 
              alt="Máquina de Cromatografia OralChroma" 
              className="w-full h-auto object-cover rounded-2xl shadow-sm border border-border-gray"
            />
            <div className="absolute -bottom-8 -left-8 hidden md:block w-48 h-48 border-[6px] border-primary-white rounded-2xl overflow-hidden shadow-sm">
              <img 
                src="https://lh3.googleusercontent.com/d/1HIpB6a4K4NEXF0j2CvdvYAHrm1Uwiqzx" 
                alt="Detalhe do OralChroma" 
                className="w-full h-full object-cover bg-primary-white"
              />
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
