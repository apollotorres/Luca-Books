import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const agent = new https.Agent({
  rejectUnauthorized: false
});

const queries = ['aventuras de pin', 'pinocchio', 'canção para ninar menino grande', 'machado de assis'];

async function testAll() {
  console.log('=== TESTING SEARCH MECHANICS ===\n');

  // Test 1: Anna's Archive mirrors with various headers
  const annasMirrors = [
    'https://annas-archive.li',
    'https://annas-archive.pm',
    'https://annas-archive.gs',
    'https://annas-archive.pk',
    'https://annas-archive.is'
  ];

  for (const q of queries) {
    console.log(`\n========================================`);
    console.log(`QUERY: "${q}"`);
    console.log(`========================================`);

    // 1. Try Anna's Archive
    for (const m of annasMirrors) {
      try {
        const url = `${m}/search?q=${encodeURIComponent(q)}`;
        const res = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          },
          httpsAgent: agent,
          timeout: 6000
        });

        const $ = cheerio.load(res.data);
        const results = [];
        $('a[href*="/md5/"]').each((i, el) => {
          const href = $(el).attr('href');
          const title = $(el).find('h3').text().trim() || $(el).text().replace(/\s+/g, ' ').trim();
          if (title && !results.some(r => r.href === href)) {
            results.push({ title: title.substring(0, 60), href });
          }
        });

        console.log(`[Anna ${m}] Status: ${res.status}, Results count: ${results.length}`);
        if (results.length > 0) {
          console.log(`   Sample:`, results.slice(0, 3));
        } else {
          console.log(`   HTML preview (first 250 chars):`, res.data.substring(0, 250).replace(/\s+/g, ' '));
        }
      } catch (e) {
        console.log(`[Anna ${m}] Error:`, e.message);
      }
    }

    // 2. Try Libgen.is (Standard non-fiction & fiction index)
    try {
      const url = `https://libgen.is/search.php?req=${encodeURIComponent(q)}&lg_topic=libgen&open=0&view=simple&res=50&phrase=1&column=def`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 6000
      });
      const $ = cheerio.load(res.data);
      const rows = $('table.c tbody tr').length || $('table.c tr').length;
      console.log(`[Libgen.is (def)] Rows found: ${rows}`);
    } catch (e) {
      console.log(`[Libgen.is] Error:`, e.message);
    }

    // 3. Try Libgen Fiction
    try {
      const url = `https://libgen.is/fiction/?q=${encodeURIComponent(q)}&language=Portuguese`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 6000
      });
      const $ = cheerio.load(res.data);
      const rows = $('table.catalog tbody tr').length || $('table.catalog tr').length;
      console.log(`[Libgen.is (fiction)] Rows found: ${rows}`);
    } catch (e) {
      console.log(`[Libgen Fiction] Error:`, e.message);
    }

    // 4. Try Libgen.li without restrictive column filters vs with wildcard
    try {
      const url = `https://libgen.li/index.php?req=${encodeURIComponent(q)}&columns%5B%5D=t&columns%5B%5D=a&objects%5B%5D=f&topics%5B%5D=l&topics%5B%5D=f&res=50`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 6000
      });
      const $ = cheerio.load(res.data);
      const rows = $('table#tablelibgen tbody tr').length;
      console.log(`[Libgen.li (columns t,a)] Rows found: ${rows}`);
    } catch (e) {
      console.log(`[Libgen.li] Error:`, e.message);
    }

    // 5. Try Libgen.li with general search
    try {
      const url = `https://libgen.li/index.php?req=${encodeURIComponent(q)}&res=50`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 6000
      });
      const $ = cheerio.load(res.data);
      const rows = $('table#tablelibgen tbody tr').length;
      console.log(`[Libgen.li (general)] Rows found: ${rows}`);
    } catch (e) {
      console.log(`[Libgen.li general] Error:`, e.message);
    }
  }
}

testAll();
