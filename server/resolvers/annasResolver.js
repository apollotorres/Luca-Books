import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';
import { CURATED_COLLECTIONS } from '../data/curatedBooks.js';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Decentralized mirror endpoints
const DOWNLOAD_MIRRORS = [
  'https://libgen.li',
  'https://libgen.vg',
  'https://libgen.gs',
  'https://libgen.rocks',
  'https://libgen.pm'
];

// Official and community Anna's Archive Search Mirrors
const ANNAS_SEARCH_MIRRORS = [
  'https://annas-archive.is',
  'https://annas-archive.org',
  'https://annas-archive.li',
  'https://annas-archive.pm',
  'https://annas-archive.gs',
  'https://annas-archive.pk'
];

// Public IPFS Gateways for decentralized content fallback
const IPFS_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs',
  'https://ipfs.io/ipfs',
  'https://gateway.pinata.cloud/ipfs',
  'https://dweb.link/ipfs'
];

// In-memory cache for search results (TTL: 10 minutes)
const searchCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

/**
 * Remove accents and special characters for broad search compatibility
 */
export function removeDiacritics(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

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
 * Normalize title for deduplication
 */
export function normalizeTitle(title) {
  if (!title) return '';
  return removeDiacritics(title)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 35);
}

/**
 * 1. Search Project Gutenberg via Gutendex API
 */
export async function searchGutenberg(query, lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = cleanTitleForSearch(query);
  const normalizedQ = removeDiacritics(cleanQ);

  const words = normalizedQ.split(/\s+/).filter(w => w.length > 2 && !['para', 'com', 'que', 'dos', 'das', 'uma', 'uns', 'the', 'and', 'for'].includes(w.toLowerCase()));
  const queriesToTry = [
    normalizedQ,
    words.length > 1 ? words.slice(0, 2).join(' ') : null
  ].filter(Boolean);

  for (const qText of queriesToTry) {
    try {
      const url = `https://gutendex.com/books/?search=${encodeURIComponent(qText)}`;
      const res = await axios.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 4000 
      });
      const books = res.data?.results || [];
      if (books.length === 0) continue;

      const results = [];
      for (const b of books.slice(0, 8)) {
        const isPt = (b.languages || []).some(l => l === 'pt' || l.includes('por'));
        const bookLang = isPt ? 'pt' : (b.languages?.[0] || 'en');

        if (lang !== 'all' && lang !== bookLang) continue;

        const epubUrl = b.formats?.['application/epub+zip'] || 
                        `https://www.gutenberg.org/ebooks/${b.id}.epub3.images`;
        const author = b.authors && b.authors[0] ? b.authors[0].name.replace(/,\s*/, ' ') : 'Domínio Público';

        let score = 55;
        if (isPt) score += 95;
        score += 40; // Verified instant EPUB

        results.push({
          id: `gut_${b.id}`,
          title: b.title,
          author: author,
          year: null,
          publisher: 'Project Gutenberg',
          cover: b.formats?.['image/jpeg'] || `https://covers.openlibrary.org/b/id/12717088-L.jpg`,
          format: 'epub',
          size: '1.8 MB',
          downloadUrl: `https://www.gutenberg.org/ebooks/${b.id}.epub3.images`,
          fallbackUrls: [
            `https://www.gutenberg.org/ebooks/${b.id}.epub3.images`,
            `https://www.gutenberg.org/ebooks/${b.id}.epub.images`,
            `https://www.gutenberg.org/ebooks/${b.id}.epub.noimages`,
            epubUrl
          ].filter(Boolean),
          source: 'Project Gutenberg',
          sourceId: 'gutenberg',
          language: bookLang,
          badge: 'EPUB ⚡ • Gutenberg',
          rating: 4.9,
          description: `Edição clássica verificada do Project Gutenberg com download direto de alta velocidade.`,
          score: score,
          fallbackMd5s: []
        });
      }

      if (results.length > 0) return results;
    } catch (e) {}
  }

  return [];
}

export const searchGutendex = searchGutenberg;

/**
 * 2. Search Internet Archive (Archive.org) for high-speed open access downloads (excluding locked CDL books)
 */
export async function searchArchiveOrg(query, lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = cleanTitleForSearch(query);
  const normalizedQ = removeDiacritics(cleanQ);

  const words = normalizedQ.split(/\s+/).filter(w => w.length > 2 && !['para', 'com', 'que', 'dos', 'das', 'uma', 'uns', 'the', 'and', 'for'].includes(w.toLowerCase()));
  const queriesToTry = [
    normalizedQ,
    words.length > 1 ? words.slice(0, 2).join(' ') : null
  ].filter(Boolean);

  for (const qText of queriesToTry) {
    try {
      const langFilter = lang === 'pt' ? 'AND+(language:por+OR+language:Portuguese+OR+language:pt)' : '';
      const url = `https://archive.org/advancedsearch.php?q=(${encodeURIComponent(qText)})+AND+mediatype:(texts)+AND+format:(EPUB+OR+Text+PDF+OR+PDF)+AND+-access-restricted-item:true+AND+-collection:inlibrary+AND+-collection:printdisabled+${langFilter}&fl[]=identifier,title,creator,year,language,description,downloads,item_size,format&sort[]=downloads+desc&rows=8&output=json`;

      const res = await axios.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 4500 
      });
      
      const docs = res.data?.response?.docs || [];
      if (docs.length === 0) continue;

      const results = [];
      for (const doc of docs) {
        if (!doc.identifier || !doc.title) continue;
        if (doc.identifier.startsWith('isbn_') && doc.identifier.length > 15) continue; // Skip raw lending ISBN scans

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

        let score = 55;
        if (docLang === 'pt') score += 80;
        if (format === 'epub') score += 40;
        if (doc.downloads && doc.downloads > 500) score += 20;

        results.push({
          id: `ia_${doc.identifier}`,
          md5: null,
          iaIdentifier: doc.identifier,
          title: doc.title,
          author: author,
          year: parseInt(doc.year, 10) || null,
          publisher: 'Internet Archive',
          cover: `https://archive.org/services/img/${doc.identifier}`,
          format: format,
          size: format === 'epub' ? '2.5 MB' : '8.0 MB',
          language: docLang,
          downloadUrl: `https://archive.org/download/${doc.identifier}`,
          source: 'Internet Archive',
          sourceId: 'archive',
          badge: `${format.toUpperCase()} ⚡ • Archive.org`,
          rating: 4.8,
          description: `Disponível no acervo universal aberto do Internet Archive com suporte a streaming contínuo.`,
          score: score,
          fallbackMd5s: []
        });
      }

      if (results.length > 0) return results;
    } catch (e) {}
  }

  return [];
}

/**
 * Resolve direct download binary URL from Internet Archive identifier (verifying open permissions)
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
    if (isRestricted) {
      console.warn(`[Archive.org Resolver] Item ${identifier} is locked behind controlled lending.`);
      return null;
    }

    const files = res.data?.files || [];
    
    // 1. Look for non-private, non-encrypted EPUB
    const epub = files.find(f => 
      f.name && 
      f.name.toLowerCase().endsWith('.epub') && 
      !f.name.includes('_sample') &&
      f.private !== 'true' &&
      f.private !== true &&
      !f.format?.toLowerCase().includes('encrypted') &&
      !f.format?.toLowerCase().includes('lcp')
    );
    if (epub) {
      return `https://archive.org/download/${identifier}/${encodeURIComponent(epub.name)}`;
    }

    // 2. Secondary: Non-private, non-encrypted Text PDF
    const textPdf = files.find(f => 
      f.name && 
      f.name.toLowerCase().endsWith('.pdf') && 
      !f.name.includes('_thumb') && 
      !f.name.includes('_text') &&
      f.private !== 'true' &&
      f.private !== true &&
      !f.format?.toLowerCase().includes('encrypted') &&
      !f.format?.toLowerCase().includes('acs')
    );
    if (textPdf) {
      return `https://archive.org/download/${identifier}/${encodeURIComponent(textPdf.name)}`;
    }
  } catch (e) {}
  return null;
}

/**
 * 3. Open Library Resolver (Open Access search)
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
        score: score,
        fallbackMd5s: []
      });
    }

    return results;
  } catch (err) {
    console.warn('[Open Library Resolver] Query notice:', err.message);
    return [];
  }
}

/**
 * 4. Direct search on Libgen decentralized mirrors
 */
export async function searchLibgenMirrors(cleanQ) {
  const libgenResults = [];
  const seenMd5s = new Set();
  const normalizedQ = removeDiacritics(cleanQ);

  const mirrorsToTry = DOWNLOAD_MIRRORS.slice(0, 2);

  for (const mirror of mirrorsToTry) {
    try {
      const url = `${mirror}/index.php?req=${encodeURIComponent(normalizedQ)}&res=25`;
      const res = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        httpsAgent,
        timeout: 4000
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
          sourceId: 'annas',
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
 * 5. Search Anna's Archive using exact search engine query parameters
 * (ext, lang, content=book_any, sort=most_relevant)
 */
export async function searchAnnasArchive(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  let allResults = [];
  const seenIds = new Set();

  // Construct official query parameters per Anna's Archive software repository
  const extParam = format && format !== 'all' ? `&ext=${encodeURIComponent(format)}` : '';
  let langParam = '';
  if (lang === 'pt') langParam = '&lang=pt,por';
  else if (lang === 'en') langParam = '&lang=en';
  else if (lang && lang !== 'all') langParam = `&lang=${encodeURIComponent(lang)}`;

  const contentParam = '&content=book_any'; // Focus on books, exclude papers/journals
  const sortParam = '&sort=most_relevant';

  // Try official search mirrors first
  for (const mirror of ANNAS_SEARCH_MIRRORS) {
    try {
      const searchUrl = `${mirror}/search?q=${encodeURIComponent(cleanQ)}${extParam}${langParam}${contentParam}${sortParam}`;
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        },
        httpsAgent,
        timeout: 5500
      });

      if (!response.data || typeof response.data !== 'string' || response.data.length < 2500) {
        continue;
      }

      const $ = cheerio.load(response.data);
      const mirrorResults = [];

      // Modern Anna's Archive search items: matches both h3 and a[href*="/md5/"]
      $('h3, a[href*="/md5/"]').each((i, el) => {
        let titleLink = $(el).is('a') ? $(el) : $(el).find('a').first();
        if (!titleLink.length && $(el).closest('a').length) {
          titleLink = $(el).closest('a');
        }

        const rawTitle = (titleLink.text() || $(el).text()).replace(/\s+/g, ' ').trim();
        const href = titleLink.attr('href') || $(el).closest('a').attr('href') || '';
        if (!rawTitle || rawTitle.length < 2 || rawTitle.toLowerCase().includes('donate')) return;

        const container = $(el).closest('div.min-w-0, div.flex-1, div.border-b, div.my-2').parent();
        let img = container.find('img').first().attr('src') || '';
        if (img && img.startsWith('/')) {
          img = `${mirror}${img}`;
        }
        
        const metaDivs = container.find('div.text-sm, div.text-xs, div.text-gray-500');
        let authorAndMeta = metaDivs.first().text().replace(/\s+/g, ' ').trim();
        let publisher = '';
        metaDivs.each((_, m) => {
          const txt = $(m).text().trim();
          if (txt.toLowerCase().startsWith('publisher:')) {
            publisher = txt.replace(/^publisher:\s*/i, '').trim();
          }
        });

        const snippet = container.find('p.text-sm, div.italic').text().replace(/\s+/g, ' ').trim();
        const parts = authorAndMeta.split('·').map(p => p.trim());
        let author = parts[0] && !parts[0].toLowerCase().includes('catalog') && !parts[0].toLowerCase().includes('publisher') 
          ? parts[0] 
          : 'Autor Desconhecido';
        if (author.includes(';')) author = author.split(';')[0].trim();
        
        let fileExt = format && format !== 'all' ? format : 'epub';
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
          score: score,
          fallbackMd5s: md5 ? [md5] : []
        });
      });

      if (mirrorResults.length > 0) {
        allResults = mirrorResults;
        break;
      }
    } catch (err) {}
  }

  // Fallback to Libgen mirror scraper if Anna's search didn't return
  if (allResults.length === 0) {
    allResults = await searchLibgenMirrors(cleanQ);
  }

  return allResults;
}

/**
 * 6. UNIFIED MULTI-SOURCE SEARCH RESOLVER WITH IN-MEMORY CACHE
 * Queries Project Gutenberg, Internet Archive, Open Library, and Anna's Archive in parallel.
 */
export async function searchAllSources(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  // Check cache
  const cacheKey = `${cleanQ.toLowerCase()}|${format}|${lang}`;
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    console.log(`[Multi-Source Search] Serving cached results for: "${cleanQ}"`);
    return cached.results;
  }

  console.log(`[Multi-Source Search] Querying all providers for: "${cleanQ}" (format: ${format}, lang: ${lang})`);

  const [gutenbergSettled, archiveSettled, openLibSettled, annasSettled] = await Promise.allSettled([
    searchGutenberg(cleanQ, lang),
    searchArchiveOrg(cleanQ, lang),
    searchOpenLibrary(cleanQ, lang),
    searchAnnasArchive(cleanQ, format, lang)
  ]);

  const gutenbergBooks = gutenbergSettled.status === 'fulfilled' ? gutenbergSettled.value : [];
  const archiveBooks = archiveSettled.status === 'fulfilled' ? archiveSettled.value : [];
  const openLibBooks = openLibSettled.status === 'fulfilled' ? openLibSettled.value : [];
  const annasBooks = annasSettled.status === 'fulfilled' ? annasSettled.value : [];

  console.log(`[Multi-Source Search] Results: Gutenberg (${gutenbergBooks.length}), Archive.org (${archiveBooks.length}), OpenLibrary (${openLibBooks.length}), Anna's Archive (${annasBooks.length})`);

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

    const aHasDirect = a.downloadUrl ? 1 : 0;
    const bHasDirect = b.downloadUrl ? 1 : 0;
    if (aHasDirect !== bHasDirect) return bHasDirect - aHasDirect;

    return (b.score || 0) - (a.score || 0);
  });

  // Save to cache (prune if cache is larger than 150 items)
  if (searchCache.size > 150) {
    const firstKey = searchCache.keys().next().value;
    searchCache.delete(firstKey);
  }
  searchCache.set(cacheKey, { timestamp: Date.now(), results: filtered });

  return filtered;
}

/**
 * Resolves all candidate direct download links in parallel (Official Fast Download API, Archive.org, Gutenberg, Libgen, IPFS)
 */
export async function resolveAllDownloadUrls(md5, title = null, candidateMd5s = []) {
  const candidateUrls = [];
  const cleanTitle = cleanTitleForSearch(title);

  const md5sToTry = Array.from(new Set([
    ...(md5 ? [md5] : []),
    ...(Array.isArray(candidateMd5s) ? candidateMd5s.slice(0, 3) : [candidateMd5s]),
  ])).filter(Boolean).slice(0, 3);

  // 1. Check for official Anna's Archive Fast Download API Key if configured
  const fastKey = process.env.ANNAS_FAST_DOWNLOAD_KEY || process.env.ANNAS_API_KEY;
  if (fastKey && md5sToTry.length > 0) {
    try {
      const fastUrl = `https://annas-archive.org/dyn/api/fast_download.json?md5=${md5sToTry[0]}&key=${fastKey}`;
      const fastRes = await axios.get(fastUrl, { timeout: 3000, httpsAgent });
      if (fastRes.data?.download_url) {
        console.log(`[Fast Download API] Direct link resolved via official API for MD5: ${md5sToTry[0]}`);
        candidateUrls.push(fastRes.data.download_url);
      }
    } catch (e) {
      console.warn('[Fast Download API] Notice:', e.message);
    }
  }

  // 2. Run parallel discovery across open repositories and decentralized mirrors
  const [iaUrl, gutUrl, libgenKey] = await Promise.all([
    // Internet Archive by title
    (async () => {
      if (!cleanTitle || cleanTitle.length < 2) return null;
      try {
        const docs = await searchArchiveOrg(cleanTitle);
        for (const doc of docs.slice(0, 3)) {
          if (doc.iaIdentifier) {
            const direct = await resolveArchiveOrgEpub(doc.iaIdentifier);
            if (direct) return direct;
          }
        }
      } catch (e) {}
      return null;
    })(),

    // Project Gutenberg by title
    (async () => {
      if (!cleanTitle || cleanTitle.length < 2) return null;
      try {
        const gutDocs = await searchGutenberg(cleanTitle);
        if (gutDocs.length > 0 && gutDocs[0].downloadUrl) {
          return gutDocs[0].downloadUrl;
        }
      } catch (e) {}
      return null;
    })(),

    // Libgen key link across active mirrors
    (async () => {
      if (md5sToTry.length === 0) return null;
      for (const candidate of md5sToTry) {
        for (const dom of DOWNLOAD_MIRRORS.slice(0, 3)) {
          try {
            const pageUrl = `${dom}/ads.php?md5=${candidate}`;
            const res = await axios.get(pageUrl, {
              headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
              httpsAgent,
              timeout: 2500
            });
            const $ = cheerio.load(res.data);
            let keyLink = null;
            $('a').each((i, el) => {
              const href = $(el).attr('href');
              if (href && href.includes('key=')) {
                keyLink = href.startsWith('http') ? href : `${dom}/${href.replace(/^\//, '')}`;
              }
            });
            if (keyLink) return keyLink;
          } catch (e) {}
        }
      }
      return null;
    })()
  ]);

  // Cross-reference curated verified books by title
  if (cleanTitle) {
    const norm = removeDiacritics(cleanTitle).toLowerCase();
    const allCurated = CURATED_COLLECTIONS.flatMap(c => c.books);
    const matchedCurated = allCurated.find(b => {
      const bNorm = removeDiacritics(b.title).toLowerCase();
      return bNorm.includes(norm) || norm.includes(bNorm);
    });
    if (matchedCurated) {
      if (matchedCurated.downloadUrl) candidateUrls.push(matchedCurated.downloadUrl);
      if (matchedCurated.fallbackUrls) candidateUrls.push(...matchedCurated.fallbackUrls);
    }
  }

  if (gutUrl) candidateUrls.push(gutUrl);
  if (iaUrl) candidateUrls.push(iaUrl);
  if (libgenKey) candidateUrls.push(libgenKey);

  const uniqueCandidates = Array.from(new Set(candidateUrls)).filter(Boolean);
  console.log(`[Resolver] Resolved ${uniqueCandidates.length} direct candidate URLs for "${cleanTitle || md5}":`, uniqueCandidates);
  return uniqueCandidates;
}

/**
 * Resolves high-speed direct download link across Libgen keys, Archive.org, and Gutenberg
 */
export async function resolveAnnaDownloadUrl(md5, title = null, candidateMd5s = []) {
  const allUrls = await resolveAllDownloadUrls(md5, title, candidateMd5s);
  return allUrls[0] || (md5 ? `https://libgen.li/ads.php?md5=${md5}` : null);
}
