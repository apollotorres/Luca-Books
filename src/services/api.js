const API_BASE = '/api';

export async function fetchCuratedCollections() {
  try {
    const res = await fetch(`${API_BASE}/curated`);
    if (!res.ok) throw new Error('Falha ao carregar destaques');
    return await res.json();
  } catch (err) {
    console.error('API Curated error:', err);
    throw err;
  }
}

export async function searchBooksApi(query, lang = 'all', format = 'epub') {
  if (!query || !query.trim()) return { results: [] };
  try {
    const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(lang)}&format=${encodeURIComponent(format)}`);
    if (!res.ok) throw new Error('Erro na busca');
    return await res.json();
  } catch (err) {
    console.error('API Search error:', err);
    throw err;
  }
}

// Download stream with real-time byte progress reporting
export async function fetchBookEpubBinary(downloadUrl, bookId, title, onProgress) {
  if (!downloadUrl) throw new Error('URL de download não fornecida.');
  
  const titleParam = title ? `&title=${encodeURIComponent(title)}` : '';
  const proxyUrl = `${API_BASE}/download?url=${encodeURIComponent(downloadUrl)}${bookId ? `&id=${encodeURIComponent(bookId)}` : ''}${titleParam}`;
  console.log(`[Client API] Fetching EPUB via proxy: ${proxyUrl}`);
  
  const response = await fetch(proxyUrl);
  if (!response.ok) {
    throw new Error(`Erro ao baixar livro (Status ${response.status})`);
  }

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
        // Approximate estimation for chunked transfers
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
