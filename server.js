const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// === STATIC FILES ===
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// === FILE UPLOAD HANDLER ===
const upload = multer({ storage: multer.memoryStorage() });
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded");
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
  res.json({ data: base64 });
});

// === CHAT HISTORY PERSISTENCE ===
const CHAT_FILE = path.join(__dirname, "chatHistory.json");
let chat = fs.existsSync(CHAT_FILE)
  ? JSON.parse(fs.readFileSync(CHAT_FILE, "utf8") || "[]")
  : [];

let users = {}; // socket.id → username
let userSockets = {}; // username → socket.id

// === SOCKET HANDLING ===
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // --- Register user ---
  socket.on("register", (username) => {
    users[socket.id] = username;
    userSockets[username] = socket.id;
    io.emit("userList", Object.values(users));
    socket.emit("chatHistory", chat);
  });

  // --- Chat messages ---
  socket.on("chatMessage", (msg) => {
    chat.push(msg);
    fs.writeFileSync(CHAT_FILE, JSON.stringify(chat, null, 2));
    io.emit("chatMessage", msg);
  });

  // === GROUP CALL SIGNALING ===
  socket.on("joinGroup", () => {
    socket.join("group");
    socket.to("group").emit("user-joined", socket.id);
  });

  socket.on("offer", ({ offer, to }) => io.to(to).emit("offer", { offer, from: socket.id }));
  socket.on("answer", ({ answer, to }) => io.to(to).emit("answer", { answer, from: socket.id }));
  socket.on("candidate", ({ candidate, to }) => io.to(to).emit("candidate", { candidate, from: socket.id }));

  socket.on("leaveGroup", () => {
    socket.leave("group");
    socket.to("group").emit("user-left", socket.id);
  });

  // === PRIVATE CALL SIGNALING ===
  socket.on("privateOffer", ({ offer, to, from }) => {
    const targetSocket = userSockets[to];
    if (targetSocket) io.to(targetSocket).emit("privateOffer", { offer, from });
  });

  socket.on("privateAnswer", ({ answer, to }) => {
    const targetSocket = userSockets[to];
    if (targetSocket) io.to(targetSocket).emit("privateAnswer", { answer });
  });

  socket.on("privateCandidate", ({ candidate, to }) => {
    const targetSocket = userSockets[to];
    if (targetSocket) io.to(targetSocket).emit("privateCandidate", { candidate });
  });

  // === DISCONNECT ===
  socket.on("disconnect", () => {
    const name = users[socket.id];
    delete users[socket.id];
    delete userSockets[name];
    io.emit("userList", Object.values(users));
    socket.to("group").emit("user-left", socket.id);
    console.log(`User ${name || socket.id} disconnected`);
  });
});

server.listen(PORT, () =>
  console.log(`🔥 Shadow Chat running at http://localhost:${PORT}`)
);
