import React, { useState } from 'react';
import { BookOpen, Star, CheckCircle } from 'lucide-react';

export function getSourceInfo(source, sourceId) {
  const s = (source || '').toLowerCase();
  const id = (sourceId || '').toLowerCase();

  if (s.includes('gutenberg') || id === 'gutenberg') {
    return { name: 'Gutenberg', icon: '🏛️', className: 'source-gutenberg' };
  }
  if (s.includes('archive') || id === 'archive') {
    return { name: 'Archive.org', icon: '🌐', className: 'source-archive' };
  }
  if (s.includes('open library') || id === 'openlibrary') {
    return { name: 'Open Library', icon: '📖', className: 'source-openlibrary' };
  }
  if (s.includes('curador') || id === 'curated') {
    return { name: 'Curadoria Luca', icon: '✨', className: 'source-curated' };
  }
  return { name: "Anna's Archive", icon: '🟣', className: 'source-annas' };
}

export function BookCard({ book, onOpen, isOffline = false, progress = 0 }) {
  const [imgSrc, setImgSrc] = useState(book.cover || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80');

  const handleImageError = () => {
    setImgSrc('https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80');
  };

  const isPortuguese = book.language === 'pt' || book.language === 'por' || !book.language;
  const langLabel = isPortuguese ? '🇧🇷 PT' : (book.language === 'es' ? '🇪🇸 ES' : '🇺🇸 EN');
  const sourceInfo = getSourceInfo(book.source, book.sourceId);

  return (
    <div 
      className="book-card" 
      onClick={() => onOpen(book)}
      role="button"
      tabIndex={0}
      id={`book-card-${book.id}`}
    >
      {/* Cover Image Container */}
      <div className="book-cover-container">
        <img 
          src={imgSrc} 
          alt={book.title} 
          className="book-card-cover"
          onError={handleImageError}
          loading="lazy"
        />

        {/* Floating Play / Read Button */}
        <button 
          className="book-floating-play-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(book);
          }}
          title="Ler Agora"
        >
          <BookOpen size={20} />
        </button>

        {/* Format & Size Badge (Top Left) */}
        {book.badge && (
          <div className={`book-card-badge ${book.format === 'pdf' || (book.badge && book.badge.startsWith('PDF')) ? 'badge-pdf' : 'badge-epub'}`}>
            {book.badge}
          </div>
        )}

        {/* Language Badge (Top Right) */}
        <div className={`book-card-lang-badge ${isPortuguese ? 'lang-pt' : 'lang-other'}`} title={`Idioma: ${isPortuguese ? 'Português' : book.language?.toUpperCase()}`}>
          {langLabel}
        </div>

        {/* Offline Saved Indicator */}
        {isOffline && (
          <div className="book-card-offline-tag" title="Salvo no dispositivo">
            <CheckCircle size={10} />
            <span>Offline</span>
          </div>
        )}
      </div>

      {/* Book Information */}
      <div className="book-card-info">
        <h3 className="book-card-title" title={book.title}>{book.title}</h3>
        <p className="book-card-author" title={book.author}>{book.author}</p>

        {/* Source Provider Tag */}
        <div className="book-card-source-row">
          <span className={`book-card-source-tag ${sourceInfo.className}`} title={`Fonte do acervo: ${sourceInfo.name}`}>
            <span>{sourceInfo.icon}</span>
            <span>{sourceInfo.name}</span>
          </span>
        </div>

        {/* Progress Bar (if reading) */}
        {progress > 0 && (
          <div style={{ marginTop: '4px' }}>
            <div className="book-progress-bar-bg">
              <div 
                className="book-progress-bar-fill" 
                style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
              />
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary-light)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
              {Math.round(progress * 100)}% lido
            </span>
          </div>
        )}

        {/* Footer Meta */}
        {progress === 0 && (
          <div className="book-card-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#f59e0b', fontWeight: 600 }}>
              <Star size={12} fill="#f59e0b" color="#f59e0b" />
              <span>{book.rating || '4.8'}</span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {book.year ? book.year : (isPortuguese ? 'Português' : (book.genre || 'Inglês'))}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
