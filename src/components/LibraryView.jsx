import React, { useState } from 'react';
import { BookCard } from './BookCard';
import { BookMarked, Download, Trash2, BookOpen, Sparkles, FolderOpen } from 'lucide-react';
import { exportBookEpub, removeBookFromLibrary } from '../services/db';

export function LibraryView({ 
  library = [], 
  onOpenBook, 
  onRefreshLibrary,
  openImportModal,
  setCurrentTab 
}) {
  const [filter, setFilter] = useState('all'); // 'all', 'reading', 'offline', 'finished'

  const filteredBooks = library.filter(book => {
    const progress = book.progress || 0;
    if (filter === 'reading') return progress > 0 && progress < 0.98;
    if (filter === 'finished') return progress >= 0.98;
    if (filter === 'offline') return !!book.hasOfflineData;
    return true;
  });

  const handleExport = async (book, e) => {
    e.stopPropagation();
    try {
      await exportBookEpub(book.id, book.title);
    } catch (err) {
      alert('Não foi possível exportar: o arquivo ainda não foi baixado completamente.');
    }
  };

  const handleRemove = async (book, e) => {
    e.stopPropagation();
    if (window.confirm(`Deseja remover "${book.title}" da sua biblioteca local?`)) {
      await removeBookFromLibrary(book.id);
      onRefreshLibrary();
    }
  };

  return (
    <div className="page-view">
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '2rem', fontWeight: 800 }}>
              Sua Biblioteca
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Seus livros salvos localmente no dispositivo para leitura instantânea e offline.
            </p>
          </div>

          <button 
            id="lib-btn-import"
            className="btn-secondary"
            onClick={openImportModal}
          >
            <FolderOpen size={16} color="var(--accent-emerald)" />
            <span>Adicionar Arquivo .EPUB</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', overflowX: 'auto' }}>
          <button 
            className={`chip-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Todos ({library.length})
          </button>
          <button 
            className={`chip-btn ${filter === 'reading' ? 'active' : ''}`}
            onClick={() => setFilter('reading')}
          >
            Lendo Agora
          </button>
          <button 
            className={`chip-btn ${filter === 'offline' ? 'active' : ''}`}
            onClick={() => setFilter('offline')}
          >
            Baixados Offline
          </button>
          <button 
            className={`chip-btn ${filter === 'finished' ? 'active' : ''}`}
            onClick={() => setFilter('finished')}
          >
            Concluídos
          </button>
        </div>
      </div>

      {/* Books List or Empty State */}
      {filteredBooks.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          textAlign: 'center',
          gap: '16px',
          background: 'var(--bg-card)',
          borderRadius: 'var(--radius-xl)',
          border: '1px dashed var(--border-subtle)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-emerald-light)'
          }}>
            <BookMarked size={32} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Nenhum livro nesta seção</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '400px', fontSize: '0.9rem', lineHeight: '1.5' }}>
            Explore o acervo completo na tela inicial ou busque qualquer livro do mundo para começar a ler com 1 clique!
          </p>
          <button 
            className="btn-primary" 
            onClick={() => setCurrentTab('home')}
            style={{ marginTop: '8px' }}
          >
            <Sparkles size={16} />
            <span>Explorar Acervo de Livros</span>
          </button>
        </div>
      ) : (
        <div className="books-grid">
          {filteredBooks.map((book) => {
            const progress = book.progress || 0;
            return (
              <div key={book.id} style={{ position: 'relative' }}>
                <BookCard 
                  book={book} 
                  onOpen={onOpenBook}
                  isOffline={!!book.hasOfflineData}
                  progress={progress}
                />
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '8px',
                  padding: '0 4px'
                }}>
                  <button 
                    onClick={(e) => handleExport(book, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-subtle)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 6px',
                      borderRadius: '4px'
                    }}
                    title="Baixar arquivo EPUB no computador"
                  >
                    <Download size={13} />
                    <span>Exportar</span>
                  </button>

                  <button 
                    onClick={(e) => handleRemove(book, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-rose)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 6px',
                      borderRadius: '4px',
                      opacity: 0.8
                    }}
                    title="Remover do dispositivo"
                  >
                    <Trash2 size={13} />
                    <span>Remover</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
