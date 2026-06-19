import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const files = [
  { id: '1_R1q6m9jY9ey84Pt7VC2Q94zOqtFR53m', name: 'karyne_hero.jpeg' },
  { id: '1neQxPznSGT9lWFCIddPJLx3DmSm3Xr1y', name: 'atendimento_confiança.jpeg' },
  { id: '1b6IbsEI5w80L_DtstqeBQ28ZIZSh-IIb', name: 'equipamentos_tech.jpeg' },
  { id: '1HIpB6a4K4NEXF0j2CvdvYAHrm1Uwiqzx', name: 'detalhe_equipamento.jpeg' },
  { id: '1R998hGla_Qn0l4drizl-GvlvliHwaMtI', name: 'karyne_avaliação.jpeg' },
  { id: '1kv65riwY8jFAEZ9DYFslI8P7Q2ZIJNVD', name: 'karyne_autoridade.jpeg' },
  { id: '1voNMbzEWjLDbnt6e4O8cC9pI8G9gH6Ba', name: 'formação_conteúdo.jpeg' },
  { id: '1-1M-IWgJPfDvGOJX0nVmdnpa9joM3UVA', name: 'karyne_hero_2.jpeg' },
];

async function downloadFile(id, filename) {
  const url = `https://drive.google.com/uc?export=download&id=${id}`;
  console.log(`Downloading ${filename}...`);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Failed to download ${filename}: ${response.statusText}`);
    return;
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(path.join(process.cwd(), 'public/images', filename), buffer);
  console.log(`Successfully downloaded ${filename} (${buffer.length} bytes)`);
}

async function main() {
  for (const file of files) {
    await downloadFile(file.id, file.name);
  }
}

main();
