import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import fs from 'fs';

const agent = new https.Agent({ rejectUnauthorized: false });

async function run() {
  const url = 'https://annas-archive.is/books/409153-dom-casmurro';
  const res = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    httpsAgent: agent
  });

  fs.writeFileSync('scratch/book_detail.html', res.data);
  const $ = cheerio.load(res.data);

  console.log('--- Links in book detail page ---');
  $('a').each((i, el) => {
    const h = $(el).attr('href');
    const t = $(el).text().replace(/\s+/g, ' ').trim();
    if (h && (h.includes('download') || h.includes('libgen') || h.includes('get.php') || h.includes('md5') || h.includes('fast_download') || h.includes('slow_download') || h.includes('ipfs') || h.includes('partner') || h.includes('external') || h.includes('http'))) {
      console.log(`[${i}] ${t.substring(0, 50)} -> ${h}`);
    }
  });

  console.log('\n--- Buttons in page ---');
  $('button, form').each((i, el) => {
    console.log($(el).text().trim(), $(el).attr('action'));
  });
}

run();
