import React from 'react';
import { BookOpen, Bookmark, Star, Sparkles } from 'lucide-react';

export function HeroBanner({ featuredBook, onOpenBook, onSaveToLibrary, isSaved = false }) {
  if (!featuredBook) return null;

  return (
    <div className="hero-spotlight">
      <div className="hero-glow-bg" />
      
      {/* Book Cover */}
      <div className="hero-cover-wrapper" onClick={() => onOpenBook(featuredBook)} style={{ cursor: 'pointer' }}>
        <img 
          src={featuredBook.cover} 
          alt={featuredBook.title} 
          className="hero-cover-img"
          loading="eager"
        />
      </div>

      {/* Book Details */}
      <div className="hero-details">
        <div className="hero-tag">
          <Sparkles size={13} />
          <span>{featuredBook.badge || 'Obra em Destaque'}</span>
        </div>

        <h1 className="hero-title">{featuredBook.title}</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <span className="hero-author">de {featuredBook.author}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#f59e0b', fontSize: '0.9rem', fontWeight: 700 }}>
            <Star size={16} fill="#f59e0b" color="#f59e0b" />
            <span>{featuredBook.rating || '4.9'}</span>
          </div>
          {featuredBook.year && (
            <span style={{ fontSize: '0.88rem', color: 'var(--text-subtle)' }}>
              • {featuredBook.year}
            </span>
          )}
          <span style={{ fontSize: '0.88rem', color: 'var(--text-subtle)' }}>
            • {featuredBook.genre || 'Literatura'}
          </span>
        </div>

        <p className="hero-desc">{featuredBook.description}</p>

        <div className="hero-actions">
          <button 
            id="hero-btn-read-now"
            className="btn-primary"
            onClick={() => onOpenBook(featuredBook)}
          >
            <BookOpen size={18} />
            <span>Começar Leitura</span>
          </button>

          <button 
            id="hero-btn-save-library"
            className="btn-secondary"
            onClick={() => onSaveToLibrary(featuredBook)}
          >
            <Bookmark size={17} fill={isSaved ? "currentColor" : "none"} />
            <span>{isSaved ? 'Na Biblioteca' : 'Salvar'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
