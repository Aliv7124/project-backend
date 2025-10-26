import express from "express";
import multer from "multer";
import fs from "fs";
import { v2 as cloudinary } from "cloudinary";
import Item from "../models/Item.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import dotenv from "dotenv";
import axios from "axios";
const router = express.Router();
dotenv.config();
router.post("/ai/description", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: "Item name is required" });

  try {
    const response = await axios.post(
      "https://api.sambanova.ai/v1/chat/completions",
      {
        model: "Llama-4-Maverick-17B-128E-Instruct",
        messages: [
          {
            role: "user",
            content: `Generate 5 short, unique descriptions for a FOUND item.
                      Name: ${name}.
                      Each description should mention appearance and possible found location.`,
          },
        ],
        temperature: 0.7,
        top_p: 0.9,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.SAMBANOVA_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || "";
    const descriptions = content
      .split("\n")
      .map((l) => l.replace(/^\d+[\.\)]\s*/, "").trim())
      .filter((l) => l.length > 0)
      .slice(0, 5);

    if (descriptions.length === 0) throw new Error("No valid descriptions generated");
    res.json({ descriptions });
  } catch (err) {
    console.error("🔥 SambaNova API error details:", err.response?.data || err.message);
    res.status(500).json({ message: "Failed to generate description" });
  }
});


// ✅ Cloudinary config (use env vars for deployment)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Setup multer for temporary file upload
const upload = multer({ dest: "uploads/" });



// ✅ Create new item (Lost or Found)
router.post("/", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { name, location, description, type, date, phone } = req.body;

    if (!name || !location || !type) {
      return res.status(400).json({ message: "Name, location, and type are required." });
    }

    let imageUrl = null;

    // ✅ Upload image to Cloudinary if provided
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "lost_found_items",
        resource_type: "auto", // ✅ ensures mobile uploads (jpg, heic, etc.) work fine
      });
      imageUrl = result.secure_url;
      fs.unlinkSync(req.file.path); // delete temp file
    }

    const newItem = new Item({
      name,
      location,
      description,
      type,
      date: date || new Date().toISOString(),
      user: req.user.id,
      phone: phone || null,
      image: imageUrl,
    });

    const savedItem = await newItem.save();
    res.status(201).json(savedItem);
  } catch (err) {
    console.error("Error creating item:", err);
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get logged-in user's items
router.get("/", verifyToken, async (req, res) => {
  try {
    const items = await Item.find({ user: req.user.id });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get all items (public)
router.get("/all", async (req, res) => {
  try {
    const items = await Item.find().populate("user", "name");
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Get a single item (public)
router.get("/:id", async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Delete an item
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    if (item.user.toString() !== req.user.id)
      return res.status(403).json({ message: "Unauthorized" });

    await item.deleteOne();
    res.json({ message: "Item deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ✅ Contact Owner
router.get("/contact/:id", verifyToken, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate("user", "name email phone");
    if (!item) return res.status(404).json({ message: "Item not found" });

    const phone = item.phone || item.user.phone;
    res.json({
      ownerName: item.user.name,
      phone,
      email: item.user.email,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch contact info" });
  }
});
router.put("/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const { name, type, location, description, image } = req.body;

  try {
    // Find post by ID
    const item = await Item.findById(id);

    if (!item) return res.status(404).json({ message: "Post not found" });

    // Optional: check if the logged-in user owns this post
    if (item.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Update fields
    item.name = name || item.name;
    item.type = type || item.type;
    item.location = location || item.location;
    item.description = description || item.description;
    item.image = image || item.image;

    const updatedItem = await item.save();
    res.json(updatedItem);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;