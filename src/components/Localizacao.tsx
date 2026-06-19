export const Localizacao = () => {
  return (
    <section id="localizacao" className="py-16 md:py-20 lg:py-24 bg-primary-white">
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
              onClick={() => window.open('https://www.google.com/maps/search/?api=1&query=Rua%20Terezina%2C%2040%2C%20Ed.%20Essenciale%20Premier%2C%20Sala%20701%2C%20Alto%20da%20Gl%C3%B3ria%2C%20Goi%C3%A2nia%20-%20GO%2C%2074815-715', '_blank')}
              className="border border-primary-brown text-primary-brown hover:bg-primary-brown hover:text-primary-white px-8 py-4 rounded-full text-base font-medium transition-colors w-full sm:w-auto"
            >
              Abrir no Google Maps
            </button>
          </div>
        </div>

        <div className="relative w-full h-[320px] md:h-[420px] bg-border-gray rounded-2xl overflow-hidden shadow-sm border border-border-gray/50">
          <iframe
            src="https://www.google.com/maps?q=Rua%20Terezina%2C%2040%2C%20Ed.%20Essenciale%20Premier%2C%20Sala%20701%2C%20Alto%20da%20Gl%C3%B3ria%2C%20Goi%C3%A2nia%20-%20GO%2C%2074815-715&output=embed"
            className="absolute inset-0 w-full h-full"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Localização da clínica da Dra. Karyne Magalhães"
          ></iframe>
        </div>

      </div>
    </section>
  );
};
