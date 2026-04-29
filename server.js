const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { google } = require("googleapis");
const stream = require("stream");
const path = require("path");

const app = express();

/* ===== CONFIG ===== */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ===== GOOGLE DRIVE ===== */
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({ version: "v3", auth });

/* 👉 SUA PASTA (ATUALIZADA) */
const ROOT_FOLDER = "1HdsMRezTJSRWUcEt5SthbMl-5kQnjSTK";

/* ===== MULTER ===== */
const upload = multer({
  storage: multer.memoryStorage()
});

/* ===== CRIAR/OBTER PASTA POR CPF ===== */
async function getOrCreateFolder(cpf) {
  try {
    const res = await drive.files.list({
      q: `'${ROOT_FOLDER}' in parents and name='${cpf}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    });

    if (res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    const folder = await drive.files.create({
      requestBody: {
        name: cpf,
        mimeType: "application/vnd.google-apps.folder",
        parents: [ROOT_FOLDER]
      },
      fields: "id",
      supportsAllDrives: true
    });

    return folder.data.id;

  } catch (err) {
    console.log("Erro pasta:", err.message);
    throw err;
  }
}

/* ===== UPLOAD ===== */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { cpf } = req.body;

    if (!cpf) {
      return res.status(400).json({ error: "CPF obrigatório" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Arquivo não enviado" });
    }

    const folderId = await getOrCreateFolder(cpf);

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const response = await drive.files.create({
      requestBody: {
        name: Date.now() + "-" + req.file.originalname,
        parents: [folderId]
      },
      media: {
        mimeType: req.file.mimetype,
        body: bufferStream
      },
      fields: "id",
      supportsAllDrives: true
    });

    res.json({
      success: true,
      fileId: response.data.id
    });

  } catch (error) {
    console.log("ERRO:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/* ===== SERVER ===== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});