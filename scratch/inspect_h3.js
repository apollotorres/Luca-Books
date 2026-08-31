import * as cheerio from 'cheerio';
import fs from 'fs';

const html = fs.readFileSync('scratch/annas_sample.html', 'utf-8');
const $ = cheerio.load(html);

$('h3').each((i, el) => {
  console.log(`\n=== H3 #${i}: "${$(el).text()}" ===`);
  const parent = $(el).parent();
  console.log('Parent HTML:');
  console.log(parent.html());
  
  console.log('\nGrandparent HTML:');
  console.log(parent.parent().html());
});

console.log('\n--- Searching for md5 patterns in entire document ---');
const md5Matches = html.match(/[a-f0-9]{32}/gi);
console.log('Found MD5 hashes:', md5Matches ? Array.from(new Set(md5Matches)).slice(0, 10) : 'none');
