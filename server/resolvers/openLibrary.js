import axios from 'axios';

export async function searchOpenLibrary(query, limit = 15) {
  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await axios.get(url, { timeout: 6000 });
    
    if (!response.data || !response.data.docs) {
      return [];
    }

    const books = response.data.docs
      .filter(doc => doc.title && (doc.author_name || doc.ia || doc.cover_i))
      .map(doc => {
        const coverId = doc.cover_i;
        const coverUrl = coverId 
          ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` 
          : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80';
        
        const iaId = doc.ia && doc.ia.length > 0 ? doc.ia[0] : null;
        const downloadUrl = iaId 
          ? `https://archive.org/download/${iaId}/${iaId}.epub` 
          : null;

        const languages = doc.language || [];
        const isPt = languages.includes('por') || languages.includes('pt');

        return {
          id: `ol_${doc.key?.replace('/works/', '') || Math.random().toString(36).substring(7)}`,
          title: doc.title,
          author: doc.author_name ? doc.author_name[0] : 'Autor Desconhecido',
          year: doc.first_publish_year || (doc.publish_year ? doc.publish_year[0] : null),
          language: isPt ? 'pt' : (languages[0] || 'en'),
          cover: coverUrl,
          downloadUrl: downloadUrl,
          iaId: iaId,
          source: 'Open Library / Internet Archive',
          rating: 4.5 + Math.round(Math.random() * 5) / 10,
          genre: doc.subject ? doc.subject[0] : 'Geral',
          description: doc.first_sentence ? doc.first_sentence[0] : `Obra clássica catalogada no acervo aberto global de literatura.`
        };
      });

    return books;
  } catch (error) {
    console.error('OpenLibrary search error:', error.message);
    return [];
  }
}
