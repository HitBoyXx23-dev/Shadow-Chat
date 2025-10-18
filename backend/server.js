import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Schemas
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
  try {
    const { username, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hash });
    await user.save();
    res.json({ link: `/u/${username}` });
  } catch {
    res.status(400).json({ error: "Username already exists" });
  }
});

// Login
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user) return res.status(404).json({ error: "User not found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: "Wrong password" });

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

// Get inbox (auth)
app.get("/api/inbox", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const { username } = jwt.verify(token, process.env.JWT_SECRET);
    const messages = await Message.find({ recipient: username });
    res.json(messages);
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
});

app.get("/", (_, res) => res.send("Shadow Chat API running"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
