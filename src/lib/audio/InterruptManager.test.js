import { InterruptManager } from "./InterruptManager";

const { State, CONFIRM_FRAMES, CONFIRM_THRESHOLD, CANCEL_FRAMES, CANCEL_THRESHOLD } =
    InterruptManager;

function createManager(overrides = {}) {
    const callbacks = {
        onInterruptConfirmed: jest.fn(),
        onDuck: jest.fn(),
        onCancelled: jest.fn(),
        ...overrides,
    };
    const manager = new InterruptManager(callbacks);
    return { manager, ...callbacks };
}

/** Send N frames at a given probability */
function sendFrames(manager, count, probability) {
    for (let i = 0; i < count; i++) {
        manager.onFrame(probability);
    }
}

describe("InterruptManager", () => {
    describe("when AI is NOT playing", () => {
        it("returns true from onSpeechStart (immediate passthrough)", () => {
            const { manager, onDuck } = createManager();
            const result = manager.onSpeechStart(false);
            expect(result).toBe(true);
            expect(manager.state).toBe(State.IDLE);
            expect(onDuck).not.toHaveBeenCalled();
        });

        it("does not process frames in IDLE state", () => {
            const { manager, onInterruptConfirmed, onCancelled } = createManager();
            manager.onSpeechStart(false);
            sendFrames(manager, 20, 0.9);
            expect(onInterruptConfirmed).not.toHaveBeenCalled();
            expect(onCancelled).not.toHaveBeenCalled();
        });
    });

    describe("when AI IS playing", () => {
        it("returns false from onSpeechStart and enters PENDING", () => {
            const { manager, onDuck } = createManager();
            const result = manager.onSpeechStart(true);
            expect(result).toBe(false);
            expect(manager.state).toBe(State.PENDING);
            expect(onDuck).toHaveBeenCalledWith(true);
        });

        it("confirms interrupt after enough high-confidence frames", () => {
            const { manager, onInterruptConfirmed, onDuck } = createManager();
            manager.onSpeechStart(true);
            onDuck.mockClear();

            sendFrames(manager, CONFIRM_FRAMES, CONFIRM_THRESHOLD + 0.1);

            expect(manager.state).toBe(State.CONFIRMED);
            expect(onInterruptConfirmed).toHaveBeenCalledTimes(1);
            expect(onDuck).toHaveBeenCalledWith(false); // unduck on confirm
        });

        it("cancels after enough low-confidence frames (echo)", () => {
            const { manager, onCancelled, onDuck, onInterruptConfirmed } = createManager();
            manager.onSpeechStart(true);
            onDuck.mockClear();

            sendFrames(manager, CANCEL_FRAMES, CANCEL_THRESHOLD - 0.1);

            expect(manager.state).toBe(State.IDLE);
            expect(onCancelled).toHaveBeenCalledTimes(1);
            expect(onInterruptConfirmed).not.toHaveBeenCalled();
            expect(onDuck).toHaveBeenCalledWith(false); // unduck on cancel
        });

        it("resets low frame count when a high frame arrives", () => {
            const { manager, onCancelled } = createManager();
            manager.onSpeechStart(true);

            // Send almost enough low frames to cancel
            sendFrames(manager, CANCEL_FRAMES - 1, CANCEL_THRESHOLD - 0.1);
            // One high frame resets the low counter
            manager.onFrame(CONFIRM_THRESHOLD + 0.1);
            // Now low frames need to start over
            sendFrames(manager, CANCEL_FRAMES - 1, CANCEL_THRESHOLD - 0.1);

            expect(manager.state).toBe(State.PENDING);
            expect(onCancelled).not.toHaveBeenCalled();
        });

        it("does not count mid-range frames toward either threshold", () => {
            const { manager, onInterruptConfirmed, onCancelled } = createManager();
            manager.onSpeechStart(true);

            // Frames between CANCEL_THRESHOLD and CONFIRM_THRESHOLD
            const midProb = (CANCEL_THRESHOLD + CONFIRM_THRESHOLD) / 2;
            sendFrames(manager, 20, midProb);

            expect(manager.state).toBe(State.PENDING);
            expect(onInterruptConfirmed).not.toHaveBeenCalled();
            expect(onCancelled).not.toHaveBeenCalled();
        });
    });

    describe("speechEnd backstop", () => {
        it("confirms if still PENDING when speech ends (short utterance)", () => {
            const { manager, onInterruptConfirmed, onDuck } = createManager();
            manager.onSpeechStart(true);
            onDuck.mockClear();

            // Only a few high frames (not enough to auto-confirm)
            sendFrames(manager, 2, CONFIRM_THRESHOLD + 0.1);
            manager.onSpeechEnd();

            expect(manager.state).toBe(State.CONFIRMED);
            expect(onInterruptConfirmed).toHaveBeenCalledTimes(1);
            expect(onDuck).toHaveBeenCalledWith(false);
        });

        it("does nothing if already CONFIRMED", () => {
            const { manager, onInterruptConfirmed } = createManager();
            manager.onSpeechStart(true);

            // Confirm via frames first
            sendFrames(manager, CONFIRM_FRAMES, CONFIRM_THRESHOLD + 0.1);
            expect(onInterruptConfirmed).toHaveBeenCalledTimes(1);

            // speechEnd should not re-fire
            manager.onSpeechEnd();
            expect(onInterruptConfirmed).toHaveBeenCalledTimes(1);
        });

        it("does nothing if IDLE", () => {
            const { manager, onInterruptConfirmed } = createManager();
            manager.onSpeechEnd();
            expect(onInterruptConfirmed).not.toHaveBeenCalled();
        });
    });

    describe("misfire handling", () => {
        it("cancels if PENDING on misfire", () => {
            const { manager, onCancelled, onDuck } = createManager();
            manager.onSpeechStart(true);
            onDuck.mockClear();

            manager.onMisfire();

            expect(manager.state).toBe(State.IDLE);
            expect(onCancelled).toHaveBeenCalledTimes(1);
            expect(onDuck).toHaveBeenCalledWith(false);
        });

        it("does nothing if IDLE on misfire", () => {
            const { manager, onCancelled } = createManager();
            manager.onMisfire();
            expect(onCancelled).not.toHaveBeenCalled();
        });

        it("does nothing if already CONFIRMED on misfire", () => {
            const { manager, onCancelled } = createManager();
            manager.onSpeechStart(true);
            sendFrames(manager, CONFIRM_FRAMES, CONFIRM_THRESHOLD + 0.1);

            manager.onMisfire();
            expect(onCancelled).not.toHaveBeenCalled();
        });
    });

    describe("reset", () => {
        it("returns to IDLE without firing callbacks", () => {
            const { manager, onDuck, onCancelled } = createManager();
            manager.onSpeechStart(true);
            onDuck.mockClear();

            manager.reset();

            expect(manager.state).toBe(State.IDLE);
            expect(manager.highFrameCount).toBe(0);
            expect(manager.lowFrameCount).toBe(0);
            expect(onDuck).not.toHaveBeenCalled();
            expect(onCancelled).not.toHaveBeenCalled();
        });
    });

    describe("full scenarios", () => {
        it("echo from speakers: PENDING → cancel → no disruption", () => {
            const { manager, onInterruptConfirmed, onCancelled, onDuck } = createManager();

            // AI is playing, echo triggers VAD
            const emitNow = manager.onSpeechStart(true);
            expect(emitNow).toBe(false);
            expect(onDuck).toHaveBeenCalledWith(true);

            // Echo frames are inconsistent/low
            sendFrames(manager, CANCEL_FRAMES, 0.1);

            expect(onCancelled).toHaveBeenCalledTimes(1);
            expect(onInterruptConfirmed).not.toHaveBeenCalled();
        });

        it("real user interrupt: PENDING → confirm → interrupt", () => {
            const { manager, onInterruptConfirmed, onDuck } = createManager();

            const emitNow = manager.onSpeechStart(true);
            expect(emitNow).toBe(false);

            // Real speech frames
            sendFrames(manager, CONFIRM_FRAMES, 0.8);

            expect(onInterruptConfirmed).toHaveBeenCalledTimes(1);
            expect(onDuck).toHaveBeenCalledWith(false);
        });

        it("short word 'stop': PENDING → speechEnd backstop → confirm", () => {
            const { manager, onInterruptConfirmed } = createManager();

            manager.onSpeechStart(true);
            // Only 3 high frames (not enough for auto-confirm of 7)
            sendFrames(manager, 3, 0.8);
            // Speech ends quickly
            manager.onSpeechEnd();

            expect(onInterruptConfirmed).toHaveBeenCalledTimes(1);
        });

        it("user speaks while AI idle: immediate passthrough", () => {
            const { manager, onDuck, onInterruptConfirmed } = createManager();

            const emitNow = manager.onSpeechStart(false);
            expect(emitNow).toBe(true);
            expect(onDuck).not.toHaveBeenCalled();
            expect(onInterruptConfirmed).not.toHaveBeenCalled();
        });

        it("multiple cycles work correctly", () => {
            const { manager, onInterruptConfirmed, onCancelled } = createManager();

            // First: echo (cancel)
            manager.onSpeechStart(true);
            sendFrames(manager, CANCEL_FRAMES, 0.1);
            expect(onCancelled).toHaveBeenCalledTimes(1);

            // Second: real speech (confirm)
            manager.onSpeechStart(true);
            sendFrames(manager, CONFIRM_FRAMES, 0.8);
            expect(onInterruptConfirmed).toHaveBeenCalledTimes(1);

            // Third: idle passthrough
            const result = manager.onSpeechStart(false);
            expect(result).toBe(true);
        });
    });
});
