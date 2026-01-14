import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
    {
        message: {
            type: String,
            required: true,
            trim: true,
        },
        screenshot: {
            type: String,
            required: false,
            trim: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: false,
        },
        username: {
            type: String,
            required: false,
            trim: true,
        },
        name: {
            type: String,
            required: false,
            trim: true,
        },
    },
    {
        timestamps: true,
    },
);

feedbackSchema.index({ createdAt: -1 });
feedbackSchema.index({ username: 1, createdAt: -1 });

const Feedback =
    mongoose.models?.Feedback || mongoose.model("Feedback", feedbackSchema);

export default Feedback;
