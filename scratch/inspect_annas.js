import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import fs from 'fs';

const agent = new https.Agent({ rejectUnauthorized: false });

async function inspectAnnasArchive() {
  const url = 'https://annas-archive.is/search?q=aventuras+de+pin';
  console.log(`Fetching: ${url}`);
  
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      httpsAgent: agent,
      timeout: 12000
    });

    console.log(`Status: ${res.status}, Length: ${res.data.length}`);
    fs.writeFileSync('scratch/annas_sample.html', res.data);

    const $ = cheerio.load(res.data);
    
    console.log('\n--- PARSING SELECTORS ---');
    // Let's check various selectors on Anna's Archive
    const searchItems = [];
    
    // Anna's Archive uses `.h-[125px]` or `a.js-vim-focus` or `a[href*="/md5/"]`
    $('a[href*="/md5/"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const h3 = $(el).find('h3').text().trim();
      const img = $(el).find('img').attr('src');
      searchItems.push({ href, h3, text: text.substring(0, 120), img });
    });

    console.log(`Found ${searchItems.length} md5 items:`);
    searchItems.slice(0, 10).forEach((item, idx) => {
      console.log(`[${idx + 1}] H3: "${item.h3}" | Href: ${item.href}`);
      console.log(`    Text: ${item.text}`);
      console.log(`    Cover: ${item.img}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  }
}

inspectAnnasArchive();
