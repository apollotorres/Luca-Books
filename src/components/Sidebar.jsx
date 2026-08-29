import React from 'react';
import { 
  Home, 
  Search, 
  BookMarked, 
  UploadCloud, 
  HardDrive, 
  Sparkles,
  BookOpen
} from 'lucide-react';

export function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  openImportModal, 
  libraryCount = 0,
  storagePersisted = false
}) {
  return (
    <aside className="sidebar">
      {/* Brand Header (Visible on Desktop & Tablet) */}
      <div className="brand-logo" onClick={() => setCurrentTab('home')} style={{ cursor: 'pointer' }}>
        <div className="brand-icon">
          <BookOpen size={18} strokeWidth={2.5} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="brand-name">Lumina</span>
          <span className="brand-badge">PRO</span>
        </div>
      </div>

      {/* Main Navigation Menu (Converts to Fixed Bottom Bar on Mobile) */}
      <nav className="nav-menu">
        <button 
          id="nav-btn-home"
          className={`nav-item ${currentTab === 'home' ? 'active' : ''}`}
          onClick={() => setCurrentTab('home')}
          title="Página Inicial"
        >
          <Home size={18} />
          <span>Início</span>
        </button>

        <button 
          id="nav-btn-search"
          className={`nav-item ${currentTab === 'search' ? 'active' : ''}`}
          onClick={() => setCurrentTab('search')}
          title="Explorar Acervo & Buscar Livros"
        >
          <Search size={18} />
          <span>Explorar</span>
        </button>

        <button 
          id="nav-btn-library"
          className={`nav-item ${currentTab === 'library' ? 'active' : ''}`}
          onClick={() => setCurrentTab('library')}
          title="Minha Biblioteca Offline"
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <BookMarked size={18} />
            {libraryCount > 0 && (
              <span className="library-counter-badge">
                {libraryCount}
              </span>
            )}
          </div>
          <span>Biblioteca</span>
        </button>

        {/* Mobile Quick Import Item */}
        <button 
          id="nav-btn-import-mobile"
          className="nav-item mobile-only-import-btn"
          onClick={openImportModal}
          title="Importar livro EPUB local"
        >
          <UploadCloud size={18} color="var(--accent-primary-light)" />
          <span>Importar</span>
        </button>
      </nav>

      <div className="sidebar-divider desktop-only" />

      {/* Sideload / Import section (Desktop) */}
      <div className="desktop-actions-section">
        <span className="sidebar-section-title">Ações</span>
        <button 
          id="btn-import-epub"
          className="quick-import-btn"
          onClick={openImportModal}
        >
          <UploadCloud size={16} color="var(--accent-primary)" />
          <span>Importar .EPUB</span>
        </button>
      </div>

      {/* Storage Quota Card (Desktop) */}
      <div className="storage-status-card desktop-only">
        <div className="storage-status-header">
          <div className="storage-badge-dot" />
          <HardDrive size={14} />
          <span>Armazenamento Local</span>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: '1.4' }}>
          {libraryCount} livro{libraryCount === 1 ? '' : 's'} sincronizado{libraryCount === 1 ? '' : 's'} offline no dispositivo.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
          <Sparkles size={11} color="var(--accent-primary-light)" />
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary-light)', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>
            {storagePersisted ? 'Storage Persistente' : 'IndexedDB Ativo'}
          </span>
        </div>
      </div>
    </aside>
  );
}
