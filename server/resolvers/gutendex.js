import axios from 'axios';

export async function searchGutendex(query) {
  try {
    const url = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
    const response = await axios.get(url, { timeout: 6000 });
    
    if (!response.data || !response.data.results) {
      return [];
    }

    return response.data.results.map(item => {
      const epubFormat = item.formats['application/epub+zip'] || 
                         item.formats['application/octet-stream'] || 
                         `https://www.gutenberg.org/ebooks/${item.id}.epub3.images`;
      const coverUrl = item.formats['image/jpeg'] || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80';
      const author = item.authors && item.authors.length > 0 ? item.authors[0].name.replace(/, (\w+)/, ' $1') : 'Autor Desconhecido';
      const lang = item.languages && item.languages.length > 0 ? item.languages[0] : 'pt';

      return {
        id: `guten_${item.id}`,
        title: item.title,
        author: author,
        year: null,
        language: lang,
        cover: coverUrl,
        downloadUrl: epubFormat,
        source: 'Project Gutenberg',
        rating: 4.8,
        genre: item.subjects && item.subjects.length > 0 ? item.subjects[0] : 'Literatura Clássica',
        description: `Disponível no acervo do Projeto Gutenberg para leitura livre e instantânea.`
      };
    });
  } catch (error) {
    console.error('Gutendex search error:', error.message);
    return [];
  }
}
