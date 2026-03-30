import mongoose from "mongoose";

const modelPolicySchema = new mongoose.Schema(
    {
        primaryModel: { type: String, required: false, trim: true },
        orientationModel: { type: String, required: false, trim: true },
        planningModel: { type: String, required: false, trim: true },
        researchModel: { type: String, required: false, trim: true },
        childModel: { type: String, required: false, trim: true },
        synthesisModel: { type: String, required: false, trim: true },
        verificationModel: { type: String, required: false, trim: true },
        compressionModel: { type: String, required: false, trim: true },
        routingModel: { type: String, required: false, trim: true },
    },
    {
        _id: false,
    },
);

const modelProfileSchema = new mongoose.Schema(
    {
        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: false,
            trim: true,
            default: "",
        },
        isDefault: {
            type: Boolean,
            default: false,
        },
        modelPolicy: {
            type: modelPolicySchema,
            required: true,
            default: {},
        },
    },
    {
        timestamps: true,
        toJSON: {
            virtuals: true,
        },
    },
);

modelProfileSchema.index({ slug: 1 }, { unique: true });

const ModelProfile =
    mongoose.models?.ModelProfile ||
    mongoose.model("ModelProfile", modelProfileSchema);

export default ModelProfile;
