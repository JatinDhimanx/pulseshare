const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    // Filter out virtual/internal adapters (e.g. VirtualBox, VMware, Loopback)
    const lowerName = name.toLowerCase();
    if (lowerName.includes('virtual') || lowerName.includes('vbox') || lowerName.includes('vmware') || lowerName.includes('bluetooth')) {
      continue;
    }
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        // Skip 192.168.56.x (typical VirtualBox Host-Only range)
        if (!net.address.startsWith('192.168.56.')) {
          addresses.push({ name, address: net.address });
        }
      }
    }
  }
  return addresses;
}

const server = http.createServer((req, res) => {
  // Parse URL to handle query parameters
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(ROOT_DIR, safePath);

  // Security check: must stay inside ROOT_DIR
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIps = getLocalIpAddresses();
  console.log('='.repeat(55));
  console.log('  🚀 Zero-DB WebRTC Share Server Started!');
  console.log('='.repeat(55));
  console.log(`  💻 Local:    http://localhost:${PORT}`);
  if (localIps.length > 0) {
    localIps.forEach(item => {
      console.log(`  📱 Network:  http://${item.address}:${PORT}  (${item.name} - Open on phone)`);
    });
  }
  console.log('='.repeat(55));
  console.log('  ℹ️  No database required! Pure browser RAM WebRTC transfer.');
  console.log('='.repeat(55));
});
