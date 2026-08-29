import app from './app.js';

const PORT = process.env.PORT || 3088;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Spotify-Books API Server running at http://localhost:${PORT}`);
});

// Keep event loop active for long-running daemon mode locally
setInterval(() => {}, 1000 * 60 * 60);

export default server;
