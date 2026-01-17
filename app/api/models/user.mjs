import mongoose from "mongoose";
import uploadedDocsSchema from "./uploaded-docs.mjs";

// Define the User schema
const userSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        contextId: {
            type: String,
            required: true,
            trim: true,
        },
        contextKey: {
            type: String,
            required: false,
            trim: true,
        },
        previousContextKey: {
            type: String,
            required: false,
            trim: true,
        },
        aiName: {
            type: String,
            required: false,
            default: "Enntity",
        },
        agentModel: {
            type: String,
            required: false,
            default: "gemini-flash-3-vision",
        },
        defaultEntityId: {
            type: String,
            required: false,
            trim: true,
        },
        uploadedDocs: {
            type: [uploadedDocsSchema],
            required: false,
            default: [],
        },
        recentChatIds: {
            type: [mongoose.Schema.Types.ObjectId],
            ref: "Chat",
            required: false,
        },
        activeChatId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Chat",
            required: false,
        },
        lastActiveAt: {
            type: Date,
            required: false,
        },
        role: {
            type: String,
            required: true,
            enum: ["user", "admin"],
            default: "user",
        },
        apps: {
            type: [
                {
                    appId: {
                        type: mongoose.Schema.Types.ObjectId,
                        ref: "App",
                        required: true,
                    },
                    order: {
                        type: Number,
                        required: true,
                        min: 0,
                    },
                    addedAt: {
                        type: Date,
                        default: Date.now,
                    },
                },
            ],
            required: false,
            default: [],
        },
        profilePicture: {
            type: String,
            required: false,
            trim: true,
        },
        profilePictureHash: {
            type: String,
            required: false,
            trim: true,
        },
        blocked: {
            type: Boolean,
            required: false,
            default: false,
        },
        pushSubscriptions: {
            type: [
                new mongoose.Schema(
                    {
                        endpoint: { type: String, required: true },
                        keys: {
                            p256dh: { type: String, required: true },
                            auth: { type: String, required: true },
                        },
                        expirationTime: { type: Number, required: false },
                        userAgent: { type: String, required: false },
                        createdAt: { type: Date, default: Date.now },
                        updatedAt: { type: Date, default: Date.now },
                    },
                    { _id: false },
                ),
            ],
            required: false,
            default: [],
        },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
        },
    },
);

userSchema.virtual("initials").get(function () {
    return this.name
        ?.split(" ")
        .map((n) => n[0]?.toUpperCase() || "")
        .join("");
});

// Indexes
userSchema.index({ createdAt: -1 });
userSchema.index({ "apps.appId": 1 });
userSchema.index({ contextId: 1 });

// Create the User model from the schema
const User = mongoose.models?.User || mongoose.model("User", userSchema);

export default User;
