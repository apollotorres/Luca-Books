import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Anna's Archive Search Mirrors
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
 * Clean book title for search queries and deduplication
 */
export function normalizeTitle(title) {
  if (!title) return '';
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 35);
}

/**
 * 1. Project Gutenberg Resolver via Gutendex API
 * Fast, free, official public domain REST API with direct EPUB links
 */
export async function searchGutendex(query, lang = 'all') {
  if (!query || !query.trim()) return [];
  try {
    const url = `https://gutendex.com/books/?search=${encodeURIComponent(query.trim())}`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 4500
    });

    const books = res.data?.results || [];
    const results = [];

    for (const b of books.slice(0, 10)) {
      const isPt = (b.languages || []).some(l => l === 'pt' || l.includes('por'));
      const bookLang = isPt ? 'pt' : (b.languages?.[0] || 'en');

      if (lang !== 'all' && lang !== bookLang) continue;

      const formats = b.formats || {};
      const epubUrl = formats['application/epub+zip'] || 
                      `https://www.gutenberg.org/ebooks/${b.id}.epub3.images`;
      const coverUrl = formats['image/jpeg'] || `https://covers.openlibrary.org/b/id/12717088-L.jpg`;

      const author = b.authors && b.authors[0] 
        ? b.authors[0].name.replace(/,\s*/, ' ') 
        : 'Domínio Público';

      let score = 55;
      if (bookLang === 'pt') score += 100;
      score += 40; // Verified instant EPUB

      results.push({
        id: `gut_${b.id}`,
        title: b.title,
        author: author,
        year: null,
        publisher: 'Project Gutenberg',
        cover: coverUrl,
        format: 'epub',
        size: '1.8 MB',
        language: bookLang,
        downloadUrl: epubUrl,
        fallbackUrls: [
          `https://www.gutenberg.org/ebooks/${b.id}.epub3.images`,
          `https://www.gutenberg.org/ebooks/${b.id}.epub.images`,
          `https://www.gutenberg.org/ebooks/${b.id}.epub.noimages`
        ],
        source: 'Project Gutenberg',
        sourceId: 'gutenberg',
        badge: 'EPUB ⚡ • Gutenberg',
        rating: 4.9,
        description: `Edição clássica verificada do Project Gutenberg com download direto de alta velocidade.`,
        score: score
      });
    }

    return results;
  } catch (err) {
    console.warn('[Gutenberg Resolver] Query notice:', err.message);
    return [];
  }
}

/**
 * 2. Internet Archive (Archive.org) Open Access Texts Resolver
 * High-speed open texts with direct HTTP Range-compatible EPUB downloads
 */
export async function searchArchiveOrg(query, lang = 'all') {
  if (!query || !query.trim()) return [];
  try {
    const langFilter = lang === 'pt' ? 'AND+(language:por+OR+language:Portuguese+OR+language:pt)' : '';
    const url = `https://archive.org/advancedsearch.php?q=(${encodeURIComponent(query.trim())})+AND+mediatype:(texts)+AND+format:(EPUB+OR+Text+PDF+OR+PDF)+AND+-access-restricted-item:true+AND+-collection:inlibrary+${langFilter}&fl[]=identifier,title,creator,year,language,description,downloads,item_size,format&sort[]=downloads+desc&rows=10&output=json`;

    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 4500
    });

    const docs = res.data?.response?.docs || [];
    const results = [];

    for (const doc of docs) {
      if (!doc.identifier || !doc.title) continue;
      if (doc.identifier.startsWith('isbn_') && doc.identifier.length > 15) continue;

      const author = Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Domínio Público');
      const docFormats = Array.isArray(doc.format) ? doc.format : [doc.format || ''];
      const hasEpub = docFormats.some(f => (f || '').toLowerCase().includes('epub') && !f.toLowerCase().includes('encrypted'));
      const format = hasEpub ? 'epub' : 'pdf';

      let docLang = 'en';
      const rawDocLang = (doc.language || '').toLowerCase();
      if (rawDocLang.includes('por') || rawDocLang.includes('pt') || rawDocLang.includes('brazil')) {
        docLang = 'pt';
      }

      if (lang !== 'all' && lang !== docLang) continue;

      let score = 50;
      if (docLang === 'pt') score += 95;
      if (format === 'epub') score += 35;
      if (doc.downloads && doc.downloads > 500) score += 20;

      results.push({
        id: `ia_${doc.identifier}`,
        iaIdentifier: doc.identifier,
        title: doc.title,
        author: author,
        year: parseInt(doc.year, 10) || null,
        publisher: 'Internet Archive',
        cover: `https://archive.org/services/img/${doc.identifier}`,
        format: format,
        size: format === 'epub' ? '2.4 MB' : '8.5 MB',
        language: docLang,
        downloadUrl: `https://archive.org/download/${doc.identifier}`,
        source: 'Internet Archive',
        sourceId: 'archive',
        badge: `${format.toUpperCase()} ⚡ • Archive.org`,
        rating: 4.8,
        description: `Disponível no acervo universal aberto do Internet Archive com suporte a streaming contínuo.`,
        score: score
      });
    }

    return results;
  } catch (err) {
    console.warn('[Archive.org Resolver] Query notice:', err.message);
    return [];
  }
}

/**
 * 3. Open Library Resolver (Open Access search)
 * Connects to Open Library metadata index & maps to open full-text editions
 */
export async function searchOpenLibrary(query, lang = 'all') {
  if (!query || !query.trim()) return [];
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query.trim())}&fields=key,title,author_name,first_publish_year,language,cover_i,ia,has_fulltext,ebook_access&limit=8`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 4500
    });

    const docs = res.data?.docs || [];
    const results = [];

    for (const doc of docs) {
      if (!doc.title) continue;

      const isPt = (doc.language || []).some(l => l === 'por' || l === 'pt');
      const docLang = isPt ? 'pt' : (doc.language?.[0] || 'en');

      if (lang !== 'all' && lang !== docLang) continue;

      const author = Array.isArray(doc.author_name) ? doc.author_name.join(', ') : (doc.author_name || 'Autor Desconhecido');
      const coverUrl = doc.cover_i 
        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
        : `https://covers.openlibrary.org/b/id/12717088-L.jpg`;

      const iaId = Array.isArray(doc.ia) && doc.ia.length > 0 ? doc.ia[0] : null;

      let score = 45;
      if (docLang === 'pt') score += 90;
      if (iaId) score += 20;

      results.push({
        id: `ol_${doc.key ? doc.key.replace(/[^a-zA-Z0-9]/g, '') : Buffer.from(doc.title).toString('hex').slice(0, 12)}`,
        iaIdentifier: iaId,
        title: doc.title,
        author: author,
        year: doc.first_publish_year || null,
        publisher: 'Open Library',
        cover: coverUrl,
        format: 'epub',
        size: '2.1 MB',
        language: docLang,
        downloadUrl: iaId ? `https://archive.org/download/${iaId}` : `https://openlibrary.org${doc.key}`,
        source: 'Open Library',
        sourceId: 'openlibrary',
        badge: 'EPUB • Open Library',
        rating: 4.8,
        description: `Indexado no catálogo universal bibliográfico da Open Library.`,
        score: score
      });
    }

    return results;
  } catch (err) {
    console.warn('[Open Library Resolver] Query notice:', err.message);
    return [];
  }
}

/**
 * 4. Anna's Archive & Libgen Direct Search Resolver
 * Matches Anna's Archive website index and decentralized shadow mirrors
 */
export async function searchAnnasArchive(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  let allResults = [];
  const seenIds = new Set();

  // 4.1. Direct Search on Anna's Archive Mirrors
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
        timeout: 6000
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
        } else if (lowerMeta.includes('span') || lowerMeta.includes('español')) {
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
          sourceId: 'annas',
          badge: `${fileExt.toUpperCase()} • ${size}`,
          rating: 4.8 + Math.round(Math.random() * 2) / 10,
          description: snippet || `Disponível no acervo universal do Anna's Archive.`,
          score: score
        });
      });

      if (mirrorResults.length > 0) {
        allResults = mirrorResults;
        break;
      }
    } catch (err) {
      // Continue to next mirror
    }
  }

  // 4.2. Fallback on decentralized Libgen mirrors if Anna's search page didn't respond
  if (allResults.length === 0) {
    for (const mirror of DOWNLOAD_MIRRORS.slice(0, 2)) {
      try {
        const url = `${mirror}/index.php?req=${encodeURIComponent(cleanQ)}&res=30`;
        const res = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 4500
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
            sourceId: 'annas',
            badge: `${fileExt.toUpperCase()} • ${sizeStr ? sizeStr.toUpperCase() : '2 MB'}`,
            rating: 4.8,
            description: `Disponível no acervo universal Anna's Archive (MD5: ${md5 || 'N/A'}).`,
            score: score
          });
        });

        if (allResults.length > 0) break;
      } catch (err) {}
    }
  }

  return allResults;
}

/**
 * 5. UNIFIED MULTI-SOURCE SEARCH RESOLVER
 * Queries Project Gutenberg, Internet Archive, Open Library, and Anna's Archive in parallel.
 * Merges results with deduplication, preserves source tags, and applies smart relevance sorting.
 */
export async function searchAllSources(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  console.log(`[Multi-Source Search] Querying all providers for: "${cleanQ}" (format: ${format}, lang: ${lang})`);

  // Run all 4 public/shadow providers concurrently
  const [gutenbergSettled, archiveSettled, openLibSettled, annasSettled] = await Promise.allSettled([
    searchGutendex(cleanQ, lang),
    searchArchiveOrg(cleanQ, lang),
    searchOpenLibrary(cleanQ, lang),
    searchAnnasArchive(cleanQ, format, lang)
  ]);

  const gutenbergBooks = gutenbergSettled.status === 'fulfilled' ? gutenbergSettled.value : [];
  const archiveBooks = archiveSettled.status === 'fulfilled' ? archiveSettled.value : [];
  const openLibBooks = openLibSettled.status === 'fulfilled' ? openLibSettled.value : [];
  const annasBooks = annasSettled.status === 'fulfilled' ? annasSettled.value : [];

  console.log(`[Multi-Source Search] Results count: Gutenberg (${gutenbergBooks.length}), Archive.org (${archiveBooks.length}), OpenLibrary (${openLibBooks.length}), Anna's Archive (${annasBooks.length})`);

  const combined = [];
  const seenNormTitles = new Set();
  const seenIds = new Set();

  function addIfUnique(book) {
    if (!book || !book.title) return;
    const norm = normalizeTitle(book.title);
    if (!seenNormTitles.has(norm) && !seenIds.has(book.id)) {
      seenNormTitles.add(norm);
      seenIds.add(book.id);
      combined.push(book);
    }
  }

  // Interleave and merge results smoothly:
  // 1. High-speed verified open access (Gutenberg & Archive.org)
  // 2. Anna's Archive / Shadow libraries
  // 3. Open Library metadata
  gutenbergBooks.forEach(addIfUnique);
  annasBooks.forEach(addIfUnique);
  archiveBooks.forEach(addIfUnique);
  openLibBooks.forEach(addIfUnique);

  // Apply format filter if requested
  let filtered = combined;
  if (format && format !== 'all') {
    const fmt = format.toLowerCase();
    const exact = filtered.filter(b => b.format === fmt);
    if (exact.length > 0) filtered = exact;
  }

  // Apply language filter if requested
  if (lang && lang !== 'all') {
    const langExact = filtered.filter(b => b.language === lang);
    if (langExact.length > 0) filtered = langExact;
  }

  // Sort with priority to Portuguese books, verified EPUBs, and high relevance score
  filtered.sort((a, b) => {
    const aIsPt = a.language === 'pt' ? 1 : 0;
    const bIsPt = b.language === 'pt' ? 1 : 0;
    if (aIsPt !== bIsPt) return bIsPt - aIsPt;

    const aIsEpub = a.format === 'epub' ? 1 : 0;
    const bIsEpub = b.format === 'epub' ? 1 : 0;
    if (aIsEpub !== bIsEpub) return bIsEpub - aIsEpub;

    return (b.score || 0) - (a.score || 0);
  });

  return filtered;
}

/**
 * Resolves high-speed binary download link for Internet Archive items
 */
export async function resolveArchiveOrgEpub(identifier) {
  if (!identifier) return null;
  try {
    const filesUrl = `https://archive.org/metadata/${identifier}`;
    const res = await axios.get(filesUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 4000 
    });

    const isRestricted = res.data?.metadata?.['access-restricted-item'] === 'true' || 
                         (res.data?.metadata?.collection || []).includes('inlibrary');
    if (isRestricted) return null;

    const files = res.data?.files || [];
    
    // 1. EPUB
    const epub = files.find(f => 
      f.name && 
      f.name.toLowerCase().endsWith('.epub') && 
      !f.name.includes('_sample') &&
      f.private !== 'true' &&
      f.private !== true &&
      !f.format?.toLowerCase().includes('encrypted')
    );
    if (epub) {
      return `https://archive.org/download/${identifier}/${encodeURIComponent(epub.name)}`;
    }

    // 2. Text PDF
    const textPdf = files.find(f => 
      f.name && 
      f.name.toLowerCase().endsWith('.pdf') && 
      !f.name.includes('_thumb') && 
      !f.name.includes('_text') &&
      f.private !== 'true' &&
      f.private !== true &&
      !f.format?.toLowerCase().includes('encrypted')
    );
    if (textPdf) {
      return `https://archive.org/download/${identifier}/${encodeURIComponent(textPdf.name)}`;
    }
  } catch (e) {}
  return null;
}

/**
 * Resolves direct download mirror link across Libgen keys and Anna's Archive
 */
export async function resolveAnnaDownloadUrl(md5, title = null) {
  if (!md5) return null;
  console.log(`[Anna Resolver] Resolving resilient download mirror for MD5: ${md5}`);

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
          return keyLink;
        }
      } catch (e) {}
    }
  }

  return `https://libgen.li/ads.php?md5=${md5}`;
}
