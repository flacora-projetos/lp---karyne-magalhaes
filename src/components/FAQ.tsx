import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const itens = [
  {
    q: "Mau hálito tem cura?",
    a: "Sim. Na grande maioria dos casos o mau hálito tem cura ou controle adequado, a depender da causa. O primeiro passo é realizar um diagnóstico preciso para identificar exatamente o que está gerando o problema e, assim, iniciar o tratamento correto."
  },
  {
    q: "Mau hálito que vem do estômago tem tratamento?",
    a: "Muitas pessoas acreditam que todo mau hálito é estomacal, mas na verdade, as causas vindas do estômago são minoria (grande parte tem origem bucal). Independentemente da causa identificada na consulta, existe tratamento adequado e tudo começa com essa investigação."
  },
  {
    q: "A consulta inclui tratamento?",
    a: "A consulta é voltada ao diagnóstico. Caso seja identificada necessidade de tratamento, a Dra. Karyne explica as possibilidades após a avaliação, porque a conduta depende da causa encontrada."
  },
  {
    q: "Por que o valor do tratamento não é informado antes?",
    a: "Porque o tratamento depende da causa da halitose e das necessidades identificadas na avaliação. Primeiro é feito o diagnóstico; depois, se houver indicação, a equipe explica as opções e valores de tratamento."
  },
  {
    q: "A consulta inclui retorno?",
    a: "Na maioria dos casos, a avaliação permite orientar os próximos passos no próprio atendimento. Se a Dra. Karyne identificar necessidade de retorno para complementar o diagnóstico, a equipe orienta o paciente sobre esse processo."
  },
  {
    q: "Preciso fazer algum preparo antes da consulta?",
    a: "É importante estar há pelo menos 21 dias sem utilizar antibióticos, pois o uso recente pode interferir nos resultados da avaliação. Caso tenha usado antibiótico recentemente, informe a equipe antes do agendamento."
  },
  {
    q: "Quem mora em outra cidade pode se consultar?",
    a: "Sim, muitos pacientes vêm de fora. Recomendamos que informe a sua origem durante o contato, para alinharmos toda a organização antes de sua viagem a Goiânia."
  },
  {
    q: "Preciso pagar antes da consulta?",
    a: "Sim. O horário é confirmado mediante pagamento no momento do agendamento. Como se trata de uma avaliação especializada, com duração aproximada de 2h a 2h30, o horário é reservado exclusivamente para o paciente.\n\nA consulta envolve tempo clínico individualizado, preparo da avaliação, análise clínica, avaliação da saliva e, conforme a modalidade escolhida, medição objetiva dos gases do hálito com OralChroma.\n\nApós a confirmação, a equipe envia as orientações da consulta pelo WhatsApp."
  }
];

export const FAQ = () => {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section id="duvidas" className="py-16 md:py-20 bg-primary-beige">
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
                  <div className="px-6 md:px-8 pb-6 md:pb-8 text-secondary-green text-lg leading-relaxed pt-2 whitespace-pre-wrap">
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
