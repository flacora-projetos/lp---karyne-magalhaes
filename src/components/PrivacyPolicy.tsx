import React, { useEffect } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';

export const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="font-sans text-primary-brown !scroll-smooth min-h-screen flex flex-col bg-[#FDFBF7]">
      <Header />
      <main className="flex-grow max-w-4xl mx-auto px-6 py-16 md:py-24">
        <article className="prose prose-brown max-w-none">
          <h1 className="text-3xl md:text-4xl font-light mb-4 font-serif text-primary-brown">Política de Privacidade</h1>
          <p className="text-sm text-primary-brown/60 mb-10">Última atualização: 22/06/2026</p>

          <p className="mb-8 text-primary-brown/80 leading-relaxed text-lg">
            Esta Política de Privacidade explica como os dados pessoais são coletados, usados e protegidos na landing page de consulta especializada em Halitose da Dra. Karyne Magalhães.
            <br /><br />
            Ao preencher o formulário ou interagir com esta página, você declara estar ciente das práticas descritas abaixo.
          </p>

          <div className="space-y-10 text-primary-brown/80">
            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">1. Quem é responsável pelos dados</h2>
              <p className="leading-relaxed">
                A responsável pelo tratamento dos dados coletados nesta página é:<br /><br />
                <strong>Dra. Karyne Magalhães</strong><br />
                CRO-GO 7954<br />
                Atendimento presencial em Goiânia - GO<br />
                Endereço: Rua Terezina, 40, Ed. Essenciale Premier, Sala 701, Alto da Glória, Goiânia - GO, CEP 74815-715<br />
                WhatsApp: (62) 98134-0675
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">2. Quais dados podemos coletar</h2>
              <p className="leading-relaxed mb-4">Podemos coletar informações fornecidas diretamente por você no formulário da página, como:</p>
              <ul className="list-disc pl-6 space-y-2 mb-6">
                <li>nome;</li>
                <li>WhatsApp;</li>
                <li>e-mail;</li>
                <li>cidade e estado;</li>
                <li>informações sobre o comportamento do hálito;</li>
                <li>interesse em uma das modalidades de avaliação;</li>
                <li>informação sobre uso recente de antibióticos;</li>
                <li>disponibilidade de horários ou datas preferidas.</li>
              </ul>
              <p className="leading-relaxed mb-4">Também podemos coletar dados técnicos de navegação, como:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>endereço da página acessada;</li>
                <li>origem do acesso;</li>
                <li>parâmetros de campanha, como UTM, fbclid e gclid;</li>
                <li>navegador, dispositivo e sistema operacional;</li>
                <li>endereço IP;</li>
                <li>identificadores de cookies e tecnologias similares, quando disponíveis.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">3. Sobre dados de saúde</h2>
              <p className="leading-relaxed mb-4">
                Algumas respostas fornecidas no formulário podem estar relacionadas à sua saúde ou à sua busca por atendimento odontológico especializado.
              </p>
              <p className="leading-relaxed mb-4">
                Essas informações são usadas apenas para facilitar o primeiro atendimento, ajudar a equipe a entender melhor o contexto informado por você e orientar os próximos passos da consulta.
              </p>
              <p className="leading-relaxed">
                Não enviamos respostas clínicas, sintomas, informações sobre halitose, uso de antibióticos ou dados sensíveis do formulário para plataformas de anúncios.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">4. Para que usamos os dados</h2>
              <p className="leading-relaxed mb-4">Os dados coletados podem ser usados para:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>responder ao seu contato;</li>
                <li>facilitar a comunicação pelo WhatsApp;</li>
                <li>orientar sobre a modalidade de avaliação mais adequada;</li>
                <li>organizar o agendamento;</li>
                <li>registrar o contato em planilha interna de acompanhamento;</li>
                <li>melhorar a experiência da página;</li>
                <li>medir o desempenho das campanhas de anúncios;</li>
                <li>prevenir fraudes, abusos ou problemas técnicos;</li>
                <li>cumprir obrigações legais ou regulatórias, quando aplicável.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">5. Compartilhamento de dados</h2>
              <p className="leading-relaxed mb-4">
                Os dados podem ser acessados pela equipe responsável pelo atendimento e por prestadores de serviço necessários para o funcionamento da página, como ferramentas de hospedagem, planilhas, automação, análise de tráfego e anúncios.
              </p>
              <p className="leading-relaxed mb-4">Podemos utilizar serviços como:</p>
              <ul className="list-disc pl-6 space-y-2 mb-6">
                <li>Google Sheets e Google Apps Script, para registro interno dos contatos;</li>
                <li>WhatsApp, para continuidade do atendimento;</li>
                <li>Vercel, para hospedagem da página;</li>
                <li>Google Analytics, Google Tag Manager e Google Ads, para mensuração de tráfego e campanhas;</li>
                <li>Meta Pixel e Meta Conversions API, para mensuração de eventos de campanha.</li>
              </ul>
              <p className="leading-relaxed mb-4">
                Nas ferramentas de anúncios e análise, usamos eventos técnicos de navegação e conversão. Quando necessário para mensuração, dados de identificação podem ser tratados em formato protegido por hash, sem envio de respostas clínicas ou informações sensíveis do formulário.
              </p>
              <p className="leading-relaxed font-medium">
                Não vendemos seus dados pessoais.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">6. Cookies e tecnologias de rastreamento</h2>
              <p className="leading-relaxed mb-4">Esta página pode utilizar cookies e tecnologias similares para:</p>
              <ul className="list-disc pl-6 space-y-2 mb-6">
                <li>medir visitas;</li>
                <li>entender interações com a página;</li>
                <li>acompanhar eventos de campanha;</li>
                <li>melhorar a análise de desempenho dos anúncios;</li>
                <li>evitar duplicidade na mensuração de eventos.</li>
              </ul>
              <p className="leading-relaxed">
                Você pode bloquear ou apagar cookies nas configurações do seu navegador. Algumas funções de mensuração podem deixar de funcionar corretamente, mas o acesso à página não deve ser impedido por isso.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">7. Segurança dos dados</h2>
              <p className="leading-relaxed mb-4">
                Adotamos medidas técnicas e organizacionais para reduzir riscos de acesso não autorizado, uso indevido, perda ou alteração dos dados.
              </p>
              <p className="leading-relaxed mb-4">Entre essas medidas estão:</p>
              <ul className="list-disc pl-6 space-y-2 mb-6">
                <li>limitação de acesso aos dados;</li>
                <li>uso de ferramentas protegidas por login;</li>
                <li>envio restrito de informações para plataformas de anúncio;</li>
                <li>não envio de respostas clínicas para Meta ou Google;</li>
                <li>uso de dados hashados quando aplicável à mensuração de anúncios.</li>
              </ul>
              <p className="leading-relaxed">
                Apesar dos cuidados, nenhum sistema digital é totalmente livre de riscos.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">8. Por quanto tempo os dados são armazenados</h2>
              <p className="leading-relaxed mb-4">Os dados podem ser mantidos pelo tempo necessário para:</p>
              <ul className="list-disc pl-6 space-y-2 mb-6">
                <li>responder ao contato;</li>
                <li>organizar o atendimento;</li>
                <li>cumprir obrigações legais;</li>
                <li>manter registros administrativos;</li>
                <li>analisar a efetividade das campanhas.</li>
              </ul>
              <p className="leading-relaxed">
                Quando não forem mais necessários, os dados poderão ser eliminados, anonimizados ou mantidos apenas quando houver obrigação legal ou interesse legítimo aplicável.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">9. Seus direitos</h2>
              <p className="leading-relaxed mb-4">Você pode solicitar, nos termos da legislação aplicável:</p>
              <ul className="list-disc pl-6 space-y-2 mb-6">
                <li>confirmação sobre o tratamento dos seus dados;</li>
                <li>acesso aos dados pessoais;</li>
                <li>correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>eliminação de dados, quando aplicável;</li>
                <li>informação sobre compartilhamento de dados;</li>
                <li>revogação de consentimento, quando essa for a base utilizada;</li>
                <li>oposição ao tratamento, quando cabível;</li>
                <li>informações sobre o uso dos seus dados.</li>
              </ul>
              <p className="leading-relaxed">
                Para exercer seus direitos, entre em contato pelo WhatsApp informado nesta página.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">10. Links externos</h2>
              <p className="leading-relaxed mb-4">
                A página pode conter links para serviços externos, como WhatsApp, Google Maps e avaliações no Google.
              </p>
              <p className="leading-relaxed">
                Ao acessar esses serviços, você estará sujeito às políticas de privacidade próprias dessas plataformas.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-medium mb-4 text-primary-brown">11. Alterações nesta política</h2>
              <p className="leading-relaxed mb-4">
                Esta Política de Privacidade pode ser atualizada a qualquer momento para refletir mudanças na página, nas ferramentas utilizadas ou em exigências legais.
              </p>
              <p className="leading-relaxed">
                A versão mais recente ficará disponível nesta página.
              </p>
            </section>

          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
};
