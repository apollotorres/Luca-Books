import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

const ANNA_SEARCH_MIRRORS = [
  'https://annas-archive.is',
  'https://annas-archive.li',
  'https://annas-archive.pm'
];

async function searchAnnas(query) {
  console.log(`\n========================================`);
  console.log(`Searching Anna's Archive for: "${query}"`);
  console.log(`========================================`);

  for (const mirror of ANNA_SEARCH_MIRRORS) {
    try {
      const url = `${mirror}/search?q=${encodeURIComponent(query)}`;
      console.log(`Trying ${url}...`);

      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        httpsAgent: agent,
        timeout: 10000
      });

      if (!res.data || res.data.length < 5000) {
        console.log(`Response too short (${res.data?.length || 0} bytes) on ${mirror}`);
        continue;
      }

      const $ = cheerio.load(res.data);
      const items = [];

      // Find all book card blocks:
      // Anna's Archive book rows are structured with `h3` tags containing the title
      $('h3').each((i, el) => {
        const titleLink = $(el).find('a').first();
        const title = titleLink.text().replace(/\s+/g, ' ').trim();
        const href = titleLink.attr('href') || $(el).closest('a').attr('href') || '';
        
        if (!title || title.length < 2) return;

        const container = $(el).closest('div.min-w-0, div.flex-1').parent();
        const img = container.find('img').first().attr('src') || '';
        
        // Metadata text (Author, year, size, format, publisher)
        const metaDivs = container.find('div.text-sm');
        let authorAndMeta = metaDivs.first().text().replace(/\s+/g, ' ').trim();
        let publisher = '';
        metaDivs.each((_, m) => {
          const txt = $(m).text().trim();
          if (txt.toLowerCase().startsWith('publisher:')) {
            publisher = txt.replace(/^publisher:\s*/i, '').trim();
          }
        });

        // Snippet description
        const snippet = container.find('p.text-sm').text().replace(/\s+/g, ' ').trim();

        // Extract metadata parts: author · year · format/size · catalog
        const parts = authorAndMeta.split('·').map(p => p.trim());
        const author = parts[0] || 'Autor Desconhecido';
        
        // File extension / format from parts
        let fileExt = 'epub';
        let size = '2.0 MB';
        let year = null;

        for (const p of parts) {
          const num = parseInt(p, 10);
          if (num > 1500 && num < 2030 && !year) {
            year = num;
          }
          if (/\b(epub|pdf|mobi|azw3|djvu|cbr|cbz)\b/i.test(p)) {
            const match = p.match(/\b(epub|pdf|mobi|azw3|djvu|cbr|cbz)\b/i);
            if (match) fileExt = match[1].toLowerCase();
          }
          if (/\b(\d+(\.\d+)?\s*(mb|kb|gb|b))\b/i.test(p)) {
            const match = p.match(/\b(\d+(\.\d+)?\s*(mb|kb|gb|b))\b/i);
            if (match) size = match[1].toUpperCase();
          }
        }

        // Extract MD5 from href
        let md5 = null;
        const md5Match = href.match(/\/md5\/([a-f0-9]{32})/i) || href.match(/([a-f0-9]{32})/i);
        if (md5Match) {
          md5 = md5Match[1].toLowerCase();
        }

        items.push({
          id: md5 || `anna-${href.replace(/[^a-zA-Z0-9_-]/g, '')}`,
          title,
          author,
          year,
          publisher,
          cover: img || `https://covers.openlibrary.org/b/id/12717088-L.jpg`,
          fileExt,
          size,
          snippet,
          href,
          md5
        });
      });

      console.log(`Found ${items.length} books on ${mirror} for "${query}":`);
      items.slice(0, 5).forEach((item, idx) => {
        console.log(`[${idx + 1}] ${item.title}`);
        console.log(`    Autor: ${item.author} | Ano: ${item.year} | Formato: ${item.fileExt} (${item.size})`);
        console.log(`    Link: ${item.href}`);
        console.log(`    Capa: ${item.cover}`);
      });

      return items;
    } catch (err) {
      console.log(`Error on ${mirror}:`, err.message);
    }
  }
}

async function run() {
  await searchAnnas('aventuras de pin');
  await searchAnnas('dom casmurro');
  await searchAnnas('canção para ninar menino grande');
}

run();
