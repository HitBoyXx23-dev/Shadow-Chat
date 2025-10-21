// Shadow Chat Server (Public Directory Version)
// By HitBoyXx23 🔮

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

// === Serve static files from /public ===
const PUBLIC_DIR = path.join(__dirname, "public");
app.use(express.static(PUBLIC_DIR));
app.use(express.json());

// === Default route for index.html ===
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// === File upload endpoint (temporary storage in memory) ===
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  res.json({ data: base64 });
});

// === Persistent Chat History ===
const CHAT_HISTORY_FILE = path.join(__dirname, "chatHistory.json");
let chatHistory = [];

// Load existing chat history
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

// === Socket.io for real-time chat + WebRTC signaling ===
io.on("connection", (socket) => {
  console.log("🟣 User connected:", socket.id);

  // Send saved chat to new client
  socket.emit("chatHistory", chatHistory);

  // Receive new message and broadcast it
  socket.on("chatMessage", (msg) => {
    chatHistory.push(msg);
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
    io.emit("chatMessage", msg);
  });

  // Handle WebRTC offer/answer/candidate for voice calls
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
