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

// Paths
const CHAT_HISTORY_FILE = path.join(__dirname, "chatHistory.json");

// Load or init chat history
let chatHistory = [];
if (fs.existsSync(CHAT_HISTORY_FILE)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(CHAT_HISTORY_FILE, "utf-8"));
  } catch (e) {
    console.error("Error loading chat history:", e);
  }
}

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// Multer memory storage (temp uploads)
const upload = multer({ storage: multer.memoryStorage() });

// File upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  res.json({ data: base64 });
});

// Socket.io handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Send chat history on join
  socket.emit("chatHistory", chatHistory);

  // Handle messages
  socket.on("chatMessage", (msg) => {
    chatHistory.push(msg);
    fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(chatHistory, null, 2));
    io.emit("chatMessage", msg);
  });

  // Handle WebRTC signaling
  socket.on("offer", (data) => socket.broadcast.emit("offer", data));
  socket.on("answer", (data) => socket.broadcast.emit("answer", data));
  socket.on("candidate", (data) => socket.broadcast.emit("candidate", data));

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`🔥 Shadow Chat running on http://localhost:${PORT}`));
