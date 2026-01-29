import { StreamProcessorSrc } from "./worklets/StreamProcessor";
import { AudioAnalysis } from "./AudioAnalysis";

/**
 * Plays audio streams received in raw PCM16 chunks from the browser
 */
export class WavStreamPlayer {
    /**
     * Creates a new WavStreamPlayer instance
     * @param {{sampleRate?: number, minBufferSize?: number}} options
     * sampleRate is the INPUT sample rate (what we receive from server)
     * The AudioContext will use the system's native rate and we'll upsample
     */
    constructor({ sampleRate = 24000, minBufferSize = 10 } = {}) {
        this.scriptSrc = StreamProcessorSrc;
        this.inputSampleRate = sampleRate; // Rate of incoming audio (24kHz from ElevenLabs)
        this.sampleRate = null; // Will be set to AudioContext's actual rate
        this.minBufferSize = minBufferSize;
        this.context = null;
        this.stream = null;
        this.analyser = null;
        this.gainNode = null; // For volume control
        this.trackSampleOffsets = {};
        this.interruptedTrackIds = {};
        this.isRestarting = false;
        this.currentTrackId = null;
        this.onTrackComplete = null;
    }

    /**
     * Connects the audio context and enables output to speakers
     * Uses system's native sample rate to avoid browser resampling artifacts
     * @returns {Promise<boolean>}
     */
    async connect() {
        // Don't specify sample rate - use system default (usually 48kHz)
        // This avoids browser resampling artifacts
        this.context = new AudioContext();
        this.sampleRate = this.context.sampleRate; // Store actual rate for reference
        console.log(
            `[WavStreamPlayer] AudioContext created at ${this.sampleRate}Hz (input: ${this.inputSampleRate}Hz)`,
        );

        if (this.context.state === "suspended") {
            await this.context.resume();
        }
        try {
            await this.context.audioWorklet.addModule(this.scriptSrc);
        } catch (e) {
            console.error(e);
            throw new Error(
                `Could not add audioWorklet module: ${this.scriptSrc}`,
            );
        }
        const analyser = this.context.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.8;
        this.analyser = analyser;
        return true;
    }

    /**
     * Gets the current frequency domain data from the playing track
     * @param {'frequency'|'music'|'voice'} analysisType
     * @param {number} minDecibels
     * @param {number} maxDecibels
     * @returns {{values: Float32Array, frequencies: number[], labels: string[]}}
     */
    getFrequencies(
        analysisType = "frequency",
        minDecibels = -100,
        maxDecibels = -30,
    ) {
        if (!this.analyser) {
            throw new Error("Not connected, please call .connect() first");
        }
        return AudioAnalysis.getFrequencies(
            this.analyser,
            this.sampleRate,
            null,
            analysisType,
            minDecibels,
            maxDecibels,
        );
    }

    /**
     * Starts audio streaming
     * @private
     * @returns {boolean}
     */
    _start() {
        if (!this.context) {
            throw new Error("AudioContext not initialized");
        }
        if (this.isRestarting) {
            return false;
        }
        try {
            const streamNode = new AudioWorkletNode(
                this.context,
                "stream_processor",
            );

            // Create gain node for volume control if not exists
            if (!this.gainNode) {
                this.gainNode = this.context.createGain();
                this.gainNode.connect(this.context.destination);
            }
            streamNode.connect(this.gainNode);

            streamNode.port.onmessage = (e) => {
                const { event } = e.data;
                if (event === "stop") {
                    streamNode.disconnect();
                    this.stream = null;
                    this.isRestarting = false;
                    if (e.data.reason === "max_underruns_reached") {
                        console.warn(
                            `Audio stream stopped due to ${e.data.finalCount} consecutive underruns`,
                        );
                    }
                } else if (event === "offset") {
                    const { requestId, trackId, offset } = e.data;
                    const currentTime = offset / this.sampleRate;
                    this.trackSampleOffsets[requestId] = {
                        trackId,
                        offset,
                        currentTime,
                    };
                } else if (event === "track_complete") {
                    const { trackId } = e.data;
                    this.onTrackComplete?.(trackId);
                } else if (event === "error") {
                    console.error("Stream processor error:", e.data.error);
                    this._handleStreamError();
                } else if (event === "underrun") {
                    console.warn(
                        `Audio buffer underrun: ${e.data.count} frames without data. ` +
                            `Buffer size: ${e.data.bufferSize}/${e.data.maxBuffers}`,
                    );
                }
            };
            if (this.analyser) {
                this.analyser.disconnect();
                streamNode.connect(this.analyser);
            }
            this.stream = streamNode;
            // Send config to the worklet including sample rate ratio for upsampling
            const resampleRatio = this.sampleRate / this.inputSampleRate;
            streamNode.port.postMessage({
                event: "config",
                minBufferSize: this.minBufferSize,
                inputSampleRate: this.inputSampleRate,
                outputSampleRate: this.sampleRate,
                resampleRatio: resampleRatio,
            });
            console.log(
                `[WavStreamPlayer] Resample ratio: ${resampleRatio} (${this.inputSampleRate}Hz -> ${this.sampleRate}Hz)`,
            );
            return true;
        } catch (error) {
            console.error("Error starting stream:", error);
            this.isRestarting = false;
            return false;
        }
    }

    /**
     * Handles stream errors by attempting to restart
     * @private
     */
    async _handleStreamError() {
        if (this.isRestarting) return;

        this.isRestarting = true;
        try {
            if (this.stream) {
                this.stream.disconnect();
                this.stream = null;
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            this._start();
        } finally {
            this.isRestarting = false;
        }
    }

    /**
     * Adds 16BitPCM data to the currently playing audio stream
     * @param {ArrayBuffer|Int16Array} pcmData
     * @param {string} trackId
     * @returns {Int16Array}
     */
    add16BitPCM(pcmData, trackId) {
        if (!this.context || !this.analyser) {
            return new Int16Array();
        }

        this.currentTrackId = trackId;
        try {
            if (this.interruptedTrackIds[trackId]) {
                return new Int16Array();
            }

            if (!this.stream && !this._start()) {
                throw new Error("Failed to start audio stream");
            }

            let buffer;
            try {
                if (pcmData instanceof Int16Array) {
                    buffer = pcmData;
                } else {
                    buffer = new Int16Array(pcmData);
                }
            } catch (error) {
                console.error("Error creating Int16Array:", error);
                return new Int16Array();
            }

            if (!buffer.length) {
                console.warn("Received empty buffer for track:", trackId);
                return buffer;
            }

            this.stream?.port.postMessage({ event: "write", buffer, trackId });
            return buffer;
        } catch (error) {
            console.error("Error processing audio chunk:", error);
            this._handleStreamError();
            return new Int16Array();
        }
    }

    /**
     * Flushes any remaining buffered audio for a track
     * Call this when you know no more audio is coming for a track
     * @param {string} trackId
     */
    flushTrack(trackId) {
        if (this.stream) {
            this.stream.port.postMessage({ event: "flush", trackId });
        }
    }

    /**
     * Clears the interrupted state for a track
     * @param {string} trackId
     */
    clearInterruptedState(trackId) {
        delete this.interruptedTrackIds[trackId];
    }

    /**
     * Clears all interrupted states
     */
    clearAllInterruptedStates() {
        this.interruptedTrackIds = {};
    }

    /**
     * Gets the offset (sample count) of the currently playing stream
     * @param {boolean} interrupt
     * @returns {Promise<{trackId: string|null, offset: number, currentTime: number}|null>}
     */
    async getTrackSampleOffset(interrupt = false) {
        if (!this.stream) {
            return null;
        }
        const requestId = crypto.randomUUID();
        this.stream.port.postMessage({
            event: interrupt ? "interrupt" : "offset",
            requestId,
        });
        let trackSampleOffset;
        const startTime = Date.now();
        while (!trackSampleOffset) {
            if (Date.now() - startTime > 5000) {
                return null; // Timeout - return null instead of hanging forever
            }
            trackSampleOffset = this.trackSampleOffsets[requestId];
            await new Promise((r) => setTimeout(() => r(null), 1));
        }
        const { trackId } = trackSampleOffset;
        if (interrupt && trackId) {
            this.interruptedTrackIds[trackId] = true;
        }
        return trackSampleOffset;
    }

    /**
     * Strips the current stream and returns the sample offset of the audio
     * @returns {Promise<{trackId: string|null, offset: number, currentTime: number}|null>}
     */
    async interrupt() {
        return this.getTrackSampleOffset(true);
    }

    /**
     * Sets the output volume
     * @param {number} volume - Volume level from 0 to 1
     * @param {number} rampTimeMs - Time to ramp to new volume in milliseconds
     */
    setVolume(volume, rampTimeMs = 50) {
        if (this.gainNode && this.context) {
            const clampedVolume = Math.max(0, Math.min(1, volume));
            this.gainNode.gain.linearRampToValueAtTime(
                clampedVolume,
                this.context.currentTime + rampTimeMs / 1000,
            );
        }
    }

    /**
     * Ducks the audio to a lower volume (for when user might be speaking)
     * @param {number} volume - Duck volume level (default 0.05 = 5%)
     */
    duck(volume = 0.05) {
        this.setVolume(volume, 30); // Quick duck
    }

    /**
     * Restores audio to full volume after ducking
     */
    unduck() {
        this.setVolume(1, 100); // Slightly slower restore
    }

    /**
     * Gets the analyser node
     * @returns {AnalyserNode|null}
     */
    getAnalyser() {
        return this.analyser;
    }

    /**
     * Sets a callback to be called when a track completes playback
     * @param {Function} callback
     */
    setTrackCompleteCallback(callback) {
        this.onTrackComplete = callback;
    }

    /**
     * Fades out the audio over the specified duration
     * @param {number} durationMs
     * @returns {Promise<void>}
     */
    async fadeOut(durationMs) {
        if (!this.context) return;
        const gainNode = this.context.createGain();
        gainNode.gain.setValueAtTime(1, this.context.currentTime);
        gainNode.gain.linearRampToValueAtTime(
            0,
            this.context.currentTime + durationMs / 1000,
        );

        // Insert gain node before destination
        this.stream?.disconnect();
        this.stream?.connect(gainNode);
        gainNode.connect(this.context.destination);

        return new Promise((resolve) => setTimeout(resolve, durationMs));
    }
}
