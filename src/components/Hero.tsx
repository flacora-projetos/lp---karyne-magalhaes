export const Hero = () => {
  return (
    <section className="relative w-full min-h-[90vh] flex md:items-center bg-primary-beige pt-20 overflow-hidden">
      {/* Background Image covering the entire hero */}
      <div className="absolute inset-0 w-full h-full z-0">
        <img 
          src="https://lh3.googleusercontent.com/d/1_R1q6m9jY9ey84Pt7VC2Q94zOqtFR53m" 
          alt="Dra. Karyne Magalhães" 
          className="w-full h-full object-cover object-[80%_top] md:w-[125%] md:max-w-none md:object-[60%_20%]"
        />
        {/* Gradients to protect the text */}
        {/* Mobile: bottom gradient protecting text */}
        <div 
          className="absolute inset-0 md:hidden" 
          style={{ background: 'linear-gradient(0deg, #F6F0E9 0%, #F6F0E9 35%, rgba(246,240,233,0.85) 45%, rgba(246,240,233,0) 55%)' }}
        />
        {/* Desktop: left to right gradient protecting text */}
        <div 
          className="absolute inset-0 hidden md:block" 
          style={{ background: 'linear-gradient(90deg, #F6F0E9 0%, #F6F0E9 36%, rgba(246,240,233,0.88) 46%, rgba(246,240,233,0.25) 53%, rgba(246,240,233,0) 58%)' }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full md:grid md:grid-cols-[55%_45%] gap-8 pb-10 mt-auto md:mt-0 pt-56 md:pt-0">
        <div className="flex flex-col justify-center md:py-14">
          <div className="inline-flex items-center space-x-2 text-sm text-soft-green font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-copper"></span>
            <span>Consulta especializada em Halitose • Goiânia</span>
          </div>
          
          <h1 className="text-4xl md:text-[44px] lg:text-[55px] font-medium leading-[1.15] mb-6 text-primary-brown">
            Investigação especializada da halitose para entender o seu caso e orientar o tratamento adequado.
          </h1>
          
          <p className="text-lg md:text-xl text-secondary-green mb-8 max-w-lg leading-relaxed">
            Avaliação odontológica completa, análise da saliva e medição objetiva dos gases do hálito com OralChroma.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-10">
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
