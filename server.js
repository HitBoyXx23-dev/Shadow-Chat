// Shadow Chat Server by HitBoyXx23 🔮
// Express + Socket.io + WebRTC Signaling + Persistent JSON Chat History

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 3000;

// === Serve static frontend ===
app.use(express.static(__dirname));
app.use(express.json());

// === Default route (fixes "Cannot GET /") ===
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// === File upload (temporary memory only) ===
const upload = multer({ storage: multer.memoryStorage() });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  res.json({ data: base64 });
});

// === Chat History Persistence ===
const CHAT_HISTORY_FILE = path.join(__dirname, "chatHistory.json");
let chatHistory = [];

// Load saved chat history
if (fs.existsSync(CHAT_HISTORY_FILE)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(CHAT_HISTORY_FILE, "utf-8"));
  } catch (err) {
    console.error("Error reading chat history:", err);
    chatHistory = [];
  }
} else {
  fs.writeFileSync(CHAT_HISTORY_FILE, "[]");
}

// === Socket.io for Chat & WebRTC ===
io.on("connection", (socket) => {
  console.log("🟣 User connected:", socket.id);

  // Send saved chat to new client
  socket.emit("chatHistory", chatHistory);

  // New chat message
  socket.on("chatMessage", (msg) => {
    chatHistory.push(msg);
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
    io.emit("chatMessage", msg);
  });

  // WebRTC Signaling
  socket.on("offer", (data) => socket.broadcast.emit("offer", data));
  socket.on("answer", (data) => socket.broadcast.emit("answer", data));
  socket.on("candidate", (data) => socket.broadcast.emit("candidate", data));

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// === Start server ===
server.listen(PORT, () => {
  console.log(`🔥 Shadow Chat running at http://localhost:${PORT}`);
});
