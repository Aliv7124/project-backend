import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
    type: { type: String, required: true }, // Lost / Found
    name: { type: String, required: true },
    location: { type: String, required: true },
    date: { type: String, required: true },
    description: { type: String },
    phone: { type: String }, // phone number for this post
    image: { type: String }, // <-- add this line
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("Item", itemSchema);