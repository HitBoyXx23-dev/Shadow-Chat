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

// === FILE UPLOAD CONFIG ===
const upload = multer({ dest: path.join(__dirname, "public/uploads") });
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ fileUrl: `/uploads/${req.file.filename}` });
});

// === STATIC FILES ===
app.use(express.static(path.join(__dirname, "public")));

// === CHAT HISTORY ===
function loadChatHistory() {
  if (fs.existsSync(chatFile)) {
    return JSON.parse(fs.readFileSync(chatFile, "utf8"));
  }
  return [];
}

function saveChatHistory(history) {
  fs.writeFileSync(chatFile, JSON.stringify(history, null, 2));
}

// === SOCKET.IO ===
io.on("connection", (socket) => {
  console.log("🟣 User connected:", socket.id);
  io.emit("userCount", io.engine.clientsCount);

  // send chat history
  const history = loadChatHistory();
  socket.emit("chat history", history);

  // chat message
  socket.on("chat message", (msg) => {
    const updated = [...history, msg].slice(-200);
    saveChatHistory(updated);
    io.emit("chat message", msg);
  });

  // --- WebRTC signaling ---
  socket.on("callSignal", (data) => {
    socket.broadcast.emit("callSignal", data);
  });

  socket.on("disconnect", () => {
    console.log("🔵 User disconnected:", socket.id);
    io.emit("userCount", io.engine.clientsCount);
  });
});

server.listen(PORT, () =>
  console.log(`🕶️ Shadow Chat Ultimate running on port ${PORT}`)
);
