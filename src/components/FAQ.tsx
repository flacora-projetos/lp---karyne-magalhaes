import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const itens = [
  {
    q: "Qual é a diferença entre as duas avaliações?",
    a: "Existem duas modalidades de avaliação. Clique em “Comparar opções e valores” para conhecer as diferenças e indicar qual delas parece mais adequada ao seu caso."
  },
  {
    q: "A consulta já inclui o tratamento?",
    a: "Não. A consulta é exclusivamente destinada ao entendimento profundo e diagnóstico preciso da sua condição atual. O tratamento será sugerido após identificarmos a verdadeira origem da halitose."
  },
  {
    q: "Quanto tempo dura a consulta?",
    a: "A consulta costuma ser bastante imersiva e completa, envolvendo anamnese, medições e avaliações clínicas, variando de acordo com a complexidade de cada situação. Uma estimativa exata é provida no momento do agendamento."
  },
  {
    q: "Preciso fazer alguma preparação?",
    a: "Existe uma orientação importante: é necessário estar há pelo menos 21 dias sem utilizar antibióticos. Demais preparos específicos são enviados logo após o agendamento."
  },
  {
    q: "Quem mora em outra cidade pode se consultar?",
    a: "Sim, muitos pacientes vêm de fora. Recomendamos que informe a sua origem durante o contato, para alinharmos toda a organização antes de sua viagem a Goiânia."
  },
  {
    q: "Como conheço os valores?",
    a: "Existem duas modalidades de avaliação. Clique em “Comparar opções e valores” para conhecer as diferenças e indicar qual delas parece mais adequada ao seu caso."
  },
  {
    q: "Como funciona o pagamento?",
    a: "O acolhimento financeiro, opções de parcelamento e regras para confirmação da agenda serão explicados pela nossa equipe de atendimento assim que você avançar para o entendimento de valores através dos nossos botões de ação."
  }
];

export const FAQ = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="duvidas" className="py-24 bg-primary-beige">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-3xl md:text-5xl font-medium leading-tight text-primary-brown mb-16 text-center font-serif">
          Perguntas Frequentes
        </h2>

        <div className="space-y-4">
          {itens.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div 
                key={idx} 
                className={`bg-primary-white rounded-2xl border transition-colors ${isOpen ? 'border-primary-brown border-opacity-30' : 'border-border-gray hover:border-primary-brown/20'}`}
              >
                <button 
                  onClick={() => toggle(idx)}
                  className="flex items-center justify-between w-full p-6 md:p-8 text-left focus:outline-none"
                >
                  <span className="text-lg text-primary-brown font-medium pr-6">{item.q}</span>
                  {isOpen ? (
                    <ChevronUp size={24} className="text-soft-green flex-shrink-0" />
                  ) : (
                    <ChevronDown size={24} className="text-soft-green flex-shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-6 md:px-8 pb-6 md:pb-8 text-secondary-green text-lg leading-relaxed pt-2">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
