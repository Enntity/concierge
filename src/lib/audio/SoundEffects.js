/**
 * SoundEffects - Plays UI sound effects for voice mode
 * Loads and caches audio buffers for quick playback
 */

class SoundEffectsManager {
    constructor() {
        this.audioContext = null;
        this.connectBuffer = null;
        this.disconnectBuffer = null;
        this.initialized = false;
    }

    async getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }
        // Resume if suspended (browser autoplay policy)
        if (this.audioContext.state === "suspended") {
            await this.audioContext.resume();
        }
        return this.audioContext;
    }

    async loadSound(url) {
        const context = await this.getAudioContext();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await context.decodeAudioData(arrayBuffer);
    }

    async init() {
        if (this.initialized) return;

        try {
            const [connect, disconnect] = await Promise.all([
                this.loadSound("/sounds/connect.mp3"),
                this.loadSound("/sounds/disconnect.mp3"),
            ]);
            this.connectBuffer = connect;
            this.disconnectBuffer = disconnect;
            this.initialized = true;
            console.log("[SoundEffects] Initialized");
        } catch (error) {
            console.error("[SoundEffects] Failed to load sounds:", error);
        }
    }

    async playBuffer(buffer) {
        if (!buffer) return;

        try {
            const context = await this.getAudioContext();
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(0);
        } catch (error) {
            console.error("[SoundEffects] Failed to play sound:", error);
        }
    }

    async playConnect() {
        console.log("[SoundEffects] playConnect called");
        await this.init();
        await this.playBuffer(this.connectBuffer);
    }

    async playDisconnect() {
        await this.init();
        await this.playBuffer(this.disconnectBuffer);
    }
}

// Singleton instance
export const SoundEffects = new SoundEffectsManager();
