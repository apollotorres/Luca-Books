import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const agent = new https.Agent({ rejectUnauthorized: false });

const ANNA_MIRRORS = [
  'https://annas-archive.is',
  'https://annas-archive.li',
  'https://annas-archive.pm',
  'https://annas-archive.gs'
];

const LIBGEN_MIRRORS = [
  'https://libgen.li',
  'https://libgen.gs',
  'https://libgen.vg'
];

export async function searchAnnasArchiveEngine(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  console.log(`[Anna Search] Executing Anna's Archive search for: "${cleanQ}" (format: ${format}, lang: ${lang})`);

  let allResults = [];
  const seenIds = new Set();

  // 1. First Priority: Direct Anna's Archive Search Engine
  for (const mirror of ANNA_MIRRORS) {
    try {
      const url = `${mirror}/search?q=${encodeURIComponent(cleanQ)}`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        httpsAgent: agent,
        timeout: 7000
      });

      if (!res.data || res.data.length < 5000) continue;

      const $ = cheerio.load(res.data);
      const mirrorResults = [];

      $('h3').each((i, el) => {
        const titleLink = $(el).find('a').first();
        const rawTitle = titleLink.text().replace(/\s+/g, ' ').trim();
        const href = titleLink.attr('href') || $(el).closest('a').attr('href') || '';
        
        if (!rawTitle || rawTitle.length < 2) return;

        const container = $(el).closest('div.min-w-0, div.flex-1').parent();
        const img = container.find('img').first().attr('src') || '';
        
        const metaDivs = container.find('div.text-sm');
        let authorAndMeta = metaDivs.first().text().replace(/\s+/g, ' ').trim();
        let publisher = '';
        metaDivs.each((_, m) => {
          const txt = $(m).text().trim();
          if (txt.toLowerCase().startsWith('publisher:')) {
            publisher = txt.replace(/^publisher:\s*/i, '').trim();
          }
        });

        const snippet = container.find('p.text-sm').text().replace(/\s+/g, ' ').trim();
        const parts = authorAndMeta.split('·').map(p => p.trim());
        const author = parts[0] && !parts[0].toLowerCase().includes('catalog') ? parts[0] : 'Autor Desconhecido';
        
        let fileExt = 'epub';
        let size = '2.0 MB';
        let year = null;

        for (const p of parts) {
          const num = parseInt(p, 10);
          if (num > 1500 && num < 2030 && !year) year = num;
          if (/\b(epub|pdf|mobi|azw3|djvu)\b/i.test(p)) {
            const match = p.match(/\b(epub|pdf|mobi|azw3|djvu)\b/i);
            if (match) fileExt = match[1].toLowerCase();
          }
          if (/\b(\d+(\.\d+)?\s*(mb|kb|gb|b))\b/i.test(p)) {
            const match = p.match(/\b(\d+(\.\d+)?\s*(mb|kb|gb|b))\b/i);
            if (match) size = match[1].toUpperCase();
          }
        }

        // Language detection
        let bookLang = 'en';
        const lowerMeta = (rawTitle + ' ' + authorAndMeta + ' ' + snippet).toLowerCase();
        if (lowerMeta.includes('portug') || lowerMeta.includes('brasil') || lowerMeta.includes('brazil') || lowerMeta.includes('em português')) {
          bookLang = 'pt';
        } else if (lowerMeta.includes('span') || lowerMeta.includes('español') || lowerMeta.includes('espanhol')) {
          bookLang = 'es';
        }

        let md5 = null;
        const md5Match = href.match(/\/md5\/([a-f0-9]{32})/i) || href.match(/([a-f0-9]{32})/i);
        if (md5Match) md5 = md5Match[1].toLowerCase();

        const uniqueKey = md5 || href || rawTitle.toLowerCase();
        if (seenIds.has(uniqueKey)) return;
        seenIds.add(uniqueKey);

        const fullHref = href.startsWith('http') ? href : `${mirror}${href.startsWith('/') ? '' : '/'}${href}`;
        const downloadUrl = md5 ? `https://annas-archive.is/md5/${md5}` : fullHref;

        mirrorResults.push({
          id: md5 || `anna-${Buffer.from(rawTitle).toString('hex').substring(0, 16)}`,
          title: rawTitle,
          author,
          year,
          publisher,
          cover: img || `https://covers.openlibrary.org/b/id/12717088-L.jpg`,
          format: fileExt,
          size,
          language: bookLang,
          downloadUrl,
          source: "Anna's Archive",
          md5,
          snippet
        });
      });

      if (mirrorResults.length > 0) {
        console.log(`[Anna Search] Successfully retrieved ${mirrorResults.length} books from ${mirror}`);
        allResults = mirrorResults;
        break;
      }
    } catch (err) {
      console.warn(`[Anna Search] Mirror ${mirror} notice:`, err.message);
    }
  }

  // 2. Secondary fallback / enrichment from Libgen general mirror
  if (allResults.length === 0) {
    console.log(`[Anna Search] Falling back to decentralized mirrors for: "${cleanQ}"`);
    for (const mirror of LIBGEN_MIRRORS) {
      try {
        const url = `${mirror}/index.php?req=${encodeURIComponent(cleanQ)}&res=50`;
        const res = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 6000
        });

        if (!res.data || typeof res.data !== 'string') continue;

        const $ = cheerio.load(res.data);
        $('table#tablelibgen tbody tr, table.table tbody tr').each((i, el) => {
          const tds = $(el).find('td');
          if (tds.length < 8) return;

          const titleLink = tds.eq(0).find('a').first();
          const rawTitle = titleLink.text().trim();
          const href = titleLink.attr('href') || '';
          const rawAuthor = tds.eq(1).text().trim() || 'Autor Desconhecido';
          const yearStr = tds.eq(3).text().trim();
          const year = parseInt(yearStr, 10) || null;
          const rawLang = tds.eq(4).text().trim().toLowerCase();
          const sizeStr = tds.eq(6).text().trim();
          const fileExt = tds.eq(7).text().trim().toLowerCase();

          const rowHtml = $(el).html() || '';
          const md5Match = rowHtml.match(/md5=([a-f0-9]{32})/i) || href.match(/([a-f0-9]{32})/i);
          const md5 = md5Match ? md5Match[1].toLowerCase() : null;

          if (!rawTitle || rawTitle.length < 2) return;
          const uniqueKey = md5 || rawTitle.toLowerCase();
          if (seenIds.has(uniqueKey)) return;
          seenIds.add(uniqueKey);

          let bookLang = 'en';
          if (rawLang.includes('portug') || rawLang === 'pt' || rawLang.includes('brazil')) bookLang = 'pt';
          else if (rawLang.includes('span') || rawLang === 'es') bookLang = 'es';

          allResults.push({
            id: md5 || `anna-${href.replace(/[^a-zA-Z0-9_-]/g, '')}`,
            title: rawTitle.replace(/\s+/g, ' ').replace(/\d{10,13}.*$/, '').trim(),
            author: rawAuthor.replace(/\s+/g, ' ').replace(/;$/, '').trim(),
            year,
            publisher: '',
            cover: `https://covers.openlibrary.org/b/id/12717088-L.jpg`,
            format: fileExt,
            size: sizeStr ? sizeStr.toUpperCase() : '2.0 MB',
            language: bookLang,
            downloadUrl: md5 ? `https://annas-archive.is/md5/${md5}` : `${mirror}/${href}`,
            source: "Anna's Archive",
            md5
          });
        });

        if (allResults.length > 0) break;
      } catch (err) {
        console.warn(`[Anna Search] Libgen mirror ${mirror} error:`, err.message);
      }
    }
  }

  // Filter by format if requested
  let filtered = allResults;
  if (format && format !== 'all') {
    const fmt = format.toLowerCase();
    const exact = filtered.filter(b => b.format === fmt);
    if (exact.length > 0) {
      filtered = exact;
    }
  }

  // Sort: Portuguese language first, then title relevance
  filtered.sort((a, b) => {
    const aPt = a.language === 'pt' ? 1 : 0;
    const bPt = b.language === 'pt' ? 1 : 0;
    if (aPt !== bPt) return bPt - aPt;

    const q = cleanQ.toLowerCase();
    const aExact = a.title.toLowerCase().includes(q) ? 1 : 0;
    const bExact = b.title.toLowerCase().includes(q) ? 1 : 0;
    return bExact - aExact;
  });

  return filtered;
}

async function test() {
  const r1 = await searchAnnasArchiveEngine('aventuras de pin');
  console.log(`Results for "aventuras de pin":`, r1.length);
  r1.slice(0, 3).forEach(b => console.log(` - ${b.title} (${b.author}) [${b.format}]`));

  const r2 = await searchAnnasArchiveEngine('canção para ninar menino grande');
  console.log(`Results for "canção para ninar menino grande":`, r2.length);
  r2.slice(0, 3).forEach(b => console.log(` - ${b.title} (${b.author}) [${b.format}]`));

  const r3 = await searchAnnasArchiveEngine('dom casmurro');
  console.log(`Results for "dom casmurro":`, r3.length);
  r3.slice(0, 3).forEach(b => console.log(` - ${b.title} (${b.author}) [${b.format}]`));
}

test();
