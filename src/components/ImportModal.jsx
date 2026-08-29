import React, { useState } from 'react';
import { UploadCloud, X, FileText, Check, AlertCircle } from 'lucide-react';
import { saveBookToLibrary } from '../services/db';

export function ImportModal({ isOpen, onClose, onImportSuccess }) {
  const [dragOver, setDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file) => {
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.epub')) {
      setErrorMsg('Por favor, selecione um arquivo válido no formato .epub');
      return;
    }

    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const rawTitle = file.name.replace(/\.epub$/i, '').replace(/[_-]/g, ' ');
      
      const newBook = {
        id: `local_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        title: rawTitle,
        author: 'Arquivo Local / Importado',
        cover: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
        genre: 'Importado',
        language: 'pt',
        rating: 5.0,
        badge: 'Arquivo Próprio',
        description: `Livro importado localmente pelo usuário: ${file.name}`
      };

      await saveBookToLibrary(newBook, arrayBuffer);
      setIsProcessing(false);
      onImportSuccess(newBook);
      onClose();
    } catch (err) {
      console.error('Error importing epub:', err);
      setErrorMsg('Erro ao processar o arquivo EPUB. Verifique se o arquivo não está corrompido.');
      setIsProcessing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-emerald-light)'
            }}>
              <UploadCloud size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Importar Livro .EPUB</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Adicione qualquer livro do seu aparelho</p>
            </div>
          </div>

          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Dropzone */}
        <div 
          className={`dropzone ${dragOver ? 'active' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('epub-file-input').click()}
        >
          <input 
            type="file" 
            id="epub-file-input"
            accept=".epub" 
            style={{ display: 'none' }} 
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileProcess(e.target.files[0]);
              }
            }}
          />
          <FileText size={40} color="var(--accent-emerald)" />
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>
              Arraste seu arquivo .EPUB aqui
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              ou clique para selecionar no computador ou celular
            </p>
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            color: 'var(--accent-rose)',
            fontSize: '0.85rem'
          }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Footer Note */}
        <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', lineHeight: '1.4' }}>
          💡 <strong>Privacidade Total:</strong> O livro é processado e salvo exclusivamente no armazenamento do seu navegador (IndexedDB). Nenhum dado pessoal é enviado para servidores de terceiros.
        </p>
      </div>
    </div>
  );
}
