export const StreamProcessorWorklet = `
class StreamProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hasStarted = false;
    this.hasInterrupted = false;
    this.outputBuffers = [];
    this.bufferLength = 128;
    this.minBufferSize = 5; // Increased for smoother startup
    this.write = { buffer: new Float32Array(this.bufferLength), trackId: null };
    this.writeOffset = 0;
    this.trackSampleOffsets = {};
    this.lastErrorTime = 0;
    this.errorCount = 0;
    this.noBufferCount = 0;
    this.maxNoBufferFrames = 100;
    this.lastUnderrunLog = 0;
    // Crossfade support - keep last sample for smoothing
    this.lastSample = 0;
    this.crossfadeLength = 4; // Samples to crossfade at boundaries
    // Headroom and limiting to prevent clipping
    this.headroom = 0.92; // Reduce gain slightly to prevent clipping
    this.softClipThreshold = 0.95; // Start soft clipping above this

    // Resampling support
    this.resampleRatio = 1; // Will be set via config (e.g., 2 for 24kHz->48kHz)
    this.inputSampleRate = 24000;
    this.outputSampleRate = 48000;
    this.resampleBuffer = []; // Buffer for input samples to resample
    this.resamplePhase = 0; // Fractional position between input samples

    this.port.onmessage = (event) => {
      try {
        if (event.data) {
          const payload = event.data;
          if (payload.event === 'write') {
            const int16Array = payload.buffer;
            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
              float32Array[i] = int16Array[i] / 0x8000;
            }
            this.writeData(float32Array, payload.trackId);
          } else if (payload.event === 'config') {
            this.minBufferSize = payload.minBufferSize || this.minBufferSize;
            if (payload.resampleRatio) {
              this.resampleRatio = payload.resampleRatio;
              this.inputSampleRate = payload.inputSampleRate;
              this.outputSampleRate = payload.outputSampleRate;
            }
          } else if (payload.event === 'flush') {
            this.flushBuffer(payload.trackId);
          } else if (
            payload.event === 'offset' ||
            payload.event === 'interrupt'
          ) {
            const requestId = payload.requestId;
            const trackId = this.write.trackId;
            const offset = this.trackSampleOffsets[trackId] || 0;
            this.port.postMessage({
              event: 'offset',
              requestId,
              trackId,
              offset,
            });
            if (payload.event === 'interrupt') {
              this.hasInterrupted = true;
            }
          } else {
            throw new Error(\`Unhandled event "\${payload.event}"\`);
          }
        }
      } catch (error) {
        this.handleError(error);
      }
    };
  }

  // Soft clipping function - attempt to tame hot signals gracefully without harsh clipping
  softClip(sample) {
    // Apply headroom reduction
    sample *= this.headroom;

    // Soft clip using tanh-like curve for samples approaching limits
    if (sample > this.softClipThreshold) {
      const excess = sample - this.softClipThreshold;
      const range = 1.0 - this.softClipThreshold;
      sample = this.softClipThreshold + range * Math.tanh(excess / range);
    } else if (sample < -this.softClipThreshold) {
      const excess = -sample - this.softClipThreshold;
      const range = 1.0 - this.softClipThreshold;
      sample = -(this.softClipThreshold + range * Math.tanh(excess / range));
    }

    // Hard clamp as final safety (should rarely hit after soft clip)
    return Math.max(-1.0, Math.min(1.0, sample));
  }

  handleError(error) {
    const now = currentTime;
    if (now - this.lastErrorTime > 5) {
      // Reset error count if more than 5 seconds have passed
      this.errorCount = 0;
    }
    this.lastErrorTime = now;
    this.errorCount++;

    if (this.errorCount <= 3) {
      this.port.postMessage({
        event: 'error',
        error: error.message || 'Unknown error in stream processor'
      });
    }
  }

  // Low-pass filter state for anti-aliasing after interpolation
  // Simple 2-pole IIR filter tuned to cut frequencies above ~10kHz at 48kHz output
  initLowPass() {
    // Coefficients for ~10kHz cutoff at 48kHz (gentle roll-off to preserve clarity)
    this.lpA1 = -1.3072850288;
    this.lpA2 = 0.4918245861;
    this.lpB0 = 0.0461348893;
    this.lpB1 = 0.0922697786;
    this.lpB2 = 0.0461348893;
    this.lpX1 = 0; this.lpX2 = 0; // Input history
    this.lpY1 = 0; this.lpY2 = 0; // Output history
  }

  lowPass(sample) {
    if (this.lpB0 === undefined) this.initLowPass();

    const output = this.lpB0 * sample + this.lpB1 * this.lpX1 + this.lpB2 * this.lpX2
                   - this.lpA1 * this.lpY1 - this.lpA2 * this.lpY2;

    this.lpX2 = this.lpX1; this.lpX1 = sample;
    this.lpY2 = this.lpY1; this.lpY1 = output;

    return output;
  }

  // Linear interpolation resampling with low-pass anti-aliasing filter
  resample(inputSamples) {
    if (this.resampleRatio === 1) {
      return inputSamples; // No resampling needed
    }

    // Add new samples to resample buffer
    for (let i = 0; i < inputSamples.length; i++) {
      this.resampleBuffer.push(inputSamples[i]);
    }

    // Calculate how many output samples we can produce
    const outputLength = Math.floor((this.resampleBuffer.length - 1) * this.resampleRatio);
    if (outputLength <= 0) {
      return new Float32Array(0);
    }

    const output = new Float32Array(outputLength);
    const step = 1 / this.resampleRatio; // Step through input for each output sample

    for (let i = 0; i < outputLength; i++) {
      const inputPos = i * step;
      const inputIndex = Math.floor(inputPos);
      const frac = inputPos - inputIndex;

      // Linear interpolation between adjacent samples
      const sample1 = this.resampleBuffer[inputIndex] || 0;
      const sample2 = this.resampleBuffer[inputIndex + 1] || sample1;
      const interpolated = sample1 + (sample2 - sample1) * frac;

      // Apply low-pass filter to remove aliasing artifacts
      output[i] = this.lowPass(interpolated);
    }

    // Keep last sample for continuity with next chunk
    const samplesUsed = Math.floor((outputLength - 1) / this.resampleRatio) + 1;
    this.resampleBuffer = this.resampleBuffer.slice(Math.max(0, samplesUsed - 1));

    return output;
  }

  writeData(float32Array, trackId = null) {
    try {
      // Resample input to output sample rate
      const resampled = this.resample(float32Array);

      let { buffer } = this.write;
      let offset = this.writeOffset;

      // Update trackId for current write buffer
      this.write.trackId = trackId;

      for (let i = 0; i < resampled.length; i++) {
        buffer[offset++] = resampled[i];
        if (offset >= buffer.length) {
          this.outputBuffers.push(this.write);
          this.write = { buffer: new Float32Array(this.bufferLength), trackId };
          buffer = this.write.buffer;
          offset = 0;
        }
      }

      // Keep partial buffer for next write - DON'T push it with zeros
      // This prevents discontinuities at chunk boundaries
      this.writeOffset = offset;

      this.noBufferCount = 0;
      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  // Flush any remaining partial buffer (call at end of track)
  flushBuffer(trackId = null) {
    try {
      // Clear resample buffer and filter state
      this.resampleBuffer = [];
      this.lpX1 = 0; this.lpX2 = 0;
      this.lpY1 = 0; this.lpY2 = 0;

      if (this.writeOffset > 0) {
        // Apply a quick fade-out to the partial buffer to avoid clicks
        const { buffer } = this.write;
        const fadeLength = Math.min(this.writeOffset, 32);
        const fadeStart = this.writeOffset - fadeLength;
        for (let i = 0; i < fadeLength; i++) {
          const fadeMultiplier = 1 - (i / fadeLength);
          buffer[fadeStart + i] *= fadeMultiplier;
        }
        // Zero-pad the rest
        for (let i = this.writeOffset; i < buffer.length; i++) {
          buffer[i] = 0;
        }
        this.outputBuffers.push({ buffer: buffer, trackId: trackId || this.write.trackId });
        this.write = { buffer: new Float32Array(this.bufferLength), trackId: null };
        this.writeOffset = 0;
      }
      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }

  process(inputs, outputs, parameters) {
    try {
      const output = outputs[0];
      const outputChannelData = output[0];
      const outputBuffers = this.outputBuffers;

      if (this.hasInterrupted) {
        this.lastSample = 0; // Reset crossfade state
        this.port.postMessage({ event: 'stop' });
        return false;
      } else if (!this.hasStarted && outputBuffers.length < this.minBufferSize) {
        // Wait for more buffers before starting
        outputChannelData.fill(0);
        return true;
      } else if (outputBuffers.length > 0) {
        this.hasStarted = true;
        this.noBufferCount = 0;
        this.lastUnderrunLog = 0;

        const { buffer, trackId } = outputBuffers.shift();

        // Apply crossfade at the start to smooth transition from previous buffer
        for (let i = 0; i < this.crossfadeLength && i < buffer.length; i++) {
          const t = i / this.crossfadeLength;
          buffer[i] = this.lastSample * (1 - t) + buffer[i] * t;
        }

        // Apply soft clipping and headroom to prevent distortion
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = this.softClip(buffer[i]);
        }

        // Store last sample for next crossfade (after clipping)
        this.lastSample = buffer[buffer.length - 1];

        outputChannelData.set(buffer);

        if (trackId) {
          this.trackSampleOffsets[trackId] =
            this.trackSampleOffsets[trackId] || 0;
          this.trackSampleOffsets[trackId] += buffer.length;

          // If this was the last buffer for this track, notify completion
          if (outputBuffers.length === 0 || outputBuffers[0].trackId !== trackId) {
            this.port.postMessage({
              event: 'track_complete',
              trackId,
              finalOffset: this.trackSampleOffsets[trackId]
            });
          }
        }
        return true;
      } else if (this.hasStarted) {
        this.noBufferCount++;

        if (this.noBufferCount >= 5 && currentTime - this.lastUnderrunLog > 1) {
          this.port.postMessage({
            event: 'underrun',
            count: this.noBufferCount,
            bufferSize: this.outputBuffers.length,
            maxBuffers: this.maxNoBufferFrames
          });
          this.lastUnderrunLog = currentTime;
        }

        if (this.noBufferCount >= this.maxNoBufferFrames) {
          this.lastSample = 0; // Reset crossfade state
          this.port.postMessage({
            event: 'stop',
            reason: 'max_underruns_reached',
            finalCount: this.noBufferCount
          });
          return false;
        }
        // Fade out to silence to avoid clicks during underrun
        if (this.lastSample !== 0) {
          const fadeOut = Math.max(0, 1 - (this.noBufferCount / 10));
          outputChannelData.fill(this.lastSample * fadeOut);
          if (fadeOut === 0) this.lastSample = 0;
        } else {
          outputChannelData.fill(0);
        }
      }
      return true;
    } catch (error) {
      this.handleError(error);
      return true;
    }
  }
}

registerProcessor('stream_processor', StreamProcessor);
`;

const script = new Blob([StreamProcessorWorklet], {
  type: 'application/javascript',
});
const src = URL.createObjectURL(script);
export const StreamProcessorSrc = src;
