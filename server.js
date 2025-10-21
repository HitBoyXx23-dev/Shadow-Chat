const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 10000;

const chatFile = path.join(__dirname, "chatlog.json");
if (!fs.existsSync(chatFile)) fs.writeFileSync(chatFile, "[]");

const upload = multer({ dest: path.join(__dirname, "public/uploads/") });
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use(express.static(path.join(__dirname, "public")));

app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

io.on("connection", (socket) => {
  console.log("🟣 Connected:", socket.id);
  const history = JSON.parse(fs.readFileSync(chatFile));
  socket.emit("chat history", history);
  io.emit("userCount", io.engine.clientsCount);

  socket.on("chat message", (msg) => {
    history.push(msg);
    fs.writeFileSync(chatFile, JSON.stringify(history.slice(-200), null, 2));
    io.emit("chat message", msg);
  });

  socket.on("callSignal", (data) => {
    socket.broadcast.emit("callSignal", data);
  });

  socket.on("disconnect", () => {
    io.emit("userCount", io.engine.clientsCount);
    console.log("🔵 Disconnected:", socket.id);
  });
});

server.listen(PORT, () =>
  console.log(`🕶️ Shadow Chat running on port ${PORT}`)
);
