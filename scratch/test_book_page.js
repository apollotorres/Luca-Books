import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

async function inspectBookPage(url) {
  console.log(`\n--- Fetching Book Page: ${url} ---`);
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      httpsAgent: agent,
      timeout: 10000
    });

    console.log(`Status: ${res.status}, Length: ${res.data.length}`);
    const $ = cheerio.load(res.data);

    console.log('Book Title:', $('h1').text().trim());
    
    // Look for download links / MD5 / external links / mirrors
    const downloadLinks = [];
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (href && (href.includes('/md5/') || href.includes('download') || href.includes('libgen') || href.includes('ipfs') || href.includes('get.php') || href.includes('/slow_download/') || href.includes('/fast_download/'))) {
        downloadLinks.push({ text: text.substring(0, 60), href });
      }
    });

    console.log(`Found ${downloadLinks.length} download/mirror links:`);
    downloadLinks.slice(0, 10).forEach((l, idx) => console.log(`  [${idx+1}] ${l.text} -> ${l.href}`));

    // Search for MD5 in page HTML
    const md5s = res.data.match(/[a-f0-9]{32}/gi);
    console.log('Unique MD5s in page:', Array.from(new Set(md5s || [])).slice(0, 5));

  } catch (err) {
    console.log('Error:', err.message);
  }
}

async function run() {
  await inspectBookPage('https://annas-archive.is/books/409153-dom-casmurro');
  await inspectBookPage('https://annas-archive.is/books/38850339-aventuras-de-pinoquio-em-portugues-do-brasil');
}

run();
