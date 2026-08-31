import * as cheerio from 'cheerio';
import fs from 'fs';

const html = fs.readFileSync('scratch/annas_sample.html', 'utf-8');
const $ = cheerio.load(html);

console.log('Title tag:', $('title').text());
console.log('H1:', $('h1').text());
console.log('H2:', $('h2').text());
console.log('H3 elements count:', $('h3').length);

$('h3').each((i, el) => {
  console.log(`H3 [${i}]:`, $(el).text().trim());
  const parentA = $(el).closest('a');
  console.log(`   Closest A href:`, parentA.attr('href'));
});

console.log('\nAll unique href prefixes in page:');
const hrefs = new Set();
$('a').each((i, el) => {
  const h = $(el).attr('href');
  if (h) {
    const prefix = h.split('?')[0].split('/').slice(0, 3).join('/');
    hrefs.add(prefix || h);
  }
});
console.log(Array.from(hrefs));

console.log('\nSample 5 links with text:');
$('a').slice(0, 15).each((i, el) => {
  console.log(`A [${i}]: href="${$(el).attr('href')}" text="${$(el).text().replace(/\s+/g, ' ').trim().substring(0, 80)}"`);
});
