import { Star } from 'lucide-react';

export const Avaliacoes = () => {
  const reviews = [
    { id: 1, name: "Maria Silva", text: "[Placeholder de texto de avaliação com detalhes do acolhimento e resultado]" },
    { id: 2, name: "João Pedro", text: "[Placeholder de texto de avaliação real sobre a precisão do diagnóstico e alívio do problema]" },
    { id: 3, name: "Ana Costa", text: "[Placeholder de texto sobre o conforto do ambiente e a expertise da profissional]" }
  ];

  return (
    <section className="py-24 bg-primary-beige">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-medium leading-tight text-primary-brown mb-6 font-serif">
            Relatos de quem já passou pelo atendimento.
          </h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {reviews.map((review) => (
            <div key={review.id} className="bg-primary-white p-8 rounded-2xl shadow-sm border border-border-gray">
              <div className="flex items-center gap-1 mb-6 text-accent-earthy">
                {[1,2,3,4,5].map(idx => <Star key={idx} size={18} fill="currentColor" />)}
              </div>
              <p className="text-secondary-green text-lg leading-relaxed mb-8 italic">
                "{review.text}"
              </p>
              <div className="flex items-center justify-between border-t border-border-gray pt-6">
                <span className="font-medium text-primary-brown">{review.name}</span>
                <span className="text-xs text-soft-green uppercase tracking-wide">Google Reviews</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
