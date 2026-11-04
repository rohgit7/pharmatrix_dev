const http = require('http');

const BACKEND_PORT = 8000;
const PROXY_PORT = 8001;

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const options = {
    hostname: '127.0.0.1',
    port: BACKEND_PORT,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: `127.0.0.1:${BACKEND_PORT}`,
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers };
    headers['access-control-allow-origin'] = '*';
    headers['access-control-allow-headers'] = '*';
    headers['access-control-allow-methods'] = '*';

    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res, { end: true });

    if (proxyRes.statusCode >= 400) {
      console.log(`[Proxy] ${req.method} ${req.url} -> Status ${proxyRes.statusCode}`);
    }
  });

  proxyReq.on('error', (err) => {
    console.error(`[Proxy Error] ${req.method} ${req.url}:`, err.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        detail: `Proxy could not reach backend on port ${BACKEND_PORT}`,
        error: err.message,
      })
    );
  });

  req.setTimeout(120000);
  proxyReq.setTimeout(120000);

  req.pipe(proxyReq, { end: true });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[Pharmatrix Proxy] Listening on http://0.0.0.0:${PROXY_PORT} -> http://127.0.0.1:${BACKEND_PORT}`);
});

