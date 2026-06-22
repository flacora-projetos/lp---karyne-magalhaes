export const Hero = () => {
  return (
    <section 
      className="relative w-full flex md:items-center bg-primary-beige overflow-hidden mt-[80px] md:min-h-[calc(100svh-80px)]"
    >
      {/* Background Image Container */}
      <div className="absolute right-0 top-0 w-full md:w-[75%] lg:w-[70%] h-[45vh] md:h-full z-0">
        <img 
          src="https://lh3.googleusercontent.com/d/1_R1q6m9jY9ey84Pt7VC2Q94zOqtFR53m" 
          alt="Dra. Karyne Magalhães" 
          className="w-full h-full object-cover object-[75%_0%] md:object-[center_15%] -translate-y-8 md:translate-y-0"
        />
        {/* Mobile: bottom gradient protecting text */}
        <div 
          className="absolute inset-0 md:hidden pointer-events-none" 
          style={{ background: 'linear-gradient(0deg, #F6F0E9 0%, #F6F0E9 2%, rgba(246,240,233,0.9) 15%, rgba(246,240,233,0) 35%)' }}
        />
      </div>

      {/* Desktop: left to right gradient protecting text */}
      <div 
        className="absolute inset-0 hidden md:block z-0 pointer-events-none" 
        style={{ background: 'linear-gradient(90deg, #F6F0E9 0%, #F6F0E9 36%, rgba(246,240,233,0.88) 46%, rgba(246,240,233,0.25) 53%, rgba(246,240,233,0) 58%)' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full md:grid md:grid-cols-[55%_45%] gap-8 pb-10 md:pb-0 pt-[38vh] md:pt-0">
        <div className="flex flex-col justify-center">
          <div className="inline-flex items-center space-x-2 text-sm text-soft-green font-medium mb-2 md:mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-copper"></span>
            <span>Consulta especializada em Halitose • Goiânia</span>
          </div>
          
          <h1 className="text-[31px] min-[390px]:text-[34px] min-[430px]:text-[37px] md:text-[44px] lg:text-[50px] xl:text-[54px] font-medium leading-[1.02] md:leading-[1.12] mb-3 md:mb-6 text-primary-brown pr-2 sm:pr-8 md:pr-12 max-w-[95%] md:max-w-2xl tracking-tight">
            Diagnóstico especializado da halitose com avaliação clínica e tecnologia.
          </h1>
          
          <p className="text-lg md:text-[1.15rem] text-secondary-green mb-5 md:mb-8 max-w-[480px] lg:max-w-[500px] leading-relaxed">
            Avaliação odontológica completa, análise da saliva e medição objetiva dos gases do hálito com OralChroma, para investigar melhor as possíveis causas da halitose.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-8 md:mb-10">
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
            <p className="hidden md:block">Atendimento presencial, reservado e individualizado • CRO-GO 7954</p>
            <p className="md:hidden">Atendimento presencial e individualizado<br/>CRO-GO 7954</p>
          </div>
        </div>
      </div>
    </section>
  );
};
