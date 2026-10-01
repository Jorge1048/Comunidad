const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());

const UPLOAD_DIR = path.join(__dirname, 'temp_storage');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Configuración de multer para guardar directo a disco y evitar picos de RAM
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const batchId = req.params.batchId || 'default';
    const batchPath = path.join(UPLOAD_DIR, batchId);
    if (!fs.existsSync(batchPath)) fs.mkdirSync(batchPath, { recursive: true });
    cb(null, batchPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Mantenemos el nombre para el orden
  }
});
const upload = multer({ storage });

// Endpoint para subir y procesar
app.post('/api/merge/:batchId', upload.array('pdfs'), (req, res) => {
  const batchId = req.params.batchId;
  const batchPath = path.join(UPLOAD_DIR, batchId);
  const outputPath = path.join(UPLOAD_DIR, `${batchId}_final.pdf`);

  // Ordenar archivos exactamente como llegaron
  const files = req.files.map(f => f.path);

  if (files.length === 0) {
    return res.status(400).json({ error: 'No se enviaron archivos' });
  }

  // Usamos qpdf: qpdf --empty --pages file1 file2 ... -- output
  // qpdf opera con streams de disco, consume ~30MB de RAM sin importar si el PDF pesa 3GB.
  const args = ['--empty', '--pages', ...files, '--', outputPath];
  const qpdf = spawn('qpdf', args);

  qpdf.on('close', (code) => {
    // Limpiar archivos originales para ahorrar espacio
    files.forEach(f => {
      try { fs.unlinkSync(f); } catch (e) {}
    });

    if (code !== 0) {
      return res.status(500).json({ error: 'Error al unir los PDFs en el servidor.' });
    }

    res.json({ 
      success: true, 
      downloadUrl: `/api/download/${batchId}` 
    });
  });
});

// Endpoint para descargar
app.get('/api/download/:batchId', (req, res) => {
  const batchId = req.params.batchId;
  const filePath = path.join(UPLOAD_DIR, `${batchId}_final.pdf`);
  
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'Manga_Batch.pdf');
  } else {
    res.status(404).send('El archivo ha expirado o no existe.');
  }
});

// Limpieza automática (Cron-like): Borra carpetas/archivos de más de 1 hora
setInterval(() => {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return;
    files.forEach(file => {
      const filePath = path.join(UPLOAD_DIR, file);
      fs.stat(filePath, (err, stats) => {
        if (!err && (now - stats.mtimeMs > ONE_HOUR)) {
          if (stats.isDirectory()) fs.rmSync(filePath, { recursive: true, force: true });
          else fs.unlinkSync(filePath);
        }
      });
    });
  });
}, 15 * 60 * 1000); // Revisa cada 15 min

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor Manga PDF en puerto ${PORT}`));
