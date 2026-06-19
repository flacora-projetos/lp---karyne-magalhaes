export const Localizacao = () => {
  return (
    <section id="localizacao" className="py-24 bg-primary-white">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        
        <div className="flex flex-col">
          <h2 className="text-3xl md:text-5xl font-medium leading-tight text-primary-brown mb-8 font-serif">
            Atendimento presencial em Goiânia
          </h2>
          
          <div className="bg-primary-beige p-8 rounded-2xl border border-border-gray mb-10">
            <h3 className="font-serif text-xl mb-4 text-primary-brown font-medium">Dra. Karyne Magalhães</h3>
            <p className="text-lg leading-relaxed text-secondary-green">
              Rua Terezina, 40<br/>
              Ed. Essenciale Premier, Sala 701<br/>
              Alto da Glória, Goiânia - GO<br/>
              CEP 74815-715<br/>
              Brasil
            </p>
          </div>

          <div>
            <button 
              onClick={() => window.open('https://maps.google.com/?q=Rua+Terezina,40,Alto+da+Gloria,Goiania', '_blank')}
              className="border border-primary-brown text-primary-brown hover:bg-primary-brown hover:text-primary-white px-8 py-4 rounded-full text-base font-medium transition-colors w-full sm:w-auto"
            >
              Abrir no Google Maps
            </button>
          </div>
        </div>

        <div className="relative w-full h-[400px] md:h-full min-h-[400px] bg-border-gray rounded-2xl overflow-hidden shadow-sm flex items-center justify-center border border-border-gray/50">
          <div className="text-soft-green text-center p-6">
            <p className="text-lg">[Placeholder do Mapa Integrado]</p>
            <p className="text-sm mt-2">Ponto a ser configurado futuramente com a API do Google Maps ou iframe dinâmico.</p>
          </div>
        </div>

      </div>
    </section>
  );
};
