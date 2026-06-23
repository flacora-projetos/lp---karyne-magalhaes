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
  let headers = [
    "Lead ID", "Criado em", "Atualizado em", "Status", "Etapa atual",
    "Nome completo", "WhatsApp", "Melhor e-mail", "Cidade", "Estado",
    "Situação informada", "Opção de interesse", "Uso de antibióticos",
    "Período preferido", "Datas ou horários informados", "UTM Source",
    "UTM Medium", "UTM Campaign", "UTM Content", "UTM Term",
    "FBCLID", "GCLID", "URL da página", "Referrer", "User Agent",
    "Event ID FilterOpen", "Event ID ContactCaptured", "Event ID Lead",
    "Event ID Contact", "Meta FBP", "Meta FBC"
  ];
  
  if (!leadsSheet) {
    leadsSheet = ss.insertSheet("Leads");
    leadsSheet.appendRow(headers);
    leadsSheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    leadsSheet.setFrozenRows(1);
  } else {
    // Check if new columns exist, append if missing
    const currentHeaders = leadsSheet.getRange(1, 1, 1, leadsSheet.getLastColumn()).getValues()[0];
    const missingHeaders = headers.filter(h => !currentHeaders.includes(h));
    if (missingHeaders.length > 0) {
      leadsSheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]).setFontWeight("bold");
    }
    // Update headers array to match the actual sheet columns order
    headers = leadsSheet.getRange(1, 1, 1, leadsSheet.getLastColumn()).getValues()[0];
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

  const valuesMap = {
    "Lead ID": data.leadId || "",
    "Criado em": data.createdAt || "",
    "Atualizado em": data.updatedAt || "",
    "Status": data.status || "",
    "Etapa atual": data.currentStep || "",
    "Nome completo": data.nomeCompleto || "",
    "WhatsApp": data.whatsapp || "",
    "Melhor e-mail": data.email || "",
    "Cidade": data.cidade || "",
    "Estado": data.estado || "",
    "Situação informada": data.comportamentoHalito || "",
    "Opção de interesse": data.opcaoInteresse || "",
    "Uso de antibióticos": data.usoAntibiotico || "",
    "Período preferido": data.periodoPreferido || "",
    "Datas ou horários informados": data.datasPreferidas || "",
    "UTM Source": data.utmSource || "",
    "UTM Medium": data.utmMedium || "",
    "UTM Campaign": data.utmCampaign || "",
    "UTM Content": data.utmContent || "",
    "UTM Term": data.utmTerm || "",
    "FBCLID": data.fbclid || "",
    "GCLID": data.gclid || "",
    "URL da página": data.pageUrl || "",
    "Referrer": data.referrer || "",
    "User Agent": data.userAgent || "",
    "Event ID FilterOpen": data.eventIdFilterOpen || "",
    "Event ID ContactCaptured": data.eventIdContactCaptured || "",
    "Event ID Lead": data.eventIdLead || "",
    "Event ID Contact": data.eventIdContact || "",
    "Meta FBP": data.metaFbp || "",
    "Meta FBC": data.metaFbc || ""
  };
  
  const rowData = headers.map(h => valuesMap[h] !== undefined ? valuesMap[h] : "");

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
  
  // Headers are in index 0. Status is index 3. Nome completo is index 5. Atualizado em is index 2.
  const statusIdx = allLeadsData[0].indexOf("Status");
  const nameIdx = allLeadsData[0].indexOf("Nome completo");
  const updatedIdx = allLeadsData[0].indexOf("Atualizado em");

  for (let i = 1; i < allLeadsData.length; i++) {
    const status = allLeadsData[i][statusIdx !== -1 ? statusIdx : 3];
    const name = allLeadsData[i][nameIdx !== -1 ? nameIdx : 5] || "Lead s/ nome";
    const updatedAt = allLeadsData[i][updatedIdx !== -1 ? updatedIdx : 2];
    
    let dateStr = "";
    if (updatedAt) {
      try {
        const dateObj = new Date(updatedAt);
        if (!isNaN(dateObj.getTime())) {
          dateStr = Utilities.formatDate(dateObj, "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
        }
      } catch(e) {}
    }
    
    const displayText = dateStr ? `${name}\n${dateStr}` : name;

    if (stateMap[status] !== undefined) {
      stateMap[status].push(displayText);
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
