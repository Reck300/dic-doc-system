const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { google } = require("googleapis");
const stream = require("stream");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ===== GOOGLE DRIVE (SEGURO COM ENV) ===== */
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/drive"]
});

const drive = google.drive({ version: "v3", auth });

const ROOT_FOLDER = "1THFDaLMxrak4vEvrwJ4QX1BH1sej8VbC";

/* ===== UPLOAD ===== */
const upload = multer({ storage: multer.memoryStorage() });

/* ===== CRIAR PASTA POR CPF ===== */
async function getOrCreateFolder(cpf) {
  const res = await drive.files.list({
    q: `name='${cpf}' and mimeType='application/vnd.google-apps.folder'`,
    fields: "files(id, name)"
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
    fields: "id"
  });

  return folder.data.id;
}

/* ===== UPLOAD ===== */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { cpf } = req.body;

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
      fields: "id"
    });

    res.json({
      success: true,
      fileId: response.data.id
    });

  } catch (error) {
    console.log(error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

/* ===== SERVER ===== */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Rodando na porta " + PORT);
});