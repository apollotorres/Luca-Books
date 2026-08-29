import { get, set, del, keys } from 'idb-keyval';

const LIBRARY_INDEX_KEY = 'lumina_library_index';
const READING_PROGRESS_KEY = 'lumina_reading_progress';
const SETTINGS_KEY = 'lumina_reader_settings';

// Request browser permission for persistent storage so the OS doesn't clean cache
export async function requestStoragePersistence() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      return isPersisted;
    } catch (e) {
      console.warn('[Storage] Could not request persistence', e);
    }
  }
  return false;
}

// Get all books in user's offline library
export async function getLibraryBooks() {
  try {
    const library = await get(LIBRARY_INDEX_KEY);
    return library || [];
  } catch (err) {
    console.error('Error fetching library from IndexedDB:', err);
    return [];
  }
}

// Save a book metadata and its EPUB ArrayBuffer binary to local IndexedDB
export async function saveBookToLibrary(book, epubBuffer) {
  try {
    const library = (await get(LIBRARY_INDEX_KEY)) || [];
    
    // Store binary EPUB data
    const binaryKey = `epub_data_${book.id}`;
    if (epubBuffer) {
      await set(binaryKey, epubBuffer);
    }

    const existingIndex = library.findIndex(b => b.id === book.id);
    const updatedBook = {
      ...book,
      hasOfflineData: !!epubBuffer || (existingIndex >= 0 && library[existingIndex].hasOfflineData),
      savedAt: existingIndex >= 0 ? library[existingIndex].savedAt : new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      library[existingIndex] = { ...library[existingIndex], ...updatedBook };
    } else {
      library.unshift(updatedBook);
    }

    await set(LIBRARY_INDEX_KEY, library);
    return updatedBook;
  } catch (err) {
    console.error('Error saving book to IndexedDB:', err);
    throw err;
  }
}

// Retrieve EPUB binary buffer from IndexedDB
export async function getBookBinary(bookId) {
  try {
    const binaryKey = `epub_data_${bookId}`;
    return await get(binaryKey);
  } catch (err) {
    console.error(`Error reading binary for book ${bookId}:`, err);
    return null;
  }
}

// Save reading position (CFI, progress percentage, chapter title)
export async function saveReadingProgress(bookId, progressData) {
  try {
    const allProgress = (await get(READING_PROGRESS_KEY)) || {};
    allProgress[bookId] = {
      ...allProgress[bookId],
      ...progressData,
      updatedAt: new Date().toISOString()
    };
    await set(READING_PROGRESS_KEY, allProgress);

    // Also update lastOpenedAt and progress in library index
    const library = (await get(LIBRARY_INDEX_KEY)) || [];
    const index = library.findIndex(b => b.id === bookId);
    if (index >= 0) {
      library[index].progress = progressData.progress ?? library[index].progress;
      library[index].lastOpenedAt = new Date().toISOString();
      await set(LIBRARY_INDEX_KEY, library);
    }
  } catch (err) {
    console.error('Error saving progress:', err);
  }
}

// Get saved progress for a book
export async function getReadingProgress(bookId) {
  try {
    const allProgress = (await get(READING_PROGRESS_KEY)) || {};
    return allProgress[bookId] || null;
  } catch (err) {
    console.error('Error getting progress:', err);
    return null;
  }
}

// Remove book and its binary from local device
export async function removeBookFromLibrary(bookId) {
  try {
    const library = (await get(LIBRARY_INDEX_KEY)) || [];
    const updated = library.filter(b => b.id !== bookId);
    await set(LIBRARY_INDEX_KEY, updated);
    await del(`epub_data_${bookId}`);
    
    const allProgress = (await get(READING_PROGRESS_KEY)) || {};
    delete allProgress[bookId];
    await set(READING_PROGRESS_KEY, allProgress);
    return true;
  } catch (err) {
    console.error('Error removing book:', err);
    return false;
  }
}

// Export raw EPUB file to user's download folder on demand
export async function exportBookEpub(bookId, bookTitle = 'livro') {
  try {
    const buffer = await getBookBinary(bookId);
    if (!buffer) {
      throw new Error('Arquivo não encontrado no armazenamento local.');
    }
    const blob = new Blob([buffer], { type: 'application/epub+zip' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const sanitizedTitle = bookTitle.replace(/[/\\?%*:|"<>]/g, '-').trim();
    a.download = `${sanitizedTitle}.epub`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Error exporting EPUB:', err);
    throw err;
  }
}

// Reader preferences (theme, font, size, line-height)
export async function getReaderSettings() {
  const defaults = {
    theme: 'dark', // 'dark', 'oled', 'sepia', 'light'
    fontFamily: 'Literata', // 'Literata', 'Merriweather', 'Inter', 'Bookerly', 'System'
    fontSize: 18,
    lineHeight: 1.6,
    marginWidth: 'normal', // 'narrow', 'normal', 'wide'
    flow: 'paginated' // 'paginated', 'scrolled'
  };
  try {
    const saved = await get(SETTINGS_KEY);
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

export async function saveReaderSettings(settings) {
  try {
    await set(SETTINGS_KEY, settings);
  } catch (err) {
    console.error('Error saving settings:', err);
  }
}
