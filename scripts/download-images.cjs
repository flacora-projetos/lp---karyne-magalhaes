const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const dir = path.join(__dirname, '../public/images');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

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

function downloadFile(url, dest, cookies = '') {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const options = {
      headers: {
        'Cookie': cookies
      }
    };
    
    lib.get(url, options, (response) => {
      let newCookies = cookies;
      if (response.headers['set-cookie']) {
        newCookies = response.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
      }

      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        let loc = response.headers.location;
        if (loc.startsWith('/')) {
            const urlObj = new URL(url);
            loc = `${urlObj.protocol}//${urlObj.host}${loc}`;
        }
        return downloadFile(loc, dest, newCookies).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        const stats = fs.statSync(dest);
        if (stats.size < 10000) {
           console.log(`Warning: File ${dest} is very small (${stats.size} bytes). Might be an HTML error page.`);
        }
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  for (const file of files) {
    const dest = path.join(dir, file.name);
    console.log(`Downloading ${file.name}...`);
    // Drive download url format that usually bypasses virus warning for small files
    const url = `https://drive.google.com/uc?export=download&id=${file.id}`;
    
    try {
      await downloadFile(url, dest);
      console.log(`Successfully downloaded ${file.name}`);
    } catch (err) {
      console.error(`Failed to download ${file.name}:`, err.message);
    }
  }
}

main();
