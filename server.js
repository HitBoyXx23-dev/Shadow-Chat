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

// Serve static files
const PUBLIC = path.join(__dirname, "public");
app.use(express.static(PUBLIC));
app.use(express.json());

// === Temporary file upload (memory only) ===
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  res.json({ data: base64 });
});

// === Chat persistence ===
const CHAT_FILE = path.join(__dirname, "chatHistory.json");
let chatHistory = [];
if (fs.existsSync(CHAT_FILE)) {
  try {
    chatHistory = JSON.parse(fs.readFileSync(CHAT_FILE, "utf8"));
  } catch {
    chatHistory = [];
  }
}

// === Socket.io ===
let users = {};

io.on("connection", (socket) => {
  socket.on("register", (user) => {
    users[socket.id] = user;
    io.emit("userList", Object.values(users));
    socket.emit("chatHistory", chatHistory);
  });

  socket.on("chatMessage", (msg) => {
    chatHistory.push(msg);
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chatHistory, null, 2));
    io.emit("chatMessage", msg);
  });

  // Group call room
  socket.on("joinGroup", () => socket.join("group"));
  socket.on("leaveGroup", () => socket.leave("group"));
  socket.on("groupAudio", (data) => socket.to("group").emit("groupAudio", data));

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

server.listen(PORT, () => console.log(`🔥 Shadow Chat running at http://localhost:${PORT}`));
