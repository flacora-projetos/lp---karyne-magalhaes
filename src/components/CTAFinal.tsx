export const CTAFinal = () => {
  return (
    <section className="relative w-full py-20 md:py-24 bg-primary-green flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        {/* Right sided image with gradient into green */}
        <div className="absolute inset-0 bg-primary-green mix-blend-multiply opacity-30 z-10"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary-green via-primary-green/90 to-transparent z-10 md:w-3/4"></div>
        <img 
          src="https://lh3.googleusercontent.com/d/1-1M-IWgJPfDvGOJX0nVmdnpa9joM3UVA" 
          alt="Dra. Karyne Magalhães" 
          className="w-full h-full object-cover object-[center_10%] md:object-[right_10%]"
        />
      </div>

      <div className="relative z-20 max-w-7xl mx-auto px-6 w-full text-center md:text-left flex flex-col md:items-start justify-center">
        <h2 className="text-3xl md:text-5xl font-medium leading-tight text-primary-white mb-6 font-serif max-w-2xl">
          O primeiro passo é entender qual avaliação faz sentido para o seu caso.
        </h2>
        <p className="text-xl text-primary-beige/90 mb-12 max-w-xl leading-relaxed">
          Conheça as opções e responda algumas perguntas para facilitar a orientação e o agendamento.
        </p>
        
        <button 
          onClick={() => window.openQualificationModal?.()}
          className="bg-primary-beige text-primary-brown hover:bg-white px-10 py-5 rounded-full text-lg font-medium transition-colors shadow-lg shadow-black/20"
        >
          Começar avaliação inicial
        </button>
      </div>
    </section>
  );
};
