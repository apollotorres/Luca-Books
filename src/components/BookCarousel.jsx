import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BookCard } from './BookCard';

export function BookCarousel({ collection, onOpenBook, libraryMap = {} }) {
  const trackRef = useRef(null);

  const scroll = (direction) => {
    if (trackRef.current) {
      const scrollAmount = direction === 'left' ? -380 : 380;
      trackRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (!collection || !collection.books || collection.books.length === 0) return null;

  return (
    <section className="carousel-section">
      <div className="carousel-header">
        <div className="carousel-title-group">
          <h2>{collection.title}</h2>
          {collection.description && <p>{collection.description}</p>}
        </div>

        <div className="carousel-controls">
          <button 
            className="carousel-arrow-btn" 
            onClick={() => scroll('left')}
            aria-label="Rolar para esquerda"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            className="carousel-arrow-btn" 
            onClick={() => scroll('right')}
            aria-label="Rolar para direita"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="carousel-track" ref={trackRef}>
        {collection.books.map((book) => {
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
    </section>
  );
}
