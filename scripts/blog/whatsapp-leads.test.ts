import test from 'node:test';
import assert from 'node:assert/strict';
import {derivarCanal, derivarOrigem, mapPayloadToRow} from '../../lib/mapLead';
import {classifyAcquisition} from '../../src/utils/acquisition';
import {isValidAnuncio, manualAcquisition, phoneKey, WHATSAPP_CAMPAIGN} from '../../lib/whatsappLeads';

test('mesmo número em formatos diferentes vira a mesma chave', () => {
  assert.equal(phoneKey('(62) 99999-1234'), '99991234');
  assert.equal(phoneKey('+55 62 99999-1234'), '99991234');
  assert.equal(phoneKey('62999991234'), '99991234');
  assert.equal(phoneKey('123'), '');
  assert.equal(phoneKey(null), '');
});

test('cadastro manual do anúncio entra como Meta Ads na campanha de WhatsApp', () => {
  assert.deepEqual(manualAcquisition('W04'), {
    utm_source:'instagram', utm_medium:'paid_social', utm_campaign:WHATSAPP_CAMPAIGN,
    utm_content:'W04 · Receitas milagrosas', origem:'Meta Ads', channel_derived:'Paid Social',
  });
  assert.equal(manualAcquisition('anuncio_sem_codigo').utm_content, null);
  assert.equal(manualAcquisition('anuncio_sem_codigo').origem, 'Meta Ads');
  assert.equal(manualAcquisition('nao_anuncio').origem, 'WhatsApp');
  assert.equal(isValidAnuncio('W01'), true);
  assert.equal(isValidAnuncio('W99'), false);
  assert.equal(isValidAnuncio(''), false);
});

test('triagem pelo link do WhatsApp tem origem própria nos dois lados', () => {
  assert.equal(derivarOrigem({utmSource:'whatsapp', utmMedium:'triagem'}), 'WhatsApp');
  assert.equal(derivarCanal({utmSource:'whatsapp', utmMedium:'triagem'}), 'Messaging');
  assert.deepEqual(classifyAcquisition({utmSource:'whatsapp', utmMedium:'triagem'}), {channel:'Messaging', provider:'WhatsApp'});
  // gclid continua vencendo, e o resto da classificação não muda.
  assert.equal(derivarOrigem({utmSource:'whatsapp', gclid:'x'}), 'Google Ads');
  assert.equal(derivarOrigem({utmSource:'instagram', utmMedium:'paid_social'}), 'Meta Ads');
});

test('triagem anexada a um cadastro manual não carrega aquisição', () => {
  const row = mapPayloadToRow({leadId:'manual-1', nomeCompleto:'Pessoa', whatsapp:'62999991234', status:'Filtro concluído(Concluiu o filtro)'});
  assert.equal(row.origem, null);
  assert.equal(row.utm_source, null);
  assert.equal(row.current_acquisition_available, false);
});
