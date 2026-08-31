import React, { useEffect, useRef, useState, useCallback } from 'react';
import ePub from 'epubjs';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  List, 
  Settings2, 
  Download, 
  Bookmark, 
  Loader2, 
  Sun, 
  Moon, 
  Type, 
  Maximize, 
  Minimize,
  AlertCircle,
  BookOpen,
  ScrollText,
  FileText,
  Search,
  Share2,
  Sliders,
  MoreHorizontal
} from 'lucide-react';
import { 
  getBookBinary, 
  saveBookToLibrary, 
  saveReadingProgress, 
  getReadingProgress, 
  getReaderSettings, 
  saveReaderSettings, 
  exportBookEpub 
} from '../services/db';
import { fetchBookEpubBinary } from '../services/api';

export const THEMES = {
  light: {
    id: 'light',
    name: 'Papel Claro',
    body: { background: '#fdfbf7', color: '#1c1917' },
    ui: { bg: '#f4f0ea', cardBg: '#ffffff', text: '#09090b', border: '#e5dec9', muted: '#71717a' },
    accent: '#0284c7'
  },
  sepia: {
    id: 'sepia',
    name: 'Sépia Suave',
    body: { background: '#f5ecd7', color: '#382a1d' },
    ui: { bg: '#e8dbbe', cardBg: '#faf4e6', text: '#2d1f12', border: '#d9c9a3', muted: '#78644e' },
    accent: '#b45309'
  },
  dark: {
    id: 'dark',
    name: 'Grafite Noturno',
    body: { background: '#18181b', color: '#e4e4e7' },
    ui: { bg: '#202024', cardBg: '#27272a', text: '#f4f4f5', border: '#3f3f46', muted: '#a1a1aa' },
    accent: '#10b981'
  },
  oled: {
    id: 'oled',
    name: 'OLED Puro',
    body: { background: '#000000', color: '#d4d4d8' },
    ui: { bg: '#09090b', cardBg: '#121215', text: '#f4f4f5', border: '#27272a', muted: '#71717a' },
    accent: '#10b981'
  }
};

const AVAILABLE_FONTS = [
  { id: 'Literata', name: 'Literata' },
  { id: 'Merriweather', name: 'Merriweather' },
  { id: 'Lora', name: 'Lora' },
  { id: 'Inter', name: 'Inter' },
  { id: 'Georgia', name: 'Georgia' },
  { id: 'Cinzel', name: 'Cinzel' }
];

function generateReaderCss(settings) {
  const theme = THEMES[settings.theme] || THEMES.dark;
  const isScrolled = settings.readingMode === 'scrolled';
  const fontFallback = settings.fontFamily === 'Inter' ? 'sans-serif' : 'serif';
  const fontSize = Number(settings.fontSize) || 18;
  const lineHeight = Number(settings.lineHeight) || 1.65;

  return `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Inter:wght@300;400;500;600;700&family=Literata:ital,opsz,wght@0,7..72,300..800;1,7..72,300..800&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&display=swap');

    html {
      background-color: ${theme.body.background} !important;
      color: ${theme.body.color} !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    body {
      background-color: ${theme.body.background} !important;
      color: ${theme.body.color} !important;
      font-family: "${settings.fontFamily}", ${fontFallback} !important;
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
      -webkit-font-smoothing: antialiased !important;
      -moz-osx-font-smoothing: grayscale !important;
      text-rendering: optimizeLegibility !important;
      margin: 0 !important;
      padding: ${isScrolled ? '36px 24px 120px 24px' : '0 24px'} !important;
    }

    p, div, span, li, blockquote, em, strong, b, i, small, pre, code {
      color: inherit !important;
      font-family: "${settings.fontFamily}", ${fontFallback} !important;
      background-color: transparent !important;
    }

    p, li, blockquote {
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
      margin-top: 0.6em !important;
      margin-bottom: 0.6em !important;
      text-align: justify !important;
      text-justify: inter-word !important;
      hyphens: auto !important;
    }

    h1, h2, h3, h4, h5, h6 {
      color: inherit !important;
      font-family: "${settings.fontFamily}", ${fontFallback} !important;
      font-weight: 700 !important;
      text-align: left !important;
    }

    h1 { font-size: ${Math.round(fontSize * 1.55)}px !important; margin: 1.3em 0 0.6em 0 !important; line-height: 1.25 !important; }
    h2 { font-size: ${Math.round(fontSize * 1.35)}px !important; margin: 1.1em 0 0.5em 0 !important; line-height: 1.3 !important; }
    h3 { font-size: ${Math.round(fontSize * 1.18)}px !important; margin: 1em 0 0.4em 0 !important; }

    img, svg, image {
      max-width: 100% !important;
      height: auto !important;
      object-fit: contain !important;
      display: block !important;
      margin: 1.2em auto !important;
    }

    a, a:link, a:visited {
      color: ${theme.accent || '#10b981'} !important;
      text-decoration: none !important;
    }

    a:hover {
      text-decoration: underline !important;
    }

    table {
      max-width: 100% !important;
      border-collapse: collapse !important;
    }

    .advertisement, .watermark, script {
      display: none !important;
    }
  `;
}

export function ReaderModal({ book, onClose, onProgressUpdate }) {
  const viewerRef = useRef(null);
  const bookInstanceRef = useRef(null);
  const renditionRef = useRef(null);
  const currentCfiRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Conectando aos servidores...');
  const [downloadProgress, setDownloadProgress] = useState(12);
  const [downloadDetail, setDownloadDetail] = useState('Localizando espelhos de alta velocidade');
  const [error, setError] = useState(null);

  const [currentChapter, setCurrentChapter] = useState('');
  const [progress, setProgress] = useState(0);
  const [toc, setToc] = useState([]);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAppleMenu, setShowAppleMenu] = useState(false);
  const [isHudVisible, setIsHudVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [currentPageInfo, setCurrentPageInfo] = useState('');

  // Reader Settings State
  const [settings, setSettings] = useState({
    theme: 'dark',
    fontFamily: 'Literata',
    fontSize: 18,
    lineHeight: 1.65,
    readingMode: 'paginated', // 'paginated' | 'scrolled'
    pageSpread: 'single'      // 'single' | 'double'
  });

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Load saved settings
  useEffect(() => {
    getReaderSettings().then(saved => {
      if (saved) {
        setSettings(prev => ({ ...prev, ...saved }));
      }
    });
  }, []);

  // Injects/Updates dynamic CSS into all active iframes safely
  const applyStylesToRendition = useCallback((targetSettings) => {
    const theme = THEMES[targetSettings.theme] || THEMES.dark;
    const css = generateReaderCss(targetSettings);

    try {
      if (viewerRef.current) {
        const iframes = viewerRef.current.querySelectorAll('iframe');
        iframes.forEach(iframe => {
          try {
            const doc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document);
            if (doc) {
              let styleTag = doc.getElementById('luca-reader-dynamic-styles');
              if (!styleTag) {
                styleTag = doc.createElement('style');
                styleTag.id = 'luca-reader-dynamic-styles';
                doc.head.appendChild(styleTag);
              }
              styleTag.textContent = css;

              if (doc.documentElement) {
                doc.documentElement.style.backgroundColor = theme.body.background;
                doc.documentElement.style.color = theme.body.color;
              }
              if (doc.body) {
                doc.body.style.backgroundColor = theme.body.background;
                doc.body.style.color = theme.body.color;
              }
            }
          } catch (e) {}
        });
      }

      if (renditionRef.current && renditionRef.current.themes) {
        renditionRef.current.themes.override('font-size', `${targetSettings.fontSize}px`, true);
        renditionRef.current.themes.override('font-family', targetSettings.fontFamily, true);
        renditionRef.current.themes.select(targetSettings.theme);
      }
    } catch (err) {
      console.warn('[Reader] Style update notice:', err);
    }
  }, []);

  // Update Settings with instant live reactivity
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => {
      const updated = { ...prev, [key]: value };
      saveReaderSettings(updated);
      
      if (key === 'theme' || key === 'fontFamily' || key === 'fontSize' || key === 'lineHeight') {
        setTimeout(() => applyStylesToRendition(updated), 10);
      }
      return updated;
    });
  }, [applyStylesToRendition]);

  // Fast Navigation Actions
  const handleNextPage = useCallback(() => {
    if (loading || error || !renditionRef.current) return;
    if (settings.readingMode === 'paginated') {
      renditionRef.current.next();
    }
  }, [loading, error, settings.readingMode]);

  const handlePrevPage = useCallback(() => {
    if (loading || error || !renditionRef.current) return;
    if (settings.readingMode === 'paginated') {
      renditionRef.current.prev();
    }
  }, [loading, error, settings.readingMode]);

  // Handle clicking inside the reader or iframe
  const handleReaderInteraction = useCallback((clickX, width) => {
    if (settingsRef.current.readingMode === 'paginated') {
      if (clickX < width * 0.22) {
        handlePrevPage();
      } else if (clickX > width * 0.78) {
        handleNextPage();
      } else {
        setIsHudVisible(prev => !prev);
        setShowAppleMenu(false);
        setShowSettings(false);
      }
    } else {
      setIsHudVisible(prev => !prev);
      setShowAppleMenu(false);
      setShowSettings(false);
    }
  }, [handlePrevPage, handleNextPage]);

  // Main Initialize ePub Reader effect
  useEffect(() => {
    let isMounted = true;

    async function initReader() {
      if (!book) return;
      setLoading(true);
      setError(null);
      setDownloadProgress(10);

      try {
        setLoadingStatus('Verificando armazenamento...');
        setDownloadDetail('Consultando cache offline');
        let epubBuffer = await getBookBinary(book.id);

        if (!epubBuffer) {
          setLoadingStatus('Baixando do Anna\'s Archive...');
          setDownloadProgress(25);

          epubBuffer = await fetchBookEpubBinary(
            book.downloadUrl, 
            book.id,
            book.title,
            (pct, received, total, customText) => {
              if (!isMounted) return;
              if (pct !== null) {
                const scaled = Math.min(85, Math.max(25, 25 + Math.round((pct * 0.6))));
                setDownloadProgress(scaled);
                const mb = (received / (1024 * 1024)).toFixed(1);
                const totalMb = total ? (total / (1024 * 1024)).toFixed(1) : '?';
                setDownloadDetail(`${mb} MB de ${totalMb} MB (${pct}%)`);
              } else if (customText) {
                setDownloadDetail(customText);
              }
            }
          );
          
          if (!isMounted) return;
          await saveBookToLibrary(book, epubBuffer);
        }

        if (!isMounted) return;
        setDownloadProgress(90);
        setLoadingStatus('Diagramando livro...');
        setDownloadDetail('Renderizando tipografia e layout');

        // Clean container DOM and previous instances
        if (renditionRef.current) {
          try { renditionRef.current.destroy(); } catch (e) {}
        }
        if (bookInstanceRef.current) {
          try { bookInstanceRef.current.destroy(); } catch (e) {}
        }
        if (viewerRef.current) {
          viewerRef.current.innerHTML = '';
        }

        const bookInstance = ePub(epubBuffer);
        bookInstanceRef.current = bookInstance;

        bookInstance.loaded.navigation.then(nav => {
          if (nav && nav.toc && isMounted) {
            setToc(nav.toc);
          }
        }).catch(() => {});

        // Safely generate locations in background
        bookInstance.ready.then(() => {
          if (bookInstance.spine && bookInstance.spine.length) {
            return bookInstance.locations.generate(1000).catch(() => {});
          }
        }).catch(() => {});

        const isScrolled = settings.readingMode === 'scrolled';
        const isDoublePage = !isScrolled && settings.pageSpread === 'double';

        const renditionOptions = {
          width: '100%',
          height: '100%',
          spread: isDoublePage ? 'always' : 'never',
          flow: isScrolled ? 'scrolled-doc' : 'paginated',
          allowScriptedContent: true
        };

        const rendition = bookInstance.renderTo(viewerRef.current, renditionOptions);
        renditionRef.current = rendition;

        // Hook content styling when any chapter loads
        rendition.hooks.content.register((contents) => {
          if (!contents) return;
          try {
            const doc = contents.document || (contents.window && contents.window.document);
            if (doc) {
              doc.querySelectorAll('script').forEach(s => s.remove());

              const css = generateReaderCss(settingsRef.current);
              let styleTag = doc.getElementById('luca-reader-dynamic-styles');
              if (!styleTag) {
                styleTag = doc.createElement('style');
                styleTag.id = 'luca-reader-dynamic-styles';
                doc.head.appendChild(styleTag);
              }
              styleTag.textContent = css;

              doc.addEventListener('click', (e) => {
                const clickX = e.clientX;
                const width = window.innerWidth;
                handleReaderInteraction(clickX, width);
              });
            }
          } catch (e) {
            console.warn('[Reader] Content hook error:', e);
          }
        });

        // Register themes
        Object.keys(THEMES).forEach(themeKey => {
          rendition.themes.register(themeKey, {
            body: THEMES[themeKey].body,
            'p, h1, h2, h3, h4, h5, h6, span, div': {
              'color': 'inherit !important'
            }
          });
        });

        rendition.themes.select(settings.theme);

        // Display saved position
        const savedProgress = await getReadingProgress(book.id);
        const targetCfi = currentCfiRef.current || (savedProgress && savedProgress.cfi);
        
        try {
          if (targetCfi) {
            await rendition.display(targetCfi);
          } else {
            await rendition.display();
          }
        } catch (dispErr) {
          try {
            await rendition.display();
          } catch (retryErr) {
            console.warn('Initial render fallback notice:', retryErr);
          }
        }

        if (!isMounted) return;
        setLoading(false);

        // Apply final styling pass
        applyStylesToRendition(settingsRef.current);

        // Location & progress tracking
        rendition.on('relocated', (location) => {
          if (!location || !location.start) return;
          const currentCfi = location.start.cfi;
          currentCfiRef.current = currentCfi;
          
          let percent = 0;
          let pageNum = null;
          let totalPages = null;

          try {
            if (bookInstance.locations && bookInstance.locations.length && bookInstance.locations.length() > 0) {
              percent = bookInstance.locations.percentageFromCfi(currentCfi) || 0;
              pageNum = bookInstance.locations.locationFromCfi(currentCfi);
              totalPages = bookInstance.locations.total;
            } else if (location.start.percentage) {
              percent = location.start.percentage;
            }
          } catch (locErr) {}

          setProgress(percent);
          if (pageNum && totalPages) {
            setCurrentPageInfo(`${pageNum} de ${totalPages}`);
          }
          
          if (location.start.href) {
            const item = toc.find(t => t.href.includes(location.start.href) || location.start.href.includes(t.href));
            if (item) setCurrentChapter(item.label?.trim() || '');
          }

          saveReadingProgress(book.id, {
            cfi: currentCfi,
            progress: percent,
            chapter: currentChapter
          });

          if (onProgressUpdate) {
            onProgressUpdate(book.id, percent);
          }
        });

      } catch (err) {
        console.error('Error loading EPUB in reader:', err);
        if (isMounted) {
          setError(`Não foi possível abrir o livro: ${err.message || 'Formato incompatível ou falha na conexão'}.`);
          setLoading(false);
        }
      }
    }

    initReader();

    return () => {
      isMounted = false;
      if (renditionRef.current) {
        try { renditionRef.current.destroy(); } catch (e) {}
      }
      if (bookInstanceRef.current) {
        try { bookInstanceRef.current.destroy(); } catch (e) {}
      }
    };
  }, [book, settings.readingMode, settings.pageSpread, applyStylesToRendition, handleReaderInteraction]);

  // Screen click handler on outer area
  const handleViewportAreaClick = (e) => {
    if (e.target.closest('button') || e.target.closest('.apple-books-floating-menu') || e.target.closest('.apple-settings-popover') || e.target.closest('.apple-toc-modal-drawer')) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    handleReaderInteraction(clickX, rect.width);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (settings.readingMode === 'paginated') {
        if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
          e.preventDefault();
          handleNextPage();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          e.preventDefault();
          handlePrevPage();
        }
      }
      if (e.key === 'Escape') {
        if (showToc) setShowToc(false);
        else if (showSettings) setShowSettings(false);
        else if (showAppleMenu) setShowAppleMenu(false);
        else onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showToc, showSettings, showAppleMenu, settings.readingMode, onClose, handleNextPage, handlePrevPage]);

  const currentThemeUI = THEMES[settings.theme]?.ui || THEMES.dark.ui;
  const currentThemeBody = THEMES[settings.theme]?.body || THEMES.dark.body;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const formattedPct = Math.round(progress * 100);

  return (
    <div 
      className={`reader-modal-overlay apple-books-theme-${settings.theme} ${isHudVisible ? 'hud-visible' : 'hud-hidden'}`}
      style={{
        '--reader-bg': currentThemeBody.background,
        '--reader-text': currentThemeBody.color,
        '--reader-card-bg': currentThemeUI.cardBg,
        '--reader-border': currentThemeUI.border,
        '--reader-muted': currentThemeUI.muted,
        backgroundColor: currentThemeBody.background,
        color: currentThemeBody.color
      }}
    >
      {/* 1. Apple Books Minimalist Topbar */}
      <header className={`apple-books-topbar ${isHudVisible ? 'visible' : 'hidden'}`}>
        <div className="apple-topbar-left">
          <button 
            id="reader-btn-back"
            className="apple-icon-btn" 
            onClick={onClose}
            title="Voltar para a biblioteca"
          >
            <ChevronLeft size={22} />
            <span className="apple-btn-label">Biblioteca</span>
          </button>
        </div>

        <div className="apple-topbar-center">
          <span className="apple-chapter-badge">
            {currentChapter || book?.title || 'Capítulo'}
          </span>
          <span className="apple-progress-subtext">
            {formattedPct}% lido • {settings.readingMode === 'paginated' ? (currentPageInfo || 'Páginas') : 'Scroll Contínuo'}
          </span>
        </div>

        <div className="apple-topbar-right">
          <button 
            className="apple-icon-btn"
            onClick={() => setIsBookmarked(!isBookmarked)}
            title={isBookmarked ? 'Página Marcada' : 'Marcar Página'}
          >
            <Bookmark size={18} fill={isBookmarked ? 'var(--accent-primary-light)' : 'none'} color={isBookmarked ? 'var(--accent-primary-light)' : 'inherit'} />
          </button>
        </div>
      </header>

      {/* 2. Main Reader Viewport with Touch & Scroll Areas */}
      <main 
        className={`reader-viewer-area mode-${settings.readingMode}`}
        onClick={handleViewportAreaClick}
        style={{ backgroundColor: currentThemeBody.background }}
      >
        {/* Navigation Arrows for Desktop (Paginated Mode) */}
        {settings.readingMode === 'paginated' && (
          <>
            <button 
              id="reader-prev-arrow"
              className="apple-nav-arrow apple-nav-prev desktop-only"
              onClick={(e) => { e.stopPropagation(); handlePrevPage(); }}
              title="Página Anterior (Seta Esquerda)"
              style={{ display: loading || error ? 'none' : 'flex' }}
            >
              <ChevronLeft size={24} />
            </button>

            <button 
              id="reader-next-arrow"
              className="apple-nav-arrow apple-nav-next desktop-only"
              onClick={(e) => { e.stopPropagation(); handleNextPage(); }}
              title="Próxima Página (Seta Direita / Espaço)"
              style={{ display: loading || error ? 'none' : 'flex' }}
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* EPUB Viewport Container */}
        <div 
          className={`apple-books-content-frame ${settings.readingMode === 'paginated' && settings.pageSpread === 'double' ? 'is-double-spread' : 'is-single-spread'}`}
          style={{ backgroundColor: currentThemeBody.background }}
        >
          {settings.readingMode === 'paginated' && settings.pageSpread === 'double' && (
            <div className="book-spine-crease" />
          )}
          <div 
            ref={viewerRef} 
            className="epub-viewport"
            id="epub-reader-container"
            style={{ backgroundColor: currentThemeBody.background }}
          />
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="apple-loading-overlay" style={{ backgroundColor: currentThemeBody.background }}>
            <div className="reader-loading-card">
              <div className="loading-cover-glow-container animate-float animate-glow">
                {book?.cover ? (
                  <img src={book.cover} alt={book.title} className="loading-cover-img" />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-primary-light)'
                  }}>
                    <BookOpen size={36} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                  {book?.title}
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  {book?.author || "Anna's Archive"}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <Loader2 size={20} className="animate-spin" color="var(--accent-primary)" />
                <span style={{ color: 'var(--text-main)', fontSize: '0.88rem', fontWeight: 500 }}>
                  {loadingStatus}
                </span>
              </div>

              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  <span>{downloadDetail || 'Sincronizando livro...'}</span>
                  <span style={{ color: 'var(--accent-primary-light)', fontWeight: 600 }}>
                    {downloadProgress}%
                  </span>
                </div>

                <div className="loading-stepped-bar-bg">
                  <div 
                    className="loading-stepped-bar-fill" 
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Fallback */}
        {error && (
          <div className="apple-error-overlay" style={{ backgroundColor: currentThemeBody.background }}>
            <div className="apple-error-card">
              <div className="apple-error-icon">
                <AlertCircle size={32} />
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Erro ao carregar livro</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {error}
              </p>
              <button 
                className="btn-primary" 
                onClick={onClose}
                style={{ marginTop: '8px' }}
              >
                Voltar ao Início
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. Apple Books Minimalist Bottom Page Counter */}
      <footer className={`apple-books-footer ${isHudVisible ? 'visible' : 'hidden'}`}>
        <span className="apple-page-counter-text">
          {currentPageInfo ? `${currentPageInfo} (${formattedPct}%)` : `${formattedPct}% lido`}
        </span>
      </footer>

      {/* 4. The Iconic Apple Books Floating Bottom-Right Pill Menu */}
      <div className={`apple-floating-container ${isHudVisible ? 'visible' : 'hidden'}`}>
        {/* Floating Pill Trigger Button */}
        <button
          className={`apple-pill-trigger-btn ${showAppleMenu ? 'active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowAppleMenu(!showAppleMenu);
            setShowSettings(false);
          }}
          title="Menu de Leitura"
        >
          <div className="apple-pill-progress-fill" style={{ width: `${formattedPct}%` }} />
          <span className="apple-pill-label">
            {showAppleMenu ? <X size={16} /> : <MoreHorizontal size={18} />}
          </span>
        </button>

        {/* Apple Books Expanded Floating Card Popover */}
        {showAppleMenu && (
          <div 
            className="apple-books-floating-menu"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Row 1: Contents / Sumário with Progress Bar */}
            <button 
              className="apple-menu-row-item"
              onClick={() => {
                setShowToc(true);
                setShowAppleMenu(false);
              }}
            >
              <div className="apple-row-left">
                <div className="apple-progress-strip-bg">
                  <div className="apple-progress-strip-fill" style={{ width: `${formattedPct}%` }} />
                </div>
                <span>Sumário • {formattedPct}%</span>
              </div>
              <List size={18} />
            </button>

            {/* Row 2: Reading Mode (Páginas vs Scroll Contínuo) */}
            <button 
              className="apple-menu-row-item"
              onClick={() => {
                updateSetting('readingMode', settings.readingMode === 'paginated' ? 'scrolled' : 'paginated');
              }}
            >
              <div className="apple-row-left">
                <span>Modo: {settings.readingMode === 'paginated' ? 'Passar Páginas' : 'Scroll Contínuo'}</span>
              </div>
              {settings.readingMode === 'paginated' ? <FileText size={18} /> : <ScrollText size={18} color="var(--accent-primary-light)" />}
            </button>

            {/* Row 3: Page Spread (1 Página vs 2 Páginas Lado a Lado) */}
            {settings.readingMode === 'paginated' && (
              <button 
                className="apple-menu-row-item"
                onClick={() => {
                  updateSetting('pageSpread', settings.pageSpread === 'single' ? 'double' : 'single');
                }}
              >
                <div className="apple-row-left">
                  <span>Layout: {settings.pageSpread === 'double' ? '2 Páginas (Aberto)' : '1 Página (Central)'}</span>
                </div>
                <span style={{ fontSize: '0.88rem' }}>{settings.pageSpread === 'double' ? '📖' : '📄'}</span>
              </button>
            )}

            {/* Row 4: Themes & Settings (AA) */}
            <button 
              className="apple-menu-row-item"
              onClick={() => {
                setShowSettings(!showSettings);
                setShowAppleMenu(false);
              }}
            >
              <div className="apple-row-left">
                <span>Aparência & Fontes</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: '0.92rem', fontFamily: 'serif' }}>AA</span>
            </button>

            {/* Row 5: Quick Action Icons Bar */}
            <div className="apple-menu-bottom-row">
              <button 
                className="apple-bottom-action-btn"
                onClick={() => exportBookEpub(book.id, book.title)}
                title="Baixar arquivo EPUB"
              >
                <Download size={18} />
              </button>

              <button 
                className="apple-bottom-action-btn"
                onClick={toggleFullscreen}
                title="Tela Cheia"
              >
                {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </button>

              <button 
                className={`apple-bottom-action-btn ${isBookmarked ? 'active' : ''}`}
                onClick={() => setIsBookmarked(!isBookmarked)}
                title="Marcar Página"
              >
                <Bookmark size={18} fill={isBookmarked ? 'currentColor' : 'none'} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. Themes, Typography & Appearance Popover */}
      {showSettings && (
        <div 
          className="apple-settings-popover"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="apple-settings-header">
            <h4 style={{ fontSize: '0.92rem', fontWeight: 700 }}>Aparência & Tipografia</h4>
            <button 
              onClick={() => setShowSettings(false)}
              className="apple-close-mini-btn"
            >
              <X size={15} />
            </button>
          </div>

          {/* Theme Selection Palette (4 Themes) */}
          <div className="apple-settings-section">
            <span className="apple-section-label">Cor da Página</span>
            <div className="apple-theme-palette-grid">
              {Object.keys(THEMES).map(tKey => (
                <button
                  key={tKey}
                  className={`apple-theme-circle-btn apple-circle-${tKey} ${settings.theme === tKey ? 'active' : ''}`}
                  onClick={() => updateSetting('theme', tKey)}
                  title={THEMES[tKey].name}
                >
                  <span className="apple-theme-name-tag">{THEMES[tKey].name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reading Mode Selector */}
          <div className="apple-settings-section">
            <span className="apple-section-label">Modo de Leitura</span>
            <div className="font-options-grid">
              <button
                className={`font-option-btn ${settings.readingMode === 'paginated' ? 'active' : ''}`}
                onClick={() => updateSetting('readingMode', 'paginated')}
              >
                <FileText size={14} style={{ marginRight: '4px' }} />
                Páginas
              </button>
              <button
                className={`font-option-btn ${settings.readingMode === 'scrolled' ? 'active' : ''}`}
                onClick={() => updateSetting('readingMode', 'scrolled')}
              >
                <ScrollText size={14} style={{ marginRight: '4px' }} />
                Scroll Contínuo
              </button>
            </div>
          </div>

          {/* Font Family Selection */}
          <div className="apple-settings-section">
            <span className="apple-section-label">Fonte Tipográfica</span>
            <div className="font-options-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {AVAILABLE_FONTS.map(font => (
                <button
                  key={font.id}
                  className={`font-option-btn ${settings.fontFamily === font.id ? 'active' : ''}`}
                  onClick={() => updateSetting('fontFamily', font.id)}
                  style={{ fontFamily: font.id, fontSize: '0.82rem' }}
                >
                  {font.name}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Sliders & Step Buttons */}
          <div className="apple-settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="apple-section-label">Tamanho do Texto</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent-primary-light)', fontFamily: 'var(--font-mono)' }}>
                {settings.fontSize}px
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
              <button 
                className="chip-btn" 
                onClick={() => updateSetting('fontSize', Math.max(12, settings.fontSize - 2))}
                style={{ width: '42px', height: '34px', fontWeight: 700 }}
                title="Diminuir texto"
              >
                A-
              </button>
              <input 
                type="range" 
                min="12" 
                max="36" 
                step="1"
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
              />
              <button 
                className="chip-btn" 
                onClick={() => updateSetting('fontSize', Math.min(36, settings.fontSize + 2))}
                style={{ width: '42px', height: '34px', fontWeight: 700 }}
                title="Aumentar texto"
              >
                A+
              </button>
            </div>
          </div>

          {/* Line Height Selector */}
          <div className="apple-settings-section">
            <span className="apple-section-label">Espaçamento Entre Linhas</span>
            <div className="font-options-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {[
                { val: 1.4, label: 'Compacto' },
                { val: 1.65, label: 'Padrão' },
                { val: 1.9, label: 'Amplo' }
              ].map(lh => (
                <button
                  key={lh.val}
                  className={`font-option-btn ${settings.lineHeight === lh.val ? 'active' : ''}`}
                  onClick={() => updateSetting('lineHeight', lh.val)}
                >
                  {lh.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. Table of Contents (TOC) Modal / Drawer */}
      {showToc && (
        <aside 
          className="apple-toc-modal-drawer"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="toc-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Sumário do Livro</h3>
            <button 
              onClick={() => setShowToc(false)}
              className="apple-close-mini-btn"
            >
              <X size={18} />
            </button>
          </div>
          <div className="toc-list">
            {toc.length === 0 ? (
              <p style={{ padding: '24px', color: 'var(--reader-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                Nenhum índice detalhado encontrado nesta edição.
              </p>
            ) : (
              toc.map((item, idx) => (
                <div 
                  key={idx}
                  className="toc-item"
                  onClick={() => {
                    renditionRef.current?.display(item.href);
                    setShowToc(false);
                  }}
                >
                  {item.label?.trim()}
                </div>
              ))
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

export default ReaderModal;
