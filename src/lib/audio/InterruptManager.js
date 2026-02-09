/**
 * InterruptManager - Gates voice interrupt signals to prevent echo-triggered false interrupts.
 *
 * When AI is NOT playing: speech events pass through immediately (no echo risk).
 * When AI IS playing: enters PENDING state, ducks audio, counts high-confidence
 * speech frames, and only confirms interrupt when enough evidence accumulates.
 *
 * State machine:
 *   IDLE ──(speechStart + AI playing)──> PENDING ──(confirmed)──> CONFIRMED
 *                                           │
 *                                      (misfire/cancel)──> IDLE
 */

const State = {
    IDLE: "IDLE",
    PENDING: "PENDING",
    CONFIRMED: "CONFIRMED",
};

const CONFIRM_FRAMES = 7; // Frames above threshold needed to confirm (~210ms)
const CONFIRM_THRESHOLD = 0.6; // Speech probability threshold for confirmation
const CANCEL_FRAMES = 3; // Consecutive low frames to auto-cancel
const CANCEL_THRESHOLD = 0.3; // Below this counts toward cancellation

export class InterruptManager {
    constructor({ onInterruptConfirmed, onDuck, onCancelled } = {}) {
        this.state = State.IDLE;
        this.highFrameCount = 0;
        this.lowFrameCount = 0;

        // Callbacks
        this.onInterruptConfirmed = onInterruptConfirmed || (() => {});
        this.onDuck = onDuck || (() => {});
        this.onCancelled = onCancelled || (() => {});
    }

    /**
     * Called when VAD detects speech start.
     * @param {boolean} aiIsPlaying - Whether AI audio is currently playing
     * @returns {boolean} true if speechStart should be emitted immediately (AI not playing)
     */
    onSpeechStart(aiIsPlaying) {
        if (!aiIsPlaying) {
            // No echo risk - pass through immediately
            this.state = State.IDLE;
            return true;
        }

        // AI is playing - enter pending state, duck audio, wait for confirmation
        this.state = State.PENDING;
        this.highFrameCount = 0;
        this.lowFrameCount = 0;
        this.onDuck(true);
        return false;
    }

    /**
     * Called for each processed audio frame with speech probability.
     * Only matters when in PENDING state - counts frames to confirm or cancel.
     * @param {number} speechProbability - VAD speech probability (0-1)
     */
    onFrame(speechProbability) {
        if (this.state !== State.PENDING) return;

        if (speechProbability > CONFIRM_THRESHOLD) {
            this.highFrameCount++;
            this.lowFrameCount = 0; // Reset low counter on high frame
        } else if (speechProbability < CANCEL_THRESHOLD) {
            this.lowFrameCount++;
        }

        // Enough high-confidence frames - this is real speech
        if (this.highFrameCount >= CONFIRM_FRAMES) {
            this._confirm();
            return;
        }

        // Too many low frames in a row - likely echo, cancel
        if (this.lowFrameCount >= CANCEL_FRAMES) {
            this._cancel();
        }
    }

    /**
     * Called when VAD detects speech end.
     * If still PENDING, confirms the interrupt (backstop for short utterances
     * like "stop" that may not accumulate enough frames).
     */
    onSpeechEnd() {
        if (this.state === State.PENDING) {
            this._confirm();
        }
    }

    /**
     * Called on VAD misfire (speech was too short to be real).
     * Cancels if still PENDING.
     */
    onMisfire() {
        if (this.state === State.PENDING) {
            this._cancel();
        }
    }

    /**
     * Returns true if the manager is currently evaluating a potential interrupt.
     */
    isPending() {
        return this.state === State.PENDING;
    }

    /**
     * Resets the manager to idle state. Does not fire callbacks.
     */
    reset() {
        this.state = State.IDLE;
        this.highFrameCount = 0;
        this.lowFrameCount = 0;
    }

    /** @private */
    _confirm() {
        this.state = State.CONFIRMED;
        this.onDuck(false); // Restore volume (interrupt will kill audio anyway)
        this.onInterruptConfirmed();
        // Reset counters for next cycle
        this.highFrameCount = 0;
        this.lowFrameCount = 0;
    }

    /** @private */
    _cancel() {
        this.state = State.IDLE;
        this.highFrameCount = 0;
        this.lowFrameCount = 0;
        this.onDuck(false); // Restore volume
        this.onCancelled();
    }
}

// Export constants for testing
InterruptManager.State = State;
InterruptManager.CONFIRM_FRAMES = CONFIRM_FRAMES;
InterruptManager.CONFIRM_THRESHOLD = CONFIRM_THRESHOLD;
InterruptManager.CANCEL_FRAMES = CANCEL_FRAMES;
InterruptManager.CANCEL_THRESHOLD = CANCEL_THRESHOLD;
