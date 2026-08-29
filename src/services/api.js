import { CURATED_COLLECTIONS } from '../data/curatedBooks';

const API_BASE = '/api';

export async function fetchCuratedCollections() {
  try {
    const res = await fetch(`${API_BASE}/curated`);
    if (!res.ok) throw new Error('Falha ao carregar destaques');
    return await res.json();
  } catch (err) {
    console.warn('API Curated fallback to local dataset:', err.message);
    return {
      timestamp: new Date().toISOString(),
      collections: CURATED_COLLECTIONS
    };
  }
}

export async function searchBooksApi(query, lang = 'all', format = 'epub') {
  if (!query || !query.trim()) return { results: [] };
  
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(lang)}&format=${encodeURIComponent(format)}`);
    if (!res.ok) throw new Error(`Erro na busca (${res.status})`);
    return await res.json();
  } catch (err) {
    console.warn('API Search fallback to local matching:', err.message);
    
    // Fallback: match against local curated dataset if API offline
    const qLower = query.toLowerCase().trim();
    const allBooks = CURATED_COLLECTIONS.flatMap(c => c.books);
    const matched = allBooks.filter(b => 
      b.title.toLowerCase().includes(qLower) || 
      b.author.toLowerCase().includes(qLower) ||
      (b.genre && b.genre.toLowerCase().includes(qLower))
    );

    return {
      query,
      count: matched.length,
      results: matched
    };
  }
}

// Download stream with real-time byte progress reporting
export async function fetchBookEpubBinary(downloadUrl, bookId, title, onProgress) {
  if (!downloadUrl && !bookId) throw new Error('Identificador do livro não fornecido.');
  
  const titleParam = title ? `&title=${encodeURIComponent(title)}` : '';
  const urlParam = downloadUrl ? `url=${encodeURIComponent(downloadUrl)}` : '';
  const idParam = bookId ? `&id=${encodeURIComponent(bookId)}` : '';
  const proxyUrl = `${API_BASE}/download?${urlParam}${idParam}${titleParam}`;
  console.log(`[Client API] Fetching EPUB via proxy: ${proxyUrl}`);
  
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    let errorDetail = 'Não foi possível carregar este livro no momento';
    try {
      const errData = await response.json();
      if (errData && errData.error) errorDetail = errData.error;
    } catch (e) {}
    throw new Error(errorDetail);
  }

  return await readStreamIntoBuffer(response, onProgress);
}

async function readStreamIntoBuffer(response, onProgress) {
  const contentLength = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  let receivedLength = 0;
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    receivedLength += value.length;

    if (onProgress) {
      if (contentLength > 0) {
        const percent = Math.min(100, Math.round((receivedLength / contentLength) * 100));
        onProgress(percent, receivedLength, contentLength);
      } else {
        const mb = (receivedLength / (1024 * 1024)).toFixed(1);
        onProgress(null, receivedLength, null, `${mb} MB`);
      }
    }
  }

  // Merge chunks into single buffer
  const allBytes = new Uint8Array(receivedLength);
  let offset = 0;
  for (const chunk of chunks) {
    allBytes.set(chunk, offset);
    offset += chunk.length;
  }

  return allBytes.buffer;
}
