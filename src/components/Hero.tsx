export const Hero = () => {
  return (
    <section className="relative w-full min-h-[90vh] flex md:items-center bg-primary-beige pt-20 overflow-hidden">
      {/* Background Image covering the entire hero */}
      <div className="absolute inset-0 w-full h-full z-0">
        <img 
          src="/images/karyne_hero.jpeg" 
          alt="Dra. Karyne Magalhães" 
          className="w-full h-full object-cover object-[80%_top] md:object-[70%_center]"
        />
        {/* Gradients to protect the text */}
        {/* Mobile: bottom gradient protecting text */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary-beige via-primary-beige/95 to-transparent md:hidden mt-[40%]" />
        {/* Desktop: left to right gradient protecting text */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-beige from-40% via-primary-beige/80 to-transparent hidden md:block" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full md:grid md:grid-cols-2 gap-12 pb-12 mt-auto md:mt-0 pt-64 md:pt-0">
        <div className="flex flex-col justify-center md:py-24">
          <div className="inline-flex items-center space-x-2 text-sm text-soft-green font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-copper"></span>
            <span>Consulta especializada em Halitose • Goiânia</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium leading-tight mb-6 text-primary-brown">
            Investigação especializada da halitose para entender o seu caso e orientar o tratamento adequado.
          </h1>
          
          <p className="text-lg md:text-xl text-secondary-green mb-10 max-w-lg leading-relaxed">
            Avaliação odontológica completa, análise da saliva e medição objetiva dos gases do hálito com OralChroma.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-12">
            <button 
              onClick={() => window.openQualificationModal?.()}
              className="bg-primary-green hover:bg-secondary-green transition-colors text-primary-white px-8 py-4 rounded-full text-base font-medium shadow-sm w-full sm:w-auto"
            >
              Entender qual avaliação faz sentido
            </button>
            <a 
              href="#como-funciona"
              className="border border-border-gray hover:border-primary-brown text-primary-brown bg-primary-white/80 backdrop-blur-sm px-8 py-4 rounded-full text-base font-medium transition-all text-center w-full sm:w-auto hover:bg-primary-white"
            >
              Conhecer a consulta
            </a>
          </div>

          <div className="flex items-center gap-3 text-sm text-soft-green">
            <div className="w-8 h-[1px] bg-border-gray"></div>
            <p>Atendimento presencial, reservado e individualizado • CRO-GO 7954</p>
          </div>
        </div>
      </div>
    </section>
  );
};
