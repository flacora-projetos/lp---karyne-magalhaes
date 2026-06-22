import { Search, Droplets, Activity } from 'lucide-react';

export const PorQueInvestigar = () => {
  const cards = [
    {
      title: "Avaliação Clínica",
      description: "Mais de 60 causas sistêmicas e locais podem interferir na qualidade do hálito e necessitam de avaliação detalhada da saúde oral.",
      icon: <Search size={24} className="text-accent-earthy" />
    },
    {
      title: "Análise da Saliva",
      description: "A saliva regula o ambiente bucal. Alterações no volume e na composição salivar podem ser um dos principais gatilhos para o odor.",
      icon: <Droplets size={24} className="text-accent-earthy" />
    },
    {
      title: "Medição dos Gases",
      description: "O OralChroma permite medir separadamente os principais gases relacionados ao mau hálito, oferecendo uma análise mais objetiva para auxiliar na investigação da causa.",
      icon: <Activity size={24} className="text-accent-earthy" />
    }
  ];

  return (
    <section className="py-16 md:py-20 bg-primary-beige">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-medium leading-tight text-primary-brown">
            Mais do que mascarar o odor, é preciso investigar sua origem.
          </h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {cards.map((card, idx) => (
            <div key={idx} className="bg-primary-white p-10 rounded-2xl shadow-sm border border-border-gray hover:shadow-md transition-shadow">
              <div className="w-14 h-14 bg-primary-beige rounded-full flex items-center justify-center mb-6">
                {card.icon}
              </div>
              <h3 className="text-xl font-medium text-primary-brown mb-4 font-serif">{card.title}</h3>
              <p className="text-secondary-green leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
