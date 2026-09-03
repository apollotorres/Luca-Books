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
 * Search Internet Archive (Archive.org) for high-speed open access downloads (excluding locked CDL books)
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
      const langFilter = lang === 'pt' ? 'AND (language:por OR language:Portuguese OR language:pt)' : '';
      // Exclude access-restricted items, inlibrary loans and printdisabled locked scans
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
          badge: `${format.toUpperCase()} • Alta Velocidade`,
          rating: 4.8 + Math.round(Math.random() * 2) / 10,
          description: `Disponível para leitura instantânea no acervo universal do Internet Archive.`,
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
 * Search Project Gutenberg via Gutendex
 */
export async function searchGutenberg(query) {
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
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 4000 
      });
      const books = res.data?.results || [];
      if (books.length === 0) continue;

      return books.slice(0, 5).map(b => {
        const epubUrl = b.formats['application/epub+zip'] || 
                        b.formats['application/x-mobipocket-ebook'] || 
                        b.formats['text/html'];
        const author = b.authors && b.authors[0] ? b.authors[0].name.replace(/,\s*/, ' ') : 'Domínio Público';
        const isPt = (b.languages || []).includes('pt');

        let score = 50;
        if (isPt) score += 90;
        score += 40; // EPUB priority

        return {
          id: `gut_${b.id}`,
          title: b.title,
          author: author,
          year: null,
          cover: b.formats['image/jpeg'] || `https://covers.openlibrary.org/b/id/12717088-L.jpg`,
          format: 'epub',
          size: '1.8 MB',
          downloadUrl: `https://www.gutenberg.org/ebooks/${b.id}.epub3.images`,
          fallbackUrls: [
            `https://www.gutenberg.org/ebooks/${b.id}.epub.images`,
            `https://www.gutenberg.org/ebooks/${b.id}.epub.noimages`,
            epubUrl
          ].filter(Boolean),
          source: 'Project Gutenberg',
          language: isPt ? 'pt' : (b.languages?.[0] || 'en'),
          badge: 'EPUB • Domínio Público',
          rating: 4.9,
          description: `Edição clássica verificada do Project Gutenberg com download direto.`,
          score: score,
          fallbackMd5s: []
        };
      });
    } catch (e) {}
  }

  return [];
}

/**
 * Direct search on Libgen decentralized mirrors
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
 * Multi-source search resolver:
 * Queries decentralized shadow library mirrors, Internet Archive, and Project Gutenberg in parallel.
 */
export async function searchAnnasArchive(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];
  const cleanQ = query.trim();

  console.log(`[Search Resolver] Querying catalog for: "${cleanQ}" (format: ${format}, lang: ${lang})`);

  // Query all 3 providers concurrently with tight timeouts
  const [libgenResults, archiveResults, gutenbergResults] = await Promise.all([
    searchLibgenMirrors(cleanQ),
    searchArchiveOrg(cleanQ, lang),
    searchGutenberg(cleanQ)
  ]);

  // Merge results with deduplication
  const combined = [];
  const seenTitles = new Set();

  function addIfUnique(book) {
    if (!book || !book.title) return;
    const norm = removeDiacritics(cleanTitleForSearch(book.title)).toLowerCase().slice(0, 30);
    if (!seenTitles.has(norm) && (!book.md5 || !seenTitles.has(book.md5))) {
      seenTitles.add(norm);
      if (book.md5) seenTitles.add(book.md5);
      combined.push(book);
    }
  }

  // Populate fallback alternative MD5s across Libgen results
  const topLibgenMd5s = libgenResults.slice(0, 5).map(b => b.md5).filter(Boolean);
  libgenResults.forEach(b => {
    b.fallbackMd5s = topLibgenMd5s;
    addIfUnique(b);
  });

  // Add Internet Archive & Gutenberg results
  archiveResults.forEach(addIfUnique);
  gutenbergResults.forEach(addIfUnique);

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

  // Sort: Portuguese first, epub first, verified source score
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
 * Resolves all candidate direct download links in parallel (Archive.org, Gutenberg, Libgen)
 */
export async function resolveAllDownloadUrls(md5, title = null, candidateMd5s = []) {
  const candidateUrls = [];
  const cleanTitle = cleanTitleForSearch(title);

  const md5sToTry = Array.from(new Set([
    ...(md5 ? [md5] : []),
    ...(Array.isArray(candidateMd5s) ? candidateMd5s.slice(0, 3) : [candidateMd5s]),
  ])).filter(Boolean).slice(0, 3);

  // Run all discovery tasks concurrently
  const [iaUrl, gutUrl, libgenKey] = await Promise.all([
    // 1. Internet Archive by title
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

    // 2. Project Gutenberg by title
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

    // 3. Libgen key link
    (async () => {
      if (md5sToTry.length === 0) return null;
      for (const candidate of md5sToTry) {
        for (const dom of DOWNLOAD_MIRRORS.slice(0, 2)) {
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

