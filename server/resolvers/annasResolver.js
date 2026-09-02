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
 * Clean book title for search queries
 */
export function cleanTitleForSearch(title) {
  if (!title) return '';
  return title
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/Edição.*$/i, '')
    .replace(/Edicao.*$/i, '')
    .replace(/Vol(\.|\s).*$/i, '')
    .replace(/[,:;\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Direct search on Libgen decentralized mirrors
 */
async function searchLibgenMirrors(cleanQ) {
  const libgenResults = [];
  const seenMd5s = new Set();

  for (const mirror of DOWNLOAD_MIRRORS.slice(0, 3)) {
    try {
      const url = `${mirror}/index.php?req=${encodeURIComponent(cleanQ)}&res=50`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        httpsAgent,
        timeout: 5000
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

        if (!rawTitle || rawTitle.length < 2 || !md5) return;
        if (seenMd5s.has(md5)) return;
        seenMd5s.add(md5);

        let bookLang = 'en';
        if (rawLang.includes('portug') || rawLang === 'pt' || rawLang.includes('brazil')) bookLang = 'pt';
        else if (rawLang.includes('span') || rawLang === 'es') bookLang = 'es';

        let cleanAuthor = rawAuthor.replace(/\s+/g, ' ').replace(/;$/, '').trim();
        if (cleanAuthor.includes(';')) cleanAuthor = cleanAuthor.split(';')[0].trim();

        const cleanTitle = rawTitle.replace(/\s+/g, ' ').replace(/\d{10,13}.*$/, '').trim();

        let score = 40;
        if (bookLang === 'pt') score += 100;
        if (fileExt === 'epub') score += 50;

        libgenResults.push({
          id: `anna_${md5}`,
          md5: md5,
          title: cleanTitle,
          author: cleanAuthor,
          year: year,
          publisher: '',
          cover: `https://covers.openlibrary.org/b/id/12717088-L.jpg`,
          format: fileExt === 'pdf' ? 'pdf' : 'epub',
          size: sizeStr ? sizeStr.toUpperCase() : '2.0 MB',
          language: bookLang,
          downloadUrl: `https://annas-archive.is/md5/${md5}`,
          source: "Anna's Archive",
          badge: `${fileExt.toUpperCase()} • ${sizeStr ? sizeStr.toUpperCase() : '2 MB'}`,
          rating: 4.8,
          description: `Disponível no acervo universal Anna's Archive (MD5: ${md5}).`,
          score: score,
          fallbackMd5s: [md5]
        });
      });

      if (libgenResults.length > 0) break;
    } catch (e) {}
  }

  return libgenResults;
}

/**
 * Search Internet Archive (Archive.org) for high-speed direct downloads
 */
async function searchArchiveOrg(cleanQ) {
  const archiveResults = [];
  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(cleanQ)}+format%3A(EPUB+OR+pdf)&fl[]=identifier,title,creator,year,mediatype&rows=5&output=json`;
    const res = await axios.get(url, { timeout: 4000 });
    const docs = res.data?.response?.docs || [];

    for (const doc of docs) {
      if (!doc.identifier || !doc.title) continue;
      const author = Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Domínio Público');
      
      archiveResults.push({
        id: `ia_${doc.identifier}`,
        md5: null,
        iaIdentifier: doc.identifier,
        title: doc.title,
        author: author,
        year: doc.year || null,
        publisher: 'Internet Archive',
        cover: `https://archive.org/services/img/${doc.identifier}`,
        format: 'epub',
        size: '2.5 MB',
        language: 'pt',
        downloadUrl: `https://archive.org/download/${doc.identifier}`,
        source: "Internet Archive",
        badge: "EPUB • 2.5 MB",
        rating: 4.9,
        description: `Disponível com download instantâneo no acervo universal do Internet Archive.`,
        score: 60,
        fallbackMd5s: []
      });
    }
  } catch (e) {}
  return archiveResults;
}

/**
 * Resolve direct download from Internet Archive identifier
 */
async function resolveArchiveOrgEpub(identifier) {
  if (!identifier) return null;
  try {
    const filesUrl = `https://archive.org/metadata/${identifier}/files`;
    const res = await axios.get(filesUrl, { timeout: 4000 });
    const files = res.data?.result || [];
    
    // Look for EPUB first, then PDF
    const epub = files.find(f => f.name && f.name.toLowerCase().endsWith('.epub'));
    if (epub) {
      return `https://archive.org/download/${identifier}/${encodeURIComponent(epub.name)}`;
    }
    const pdf = files.find(f => f.name && f.name.toLowerCase().endsWith('.pdf'));
    if (pdf) {
      return `https://archive.org/download/${identifier}/${encodeURIComponent(pdf.name)}`;
    }
  } catch (e) {}
  return null;
}

/**
 * Direct search resolver:
 * Searches Anna's Archive, decentralized shadow library mirrors, and Internet Archive.
 */
export async function searchAnnasArchive(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  console.log(`[Search Resolver] Querying catalog for: "${cleanQ}" (format: ${format}, lang: ${lang})`);

  let annaResults = [];
  const seenKeys = new Set();

  // 1. Direct Search on Anna's Archive Mirrors
  for (const mirror of ANNAS_SEARCH_MIRRORS.slice(0, 3)) {
    try {
      const searchUrl = `${mirror}/search?q=${encodeURIComponent(cleanQ)}`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        httpsAgent,
        timeout: 7000
      });

      if (!response.data || typeof response.data !== 'string' || response.data.length < 2000) {
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

        const uniqueKey = md5 || rawTitle.toLowerCase();
        if (seenKeys.has(uniqueKey)) return;
        seenKeys.add(uniqueKey);

        const fullHref = href.startsWith('http') ? href : `${mirror}${href.startsWith('/') ? '' : '/'}${href}`;
        const downloadUrl = md5 ? `https://annas-archive.is/md5/${md5}` : fullHref;

        let score = 50;
        if (bookLang === 'pt') score += 100;
        if (fileExt === 'epub') score += 50;
        if (rawTitle.toLowerCase().includes(cleanQ.toLowerCase())) score += 50;
        if (md5) score += 40;

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
          score: score,
          fallbackMd5s: md5 ? [md5] : []
        });
      });

      if (mirrorResults.length > 0) {
        annaResults = mirrorResults;
        break;
      }
    } catch (err) {}
  }

  // 2. Query Libgen & Internet Archive in parallel
  const [libgenResults, archiveResults] = await Promise.all([
    searchLibgenMirrors(cleanQ),
    searchArchiveOrg(cleanQ)
  ]);

  // 3. Cross-match: Populate missing MD5s and group fallback alternative MD5s
  const allDiscoveredMd5s = libgenResults.map(lb => lb.md5).filter(Boolean);

  for (const annaBook of annaResults) {
    const cleanAnnaTitle = cleanTitleForSearch(annaBook.title).toLowerCase();
    
    // Find all matching libgen candidates for this title
    const matchingLibgen = libgenResults.filter(lb => {
      const cleanLbTitle = cleanTitleForSearch(lb.title).toLowerCase();
      return cleanLbTitle.includes(cleanAnnaTitle) || cleanAnnaTitle.includes(cleanLbTitle);
    });

    const candidateMd5List = matchingLibgen.map(m => m.md5).filter(Boolean);
    if (!annaBook.md5 && candidateMd5List.length > 0) {
      annaBook.md5 = candidateMd5List[0];
      annaBook.downloadUrl = `https://annas-archive.is/md5/${candidateMd5List[0]}`;
      annaBook.id = `anna_${candidateMd5List[0]}`;
      annaBook.score += 40;
    }

    annaBook.fallbackMd5s = Array.from(new Set([
      ...(annaBook.md5 ? [annaBook.md5] : []),
      ...candidateMd5List,
      ...allDiscoveredMd5s.slice(0, 3)
    ]));
  }

  // Combine results: Anna results + Libgen + Archive.org
  const combined = [...annaResults];
  for (const lb of libgenResults) {
    const isPresent = combined.some(b => b.md5 === lb.md5 || cleanTitleForSearch(b.title).toLowerCase() === cleanTitleForSearch(lb.title).toLowerCase());
    if (!isPresent) {
      lb.fallbackMd5s = allDiscoveredMd5s;
      combined.push(lb);
    }
  }

  for (const ar of archiveResults) {
    const isPresent = combined.some(b => cleanTitleForSearch(b.title).toLowerCase() === cleanTitleForSearch(ar.title).toLowerCase());
    if (!isPresent) {
      combined.push(ar);
    }
  }

  // Filter by format if requested
  let filtered = combined;
  if (format && format !== 'all') {
    const fmt = format.toLowerCase();
    const exact = filtered.filter(b => b.format === fmt);
    if (exact.length > 0) filtered = exact;
  }

  // Filter by language if specified
  if (lang && lang !== 'all') {
    const langExact = filtered.filter(b => b.language === lang);
    if (langExact.length > 0) filtered = langExact;
  }

  // Sort: Portuguese first, epub first, verified MD5 first, then score
  filtered.sort((a, b) => {
    const aIsPt = a.language === 'pt' ? 1 : 0;
    const bIsPt = b.language === 'pt' ? 1 : 0;
    if (aIsPt !== bIsPt) return bIsPt - aIsPt;

    const aHasMd5 = a.md5 ? 1 : 0;
    const bHasMd5 = b.md5 ? 1 : 0;
    if (aHasMd5 !== bHasMd5) return bHasMd5 - aHasMd5;

    return (b.score || 0) - (a.score || 0);
  });

  return filtered;
}

/**
 * Resolves a list of direct high-speed download links across candidate MD5s, mirrors & Archive.org
 */
export async function resolveAnnaDownloadUrl(md5, title = null, candidateMd5s = []) {
  const md5sToTry = Array.from(new Set([
    ...(md5 ? [md5] : []),
    ...(Array.isArray(candidateMd5s) ? candidateMd5s : [candidateMd5s]),
  ])).filter(Boolean);

  console.log(`[Resolver] Resolving download mirror for MD5s: [${md5sToTry.join(', ')}] (title: ${title || 'N/A'})`);

  // 1. Try resolving key link for candidate MD5s on LibGen mirrors
  for (const candidate of md5sToTry) {
    for (const dom of DOWNLOAD_MIRRORS.slice(0, 3)) {
      const urlsToTry = [
        `${dom}/ads.php?md5=${candidate}`,
        `${dom}/get.php?md5=${candidate}`
      ];

      for (const pageUrl of urlsToTry) {
        try {
          const res = await axios.get(pageUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            },
            httpsAgent,
            timeout: 3500
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
            console.log(`[Resolver] Resolved key link on ${dom} for ${candidate}: ${keyLink}`);
            return keyLink;
          }
        } catch (e) {}
      }
    }
  }

  // 2. Auto-search Archive.org for instant open-access EPUB stream
  if (title && title.trim().length > 1) {
    const cleanTitle = cleanTitleForSearch(title);
    console.log(`[Resolver] Querying Archive.org for: "${cleanTitle}"...`);
    try {
      const archiveDocs = await searchArchiveOrg(cleanTitle);
      for (const doc of archiveDocs) {
        if (doc.iaIdentifier) {
          const iaUrl = await resolveArchiveOrgEpub(doc.iaIdentifier);
          if (iaUrl) {
            console.log(`🎉 [Resolver] Archive.org SUCCESS: ${iaUrl}`);
            return iaUrl;
          }
        }
      }
    } catch (e) {}
  }

  // 3. If MD5s failed, auto-search by clean title across shadow mirrors
  if (title && title.trim().length > 1) {
    const cleanTitle = cleanTitleForSearch(title);
    console.log(`[Resolver] Auto-searching mirrors for title: "${cleanTitle}"...`);

    for (const dom of DOWNLOAD_MIRRORS.slice(0, 2)) {
      try {
        const searchUrl = `${dom}/index.php?req=${encodeURIComponent(cleanTitle)}&res=25`;
        const res = await axios.get(searchUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          httpsAgent,
          timeout: 4500
        });

        const $ = cheerio.load(res.data);
        const rows = $('table#tablelibgen tbody tr, table.table tbody tr');

        for (let i = 0; i < rows.length; i++) {
          const row = rows.eq(i);
          const rowHtml = row.html() || '';
          const md5Match = rowHtml.match(/md5=([a-f0-9]{32})/i) || rowHtml.match(/([a-f0-9]{32})/i);

          if (md5Match) {
            const foundMd5 = md5Match[1];
            if (!md5sToTry.includes(foundMd5)) {
              console.log(`[Resolver] Trying newly discovered candidate MD5: ${foundMd5}...`);
              
              try {
                const keyRes = await axios.get(`${dom}/ads.php?md5=${foundMd5}`, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
                  httpsAgent,
                  timeout: 3500
                });
                const $key = cheerio.load(keyRes.data);
                let altKey = null;
                $key('a').each((j, el) => {
                  const href = $key(el).attr('href');
                  if (href && href.includes('key=')) {
                    altKey = href.startsWith('http') ? href : `${dom}/${href.replace(/^\//, '')}`;
                  }
                });
                if (altKey) {
                  console.log(`🎉 [Resolver] Auto-recovery SUCCESS: ${altKey}`);
                  return altKey;
                }
              } catch (e) {}
            }
          }
        }
      } catch (err) {}
    }
  }

  return md5 ? `https://libgen.li/ads.php?md5=${md5}` : null;
}
