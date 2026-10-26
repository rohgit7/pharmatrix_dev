// Pharmatrix Driver - Development Network Relay
// Allows mobile devices on Wi-Fi to reach FastAPI even when Windows Firewall blocks python.exe
const http = require('http');

const PROXY_PORT = 8001;
const TARGET_HOST = '127.0.0.1';
const TARGET_PORT = 8000;

const server = http.createServer((req, res) => {
  const options = {
    hostname: TARGET_HOST,
    port: TARGET_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `${TARGET_HOST}:${TARGET_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ detail: `Gateway error connecting to backend: ${err.message}` }));
  });

  req.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[Pharmatrix Proxy] Relay running on http://0.0.0.0:${PROXY_PORT} -> http://${TARGET_HOST}:${TARGET_PORT}`);
});
