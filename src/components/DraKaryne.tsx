export const DraKaryne = () => {
  return (
    <section id="sobre" className="py-24 bg-primary-white">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        
        <div className="order-2 md:order-1 flex gap-6 relative">
          <div className="w-1/2 flex flex-col justify-end">
            <img 
              src="/images/formacao_conteudo.jpeg" 
              alt="Dra. Karyne em formação e conteúdo" 
              className="w-full h-auto aspect-[3/4] object-cover rounded-2xl shadow-sm border border-border-gray/50 mb-8"
            />
          </div>
          <div className="w-1/2 flex flex-col justify-start">
            <img 
              src="/images/karyne_autoridade.jpeg" 
              alt="Dra. Karyne Magalhães - Especialista" 
              className="w-full h-auto aspect-[3/4] object-cover rounded-2xl shadow-sm border border-border-gray/50 mt-12"
            />
          </div>
        </div>

        <div className="order-1 md:order-2 flex flex-col justify-center">
          <h2 className="text-3xl md:text-5xl font-medium leading-tight text-primary-brown mb-8 font-serif">
            Experiência específica para investigar alterações do hálito.
          </h2>
          
          <div className="space-y-6 text-lg text-secondary-green leading-relaxed mb-10">
            <p>
              A Dra. Karyne Magalhães é Cirurgiã-Dentista e Especialista em Halitose, com forte atuação e experiência na investigação de alterações salivares e medição objetiva dos gases que geram odores bucais.
            </p>
            <p>
              O foco do seu atendimento é o acolhimento num ambiente seguro e a utilização de tecnologia para sair da subjetividade, indicando caminhos de tratamento precisos para cada tipo de condição.
            </p>
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
