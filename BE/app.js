const express = require('express');
const path = require("path");
const fs = require('fs');
const rateLimitMiddleware = require("./middlewares/ratelimit");
const app = express();
const { google } = require("googleapis");
app.use(rateLimitMiddleware);

const PORT = 3000;



const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, "credentials.json"),
  scopes: ["https://www.googleapis.com/auth/drive.readonly"],
});

const drive = google.drive({ version: "v3", auth });

const FOLDER_ID = "1TZJHpbxyjpd664fI1RQRrEjvBNqxRmVY";



const THUMB_CACHE_DIR = path.join(__dirname, 'public', 'thumbcache');
if (!fs.existsSync(THUMB_CACHE_DIR)) fs.mkdirSync(THUMB_CACHE_DIR);

app.get("/api/thumbnail", async (req, res) => {
  try {
    const { id } = req.query;
    const cachePath = path.join(THUMB_CACHE_DIR, `${id}.jpg`);
    if (fs.existsSync(cachePath)) return res.sendFile(cachePath);
    const url = `https://drive.google.com/thumbnail?id=${id}&sz=w220`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).send('Unavailable');
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(cachePath, buffer);
    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);
  } catch (err) {
    res.status(500).send('Error fetching thumbnail');
  }
});

app.get("/api/videos", async (req, res) => {
  try {
    const response = await drive.files.list({
      q: `'${FOLDER_ID}' in parents and mimeType contains 'video/'`,
      fields: "files(id, name, webViewLink, thumbnailLink)",
    });
    // console.log(response.data.files);
    const videos = response.data.files.map(file => ({
      id: file.id,
      name: file.name,
      thumbnail: `https://drive.google.com/thumbnail?id=${file.id}`,
      embedLink: `https://drive.google.com/file/d/${file.id}/preview`,
    }));

    res.json(videos);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching videos");
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.get('/videoplayer', (req, res) => {
    const range = req.headers.range
    const videoPath = './sample.mp4';
    const videoSize = fs.statSync(videoPath).size
    const chunkSize = 1 * 1e6;
    const start = Number(range.replace(/\D/g, ""))
    const end = Math.min(start + chunkSize, videoSize - 1)
    const contentLength = end - start + 1;
    const headers = {
        "Content-Range": `bytes ${start}-${end}/${videoSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": contentLength,
        "Content-Type": "video/mp4"
    }
    res.writeHead(206, headers)
    const stream = fs.createReadStream(videoPath, {
        start,
        end
    })
    stream.pipe(res)
})
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});