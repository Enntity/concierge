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
            this.minBufferSize = payload.minBufferSize;
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

  writeData(float32Array, trackId = null) {
    try {
      let { buffer } = this.write;
      let offset = this.writeOffset;

      // Update trackId for current write buffer
      this.write.trackId = trackId;

      for (let i = 0; i < float32Array.length; i++) {
        buffer[offset++] = float32Array[i];
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

        // Store last sample for next crossfade
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
