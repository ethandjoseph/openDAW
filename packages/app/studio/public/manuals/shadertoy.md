# Shadertoy Visualizer

Create real-time visuals for your music using GLSL shaders. The editor supports Shadertoy-compatible syntax, so you can learn from their community and adapt techniques to your own creations.

---

## 0. Overview

The Shadertoy panel lets you write fragment shaders that respond to audio and MIDI data from your project. Audio spectrum and waveform data arrive via `iChannel0`, and MIDI data is available through helper functions.

To send MIDI to the visualizer, create a MIDI Output and select **Shadertoy** as the destination device.

---

## 1. Supported Uniforms

| Uniform | Type | Description |
|---------|------|-------------|
| `iResolution` | `vec3` | Viewport size (width, height, 1.0) |
| `iTime` | `float` | Elapsed time in seconds |
| `iTimeDelta` | `float` | Time since last frame |
| `iFrame` | `int` | Frame counter |
| `iBeat` | `float` | Beat position (quarter notes) |
| `iPeaks` | `vec4` | Stereo levels (leftPeak, leftRMS, rightPeak, rightRMS) |
| `iChannel0` | `sampler2D` | Audio texture (512×2) |
| `iChannelResolution` | `vec3[1]` | Audio texture size (512, 2, 1) |

---

## 2. Audio Data

Audio data is stored in `iChannel0` as a 512×2 texture:

```glsl
// Spectrum (row 0) - logarithmic 20Hz to 18kHz
float spectrum = texture(iChannel0, vec2(uv.x, 0.25)).r;

// Waveform (row 1) - signed audio, map to -1..1
float wave = texture(iChannel0, vec2(uv.x, 0.75)).r * 2.0 - 1.0;
```

---

## 3. MIDI Functions

```glsl
// Returns velocity (0.0-1.0) if note is on, 0.0 if off
// Pitch: 60 = C4 (Middle C)
float midiNote(int pitch);

// Returns CC value (0.0-1.0)
// Common CCs: 1 = mod wheel, 74 = filter cutoff
float midiCC(int cc);
```

**Example:**
```glsl
float kick = midiNote(36);      // C1
float modWheel = midiCC(1);
float brightness = midiCC(74);
```

---

## 4. Not Supported

The following Shadertoy features are **not available**:

- `iMouse` — Mouse input
- `iDate` — Date/time
- `iSampleRate` — Sample rate
- `iChannelTime` — Channel playback time
- `iChannel1..3` — Additional texture channels
- **Multi-pass buffers** (Buffer A/B/C/D)
- **Cubemap / 3D textures**

---

## 5. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+Enter` | Compile and run |
| `Ctrl+S` / `Cmd+S` | Save to project |

---

## 6. Example

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Spectrum glow
    float spectrum = texture(iChannel0, vec2(uv.x, 0.25)).r;
    vec3 col = vec3(0.2, 0.5, 1.0) * spectrum;
    
    // Pulse on beat
    float pulse = exp(-fract(iBeat) * 4.0);
    col += pulse * 0.2;
    
    // React to MIDI note
    float vel = midiNote(60);
    col = mix(col, vec3(1.0, 0.3, 0.5), vel);
    
    fragColor = vec4(col, 1.0);
}
```