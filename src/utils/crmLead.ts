export type CrmLeadResult = { success: boolean; error?: string };

export async function sendLeadToCrm(
  payload: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<CrmLeadResult> {
  try {
    const response = await fetchImpl('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (!response.ok) return {success:false,error:`HTTP ${response.status}`};
    const result = await response.json().catch(() => null) as {success?: boolean; error?: string} | null;
    if (result?.success === true) return {success:true};
    return {success:false,error:result?.error || 'CRM não confirmou persistência'};
  } catch (error) {
    return {success:false,error:error instanceof Error ? error.message : 'Falha de transporte'};
  }
}
