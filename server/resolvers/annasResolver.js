import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import axios from 'axios';
import * as cheerio from 'cheerio';
puppeteer.use(StealthPlugin());

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

let sharedBrowser = null;
let isInitializing = false;

async function getSharedBrowser() {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(r => setTimeout(r, 200));
    }
    if (sharedBrowser && sharedBrowser.connected) return sharedBrowser;
  }

  isInitializing = true;
  try {
    console.log('[Anna Resolver] Launching shared Stealth Chrome instance...');
    sharedBrowser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: false,
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--window-size=1280,800',
        '--window-position=-3000,-3000'
      ]
    });
    console.log('[Anna Resolver] Shared browser ready!');
    return sharedBrowser;
  } catch (err) {
    console.error('[Anna Resolver] Error launching Chrome:', err.message);
    throw err;
  } finally {
    isInitializing = false;
  }
}

export async function searchAnnasArchive(query, format = 'epub', lang = 'all') {
  if (!query || !query.trim()) return [];

  const filterExt = format === 'all' ? '' : '&ext=epub';
  const filterLang = lang === 'pt' ? '&lang=pt' : (lang === 'en' ? '&lang=en' : (lang === 'es' ? '&lang=es' : ''));
  console.log(`[Anna Resolver] Searching Anna's Archive for: "${query}" (format: ${format}, lang: ${lang})`);
  let page = null;

  try {
    const browser = await getSharedBrowser();
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const searchUrl = `https://annas-archive.gl/search?q=${encodeURIComponent(query)}${filterExt}${filterLang}`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for the books to render after DDoS-Guard passes
    await page.waitForSelector('main a[href*="/md5/"], a[href*="/md5/"]', { timeout: 20000 });

    const results = await page.evaluate((searchQuery) => {
      const qLower = searchQuery.toLowerCase().trim();
      const mapByMd5 = new Map();

      const links = document.querySelectorAll('a[href*="/md5/"]');
      links.forEach(a => {
        if (a.closest('[style*="scroll"]')) return;

        const href = a.getAttribute('href');
        const md5Match = href?.match(/md5\/([a-f0-9]{32})/i);
        if (!md5Match) return;
        const md5 = md5Match[1];

        let entry = mapByMd5.get(md5) || {
          id: `anna_${md5}`,
          md5: md5,
          title: '',
          author: 'Acervo Anna\'s Archive',
          cover: null,
          downloadUrl: `https://annas-archive.gl/md5/${md5}`,
          source: "Anna's Archive",
          rating: 4.9,
          year: null,
          language: 'pt',
          format: 'epub',
          size: '2.0 MB',
          genre: 'eBook / Anna\'s Archive',
          badge: "EPUB • 2 MB",
          description: `Disponível no acervo Anna's Archive via MD5: ${md5}. Leitura instantânea no navegador.`,
          score: 0
        };

        const img = a.querySelector('img')?.getAttribute('src');
        if (img && !entry.cover) {
          entry.cover = img.startsWith('/') ? `https://annas-archive.gl${img}` : img;
        }

        const text = a.innerText.replace(/\s+/g, ' ').trim();
        if (text && !entry.title) {
          entry.title = text;
        }

        const parent = a.closest('div.flex') || a.parentElement;
        if (parent) {
          const fullText = parent.innerText.replace(/\s+/g, ' ');
          const lowerText = fullText.toLowerCase();

          // Precise Language detection
          if (lowerText.includes('portuguese') || lowerText.includes('português') || lowerText.includes('[pt]') || lowerText.includes(' pt ') || lowerText.includes(', pt,')) {
            entry.language = 'pt';
          } else if (lowerText.includes('english') || lowerText.includes('inglês') || lowerText.includes('[en]') || lowerText.includes(' en ')) {
            entry.language = 'en';
          } else if (lowerText.includes('spanish') || lowerText.includes('español') || lowerText.includes('[es]') || lowerText.includes(' es ')) {
            entry.language = 'es';
          } else if (lowerText.includes('french') || lowerText.includes('français') || lowerText.includes('[fr]')) {
            entry.language = 'fr';
          }
          
          // Format detection
          if (lowerText.includes('pdf')) {
            entry.format = 'pdf';
          } else if (lowerText.includes('epub')) {
            entry.format = 'epub';
          }

          // Size detection (e.g. 1.8MB, 85.2MB, 500KB)
          const sizeMatch = fullText.match(/(\d+(?:\.\d+)?\s*(?:MB|KB|GB))/i);
          if (sizeMatch) {
            entry.size = sizeMatch[1].toUpperCase();
          }

          entry.badge = `${entry.format.toUpperCase()}${entry.size ? ` • ${entry.size}` : ''}`;

          const authorMatch = parent.querySelector('.italic, [class*="italic"]');
          if (authorMatch && authorMatch.innerText.trim()) {
            entry.author = authorMatch.innerText.trim();
          }
        }

        mapByMd5.set(md5, entry);
      });

      const items = Array.from(mapByMd5.values()).filter(item => item.title && item.title.length > 1);

      // Score relevance & Heavy Portuguese Prioritization
      items.forEach(item => {
        const titleLower = item.title.toLowerCase();
        if (titleLower === qLower) item.score += 120;
        else if (titleLower.includes(qLower)) item.score += 70;
        else {
          const words = qLower.split(' ');
          words.forEach(w => {
            if (w.length > 2 && titleLower.includes(w)) item.score += 20;
          });
        }
        if (item.cover) item.score += 25;
        
        // Portuguese Priority Boost: +80 points so PT editions always appear first
        if (item.language === 'pt') item.score += 80;
        
        // Lightweight EPUB Priority: +40 points
        if (item.format === 'epub') item.score += 40;
      });

      items.sort((a, b) => b.score - a.score);
      return items;
    }, query);

    console.log(`[Anna Resolver] Successfully extracted ${results.length} books for "${query}" from Anna's Archive!`);
    return results;
  } catch (err) {
    console.error(`[Anna Resolver] Error searching for "${query}":`, err.message);
    return [];
  } finally {
    if (page) {
      try { await page.close(); } catch (e) {}
    }
  }
}

export async function resolveAnnaDownloadUrl(md5, title = null) {
  if (!md5) return null;
  console.log(`[Anna Resolver] Resolving resilient download mirror for MD5: ${md5} (title: ${title || 'N/A'})`);

  // 1. Direct high-speed LibGen network key resolver across top mirrors
  const libgenDomains = ['libgen.li', 'libgen.gs', 'libgen.vg', 'libgen.pm', 'libgen.rocks'];
  
  for (const dom of libgenDomains) {
    const urlsToTry = [
      `https://${dom}/ads.php?md5=${md5}`,
      `https://${dom}/get.php?md5=${md5}`
    ];

    for (const pageUrl of urlsToTry) {
      try {
        const res = await axios.get(pageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 4000
        });

        const $ = cheerio.load(res.data);
        let keyLink = null;
        $('a').each((i, el) => {
          const href = $(el).attr('href');
          if (href && href.includes('key=')) {
            keyLink = href.startsWith('http') ? href : `https://${dom}/${href.replace(/^\//, '')}`;
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

  // 2. Alternate edition automatic recovery (if title is provided)
  if (title && title.trim().length > 2) {
    console.log(`[Anna Resolver] Primary MD5 unmirrored. Searching alternate editions for "${title}"...`);
    try {
      const candidates = await searchAnnasArchive(title, 'epub', 'pt');
      for (const cand of candidates) {
        if (cand.md5 && cand.md5 !== md5) {
          console.log(`[Anna Resolver] Trying alternate edition MD5: ${cand.md5} (${cand.title})...`);
          for (const dom of ['libgen.li', 'libgen.gs', 'libgen.vg']) {
            try {
              const res = await axios.get(`https://${dom}/ads.php?md5=${cand.md5}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 3500
              });
              const $ = cheerio.load(res.data);
              let altKey = null;
              $('a').each((i, el) => {
                const href = $(el).attr('href');
                if (href && href.includes('key=')) {
                  altKey = href.startsWith('http') ? href : `https://${dom}/${href.replace(/^\//, '')}`;
                }
              });
              if (altKey) {
                console.log(`🎉 [Anna Resolver] Auto-recovery SUCCESS: Found working mirror on alternate edition: ${altKey}`);
                return altKey;
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.log('[Anna Resolver] Auto-recovery note:', err.message);
    }
  }

  return `https://libgen.li/ads.php?md5=${md5}`;
}
