import React from 'react';
import { BookCard } from './BookCard';
import { Search, Loader2, Sparkles, Zap, FileText, Globe } from 'lucide-react';

const POPULAR_GENRES = [
  'Machado de Assis',
  'Filosofia Estoica',
  'Ficção Científica',
  'Mistério & Sherlock',
  'A Arte da Guerra',
  'Terror Clássico',
  'Literatura Brasileira',
  'Desenvolvimento Pessoal'
];

export function SearchView({ 
  searchQuery, 
  setSearchQuery, 
  onSearchSubmit, 
  searchResults = [], 
  isLoading = false, 
  onOpenBook,
  libraryMap = {},
  selectedFormat = 'epub',
  setSelectedFormat,
  selectedLang = 'pt',
  setSelectedLang
}) {
  return (
    <div className="page-view">
      {/* Search Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {searchQuery ? `Resultados para "${searchQuery}"` : 'Explorar & Buscar'}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.86rem', marginTop: '2px' }}>
              Pesquise no acervo universal do Anna's Archive com prioridade para livros em Português e arquivos leves.
            </p>
          </div>

          {/* Quick Format & Language Filter Bar */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Format Selector */}
            {setSelectedFormat && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#0c0c0e',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <button
                  className={`chip-btn ${selectedFormat === 'epub' ? 'active' : ''}`}
                  onClick={() => setSelectedFormat('epub')}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '3px 9px' }}
                  title="Filtra apenas livros leves em EPUB para leitura instantânea"
                >
                  <Zap size={12} color={selectedFormat === 'epub' ? '#000' : 'var(--accent-primary-light)'} />
                  <span>EPUB ⚡</span>
                </button>
                <button
                  className={`chip-btn ${selectedFormat === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedFormat('all')}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '3px 9px' }}
                  title="Inclui livros em PDF"
                >
                  <span>Todos Formatos</span>
                </button>
              </div>
            )}

            {/* Language Selector */}
            {setSelectedLang && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#0c0c0e',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)'
              }}>
                <button
                  className={`chip-btn ${selectedLang === 'pt' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('pt')}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '3px 9px' }}
                  title="Prioriza obras em Português"
                >
                  <span>🇧🇷 Português</span>
                </button>
                <button
                  className={`chip-btn ${selectedLang === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('all')}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '3px 9px' }}
                  title="Todos os idiomas"
                >
                  <span>🌐 Todos</span>
                </button>
                <button
                  className={`chip-btn ${selectedLang === 'en' ? 'active' : ''}`}
                  onClick={() => setSelectedLang('en')}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', padding: '3px 9px' }}
                  title="Inglês"
                >
                  <span>🇺🇸 EN</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Quick Genre Pills */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {POPULAR_GENRES.map((genre) => (
            <button
              key={genre}
              className="chip-btn"
              onClick={() => {
                setSearchQuery(genre);
                onSearchSubmit(genre);
              }}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State with Animated Skeletons */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px', 
            padding: '14px 20px', 
            background: 'var(--bg-surface)', 
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            width: 'fit-content'
          }}>
            <Loader2 size={20} className="animate-spin" color="var(--accent-primary)" />
            <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>
              Consultando acervo do Anna's Archive (Prioridade: {selectedLang === 'pt' ? '🇧🇷 Português' : 'Global'}, {selectedFormat === 'epub' ? 'EPUB ⚡' : 'Todos'})...
            </span>
          </div>

          <div className="books-grid">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="book-card" style={{ opacity: 0.6 }}>
                <div 
                  className="book-cover-container animate-pulse" 
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }} 
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div 
                    className="animate-pulse" 
                    style={{ height: '14px', width: '85%', background: 'var(--bg-elevated)', borderRadius: '4px' }} 
                  />
                  <div 
                    className="animate-pulse" 
                    style={{ height: '12px', width: '55%', background: 'var(--bg-elevated)', borderRadius: '4px' }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Grid */}
      {!isLoading && searchResults.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {searchResults.length} livro{searchResults.length === 1 ? '' : 's'} encontrado{searchResults.length === 1 ? '' : 's'} • Prioridade: {selectedLang === 'pt' ? '🇧🇷 Português' : 'Todos'}.
            </p>
            {selectedFormat === 'epub' && (
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary-light)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Zap size={12} /> Otimizado para leitura rápida
              </span>
            )}
          </div>
          <div className="books-grid">
            {searchResults.map((book) => {
              const isOffline = !!libraryMap[book.id]?.hasOfflineData;
              const progress = libraryMap[book.id]?.progress || 0;
              return (
                <BookCard 
                  key={book.id} 
                  book={book} 
                  onOpen={onOpenBook}
                  isOffline={isOffline}
                  progress={progress}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Empty / Initial State */}
      {!isLoading && searchResults.length === 0 && searchQuery && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          textAlign: 'center',
          gap: '14px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)'
        }}>
          <Search size={36} color="var(--text-subtle)" />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Nenhum livro encontrado</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.9rem' }}>
            Tente buscar por outro termo, alternar idioma para "Todos" ou escolher um dos tópicos sugeridos.
          </p>
        </div>
      )}
    </div>
  );
}
