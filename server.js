// Shadow Chat v2.5 – fully working core
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

const PUBLIC = path.join(__dirname, "public");
app.use(express.static(PUBLIC));
app.use(express.json());

// ---- File uploads (base64 only, temp in memory) ----
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  res.json({ data: base64 });
});

// ---- Persistent chat ----
const CHAT_FILE = path.join(__dirname, "chatHistory.json");
let chat = fs.existsSync(CHAT_FILE)
  ? JSON.parse(fs.readFileSync(CHAT_FILE, "utf8") || "[]")
  : [];

let users = {}; // socket.id -> username

io.on("connection", (socket) => {
  // register user
  socket.on("register", (name) => {
    users[socket.id] = name;
    io.emit("userList", Object.values(users));
    socket.emit("chatHistory", chat);
  });

  // chat
  socket.on("chatMessage", (msg) => {
    chat.push(msg);
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chat, null, 2));
    io.emit("chatMessage", msg);
  });

  // ---- 1-on-1 WebRTC signaling ----
  socket.on("callUser", ({ to, offer }) => {
    const target = Object.keys(users).find((id) => users[id] === to);
    if (target) io.to(target).emit("incomingCall", { from: users[socket.id], offer });
  });
  socket.on("answerCall", ({ to, answer }) => {
    const target = Object.keys(users).find((id) => users[id] === to);
    if (target) io.to(target).emit("callAnswered", { answer });
  });
  socket.on("iceCandidate", ({ to, candidate }) => {
    const target = Object.keys(users).find((id) => users[id] === to);
    if (target) io.to(target).emit("iceCandidate", { candidate });
  });

  // ---- Group room join/leave ----
  socket.on("joinGroup", (room) => socket.join("group"));
  socket.on("leaveGroup", (room) => socket.leave("group"));
  socket.on("groupAudio", (data) => socket.to("group").emit("groupAudio", data));

  socket.on("disconnect", () => {
    delete users[socket.id];
    io.emit("userList", Object.values(users));
  });
});

server.listen(PORT, () => console.log(`🔥 Shadow Chat running at http://localhost:${PORT}`));
