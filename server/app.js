import express from 'express';
import cors from 'cors';
import axios from 'axios';
import https from 'https';
import { CURATED_COLLECTIONS } from './data/curatedBooks.js';
import { searchAnnasArchive, resolveAnnaDownloadUrl } from './resolvers/annasResolver.js';

const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

const app = express();

app.use(cors());
app.use(express.json());

const router = express.Router();

// Health Check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Curated Books Endpoint
router.get('/curated', (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    collections: CURATED_COLLECTIONS
  });
});

// Exclusive Anna's Archive Search Endpoint
router.get('/search', async (req, res) => {
  const query = req.query.q;
  const lang = req.query.lang || 'all';
  const format = req.query.format || 'epub';

  if (!query || !query.trim()) {
    return res.json({
      query: '',
      count: 0,
      results: []
    });
  }

  console.log(`[API /search] Query: "${query}" (lang: ${lang}, format: ${format})`);
  const queryLower = query.toLowerCase().trim();

  // 1. Check curated books first for exact title matches
  const allCuratedBooks = CURATED_COLLECTIONS.flatMap(c => c.books);
  const matchedCurated = allCuratedBooks.filter(book => 
    book.title.toLowerCase().includes(queryLower) ||
    book.author.toLowerCase().includes(queryLower)
  );

  try {
    // 2. Query Anna's Archive & Shadow Libraries
    const annaBooks = await searchAnnasArchive(query, format, lang);
    console.log(`[API /search] Search returned ${annaBooks.length} books for "${query}"`);

    // Combine results: Curated matches -> Anna's Archive
    const combined = [...matchedCurated];
    const seenTitles = new Set(matchedCurated.map(b => b.title.toLowerCase().trim()));

    annaBooks.forEach(book => {
      if (!book || !book.title) return;
      const normalizedTitle = book.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);
      if (!seenTitles.has(normalizedTitle) && !seenTitles.has(book.id)) {
        seenTitles.add(normalizedTitle);
        seenTitles.add(book.id);
        
        book.source = "Anna's Archive";
        book.format = book.format || 'epub';
        book.language = book.language || 'pt';
        if (!book.badge) {
          book.badge = `${book.format.toUpperCase()} • ${book.size || '2.0 MB'}`;
        }

        combined.push(book);
      }
    });

    // Sort with highest priority to Portuguese books first, verified direct downloads, then score
    combined.sort((a, b) => {
      const aIsPt = a.language === 'pt' ? 1 : 0;
      const bIsPt = b.language === 'pt' ? 1 : 0;
      if (aIsPt !== bIsPt) return bIsPt - aIsPt;

      const aIsEpub = a.format === 'epub' ? 1 : 0;
      const bIsEpub = b.format === 'epub' ? 1 : 0;
      if (aIsEpub !== bIsEpub) return bIsEpub - aIsEpub;

      const aHasMd5 = a.md5 ? 1 : 0;
      const bHasMd5 = b.md5 ? 1 : 0;
      if (aHasMd5 !== bHasMd5) return bHasMd5 - aHasMd5;

      return (b.score || 0) - (a.score || 0);
    });

    res.json({
      query,
      count: combined.length,
      results: combined
    });
  } catch (err) {
    console.error(`[API /search] Search error:`, err.message);
    res.json({
      query,
      count: matchedCurated.length,
      results: matchedCurated
    });
  }
});

// Exclusive Stream & Download Proxy with Auto-Recovery Cascade
router.get('/download', async (req, res) => {
  let fileUrl = req.query.url;
  const bookId = req.query.id;
  const title = req.query.title;
  const rawFallbacks = req.query.fallbackMd5s || '';
  const rangeHeader = req.headers['range'];

  const candidateMd5s = rawFallbacks.split(',').map(s => s.trim()).filter(Boolean);

  if (!fileUrl && !bookId && !title && candidateMd5s.length === 0) {
    return res.status(400).json({ error: 'Missing url, id or title parameter' });
  }

  console.log(`[Stream Proxy] Request to download: ${fileUrl || 'N/A'} (title: "${title || 'N/A'}", candidates: ${candidateMd5s.length})`);

  // 1. Resolve MD5 from parameter or URLs
  const md5Match = (fileUrl || '').match(/md5\/([a-f0-9]{32})/i) || 
                   (fileUrl || '').match(/md5=([a-f0-9]{32})/i) || 
                   (bookId || '').match(/anna_([a-f0-9]{32})/i);

  const md5 = md5Match ? md5Match[1] : (candidateMd5s[0] || null);

  // 2. Resolve direct mirror link
  let resolvedDirectUrl = await resolveAnnaDownloadUrl(md5, title, candidateMd5s);

  // 3. Build list of candidate mirror URLs
  let fallbacks = [];
  if (bookId) {
    const allCurated = CURATED_COLLECTIONS.flatMap(c => c.books);
    const found = allCurated.find(b => b.id === bookId);
    if (found && found.fallbackUrls) {
      fallbacks = found.fallbackUrls;
    }
  }

  const urlsToTry = [
    resolvedDirectUrl,
    fileUrl && !fileUrl.includes('/books/') ? fileUrl : null,
    ...fallbacks
  ].filter(Boolean);

  // 4. Try streaming primary mirrors
  for (let i = 0; i < urlsToTry.length; i++) {
    const currentUrl = urlsToTry[i];
    const streamed = await tryStreamUrl(currentUrl, rangeHeader, res);
    if (streamed) return;
  }

  // 5. Auto-recovery by title and candidate MD5 cascade
  console.log(`[Stream Proxy] Primary mirror failed. Auto-recovering across candidate mirrors for: "${title || 'N/A'}"...`);
  try {
    const recoveryUrl = await resolveAnnaDownloadUrl(null, title, candidateMd5s);
    if (recoveryUrl && !urlsToTry.includes(recoveryUrl)) {
      const streamed = await tryStreamUrl(recoveryUrl, rangeHeader, res);
      if (streamed) {
        console.log(`🎉 [Stream Proxy] Auto-recovery SUCCESS for "${title}"`);
        return;
      }
    }
  } catch (autoErr) {
    console.warn('[Stream Proxy] Auto-recovery error:', autoErr.message);
  }

  res.status(502).json({ 
    error: 'Servidores de espelho temporariamente sobrecarregados. Tente novamente em alguns instantes.',
    url: fileUrl 
  });
});

async function tryStreamUrl(currentUrl, rangeHeader, res) {
  if (!currentUrl || typeof currentUrl !== 'string') return false;
  if (currentUrl.includes('/books/')) {
    return false;
  }

  try {
    console.log(`[Stream Proxy] Fetching: ${currentUrl}`);
    
    const domainMatch = currentUrl.match(/https?:\/\/([^/]+)/);
    const refererHost = domainMatch ? `https://${domainMatch[1]}/` : 'https://libgen.li/';

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': currentUrl.includes('libgen') || currentUrl.includes('booksdl') ? 'https://libgen.li/' : refererHost
    };

    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const response = await axios({
      method: 'get',
      url: currentUrl,
      responseType: 'stream',
      timeout: 20000,
      headers,
      httpsAgent,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 300
    });

    const rawContentType = (response.headers['content-type'] || '').toLowerCase();
    
    // Reject HTML error pages or JSON error payloads
    if (rawContentType.includes('text/html') || rawContentType.includes('application/json')) {
      console.warn(`[Stream Proxy] Target returned non-binary payload (${rawContentType}) from ${currentUrl}`);
      return false;
    }

    // Detect Content-Type (EPUB vs PDF)
    let finalContentType = 'application/epub+zip';
    if (rawContentType.includes('pdf') || currentUrl.toLowerCase().includes('.pdf')) {
      finalContentType = 'application/pdf';
    }

    // Set streaming and CORS headers
    res.setHeader('Content-Type', finalContentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (response.headers['content-length']) {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    if (response.headers['content-range']) {
      res.setHeader('Content-Range', response.headers['content-range']);
      res.status(206);
    } else {
      res.status(response.status);
    }

    response.data.pipe(res);
    return true;
  } catch (err) {
    console.warn(`[Stream Proxy] Attempt failed on ${currentUrl}:`, err.message);
    return false;
  }
}

// Support both /api/path and /path
app.use('/api', router);
app.use('/', router);

export default app;
