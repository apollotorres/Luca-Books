import * as cheerio from 'cheerio';
import fs from 'fs';

const html = fs.readFileSync('scratch/book_detail.html', 'utf-8');
const $ = cheerio.load(html);

// Look for elements with text "Downloads" or "Technical details"
$('*').each((i, el) => {
  const text = $(el).clone().children().remove().end().text().trim();
  if (text.toLowerCase() === 'technical details' || text.toLowerCase() === 'downloads') {
    console.log(`\n=== Section: ${text} ===`);
    console.log($(el).parent().html().substring(0, 1500));
  }
});
