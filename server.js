'use strict';

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { PDFDocument } = require('pdf-lib');
const FormData = require('form-data');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const STORAGE_TO_API = process.env.STORAGE_TO_API || 'https://storage.to/api';

// CORS para el frontend
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// Configuración de multer: guardar en disco, no en memoria
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2 GB por archivo
    files: 200, // máximo 200 archivos por lote
  },
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpm-'));
      req.uploadDir = dir;
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Sanitizar nombre
      const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      cb(null, `${Date.now()}-${safe}`);
    },
  }),
});

/**
 * POST /merge
 * Recibe múltiples PDFs, los fusiona y sube el resultado a storage.to.
 * Devuelve { url, name, size }.
 */
app.post('/merge', upload.array('files', 200), async (req, res) => {
  const uploadDir = req.uploadDir;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No se recibieron archivos' });
  }

  const manga = req.body.manga || 'Manga';
  const min = parseInt(req.body.min, 10) || 0;
  const max = parseInt(req.body.max, 10) || 0;
  const outputName = `(${min} - ${max}) ${manga}.pdf`;

  let mergedPath = null;

  try {
    // 1. Fusionar con pdf-lib en modo secuencial (uno a uno)
    const out = await PDFDocument.create();

    for (const file of files) {
      const filePath = file.path;
      const fileBuffer = fs.readFileSync(filePath);
      const src = await PDFDocument.load(fileBuffer, {
        ignoreEncryption: true,
        updateMetadata: false,
      });
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach(p => out.addPage(p));
      // El buffer se libera al final del bucle
    }

    // 2. Serializar a disco
    mergedPath = path.join(uploadDir, 'merged.pdf');
    const bytes = await out.save({ addDefaultPage: false });
    fs.writeFileSync(mergedPath, bytes);

    const size = bytes.length;

    // 3. Subir a storage.to
    const fileStream = fs.createReadStream(mergedPath);
    const form = new FormData();
    form.append('file', fileStream, outputName);

    // Iniciar subida (multipart automático si > 50 MB)
    const initRes = await fetch(`${STORAGE_TO_API}/upload/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: outputName,
        size: size,
        type: 'application/pdf',
      }),
    });
    if (!initRes.ok) throw new Error(`storage.to init falló: ${initRes.status}`);
    const initData = await initRes.json();

    // Subir usando la URL presignada
    const uploadRes = await fetch(initData.uploadUrl, {
      method: 'PUT',
      body: fileStream,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(size),
      },
    });
    if (!uploadRes.ok) throw new Error(`storage.to upload falló: ${uploadRes.status}`);

    // Confirmar subida
    const confirmRes = await fetch(`${STORAGE_TO_API}/upload/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uploadId: initData.uploadId }),
    });
    if (!confirmRes.ok) throw new Error(`storage.to confirm falló: ${confirmRes.status}`);
    const confirmData = await confirmRes.json();

    // 4. Limpiar archivos temporales
    fs.rmSync(uploadDir, { recursive: true, force: true });

    res.json({
      url: confirmData.url,
      name: outputName,
      size: size,
    });
  } catch (err) {
    console.error('Error en /merge:', err);
    // Limpiar temporales en caso de error
    if (uploadDir && fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }
    res.status(500).json({ error: err.message || 'Error interno del servidor' });
  }
});

/**
 * GET /health
 */
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Limpieza automática de temporales cada 30 minutos
setInterval(() => {
  const tmp = os.tmpdir();
  const dirs = fs.readdirSync(tmp).filter(d => d.startsWith('mpm-'));
  const now = Date.now();
  for (const dir of dirs) {
    const full = path.join(tmp, dir);
    try {
      const stat = fs.statSync(full);
      if (now - stat.mtimeMs > 60 * 60 * 1000) { // 1 hora
        fs.rmSync(full, { recursive: true, force: true });
      }
    } catch (_) { /* ignorar */ }
  }
}, 30 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Manga PDF Manager backend escuchando en http://localhost:${PORT}`);
});
