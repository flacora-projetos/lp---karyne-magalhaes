# Conteúdo publicado do blog

Este diretório público só pode receber a **versão exata** de um artigo explicitamente aprovada para publicação.

O gerador de produção exige simultaneamente:
- `status: "approved"`;
- `approval.version` igual a `version`;
- `approval.editorial: true`;
- `approval.clinical: true`;
- `approval.contentHash` corresponde ao conteúdo, autoria e datas desta versão;
- corpo não vazio.

O build falha se qualquer arquivo deste diretório perder sua aprovação válida.

Rascunhos, fontes brutas e comentários de revisão permanecem fora deste repositório público.
