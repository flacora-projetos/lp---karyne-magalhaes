import { Star } from 'lucide-react';

export const Avaliacoes = () => {
  const reviews = [
    { 
      id: 1, 
      name: "suzana silva", 
      text: "Amei o atendimento, me senti a vontade para falar do meu problema, uma Excelente profissional nota 10/10. Obrigada Dra Karyne pelo atendimento e paciência." 
    },
    { 
      id: 2, 
      name: "adriano canaverde celebrante", 
      text: "Foi incrível, um atendimento digno de um rei... Me senti super confortável ainda mais por se tratar de um assunto muito delicado. Só tenho a agradecer o atendimento da doutora Karyne e de sua auxiliar Celimar." 
    },
    { 
      id: 3, 
      name: "euza felipe", 
      text: "Dra Karine é uma excelente profissional. Muito atenciosa, explica detalhadamente sem deixar dúvidas. Nota 1000!! Um lugar maravilhoso. Parabéns dra Karine👏 amei ser atendida em seu consultório." 
    }
  ];

  return (
    <section className="py-16 md:py-20 bg-primary-beige">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-medium leading-tight text-primary-brown mb-4 font-serif">
            Relatos de quem já passou pelo atendimento
          </h2>
          <p className="text-secondary-green text-lg mb-4">
            Avaliações públicas deixadas por pacientes no Google.
          </p>
          <div className="flex items-center justify-center gap-1 text-sm text-soft-green">
            <div className="flex text-accent-earthy">
              {[1, 2, 3, 4, 5].map(idx => <Star key={idx} size={16} fill="currentColor" />)}
            </div>
            <span className="font-medium ml-1">5,0 no Google • 250 avaliações</span>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {reviews.map((review) => (
            <div key={review.id} className="bg-primary-white p-8 rounded-2xl shadow-sm border border-border-gray flex flex-col h-full">
              <div className="flex items-center gap-1 mb-6 text-accent-earthy">
                {[1,2,3,4,5].map(idx => <Star key={idx} size={18} fill="currentColor" />)}
              </div>
              <p className="text-secondary-green text-lg leading-relaxed mb-8 italic flex-grow">
                "{review.text}"
              </p>
              <div className="flex items-center justify-between border-t border-border-gray pt-6 mt-auto">
                <span className="font-medium text-primary-brown">{review.name}</span>
                <span className="text-xs text-soft-green uppercase tracking-wide">Google Reviews</span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center">
          <a 
            href="https://share.google/Sz1V6AMoDNkSkDhzf" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-4 bg-primary-brown text-primary-beige rounded-full font-medium hover:bg-opacity-90 transition-all shadow-sm text-sm"
          >
            Ver mais avaliações no Google
          </a>
        </div>
      </div>
    </section>
  );
};
