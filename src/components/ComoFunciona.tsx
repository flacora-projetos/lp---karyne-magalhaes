export const ComoFunciona = () => {
  const steps = [
    { num: "01", title: "Entendimento do histórico" },
    { num: "02", title: "Avaliação odontológica" },
    { num: "03", title: "Análise da saliva" },
    { num: "04", title: "Medição dos gases" },
    { num: "05", title: "Diagnóstico e orientação" },
  ];

  return (
    <section id="como-funciona" className="py-24 bg-primary-white">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        
        {/* Imagem fica na direita no desktop, na ordem original na mobile deixamos ela em segundo plano */}
        <div className="order-2 md:order-2">
          <img 
            src="/images/karyne_avaliação.jpeg" 
            alt="Dra. Karyne avaliando a paciente" 
            className="w-full h-auto aspect-square object-cover rounded-2xl shadow-sm border border-border-gray/50"
          />
        </div>

        <div className="order-1 md:order-1 flex flex-col justify-center">
          <h2 className="text-3xl md:text-4xl font-medium leading-tight text-primary-brown mb-12">
            Uma avaliação completa para entender o seu caso.
          </h2>
          
          <div className="relative border-l border-border-gray ml-4 space-y-10">
            {steps.map((step, idx) => (
              <div key={idx} className="relative pl-8">
                {/* Dot connected to the line */}
                <span className="absolute -left-3.5 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary-white border border-border-gray shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-accent-copper"></span>
                </span>
                <span className="text-sm font-bold text-soft-green tracking-widest block mb-1">
                  ETAPA {step.num}
                </span>
                <h3 className="text-xl font-serif text-primary-brown font-medium">
                  {step.title}
                </h3>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};
