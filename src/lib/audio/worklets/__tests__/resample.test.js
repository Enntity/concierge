/**
 * Test for StreamProcessor resampler phase continuity.
 *
 * Strategy: a single-pass resampler (no chunking) is the ground-truth reference.
 * The NEW (fixed) chunked resampler must produce bit-identical output.
 * The OLD (broken) chunked resampler will diverge because it re-processes
 * samples at every chunk boundary.
 */

// ── helpers ──────────────────────────────────────────────────────────

function makeSine(freq, sampleRate, numSamples, amplitude = 0.8) {
    const out = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        out[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
    }
    return out;
}

function chunkArray(arr, size) {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
    }
    return chunks;
}

function concat(arrays) {
    const totalLen = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Float32Array(totalLen);
    let off = 0;
    for (const a of arrays) {
        out.set(a, off);
        off += a.length;
    }
    return out;
}

/** Simple power-spectrum via DFT (magnitude squared, no window) */
function powerSpectrum(samples) {
    const N = samples.length;
    const halfN = Math.floor(N / 2);
    const mag = new Float64Array(halfN);
    for (let k = 0; k < halfN; k++) {
        let re = 0,
            im = 0;
        for (let n = 0; n < N; n++) {
            const angle = (2 * Math.PI * k * n) / N;
            re += samples[n] * Math.cos(angle);
            im -= samples[n] * Math.sin(angle);
        }
        mag[k] = (re * re + im * im) / (N * N);
    }
    return mag;
}

function lerp(buffer, pos) {
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s1 = buffer[idx] || 0;
    const s2 = buffer[idx + 1] || s1;
    return s1 + (s2 - s1) * frac;
}

// ── OLD resampler (no phase tracking – the bug) ─────────────────────

class OldResampler {
    constructor(ratio) {
        this.resampleRatio = ratio;
        this.resampleBuffer = [];
    }
    resample(inputSamples) {
        for (let i = 0; i < inputSamples.length; i++)
            this.resampleBuffer.push(inputSamples[i]);
        const outputLength = Math.floor(
            (this.resampleBuffer.length - 1) * this.resampleRatio,
        );
        if (outputLength <= 0) return new Float32Array(0);
        const output = new Float32Array(outputLength);
        const step = 1 / this.resampleRatio;
        for (let i = 0; i < outputLength; i++) {
            output[i] = lerp(this.resampleBuffer, i * step);
        }
        const samplesUsed =
            Math.floor((outputLength - 1) / this.resampleRatio) + 1;
        this.resampleBuffer = this.resampleBuffer.slice(
            Math.max(0, samplesUsed - 1),
        );
        return output;
    }
}

// ── NEW resampler (with phase tracking – the fix) ────────────────────

class NewResampler {
    constructor(ratio) {
        this.resampleRatio = ratio;
        this.resampleBuffer = [];
        this.resamplePhase = 0;
    }
    resample(inputSamples) {
        for (let i = 0; i < inputSamples.length; i++)
            this.resampleBuffer.push(inputSamples[i]);
        const step = 1 / this.resampleRatio;
        const maxPos = this.resampleBuffer.length - 1;
        const outputLength = Math.floor((maxPos - this.resamplePhase) / step);
        if (outputLength <= 0) return new Float32Array(0);
        const output = new Float32Array(outputLength);
        let pos = this.resamplePhase;
        for (let i = 0; i < outputLength; i++) {
            output[i] = lerp(this.resampleBuffer, pos);
            pos += step;
        }
        const nextPos = this.resamplePhase + outputLength * step;
        const consumed = Math.floor(nextPos);
        this.resampleBuffer = this.resampleBuffer.slice(consumed);
        this.resamplePhase = nextPos - consumed;
        return output;
    }
}

// ── reference: single-pass resampler (whole signal, no chunking) ─────

class ReferenceResampler {
    constructor(ratio) {
        this.resampleRatio = ratio;
    }
    resample(allSamples) {
        const outputLength = Math.floor(
            (allSamples.length - 1) * this.resampleRatio,
        );
        const output = new Float32Array(outputLength);
        const step = 1 / this.resampleRatio;
        for (let i = 0; i < outputLength; i++) {
            output[i] = lerp(allSamples, i * step);
        }
        return output;
    }
}

// ── tests ────────────────────────────────────────────────────────────

const INPUT_SR = 24000;
const OUTPUT_SR = 48000;
const RATIO = OUTPUT_SR / INPUT_SR; // 2
const CHUNK_SIZE = 2560; // typical ElevenLabs chunk
const DURATION_S = 0.5;
const TOTAL_SAMPLES = INPUT_SR * DURATION_S; // 12000
const SINE_FREQ = 440;

function processChunked(resampler, input, chunkSize) {
    const chunks = chunkArray(input, chunkSize);
    return concat(chunks.map((c) => resampler.resample(c)));
}

describe("StreamProcessor resampler", () => {
    const input = makeSine(SINE_FREQ, INPUT_SR, TOTAL_SAMPLES);

    test("NEW chunked output matches single-pass reference (bit-identical)", () => {
        const ref = new ReferenceResampler(RATIO);
        const refOut = ref.resample(input);

        const fixed = new NewResampler(RATIO);
        const fixedOut = processChunked(fixed, input, CHUNK_SIZE);

        expect(fixedOut.length).toBe(refOut.length);

        let maxErr = 0;
        for (let i = 0; i < refOut.length; i++) {
            const err = Math.abs(fixedOut[i] - refOut[i]);
            if (err > maxErr) maxErr = err;
        }
        console.log(
            `  NEW vs reference — length: ${fixedOut.length}/${refOut.length}, max error: ${maxErr.toExponential(3)}`,
        );
        expect(maxErr).toBe(0);
    });

    test("OLD chunked output diverges from single-pass reference", () => {
        const ref = new ReferenceResampler(RATIO);
        const refOut = ref.resample(input);

        const old = new OldResampler(RATIO);
        const oldOut = processChunked(old, input, CHUNK_SIZE);

        console.log(
            `  OLD output length: ${oldOut.length}, reference: ${refOut.length}, excess: ${oldOut.length - refOut.length}`,
        );
        expect(oldOut.length).toBeGreaterThan(refOut.length);

        const minLen = Math.min(oldOut.length, refOut.length);
        let maxErr = 0;
        for (let i = 0; i < minLen; i++) {
            const err = Math.abs(oldOut[i] - refOut[i]);
            if (err > maxErr) maxErr = err;
        }
        console.log(
            `  OLD vs reference max sample error: ${maxErr.toFixed(4)}`,
        );
        expect(maxErr).toBeGreaterThan(0.001);
    });

    test("OLD resampler produces excess samples (evidence of duplication)", () => {
        const old = new OldResampler(RATIO);
        const oldOut = processChunked(old, input, CHUNK_SIZE);

        const numChunks = Math.ceil(TOTAL_SAMPLES / CHUNK_SIZE);
        const expectedLength = Math.floor((TOTAL_SAMPLES - 1) * RATIO);

        const excess = oldOut.length - expectedLength;
        console.log(
            `  OLD excess samples: ${excess} across ${numChunks} chunks (≈${(excess / (numChunks - 1)).toFixed(1)} per boundary)`,
        );
        expect(excess).toBeGreaterThan(0);
    });

    test("NEW resampler produces correct sample count", () => {
        const fixed = new NewResampler(RATIO);
        const fixedOut = processChunked(fixed, input, CHUNK_SIZE);

        const expectedLength = Math.floor((TOTAL_SAMPLES - 1) * RATIO);
        console.log(
            `  NEW output length: ${fixedOut.length}, expected: ${expectedLength}`,
        );
        expect(fixedOut.length).toBe(expectedLength);
    });

    test("NEW resampler works across different chunk sizes", () => {
        for (const cs of [128, 256, 1000, 2560, 4800]) {
            const ref = new ReferenceResampler(RATIO);
            const refOut = ref.resample(input);

            const fixed = new NewResampler(RATIO);
            const fixedOut = processChunked(fixed, input, cs);

            let maxErr = 0;
            for (let i = 0; i < refOut.length; i++) {
                const err = Math.abs(fixedOut[i] - refOut[i]);
                if (err > maxErr) maxErr = err;
            }
            console.log(
                `  chunk=${cs}: length ${fixedOut.length}/${refOut.length}, max err ${maxErr.toExponential(2)}`,
            );
            expect(fixedOut.length).toBe(refOut.length);
            expect(maxErr).toBe(0);
        }
    });

    test("spectral artifact power: NEW is lower than OLD", () => {
        const longInput = makeSine(SINE_FREQ, INPUT_SR, INPUT_SR); // 1s
        const smallChunk = 256;

        const old = new OldResampler(RATIO);
        const oldOut = processChunked(old, longInput, smallChunk);

        const fixed = new NewResampler(RATIO);
        const fixedOut = processChunked(fixed, longInput, smallChunk);

        const N = 2048;
        const start =
            Math.floor(Math.min(oldOut.length, fixedOut.length) / 2) - N / 2;
        const oldSpec = powerSpectrum(oldOut.slice(start, start + N));
        const fixedSpec = powerSpectrum(fixedOut.slice(start, start + N));

        const binFreq = OUTPUT_SR / N;
        const fundBin = Math.round(SINE_FREQ / binFreq);

        let oldArtifact = 0,
            fixedArtifact = 0;
        for (let k = 1; k < oldSpec.length; k++) {
            if (Math.abs(k - fundBin) <= 2) continue;
            oldArtifact += oldSpec[k];
            fixedArtifact += fixedSpec[k];
        }

        const oldDb = 10 * Math.log10(oldArtifact + 1e-20);
        const fixedDb = 10 * Math.log10(fixedArtifact + 1e-20);
        console.log(
            `  Artifact power (256-sample chunks) — OLD: ${oldDb.toFixed(1)} dB, NEW: ${fixedDb.toFixed(1)} dB (Δ${(oldDb - fixedDb).toFixed(1)} dB)`,
        );
        expect(fixedArtifact).toBeLessThan(oldArtifact);
    });

    test("phase is preserved across odd-sized chunks", () => {
        const ref = new ReferenceResampler(RATIO);
        const refOut = ref.resample(input);

        const fixed = new NewResampler(RATIO);
        const fixedOut = processChunked(fixed, input, 333);

        expect(fixedOut.length).toBe(refOut.length);
        let maxErr = 0;
        for (let i = 0; i < refOut.length; i++) {
            const err = Math.abs(fixedOut[i] - refOut[i]);
            if (err > maxErr) maxErr = err;
        }
        console.log(`  Odd chunk (333): max err ${maxErr.toExponential(2)}`);
        expect(maxErr).toBe(0);
    });

    test("non-integer ratios (e.g. 44100→48000) also work correctly", () => {
        const oddRatio = 48000 / 44100; // ~1.0884
        const oddInput = makeSine(440, 44100, 44100); // 1 second

        const ref = new ReferenceResampler(oddRatio);
        const refOut = ref.resample(oddInput);

        const fixed = new NewResampler(oddRatio);
        const fixedOut = processChunked(fixed, oddInput, 1024);

        let maxErr = 0;
        const minLen = Math.min(fixedOut.length, refOut.length);
        for (let i = 0; i < minLen; i++) {
            const err = Math.abs(fixedOut[i] - refOut[i]);
            if (err > maxErr) maxErr = err;
        }
        console.log(
            `  Non-integer ratio (${oddRatio.toFixed(4)}): length ${fixedOut.length}/${refOut.length}, max err ${maxErr.toExponential(2)}`,
        );
        expect(fixedOut.length).toBe(refOut.length);
        // Non-integer ratios accumulate float rounding (~1e-8); ensure it's negligible
        expect(maxErr).toBeLessThan(1e-6);
    });
});
