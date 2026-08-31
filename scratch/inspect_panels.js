import * as cheerio from 'cheerio';
import fs from 'fs';

const html = fs.readFileSync('scratch/book_detail.html', 'utf-8');
const $ = cheerio.load(html);

console.log('=== Panel Downloads ===');
console.log($('#book-panel-downloads').html());

console.log('=== Panel Details ===');
console.log($('#book-panel-details').html());
