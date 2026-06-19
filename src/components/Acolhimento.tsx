export const Acolhimento = () => {
  return (
    <section id="consulta" className="py-16 md:py-20 bg-primary-white">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div className="order-2 md:order-1 relative">
          <div className="absolute -inset-4 bg-primary-beige rounded-3xl -z-10 transform -rotate-2"></div>
          <img 
            src="https://lh3.googleusercontent.com/d/1neQxPznSGT9lWFCIddPJLx3DmSm3Xr1y" 
            alt="Atendimento de confiança e reservado" 
            className="w-full h-auto aspect-[4/5] object-cover rounded-2xl shadow-sm border border-border-gray/50"
          />
        </div>
        
        <div className="order-1 md:order-2 flex flex-col justify-center">
          <h2 className="text-3xl md:text-4xl font-medium leading-tight mb-8">
            O mau hálito nem sempre se manifesta da mesma forma.
          </h2>
          
          <div className="space-y-6 text-lg text-secondary-green leading-relaxed">
            <p>
              A alteração do hálito tem comportamentos diferentes: ela pode ser constante ao longo do dia, apresentar oscilações ou mesmo não ser facilmente percebida por você, mas sim por pessoas próximas.
            </p>
            <p>
              Em muitos casos, a insegurança relacionada à própria percepção gera angústia e afeta a qualidade de vida, mesmo quando a alteração não é confirmada em consultório.
            </p>
            <p>
              É por isso que a nossa avaliação é feita com base em protocolos clínicos rigorosos e medição objetiva em um ambiente <strong>totalmente reservado e acolhedor</strong>. Aqui, o foco é compreender o seu quadro sem qualquer tipo de constrangimento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
