const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// Simple route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Handle socket connections
io.on("connection", (socket) => {
  console.log("🟣 New user connected:", socket.id);

  socket.on("chat message", (msg) => {
    io.emit("chat message", msg); // broadcast to everyone
  });

  socket.on("disconnect", () => {
    console.log("🔵 User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () =>
  console.log(`🕶️ Shadow Chat Global running on port ${PORT}`)
);
