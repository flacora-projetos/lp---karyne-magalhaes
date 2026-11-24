# Opções da página de vendas tiradas do Designeer (24/11/2026)

Pedido do PO: novas opções para a página de vendas, pelo método que deu certo na Nomilume (referências no Designeer, duas ideias saídas do mundo do produto, página completa, montador, páginas privadas). Nada foi ao ar: o site em produção, o código dele (`src/`) e a publicação na Vercel não mudaram. As prévias não enviam dados (cadastro, planilha, Meta e Google ficam desligados) e o WhatsApp mostra um aviso em vez de abrir.

## O que já existia e não mudou

- **Texto aprovado:** todo o texto da página vem dos próprios blocos do site (`src/components`), inclusive perguntas frequentes, avaliações do Google e o filtro de 7 etapas. As opções leem o texto de lá; nada foi copiado à mão.
- **Identidade:** a única do projeto (`../ID VISUAL LP.md`): Lora + Geist, bege, verde, marrom e cobre, fotos reais da Dra. Karyne. Acréscimo: Geist Mono só nos rótulos de medida (licença SIL Open Font License, livre para uso comercial; mesma família da Geist).
- **Caras:** o projeto tem uma identidade só. Por isso, no lugar da matriz de caras, entram as duas ideias pedidas e uma terceira.
- **Área do cliente:** não existe nem está planejada para paciente (o painel do site é da clínica). Não foi feita.

## As ideias

| Ideia | A prova vira... | O que troca na página |
|---|---|---|
| **Ficha** | a ficha de investigação, impressa linha por linha, com o traçado dos três gases e o carimbo "Voltada ao diagnóstico" | topo; "Duas formas de avaliar" vira guias de requisição; "O que está incluído" vira extrato impresso |
| **Filtro à vista** | a pergunta real do filtro ("Qual situação mais se aproxima do seu caso?") funcionando logo abaixo do título, respondendo com o texto aprovado de cada avaliação | topo; seção nova "De onde vem cada informação da consulta" (mapa das 4 fontes até a explicação dos resultados) |
| **Cartão de consulta** | o cartão de agendamento (2 horas, 21 dias de preparo, local, CRO) | topo; "Como funciona" ganha a régua das duas horas; o preparo ganha o calendário dos 21 dias |

Texto novo que a ideia exigiu aparece **sublinhado tracejado** na prévia e está marcado com `AAprovar` no código. Lista: rótulo "Ficha de investigação do hálito", legenda do traçado e nomes dos gases, carimbo "Voltada ao diagnóstico", "Uma das 7 perguntas", dica e nota do filtro, **a ligação entre cada situação e a avaliação sugerida** (interpretação do texto das modalidades; precisa do OK da clínica), título, frase e nomes das fontes do mapa, "Cartão de consulta", "Data: combinada com a equipe", nota da régua, título e legenda do calendário e o dia "consulta".

## Links (páginas privadas do PO)

| Página | Link |
|---|---|
| Página atual (mesma base, para comparar) | https://claude.ai/artifact/L2ULwKip4wdE6YK3dLXyT9 |
| Ficha | https://claude.ai/artifact/LY3pJhrQHmcbEvL64LfRzY |
| Filtro à vista | https://claude.ai/artifact/MBrM2opmqhF9CJauxK1GMH |
| Cartão de consulta | https://claude.ai/artifact/4YUGrhV1KZwMG3S9xahXqZ |

Na prévia, o vídeo do YouTube e o mapa do Google ficam em branco: as páginas privadas não carregam conteúdo de outros sites. No site real eles continuam iguais.

## Referências (o que se pegou de cada uma)

- **Saaspo, Respan:** a tabela real do produto logo abaixo do título → o filtro funcionando no topo (Filtro à vista).
- **Saaspo, Terms:** um documento como peça central do topo → a ficha (Ficha).
- **Land-book, Jacques + Cie (clínica dentária, Québec):** foto real grande e blocos de texto ao lado, tom humano e sem cara de clínica genérica → as fotos reais ficam em todas as opções.
- **Supahero, Superpower:** um objeto concreto ao lado do título como prova → o cartão de consulta como único objeto (Cartão).
- **Supahero, Yucca Packaging:** fundo bege quente e etiquetas curtas junto ao produto → rótulos curtos do cartão (duração, preparo, local).
- **SEESAW, Helios (exames de saúde):** serifada nos títulos e letra mono só para medidas → Geist Mono nos números, gases e rótulos.
- **Finds, grade de dias que se preenche (verde):** progresso por dia → calendário dos 21 dias sem antibiótico.
- **Finds, cartão de agenda com horários:** a agenda como objeto → régua das duas horas.
- **Finds, "Crumpled Receipt" (Lorenzo Cabra), já usado na Nomilume:** documento impresso linha por linha → animação de impressão da ficha.
- **60fps e Mobbin:** não usados, porque não há área logada de paciente.

Cuidados: só a linguagem das referências (ritmo, hierarquia, tipo de movimento), nenhuma peça, texto ou ilustração copiados; nenhum resultado de paciente (o traçado é ilustrativo e sem valores); nenhum depoimento novo (só as avaliações públicas que a página já tinha); tudo que se move respeita a preferência de menos movimento.

## Como rodar o montador

Na pasta do site (`lp---karyne-magalhaes`):

```
node opcoes-designeer/montar.mjs            # as quatro páginas
node opcoes-designeer/montar.mjs ficha      # só uma (atual, ficha, filtro-a-vista, cartao)
```

Sai em `opcoes-designeer/saida/<opcao>.html` (fora do histórico, porque é gerado): uma página única com código, estilo e fotos dentro. Mudou um texto no site (`src/components`)? Rode de novo e republique: vale para todas. Para republicar no mesmo link, publique o mesmo arquivo pela mesma sessão ou passe o link da tabela.

Arquivos: `entrada.tsx` (trava de prévia e escolha da opção), `Pagina.tsx` (a página completa na ordem do site), `blocos/` (uma ideia por arquivo), `estilo.css` (só o que as ideias acrescentam).
