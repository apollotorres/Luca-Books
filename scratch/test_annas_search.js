import axios from 'axios';
import * as cheerio from 'cheerio';

const MIRRORS = [
  'https://annas-archive.org',
  'https://annas-archive.li',
  'https://annas-archive.se',
  'https://annas-archive.pm',
  'https://annas-archive.gd',
  'https://annas-archive.gl'
];

async function testMirror(mirror, query) {
  const url = `${mirror}/search?q=${encodeURIComponent(query)}&lang=pt&ext=epub`;
  console.log(`\n--- Testing ${url} ---`);
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 8000
    });

    console.log(`Status: ${res.status}, Length: ${res.data.length}`);
    const $ = cheerio.load(res.data);
    
    // Check titles / links found
    const md5Links = [];
    $('a[href*="/md5/"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      const img = $(el).find('img').attr('src');
      md5Links.push({ href, text: text.substring(0, 80), img });
    });

    console.log(`Found ${md5Links.length} /md5/ links`);
    if (md5Links.length > 0) {
      console.log('Sample results:', md5Links.slice(0, 4));
      return { success: true, count: md5Links.length, mirror };
    }
  } catch (err) {
    console.log(`Error on ${mirror}:`, err.message, err.response ? `Status ${err.response.status}` : '');
    return { success: false, error: err.message };
  }
}

async function run() {
  const query = 'aventuras de pin';
  console.log(`Testing query: "${query}"`);
  for (const m of MIRRORS) {
    await testMirror(m, query);
  }
}

run();
