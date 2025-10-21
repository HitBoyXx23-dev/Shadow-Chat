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

// ---------------------------
// Chat log persistence
// ---------------------------
const chatFile = path.join(__dirname, "chatlog.json");
function loadChat() {
  try {
    if (fs.existsSync(chatFile)) {
      return JSON.parse(fs.readFileSync(chatFile, "utf8"));
    }
  } catch (e) {
    console.error("❌ Failed to load chat log:", e);
  }
  return [];
}
function saveChat(history) {
  try {
    fs.writeFileSync(chatFile, JSON.stringify(history, null, 2));
  } catch (e) {
    console.error("❌ Failed to save chat log:", e);
  }
}

// ---------------------------
// File upload (Multer)
// ---------------------------
const upload = multer({ dest: path.join(__dirname, "public/uploads") });
app.post("/upload", upload.single("file"), (req, res) => {
  const url = `/uploads/${req.file.filename}`;
  res.json({ fileUrl: url });
});

// ---------------------------
// Static files
// ---------------------------
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// Socket.IO logic
// ---------------------------
io.on("connection", (socket) => {
  console.log("🟣 Client connected:", socket.id);
  io.emit("userCount", io.engine.clientsCount);

  const history = loadChat();
  socket.emit("chat history", history);

  // ---- Chat messages ----
  socket.on("chat message", (msg) => {
    const updated = [...history, msg].slice(-300);
    saveChat(updated);
    io.emit("chat message", msg);
  });

  // ---- WebRTC signaling ----
  socket.on("callSignal", (payload) => {
    socket.broadcast.emit("callSignal", payload);
  });

  // ---- Disconnect ----
  socket.on("disconnect", () => {
    io.emit("userCount", io.engine.clientsCount);
    console.log("🔵 Client disconnected:", socket.id);
  });
});

// ---------------------------
// Start server
// ---------------------------
server.listen(PORT, () => {
  console.log(`🕶️ Shadow Chat Ultra running → http://localhost:${PORT}`);
});
