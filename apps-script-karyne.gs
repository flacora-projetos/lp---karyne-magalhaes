function doPost(e) {
  const SPREADSHEET_ID = "1Nt5VXh2NVnGgK6wS_WIjVV-e609VQlxK--46jP3LgHg";
  
  try {
    const data = JSON.parse(e.postData.contents);
    return processData(data, SPREADSHEET_ID);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Web App está ativo e funcionando! A integração deve ser feita via POST." }))
    .setMimeType(ContentService.MimeType.JSON);
}

function processData(data, spreadsheetId) {
  const ss = SpreadsheetApp.openById(spreadsheetId);
  
  let leadsSheet = ss.getSheetByName("Leads");
  if (!leadsSheet) {
    leadsSheet = ss.insertSheet("Leads");
    const headers = [
      "Lead ID", "Criado em", "Atualizado em", "Status", "Etapa atual",
      "Nome completo", "WhatsApp", "Melhor e-mail", "Cidade", "Estado",
      "Situação informada", "Opção de interesse", "Uso de antibióticos",
      "Período preferido", "Datas ou horários informados", "UTM Source",
      "UTM Medium", "UTM Campaign", "UTM Content", "UTM Term",
      "FBCLID", "GCLID", "URL da página", "Referrer", "User Agent"
    ];
    leadsSheet.appendRow(headers);
    leadsSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    leadsSheet.setFrozenRows(1);
  }

  let kanbanSheet = ss.getSheetByName("Kanban");
  const kanbanColumns = [
    "Filtro aberto (Abriu o filtro)",
    "Filtro iniciado (Começou a responder)",
    "Respondendo perguntas (Ainda no preenchimento)",
    "Lead gerado(Lead formado)",
    "Filtro concluído(Concluiu o filtro)",
    "WhatsApp aberto(clicou para WhatsApp)"
  ];
  
  if (!kanbanSheet) {
    kanbanSheet = ss.insertSheet("Kanban");
  }
  
  kanbanSheet.getRange(1, 1, 1, kanbanColumns.length).setValues([kanbanColumns]).setFontWeight("bold");


  const leadId = data.leadId;
  if (!leadId) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "No leadId provided" }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const rowData = [
    data.leadId || "",
    data.createdAt || "",
    data.updatedAt || "",
    data.status || "",
    data.currentStep || "",
    data.nomeCompleto || "",
    data.whatsapp || "",
    data.email || "",
    data.cidade || "",
    data.estado || "",
    data.comportamentoHalito || "",
    data.opcaoInteresse || "",
    data.usoAntibiotico || "",
    data.periodoPreferido || "",
    data.datasPreferidas || "",
    data.utmSource || "",
    data.utmMedium || "",
    data.utmCampaign || "",
    data.utmContent || "",
    data.utmTerm || "",
    data.fbclid || "",
    data.gclid || "",
    data.pageUrl || "",
    data.referrer || "",
    data.userAgent || ""
  ];

  const dataRange = leadsSheet.getDataRange();
  const values = dataRange.getValues();
  let rowIndex = -1;

  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === leadId) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex > -1) {
    leadsSheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    leadsSheet.appendRow(rowData);
  }

  // Regenerate Kanban sheet fully
  const lastRow = kanbanSheet.getLastRow();
  const lastCol = Math.max(kanbanSheet.getLastColumn(), kanbanColumns.length);
  if (lastRow > 1) {
    kanbanSheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
  
  const allLeadsData = leadsSheet.getDataRange().getValues();
  const stateMap = {};
  kanbanColumns.forEach(c => stateMap[c] = []);
  
  // Headers are in index 0. Status is index 3. Nome completo is index 5.
  for (let i = 1; i < allLeadsData.length; i++) {
    const status = allLeadsData[i][3];
    const name = allLeadsData[i][5] || "Lead s/ nome";
    if (stateMap[status] !== undefined) {
      stateMap[status].push(name);
    }
  }

  const maxRows = Math.max(...kanbanColumns.map(c => stateMap[c].length));
  if (maxRows > 0) {
    const kanbanOutput = [];
    for (let r = 0; r < maxRows; r++) {
      const row = [];
      for (const col of kanbanColumns) {
        row.push(stateMap[col][r] || "");
      }
      kanbanOutput.push(row);
    }
    kanbanSheet.getRange(2, 1, kanbanOutput.length, kanbanColumns.length).setValues(kanbanOutput);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: "success", leadId: leadId }))
    .setMimeType(ContentService.MimeType.JSON);
}

// Função para testar no editor do Apps Script sem precisar de Web App
function testarScript() {
  const SPREADSHEET_ID = "1Nt5VXh2NVnGgK6wS_WIjVV-e609VQlxK--46jP3LgHg";
  const mockData = {
    leadId: "test-id-12345",
    createdAt: new Date().toISOString(),
    status: "Teste via Editor",
    nomeCompleto: "Pessoa Teste"
  };
  
  const result = processData(mockData, SPREADSHEET_ID);
  Logger.log(result.getContent());
}
