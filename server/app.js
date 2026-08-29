import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { CURATED_COLLECTIONS } from './data/curatedBooks.js';
import { searchOpenLibrary } from './resolvers/openLibrary.js';
import { searchGutendex } from './resolvers/gutendex.js';
import { searchAnnasArchive, resolveAnnaDownloadUrl } from './resolvers/annasResolver.js';

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

// Unified Search Endpoint (Prioritizes Portuguese, EPUB & aggregated sources)
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

  console.log(`[API /search] Incoming query: "${query}" (lang: ${lang}, format: ${format})`);
  const queryLower = query.toLowerCase();

  // 1. Check curated books first
  const allCuratedBooks = CURATED_COLLECTIONS.flatMap(c => c.books);
  const matchedCurated = allCuratedBooks.filter(book => 
    book.title.toLowerCase().includes(queryLower) ||
    book.author.toLowerCase().includes(queryLower) ||
    (book.genre && book.genre.toLowerCase().includes(queryLower))
  );

  // 2. Concurrently search Anna's Archive (if local headless Chrome available), OpenLibrary, and Gutendex
  try {
    const [annaResults, olResults, gutenResults] = await Promise.allSettled([
      searchAnnasArchive(query, format, lang),
      searchOpenLibrary(query),
      searchGutendex(query)
    ]);

    const annaBooks = annaResults.status === 'fulfilled' ? (annaResults.value || []) : [];
    const olBooks = olResults.status === 'fulfilled' ? (olResults.value || []) : [];
    const gutenBooks = gutenResults.status === 'fulfilled' ? (gutenResults.value || []) : [];

    console.log(`[API /search] Results count: Anna: ${annaBooks.length}, OL: ${olBooks.length}, Guten: ${gutenBooks.length}`);

    // Combine all results with priority: Curated -> Anna's Archive -> OpenLibrary / Gutenberg
    const combined = [...matchedCurated];
    const seenTitles = new Set(matchedCurated.map(b => b.title.toLowerCase().trim()));

    const addIfNew = (book) => {
      if (!book || !book.title) return;
      const normalizedTitle = book.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 25);
      if (!seenTitles.has(normalizedTitle) && !seenTitles.has(book.id)) {
        seenTitles.add(normalizedTitle);
        seenTitles.add(book.id);
        
        book.format = book.format || 'epub';
        book.language = book.language || 'pt';
        if (!book.badge) {
          book.badge = book.format === 'pdf' ? 'PDF • 45 MB' : 'EPUB • 1.5 MB';
        }

        if (lang === 'all' || book.language === lang) {
          combined.push(book);
        }
      }
    };

    annaBooks.forEach(addIfNew);
    olBooks.forEach(addIfNew);
    gutenBooks.forEach(addIfNew);

    // Sort with highest priority to Portuguese books first, then EPUB format
    combined.sort((a, b) => {
      const aIsPt = a.language === 'pt';
      const bIsPt = b.language === 'pt';
      if (aIsPt && !bIsPt) return -1;
      if (!aIsPt && bIsPt) return 1;

      const aIsEpub = a.format === 'epub';
      const bIsEpub = b.format === 'epub';
      if (aIsEpub && !bIsEpub) return -1;
      if (!aIsEpub && bIsEpub) return 1;

      return (b.score || 0) - (a.score || 0);
    });

    res.json({
      query,
      count: combined.length,
      results: combined
    });
  } catch (err) {
    console.error('Search aggregation error:', err.message);
    res.json({
      query,
      count: matchedCurated.length,
      results: matchedCurated
    });
  }
});

// Download & Stream Proxy with HTTP Range Requests & Chunked Streaming
router.get('/download', async (req, res) => {
  let fileUrl = req.query.url;
  const bookId = req.query.id;
  const rangeHeader = req.headers['range'];

  if (!fileUrl) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  console.log(`[Stream Proxy] Request to download: ${fileUrl} (id: ${bookId}, range: ${rangeHeader || 'none'})`);

  // If this is an Anna's Archive book, resolve the direct download mirror
  if (fileUrl.includes('annas-archive.gl/md5/') || (bookId && bookId.startsWith('anna_'))) {
    const md5Match = fileUrl.match(/md5\/([a-f0-9]{32})/i) || (bookId?.match(/anna_([a-f0-9]{32})/i));
    if (md5Match) {
      const md5 = md5Match[1];
      console.log(`[Stream Proxy] Resolving Anna's archive direct download for MD5: ${md5}...`);
      const resolvedUrl = await resolveAnnaDownloadUrl(md5, req.query.title);
      if (resolvedUrl && resolvedUrl !== fileUrl) {
        fileUrl = resolvedUrl;
        console.log(`[Stream Proxy] Resolved to direct mirror: ${fileUrl}`);
      }
    }
  }

  // Determine potential fallback URLs if this is a curated book
  let fallbacks = [];
  if (bookId) {
    const allCurated = CURATED_COLLECTIONS.flatMap(c => c.books);
    const found = allCurated.find(b => b.id === bookId);
    if (found && found.fallbackUrls) {
      fallbacks = found.fallbackUrls;
    }
  }

  const baseUrls = [fileUrl, ...fallbacks];
  const urlsToTry = [];

  for (const u of baseUrls) {
    if (u.includes('libgen.li')) {
      urlsToTry.push(u);
      urlsToTry.push(u.replace('libgen.li', 'libgen.gs'));
      urlsToTry.push(u.replace('libgen.li', 'libgen.vg'));
      urlsToTry.push(u.replace('libgen.li', 'libgen.pm'));
      urlsToTry.push(u.replace('libgen.li', 'libgen.rocks'));
    } else {
      urlsToTry.push(u);
    }
  }

  for (let i = 0; i < urlsToTry.length; i++) {
    const currentUrl = urlsToTry[i];
    try {
      console.log(`[Stream Proxy] Trying URL [${i + 1}/${urlsToTry.length}]: ${currentUrl}`);
      
      const domainMatch = currentUrl.match(/https?:\/\/([^/]+)/);
      const refererHost = domainMatch ? `https://${domainMatch[1]}/` : 'https://libgen.li/';

      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Referer': currentUrl.includes('libgen') ? refererHost : undefined
      };

      if (rangeHeader) {
        headers['Range'] = rangeHeader;
      }

      const response = await axios({
        method: 'get',
        url: currentUrl,
        responseType: 'stream',
        timeout: 25000,
        headers,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 300
      });

      // Detect Content-Type (EPUB vs PDF)
      const rawContentType = response.headers['content-type'] || '';
      let finalContentType = 'application/epub+zip';
      if (rawContentType.includes('pdf') || currentUrl.toLowerCase().includes('.pdf')) {
        finalContentType = 'application/pdf';
      }

      // Headers setup
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
      return;
    } catch (err) {
      console.error(`[Stream Proxy] Failed on URL ${currentUrl}:`, err.message);
    }
  }

  res.status(502).json({ 
    error: 'Failed to stream book from sources. The archive mirror may be down or requires direct authentication.',
    url: fileUrl 
  });
});

// Support both /api/path and /path
app.use('/api', router);
app.use('/', router);

export default app;
