import React, { useEffect, useRef, useState } from 'react';
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

const THEMES = {
  light: {
    name: 'Papel Claro',
    body: { background: '#fbfbfe', color: '#1a1a1e' },
    ui: { bg: '#f4f4f7', cardBg: '#ffffff', text: '#09090b', border: '#e2e2e7', muted: '#64748b' }
  },
  sepia: {
    name: 'Sépia Suave',
    body: { background: '#f5ecd7', color: '#3c2e1f' },
    ui: { bg: '#ebdcc0', cardBg: '#f8efe0', text: '#3c2e1f', border: '#dfceac', muted: '#7d6951' }
  },
  dark: {
    name: 'Grafite Escuro',
    body: { background: '#121215', color: '#e4e4e7' },
    ui: { bg: '#18181c', cardBg: '#222228', text: '#f8fafc', border: '#2e2e36', muted: '#a1a1aa' }
  },
  oled: {
    name: 'OLED Puro',
    body: { background: '#000000', color: '#d4d4d8' },
    ui: { bg: '#09090b', cardBg: '#141416', text: '#f8fafc', border: '#202024', muted: '#71717a' }
  }
};

export function ReaderModal({ book, onClose, onProgressUpdate }) {
  const viewerRef = useRef(null);
  const bookInstanceRef = useRef(null);
  const renditionRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [loadingStatus, setLoadingStatus] = useState('Conectando aos servidores...');
  const [downloadProgress, setDownloadProgress] = useState(12);
  const [downloadDetail, setDownloadDetail] = useState('Localizando espelhos de alta velocidade');
  const [loadingStep, setLoadingStep] = useState(1);
  const [error, setError] = useState(null);

  const [currentChapter, setCurrentChapter] = useState('');
  const [progress, setProgress] = useState(0);
  const [toc, setToc] = useState([]);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAppleMenu, setShowAppleMenu] = useState(false); // Floating Apple Books pill menu
  const [isHudVisible, setIsHudVisible] = useState(true); // Toggle topbar/footer on screen tap
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [currentPageInfo, setCurrentPageInfo] = useState('');

  // Reader Settings: 2 Simple Modes + Dual-Page Spread option
  const [settings, setSettings] = useState({
    theme: 'dark',
    fontFamily: 'Literata',
    fontSize: 18,
    lineHeight: 1.6,
    readingMode: 'paginated', // 'paginated' (Passar página) | 'scrolled' (Scroll contínuo)
    pageSpread: 'single'      // 'single' (1 Página centralizada) | 'double' (2 Páginas lado a lado)
  });

  // Load user reader settings
  useEffect(() => {
    getReaderSettings().then(saved => {
      if (saved) setSettings(prev => ({ ...prev, ...saved }));
    });
  }, []);

  // Initialize or Re-initialize EPUB reader
  useEffect(() => {
    let isMounted = true;

    async function initReader() {
      if (!book) return;
      setLoading(true);
      setError(null);
      setDownloadProgress(10);
      setLoadingStep(1);

      try {
        // 1. Check if EPUB binary is in local IndexedDB
        setLoadingStatus('Verificando cache no dispositivo...');
        setDownloadDetail('Consultando armazenamento local');
        let epubBuffer = await getBookBinary(book.id);

        // 2. Fetch via stream proxy with resilient auto-recovery if needed
        if (!epubBuffer) {
          setLoadingStep(2);
          setLoadingStatus('Baixando livro...');
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
        setLoadingStep(3);
        setDownloadProgress(90);
        setLoadingStatus('Formatando diagramação...');
        setDownloadDetail('Renderizando tipografia e layout');

        // 3. Clean up previous instances
        if (renditionRef.current) {
          try { renditionRef.current.destroy(); } catch (e) {}
        }
        if (bookInstanceRef.current) {
          try { bookInstanceRef.current.destroy(); } catch (e) {}
        }

        // 4. Initialize ePub.js
        const bookInstance = ePub(epubBuffer);
        bookInstanceRef.current = bookInstance;

        bookInstance.loaded.navigation.then(nav => {
          if (nav && nav.toc) {
            setToc(nav.toc);
          }
        });

        bookInstance.ready.then(() => {
          return bookInstance.locations.generate(1000);
        }).then(() => {
          console.log('[Reader] Locations generated');
        }).catch(e => console.log('Location note:', e));

        // Render with selected flow ('paginated' or 'scrolled-doc') and spread ('always' or 'never')
        const isScrolled = settings.readingMode === 'scrolled';
        const isDoublePage = !isScrolled && settings.pageSpread === 'double';

        const rendition = bookInstance.renderTo(viewerRef.current, {
          width: '100%',
          height: '100%',
          spread: isDoublePage ? 'always' : 'never',
          flow: isScrolled ? 'scrolled-doc' : 'paginated',
          allowScriptedContent: true
        });
        renditionRef.current = rendition;

        // Strip obsolete scripts from EPUB chapters to prevent console errors
        rendition.hooks.content.register((contents) => {
          try {
            const doc = contents.document;
            if (doc) {
              const scripts = doc.querySelectorAll('script');
              scripts.forEach(s => s.remove());
            }
          } catch (e) {}
        });

        // Apply Apple Books Themes
        Object.keys(THEMES).forEach(themeKey => {
          rendition.themes.register(themeKey, {
            body: {
              ...THEMES[themeKey].body,
              'font-family': `${settings.fontFamily}, serif !important`,
              'font-size': `${settings.fontSize}px !important`,
              'line-height': `${settings.lineHeight} !important`,
              'padding': isScrolled ? '24px 20px !important' : '0 24px !important'
            },
            'p, h1, h2, h3, h4, h5, h6, span, div': {
              'font-family': `${settings.fontFamily}, serif !important`,
              'color': 'inherit !important'
            }
          });
        });

        rendition.themes.select(settings.theme);

        // 5. Restore saved position (CFI)
        const savedProgress = await getReadingProgress(book.id);
        try {
          if (savedProgress && savedProgress.cfi) {
            await rendition.display(savedProgress.cfi);
          } else {
            await rendition.display();
          }
        } catch (dispErr) {
          await rendition.display();
        }

        if (!isMounted) return;
        setLoading(false);

        // 6. Hook progress tracking
        rendition.on('relocated', (location) => {
          if (!location || !location.start) return;
          const currentCfi = location.start.cfi;
          
          let percent = 0;
          let pageNum = null;
          let totalPages = null;

          if (bookInstance.locations && bookInstance.locations.length() > 0) {
            percent = bookInstance.locations.percentageFromCfi(currentCfi) || 0;
            pageNum = bookInstance.locations.locationFromCfi(currentCfi);
            totalPages = bookInstance.locations.total;
          } else if (location.start.percentage) {
            percent = location.start.percentage;
          }

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
  }, [book, settings.readingMode, settings.pageSpread]);

  // Fast Navigation Actions
  const handleNextPage = () => {
    if (loading || error || !renditionRef.current) return;
    renditionRef.current.next();
  };

  const handlePrevPage = () => {
    if (loading || error || !renditionRef.current) return;
    renditionRef.current.prev();
  };

  // Screen click handler (Center taps toggle HUD, sides turn pages in paginated mode)
  const handleViewportAreaClick = (e) => {
    // If clicking on a button or menu, do nothing
    if (e.target.closest('button') || e.target.closest('.apple-books-floating-menu') || e.target.closest('.reader-settings-panel') || e.target.closest('.reader-toc-drawer')) {
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;

    if (settings.readingMode === 'paginated') {
      if (clickX < width * 0.22) {
        // Left zone: Previous page
        handlePrevPage();
      } else if (clickX > width * 0.78) {
        // Right zone: Next page
        handleNextPage();
      } else {
        // Center zone: Toggle HUD visibility & close floating popovers
        setIsHudVisible(!isHudVisible);
        setShowAppleMenu(false);
        setShowSettings(false);
      }
    } else {
      // In scrolled mode: Center tap toggles HUD
      setIsHudVisible(!isHudVisible);
      setShowAppleMenu(false);
      setShowSettings(false);
    }
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
  }, [showToc, showSettings, showAppleMenu, settings.readingMode, onClose]);

  // Update Settings
  const updateSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveReaderSettings(newSettings);

    if (renditionRef.current) {
      if (key === 'theme') {
        renditionRef.current.themes.select(value);
      } else if (key === 'fontSize') {
        renditionRef.current.themes.fontSize(`${value}px`);
      } else if (key === 'fontFamily') {
        renditionRef.current.themes.font(value);
      }
    }
  };

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
        '--reader-muted': currentThemeUI.muted
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
            {formattedPct}% lido • {settings.readingMode === 'paginated' ? (currentPageInfo || 'Páginas') : 'Rolagem'}
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

      {/* 2. Main Reader Viewport with Touch Zones */}
      <main 
        className={`reader-viewer-area mode-${settings.readingMode}`}
        onClick={handleViewportAreaClick}
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
        <div className={`apple-books-content-frame ${settings.readingMode === 'paginated' && settings.pageSpread === 'double' ? 'is-double-spread' : 'is-single-spread'}`}>
          {settings.readingMode === 'paginated' && settings.pageSpread === 'double' && (
            <div className="book-spine-crease" />
          )}
          <div 
            ref={viewerRef} 
            className="epub-viewport"
            id="epub-reader-container"
          />
        </div>

        {/* Loading Overlay */}
        {loading && (
          <div className="apple-loading-overlay">
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
          <div className="apple-error-overlay">
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
          title="Menu Apple Books"
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

            {/* Row 2: Reading Mode (Páginas vs Scroll) */}
            <button 
              className="apple-menu-row-item"
              onClick={() => {
                updateSetting('readingMode', settings.readingMode === 'paginated' ? 'scrolled' : 'paginated');
              }}
            >
              <div className="apple-row-left">
                <span>Modo: {settings.readingMode === 'paginated' ? 'Passar Páginas' : 'Scroll Contínuo'}</span>
              </div>
              {settings.readingMode === 'paginated' ? <FileText size={18} /> : <ScrollText size={18} />}
            </button>

            {/* Row 3: Page Spread (1 Página vs 2 Páginas Lado a Lado) - active in paginated mode */}
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

      {/* 5. Themes & Typography Drawer / Popover */}
      {showSettings && (
        <div 
          className="apple-settings-popover"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="apple-settings-header">
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Aparência & Leitura</h4>
            <button 
              onClick={() => setShowSettings(false)}
              className="apple-close-mini-btn"
            >
              <X size={15} />
            </button>
          </div>

          {/* Theme Selection Palette */}
          <div className="apple-settings-section">
            <span className="apple-section-label">Tema</span>
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

          {/* Dual Page Spread Selection (Only in Paginated Mode) */}
          {settings.readingMode === 'paginated' && (
            <div className="apple-settings-section">
              <span className="apple-section-label">Distribuição de Páginas</span>
              <div className="font-options-grid">
                <button
                  className={`font-option-btn ${settings.pageSpread === 'single' ? 'active' : ''}`}
                  onClick={() => updateSetting('pageSpread', 'single')}
                >
                  📄 1 Página
                </button>
                <button
                  className={`font-option-btn ${settings.pageSpread === 'double' ? 'active' : ''}`}
                  onClick={() => updateSetting('pageSpread', 'double')}
                >
                  📖 2 Páginas (Aberto)
                </button>
              </div>
            </div>
          )}

          {/* Font Family Selection */}
          <div className="apple-settings-section">
            <span className="apple-section-label">Tipografia</span>
            <div className="font-options-grid">
              {['Literata', 'Merriweather', 'Inter', 'Georgia'].map(font => (
                <button
                  key={font}
                  className={`font-option-btn ${settings.fontFamily === font ? 'active' : ''}`}
                  onClick={() => updateSetting('fontFamily', font)}
                >
                  {font}
                </button>
              ))}
            </div>
          </div>

          {/* Font Size Sliders */}
          <div className="apple-settings-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="apple-section-label">Tamanho do Texto</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--reader-muted)', fontFamily: 'var(--font-mono)' }}>{settings.fontSize}px</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
              <button 
                className="chip-btn" 
                onClick={() => updateSetting('fontSize', Math.max(12, settings.fontSize - 2))}
              >
                A-
              </button>
              <input 
                type="range" 
                min="12" 
                max="32" 
                value={settings.fontSize}
                onChange={(e) => updateSetting('fontSize', Number(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
              />
              <button 
                className="chip-btn" 
                onClick={() => updateSetting('fontSize', Math.min(32, settings.fontSize + 2))}
              >
                A+
              </button>
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
