import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { BookCarousel } from './components/BookCarousel';
import { MiniPlayerBar } from './components/MiniPlayerBar';
import { LibraryView } from './components/LibraryView';
import { SearchView } from './components/SearchView';
import { ImportModal } from './components/ImportModal';
import { ReaderModal } from './components/ReaderModal';
import { 
  getLibraryBooks, 
  requestStoragePersistence, 
  saveBookToLibrary 
} from './services/db';
import { fetchCuratedCollections, searchBooksApi } from './services/api';

export function App() {
  const [currentTab, setCurrentTab] = useState('home'); // 'home', 'search', 'library'
  const [curatedCollections, setCuratedCollections] = useState([]);
  const [featuredBook, setFeaturedBook] = useState(null);
  
  // Library & Local Storage State
  const [library, setLibrary] = useState([]);
  const [storagePersisted, setStoragePersisted] = useState(false);
  
  // Active Reader and Mini Player
  const [activeReaderBook, setActiveReaderBook] = useState(null);
  const [currentActiveBook, setCurrentActiveBook] = useState(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLang, setSelectedLang] = useState('pt'); // Default prioritize Portuguese
  const [selectedFormat, setSelectedFormat] = useState('epub'); // 'epub' (instant & light) or 'all'

  // Modals & Network
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Load Library from IndexedDB
  const refreshLibrary = useCallback(async () => {
    try {
      const books = await getLibraryBooks();
      setLibrary(books);
      if (books.length > 0 && !currentActiveBook) {
        setCurrentActiveBook(books[0]);
      }
    } catch (err) {
      console.error('Error refreshing library:', err);
    }
  }, [currentActiveBook]);

  // Initial Bootstrapping
  useEffect(() => {
    // 1. Request persistent disk storage
    requestStoragePersistence().then(persisted => {
      setStoragePersisted(persisted);
    });

    // 2. Load offline library
    refreshLibrary();

    // 3. Fetch curated showcase books
    fetchCuratedCollections().then(data => {
      if (data && data.collections) {
        setCuratedCollections(data.collections);
        if (data.collections[0]?.books?.[0]) {
          setFeaturedBook(data.collections[0].books[0]);
        }
      }
    }).catch(err => {
      console.log('Curated books fallback or offline mode:', err);
    });

    // 4. Listen for network changes
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshLibrary]);

  // Execute Search with format & language filtering
  const handleSearch = async (queryText, lang = selectedLang, format = selectedFormat) => {
    const q = queryText || searchQuery;
    if (!q.trim()) return;
    setIsSearching(true);
    setCurrentTab('search');
    try {
      const data = await searchBooksApi(q, lang, format);
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Open Book in Reader
  const handleOpenBook = (book) => {
    setCurrentActiveBook(book);
    setActiveReaderBook(book);
  };

  // Save Book to Library
  const handleSaveToLibrary = async (book) => {
    try {
      await saveBookToLibrary(book, null);
      await refreshLibrary();
    } catch (err) {
      console.error('Error saving book:', err);
    }
  };

  // Progress update callback from Reader
  const handleProgressUpdate = (bookId, progress) => {
    refreshLibrary();
    if (currentActiveBook && currentActiveBook.id === bookId) {
      setCurrentActiveBook(prev => prev ? { ...prev, progress } : prev);
    }
  };

  // Fast lookup map for library books
  const libraryMap = library.reduce((acc, b) => {
    acc[b.id] = b;
    return acc;
  }, {});

  const currentBookProgress = currentActiveBook ? (libraryMap[currentActiveBook.id]?.progress || 0) : 0;

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        openImportModal={() => setIsImportModalOpen(true)}
        libraryCount={library.length}
        storagePersisted={storagePersisted}
      />

      {/* Main Content Pane */}
      <main className="main-content">
        <Navbar 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearchSubmit={(q) => handleSearch(q, selectedLang, selectedFormat)}
          selectedLang={selectedLang}
          setSelectedLang={(lang) => {
            setSelectedLang(lang);
            if (searchQuery) handleSearch(searchQuery, lang, selectedFormat);
          }}
          selectedFormat={selectedFormat}
          setSelectedFormat={(format) => {
            setSelectedFormat(format);
            if (searchQuery) handleSearch(searchQuery, selectedLang, format);
          }}
          isOnline={isOnline}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
        />

        {/* Tab Views */}
        {currentTab === 'home' && (
          <div className="page-view">
            {/* Hero Spotlight */}
            <HeroBanner 
              featuredBook={featuredBook}
              onOpenBook={handleOpenBook}
              onSaveToLibrary={handleSaveToLibrary}
              isSaved={featuredBook ? !!libraryMap[featuredBook.id] : false}
            />

            {/* Curated Carousels */}
            {curatedCollections.map((collection) => (
              <BookCarousel 
                key={collection.id}
                collection={collection}
                onOpenBook={handleOpenBook}
                libraryMap={libraryMap}
              />
            ))}
          </div>
        )}

        {currentTab === 'search' && (
          <SearchView 
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onSearchSubmit={(q) => handleSearch(q, selectedLang, selectedFormat)}
            searchResults={searchResults}
            isLoading={isSearching}
            onOpenBook={handleOpenBook}
            libraryMap={libraryMap}
            selectedFormat={selectedFormat}
            setSelectedFormat={(format) => {
              setSelectedFormat(format);
              if (searchQuery) handleSearch(searchQuery, selectedLang, format);
            }}
            selectedLang={selectedLang}
            setSelectedLang={(lang) => {
              setSelectedLang(lang);
              if (searchQuery) handleSearch(searchQuery, lang, selectedFormat);
            }}
          />
        )}

        {currentTab === 'library' && (
          <LibraryView 
            library={library}
            onOpenBook={handleOpenBook}
            onRefreshLibrary={refreshLibrary}
            openImportModal={() => setIsImportModalOpen(true)}
            setCurrentTab={setCurrentTab}
          />
        )}
      </main>

      {/* Persistent Mini Player Bar */}
      <MiniPlayerBar 
        currentBook={currentActiveBook}
        onOpenReader={handleOpenBook}
        progress={currentBookProgress}
      />

      {/* Sideload / Import Modal */}
      <ImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={(newBook) => {
          refreshLibrary();
          handleOpenBook(newBook);
        }}
      />

      {/* Immersive Web eReader */}
      {activeReaderBook && (
        <ReaderModal 
          book={activeReaderBook}
          onClose={() => {
            setActiveReaderBook(null);
            refreshLibrary();
          }}
          onProgressUpdate={handleProgressUpdate}
        />
      )}
    </div>
  );
}

export default App;
