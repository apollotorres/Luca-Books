import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Anna's Archive Direct Search Mirrors
const ANNAS_SEARCH_MIRRORS = [
  'https://annas-archive.is',
  'https://annas-archive.li',
  'https://annas-archive.pm',
  'https://annas-archive.gs',
  'https://annas-archive.pk'
];

// High-speed file host mirrors for key resolution and direct binary downloads
const DOWNLOAD_MIRRORS = [
  'https://libgen.li',
  'https://libgen.gs',
  'https://libgen.vg',
  'https://libgen.pm',
  'https://libgen.rocks'
];

/**
 * Direct Anna's Archive search resolver:
 * Matches Anna's Archive's website search engine with typo-tolerance, full metadata & covers.
 */
export async function searchAnnasArchive(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  console.log(`[Anna's Archive] Searching Anna's Archive index for: "${cleanQ}" (format: ${format}, lang: ${lang})`);

  let allResults = [];
  const seenIds = new Set();

  // 1. Direct Search on Anna's Archive Mirrors
  for (const mirror of ANNAS_SEARCH_MIRRORS) {
    try {
      const searchUrl = `${mirror}/search?q=${encodeURIComponent(cleanQ)}`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        httpsAgent,
        timeout: 8000
      });

      if (!response.data || typeof response.data !== 'string' || response.data.length < 3000) {
        continue;
      }

      const $ = cheerio.load(response.data);
      const mirrorResults = [];

      $('h3').each((i, el) => {
        const titleLink = $(el).find('a').first();
        const rawTitle = titleLink.text().replace(/\s+/g, ' ').trim();
        const href = titleLink.attr('href') || $(el).closest('a').attr('href') || '';
        
        if (!rawTitle || rawTitle.length < 2) return;

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

        const snippet = container.find('p.text-sm').text().replace(/\s+/g, ' ').trim();

        // Extract metadata parts: author · year · format/size · catalog
        const parts = authorAndMeta.split('·').map(p => p.trim());
        let author = parts[0] && !parts[0].toLowerCase().includes('catalog') ? parts[0] : 'Autor Desconhecido';
        if (author.includes(';')) author = author.split(';')[0].trim();
        
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
        } else if (lowerMeta.includes('french') || lowerMeta.includes('français')) {
          bookLang = 'fr';
        } else if (lowerMeta.includes('german') || lowerMeta.includes('deutsch')) {
          bookLang = 'de';
        }

        let md5 = null;
        const md5Match = href.match(/\/md5\/([a-f0-9]{32})/i) || href.match(/([a-f0-9]{32})/i);
        if (md5Match) md5 = md5Match[1].toLowerCase();

        const uniqueKey = md5 || href || rawTitle.toLowerCase();
        if (seenIds.has(uniqueKey)) return;
        seenIds.add(uniqueKey);

        const fullHref = href.startsWith('http') ? href : `${mirror}${href.startsWith('/') ? '' : '/'}${href}`;
        const downloadUrl = md5 ? `https://annas-archive.is/md5/${md5}` : fullHref;

        // Score relevance
        let score = 50;
        if (bookLang === 'pt') score += 100;
        if (fileExt === 'epub') score += 30;
        if (rawTitle.toLowerCase().includes(cleanQ.toLowerCase())) score += 50;

        mirrorResults.push({
          id: `anna_${md5 || Buffer.from(rawTitle).toString('hex').substring(0, 16)}`,
          md5: md5,
          title: rawTitle,
          author: author,
          year: year,
          publisher: publisher,
          cover: img || `https://covers.openlibrary.org/b/id/12717088-L.jpg`,
          format: fileExt === 'pdf' ? 'pdf' : 'epub',
          size: size,
          language: bookLang,
          downloadUrl: downloadUrl,
          source: "Anna's Archive",
          badge: `${fileExt.toUpperCase()} • ${size}`,
          rating: 4.8 + Math.round(Math.random() * 2) / 10,
          description: snippet || `Disponível para leitura instantânea no acervo oficial do Anna's Archive.`,
          score: score
        });
      });

      if (mirrorResults.length > 0) {
        console.log(`[Anna's Archive] Found ${mirrorResults.length} books on ${mirror}!`);
        allResults = mirrorResults;
        break;
      }
    } catch (err) {
      console.warn(`[Anna's Archive] Mirror ${mirror} notice:`, err.message);
    }
  }

  // 2. Secondary fallback / enrichment from decentralized mirrors if needed
  if (allResults.length === 0) {
    console.log(`[Anna's Archive] Trying decentralized search mirrors for: "${cleanQ}"`);
    for (const mirror of DOWNLOAD_MIRRORS) {
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

          let cleanAuthor = rawAuthor.replace(/\s+/g, ' ').replace(/;$/, '').trim();
          if (cleanAuthor.includes(';')) cleanAuthor = cleanAuthor.split(';')[0].trim();

          const cleanTitle = rawTitle.replace(/\s+/g, ' ').replace(/\d{10,13}.*$/, '').trim();

          let score = 40;
          if (bookLang === 'pt') score += 100;
          if (fileExt === 'epub') score += 30;

          allResults.push({
            id: `anna_${md5 || Buffer.from(cleanTitle).toString('hex').substring(0, 16)}`,
            md5: md5,
            title: cleanTitle,
            author: cleanAuthor,
            year: year,
            publisher: '',
            cover: `https://covers.openlibrary.org/b/id/12717088-L.jpg`,
            format: fileExt === 'pdf' ? 'pdf' : 'epub',
            size: sizeStr ? sizeStr.toUpperCase() : '2.0 MB',
            language: bookLang,
            downloadUrl: md5 ? `https://annas-archive.is/md5/${md5}` : `${mirror}/${href}`,
            source: "Anna's Archive",
            badge: `${fileExt.toUpperCase()} • ${sizeStr ? sizeStr.toUpperCase() : '2 MB'}`,
            rating: 4.8,
            description: `Disponível no acervo universal Anna's Archive (MD5: ${md5 || 'N/A'}).`,
            score: score
          });
        });

        if (allResults.length > 0) break;
      } catch (err) {
        console.warn(`[Anna's Archive] Fallback mirror ${mirror} error:`, err.message);
      }
    }
  }

  // Filter by requested format if needed
  let filtered = allResults;
  if (format && format !== 'all') {
    const fmt = format.toLowerCase();
    const exact = filtered.filter(b => b.format === fmt);
    if (exact.length > 0) {
      filtered = exact;
    }
  }

  // Filter by language if specified
  if (lang && lang !== 'all') {
    const langExact = filtered.filter(b => b.language === lang);
    if (langExact.length > 0) {
      filtered = langExact;
    }
  }

  // Sort results: Portuguese first, then highest score
  filtered.sort((a, b) => (b.score || 0) - (a.score || 0));

  return filtered;
}

/**
 * Resolves direct high-speed download link with MD5 key on Anna's Archive mirrors
 */
export async function resolveAnnaDownloadUrl(md5, title = null) {
  if (!md5) return null;
  console.log(`[Anna Resolver] Resolving resilient download mirror for MD5: ${md5} (title: ${title || 'N/A'})`);

  for (const dom of DOWNLOAD_MIRRORS) {
    const urlsToTry = [
      `${dom}/ads.php?md5=${md5}`,
      `${dom}/get.php?md5=${md5}`
    ];

    for (const pageUrl of urlsToTry) {
      try {
        const res = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 4000
        });

        const $ = cheerio.load(res.data);
        let keyLink = null;
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          if (href && href.includes('key=')) {
            keyLink = href.startsWith('http') ? href : `${dom}/${href.replace(/^\//, '')}`;
          }
        });

        if (keyLink) {
          console.log(`[Anna Resolver] Resilient key link resolved on ${dom}: ${keyLink}`);
          return keyLink;
        }
      } catch (e) {
        // Continue to next mirror
      }
    }
  }

  // Auto-recovery by title if MD5 is unmirrored
  if (title && title.trim().length > 2) {
    console.log(`[Anna Resolver] Primary MD5 unmirrored. Auto-searching alternative Anna's Archive editions for "${title}"...`);
    try {
      const candidates = await searchAnnasArchive(title, 'epub', 'all');
      for (const cand of candidates) {
        if (cand.md5 && cand.md5.toLowerCase() !== md5.toLowerCase()) {
          console.log(`[Anna Resolver] Trying alternative edition MD5: ${cand.md5} (${cand.title})...`);
          for (const dom of DOWNLOAD_MIRRORS.slice(0, 3)) {
            try {
              const res = await axios.get(`${dom}/ads.php?md5=${cand.md5}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3500
              });
              const $ = cheerio.load(res.data);
              let altKey = null;
              $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('key=')) {
                  altKey = href.startsWith('http') ? href : `${dom}/${href.replace(/^\//, '')}`;
                }
              });
              if (altKey) {
                console.log(`🎉 [Anna Resolver] Auto-recovery SUCCESS: Found working mirror: ${altKey}`);
                return altKey;
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.warn('[Anna Resolver] Auto-recovery note:', err.message);
    }
  }

  return `https://libgen.li/ads.php?md5=${md5}`;
}
