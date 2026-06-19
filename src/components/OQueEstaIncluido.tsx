import { Check } from 'lucide-react';

export const OQueEstaIncluido = () => {
  const itens = [
    "Anamnese e história clínica detalhada",
    "Avaliação odontológica completa",
    "Fotografias intraorais",
    "Sialometria (avaliação salivar)",
    "Medição objetiva com OralChroma",
    "Explicação técnica dos resultados",
    "Orientação sobre os próximos passos"
  ];

  return (
    <section className="py-24 bg-primary-green text-primary-beige">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16">
        <div>
          <h2 className="text-3xl md:text-5xl font-medium leading-tight mb-8 text-primary-white">
            A consulta vai além da medição do hálito.
          </h2>
          
          <div className="bg-primary-white/10 p-6 rounded-xl border border-primary-white/20">
            <p className="text-lg leading-relaxed font-medium">
              A consulta é destinada ao diagnóstico. O tratamento é proposto conforme a necessidade identificada ao fim da avaliação.
            </p>
          </div>
        </div>
        
        <div className="flex flex-col justify-center">
          <ul className="space-y-6">
            {itens.map((item, idx) => (
              <li key={idx} className="flex items-start gap-4">
                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-accent-copper/20 flex items-center justify-center">
                  <Check size={14} className="text-accent-copper" />
                </div>
                <span className="text-lg text-primary-beige/90">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
