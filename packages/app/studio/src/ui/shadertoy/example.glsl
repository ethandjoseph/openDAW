/*
 * Methods to read MIDI
 * midiNote(int pitch) - returns velocity (0.0-1.0) or 0.0 if off. Pitch: 60 = C4
 * midiCC(int cc)      - returns CC value (0.0-1.0). CC: 1 = mod, 74 = filter
 */
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    // Time varying pixel color
    vec3 col = 0.5 + 0.5*cos(iTime+uv.xyx+vec3(0, 2, 4));

    // Output to screen
    fragColor = vec4(col, 1.0);
}