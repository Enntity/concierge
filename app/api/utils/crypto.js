// Encrypt/decrypt using AES-256-GCM — matches cortex/lib/crypto.js format
// Format: iv:tag:encrypted (all hex-encoded)
import crypto from "crypto";

function tryBufferKey(key) {
    if (key.length === 64) return Buffer.from(key, "hex");
    return key;
}

export function encrypt(text, key) {
    if (!key) return text;
    key = tryBufferKey(key);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();
    return iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted;
}
