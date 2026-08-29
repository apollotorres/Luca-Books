import React from 'react';
import { Search, Wifi, WifiOff, X, Zap } from 'lucide-react';

export function Navbar({ 
  searchQuery, 
  setSearchQuery, 
  onSearchSubmit, 
  selectedLang, 
  setSelectedLang,
  selectedFormat = 'epub',
  setSelectedFormat,
  isOnline = true,
  currentTab,
  setCurrentTab 
}) {
  return (
    <header className="top-navbar">
      {/* Search Input Bar */}
      <div className="search-input-wrapper">
        <Search className="search-icon" size={15} />
        <input 
          id="global-search-input"
          type="text"
          className="search-input"
          placeholder="Buscar livros, autores ou tópicos..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (currentTab !== 'search' && e.target.value.trim().length > 0) {
              setCurrentTab('search');
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSearchSubmit(searchQuery);
            }
          }}
          onFocus={() => {
            if (currentTab !== 'search' && searchQuery.trim().length > 0) {
              setCurrentTab('search');
            }
          }}
        />
        {searchQuery ? (
          <button 
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '10px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={14} />
          </button>
        ) : (
          <kbd style={{
            position: 'absolute',
            right: '10px',
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '4px',
            padding: '2px 5px',
            fontSize: '0.68rem',
            color: 'var(--text-subtle)',
            fontFamily: 'var(--font-mono)',
            pointerEvents: 'none'
          }}>
            ⌘K
          </kbd>
        )}
      </div>

      {/* Format & Language Filter Chips */}
      <div className="filter-chips-container">
        {/* Format Selector */}
        <button 
          id="filter-format-epub"
          className={`chip-btn ${selectedFormat === 'epub' ? 'active' : ''}`}
          onClick={() => setSelectedFormat && setSelectedFormat('epub')}
          title="Filtra apenas arquivos EPUB leves (1-3 MB) para leitura instantânea"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <Zap size={12} color={selectedFormat === 'epub' ? '#000' : 'var(--accent-primary-light)'} />
          <span>EPUB (Rápido)</span>
        </button>

        <button 
          id="filter-format-all"
          className={`chip-btn ${selectedFormat === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedFormat && setSelectedFormat('all')}
          title="Mostra todos os formatos incluindo PDFs pesados"
        >
          Todos os Formatos
        </button>

        <div style={{ width: '1px', height: '18px', background: 'var(--border-subtle)', margin: '0 4px' }} />

        {/* Language Selector */}
        <button 
          id="filter-lang-pt"
          className={`chip-btn ${selectedLang === 'pt' ? 'active' : ''}`}
          onClick={() => setSelectedLang('pt')}
          title="Prioriza e filtra obras em Língua Portuguesa"
          style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span>🇧🇷 Português</span>
        </button>
        <button 
          id="filter-lang-all"
          className={`chip-btn ${selectedLang === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedLang('all')}
        >
          🌐 Todos
        </button>
        <button 
          id="filter-lang-en"
          className={`chip-btn ${selectedLang === 'en' ? 'active' : ''}`}
          onClick={() => setSelectedLang('en')}
        >
          🇺🇸 Inglês
        </button>
      </div>

      {/* Online Status Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.74rem',
        fontFamily: 'var(--font-mono)',
        color: isOnline ? '#ededed' : 'var(--accent-amber)',
        background: '#0a0a0a',
        padding: '5px 10px',
        borderRadius: '6px',
        border: '1px solid var(--border-subtle)'
      }}>
        {isOnline ? <Wifi size={12} color="var(--accent-primary-light)" /> : <WifiOff size={12} />}
        <span>{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
      </div>
    </header>
  );
}
