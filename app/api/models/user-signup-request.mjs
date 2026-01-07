import mongoose from "mongoose";

const userSignupRequestSchema = new mongoose.Schema(
    {
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            unique: true, // Prevent duplicate signup requests
        },
        name: {
            type: String,
            required: false,
            trim: true,
        },
        domain: {
            type: String,
            required: false,
            trim: true,
        },
        requestedAt: {
            type: Date,
            default: Date.now,
            required: true,
        },
    },
    {
        timestamps: true,
    },
);

// Index for efficient queries (email index created by unique: true)
userSignupRequestSchema.index({ requestedAt: -1 });
userSignupRequestSchema.index({ domain: 1 });

const UserSignupRequest =
    mongoose.models.UserSignupRequest ||
    mongoose.model("UserSignupRequest", userSignupRequestSchema);

export default UserSignupRequest;
