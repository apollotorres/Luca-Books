import React from 'react';
import { BookOpen, Download, Maximize2 } from 'lucide-react';
import { exportBookEpub } from '../services/db';

export function MiniPlayerBar({ currentBook, onOpenReader, progress = 0 }) {
  if (!currentBook) return null;

  const handleExport = async (e) => {
    e.stopPropagation();
    try {
      await exportBookEpub(currentBook.id, currentBook.title);
    } catch (err) {
      alert(`Para exportar o arquivo .EPUB, abra o livro para concluir o download inicial.`);
    }
  };

  const progressPercent = Math.min(100, Math.round((progress || 0) * 100));

  return (
    <div className="mini-player-bar">
      {/* Book Thumbnail & Info */}
      <div className="mini-book-info" onClick={() => onOpenReader(currentBook)} style={{ cursor: 'pointer' }}>
        <img 
          src={currentBook.cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=100&q=80'} 
          alt={currentBook.title} 
          className="mini-book-cover"
        />
        <div className="mini-book-texts">
          <span className="mini-book-title" title={currentBook.title}>{currentBook.title}</span>
          <span className="mini-book-author" title={currentBook.author}>{currentBook.author}</span>
        </div>
      </div>

      {/* Center Controls & Progress */}
      <div className="mini-player-center">
        <div className="mini-player-controls">
          <button 
            id="mini-player-btn-continue"
            className="mini-player-read-btn"
            onClick={() => onOpenReader(currentBook)}
          >
            <BookOpen size={16} />
            <span>Continuar Leitura</span>
          </button>
        </div>

        <div className="mini-progress-wrapper">
          <span>{progressPercent}%</span>
          <div className="mini-progress-bar">
            <div 
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: 'var(--accent-primary)',
                borderRadius: '9999px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <span>{currentBook.pages ? `${currentBook.pages} págs` : '100%'}</span>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="mini-player-actions">
        <button 
          id="mini-player-btn-export"
          className="icon-action-btn" 
          onClick={handleExport}
          title="Exportar arquivo .EPUB para o computador"
        >
          <Download size={18} />
        </button>

        <button 
          id="mini-player-btn-fullscreen"
          className="icon-action-btn" 
          onClick={() => onOpenReader(currentBook)}
          title="Tela Cheia"
        >
          <Maximize2 size={18} />
        </button>
      </div>
    </div>
  );
}
