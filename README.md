# 🎧 Luca-Books (Spotify for Books)

Leitor e buscador universal de livros e audiolivros, com interface moderna inspirada no Spotify e suporte a streaming contínuo de EPUB e PDF.

## 🚀 Arquitetura Multi-Source com Python

- **Frontend**: React + Vite + Lucide Icons + EPUB.js + PDF.js (porta `5173`)
- **Backend Node.js (Express)**: API de orquestração, cache e proxy de stream (porta `3088`)
- **Microserviço Python (FastAPI + `curl_cffi`)**: Busca e resolução resiliente no Anna's Archive / LibGen com bypass de proteções anti-bot (porta `3089`)

## 📦 Como Rodar

1. **Instalar dependências Node & Python**:
```bash
npm install
pip install -r server_py/requirements.txt
```

2. **Iniciar todos os serviços em paralelo**:
```bash
npm run dev
```

Isso inicializará concorrentemente:
- `PY-API`: http://localhost:3089
- `NODE-API`: http://localhost:3088
- `VITE`: http://localhost:5173

