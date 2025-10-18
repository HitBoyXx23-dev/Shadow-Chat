import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI);

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
});

const messageSchema = new mongoose.Schema({
  recipient: String,
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

// Register
app.post("/api/register", async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hash });
  await user.save();
  res.json({ message: "User created", link: `/u/${username}` });
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const token = jwt.sign({ username }, process.env.JWT_SECRET);
  res.json({ token });
});

// Send anonymous message
app.post("/api/send/:username", async (req, res) => {
  const { username } = req.params;
  const { text } = req.body;
  const recipient = await User.findOne({ username });
  if (!recipient) return res.status(404).json({ error: "User not found" });
  await Message.create({ recipient: username, text });
  res.json({ success: true });
});

// Get user inbox
app.get("/api/inbox", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(403).json({ error: "No token" });
  const { username } = jwt.verify(token, process.env.JWT_SECRET);
  const messages = await Message.find({ recipient: username });
  res.json(messages);
});

app.get("/", (req, res) => res.send("Shadow Chat API Running"));
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
