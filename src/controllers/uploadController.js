const fs = require('node:fs/promises');
const path = require('node:path');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const config = require('../config');
const db = require('../db');

const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (_req, file, done) => done(null, `${Date.now()}-${require('node:crypto').randomUUID()}${path.extname(file.originalname).toLowerCase()}`)
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadBytes, files: 5 },
  fileFilter: (_req, file, done) => {
    const allowed = file.mimetype === 'application/pdf' || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    done(allowed ? null : new Error('Seuls les fichiers PDF et les images sont acceptés.'), allowed);
  }
}).array('files', 5);

exports.upload = (req, res, next) => upload(req, res, async (error) => {
  if (error) {
    const status = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT' ? 413 : 400;
    return res.status(status).json({ error: error.message });
  }
  try {
    const saved = [];
    for (const file of req.files || []) {
      let extractedText = '';
      if (file.mimetype === 'application/pdf') {
        try {
          const parsed = await pdfParse(await fs.readFile(file.path));
          extractedText = parsed.text.slice(0, 100000);
        } catch (parseError) {
          await fs.unlink(file.path);
          return res.status(400).json({ error: `Impossible de lire le PDF ${file.originalname}: ${parseError.message}` });
        }
      }
      const result = db.prepare(`
        INSERT INTO uploads (user_id, filename, original_name, mime_type, extracted_text)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.user.id, file.filename, file.originalname.slice(0, 255), file.mimetype, extractedText);
      saved.push({ id: Number(result.lastInsertRowid), name: file.originalname, mimeType: file.mimetype });
    }
    return res.status(201).json(saved);
  } catch (unexpectedError) {
    return next(unexpectedError);
  }
});
