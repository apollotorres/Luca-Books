import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Smartphone, Check } from 'lucide-react';

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / standalone
    const standaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(standaloneMode);
    if (standaloneMode) return;

    // 2. Check if user recently dismissed
    const dismissedAt = localStorage.getItem('luca_pwa_dismissed_at');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 3 * 24 * 60 * 60 * 1000) {
      return;
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|edgios/.test(userAgent);

    if (isIOSDevice && isSafari && !standaloneMode) {
      setIsIOS(true);
      // Show iOS banner after a short delay
      const timer = setTimeout(() => setIsVisible(true), 2500);
      return () => clearTimeout(timer);
    }

    // 4. Listen for Chrome / Android / Desktop beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setTimeout(() => setIsVisible(true), 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 5. Listen for successful install
    const handleAppInstalled = () => {
      setInstalled(true);
      setIsVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setInstalled(true);
      setIsVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setShowIOSGuide(false);
    localStorage.setItem('luca_pwa_dismissed_at', Date.now().toString());
  };

  if (isStandalone || !isVisible) return null;

  return (
    <>
      {/* Floating Main PWA Banner */}
      <div className="pwa-install-floating-banner animate-slide-up">
        <div className="pwa-banner-card">
          <div className="pwa-banner-left">
            <div className="pwa-icon-glow">
              <img 
                src="/icons/icon-192.png" 
                alt="Luca Books Logo" 
                className="pwa-app-icon" 
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            <div className="pwa-banner-text">
              <div className="pwa-badge">APLICATIVO OFFLINE</div>
              <h4 className="pwa-title">Instalar Luca Books</h4>
              <p className="pwa-subtitle">
                Adicione à tela de início para ler offline com velocidade instantânea.
              </p>
            </div>
          </div>

          <div className="pwa-banner-actions">
            <button 
              id="btn-install-pwa"
              className="pwa-install-btn" 
              onClick={handleInstallClick}
            >
              <Download size={16} />
              <span>Instalar App</span>
            </button>

            <button 
              className="pwa-close-btn" 
              onClick={handleDismiss}
              title="Dispensar"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* iOS Step-by-Step Safari Drawer Modal */}
      {showIOSGuide && (
        <div className="pwa-ios-modal-overlay" onClick={handleDismiss}>
          <div className="pwa-ios-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-ios-header">
              <div className="pwa-ios-logo-badge">
                <Smartphone size={22} color="var(--accent-primary-light)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Adicionar à Tela de Início</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Instalação rápida no iOS / Safari</p>
              </div>
              <button className="apple-close-mini-btn" onClick={handleDismiss}>
                <X size={18} />
              </button>
            </div>

            <div className="pwa-ios-steps">
              <div className="pwa-ios-step-item">
                <div className="pwa-step-number">1</div>
                <div className="pwa-step-content">
                  <p>Toque no botão <strong>Compartilhar</strong> na barra inferior do Safari.</p>
                  <div className="pwa-step-icon-badge">
                    <Share size={18} color="#0070f3" />
                  </div>
                </div>
              </div>

              <div className="pwa-ios-step-item">
                <div className="pwa-step-number">2</div>
                <div className="pwa-step-content">
                  <p>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</p>
                  <div className="pwa-step-icon-badge">
                    <PlusSquare size={18} color="#10b981" />
                  </div>
                </div>
              </div>

              <div className="pwa-ios-step-item">
                <div className="pwa-step-number">3</div>
                <div className="pwa-step-content">
                  <p>Toque em <strong>Adicionar</strong> no canto superior direito para concluir.</p>
                  <div className="pwa-step-icon-badge">
                    <Check size={18} color="#10b981" />
                  </div>
                </div>
              </div>
            </div>

            <button className="btn-primary" style={{ width: '100%', marginTop: '12px' }} onClick={handleDismiss}>
              Pronto, Entendi!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default PWAInstallBanner;
