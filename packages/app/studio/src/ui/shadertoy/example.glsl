/*
 * midiNote(int pitch) - returns normalized velocity or 0. if off. Pitch: 60 = C4
 * midiCC(int cc)      - returns normalized CC value
 * iBeat               - returns normalized beat position (ppqn / PPQN.Quaver)
 * iPeaks              - returns vec4(leftPeak, rightPeak, leftRMS, rightRMS)
 */
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    float aspect = iResolution.x / iResolution.y;
    vec3 col = vec3(0.0);
    vec3 green = vec3(0.3, 0.7, 0.4);
    vec3 blue = vec3(0.5, 0.5, 0.7);
    vec3 gray = vec3(0.2);

    float wave = texture(iChannel0, vec2(uv.x, 0.75)).r * 2.0 - 1.0;
    float waveY = 0.5 + wave * 0.4;
    if (abs(uv.y - waveY) < 0.001) col = blue * 0.5;

    // Dots
    float beat = mod(floor(iBeat * 4.0), 16.0);
    for (int i = 0; i < 16; i++) {
        vec2 center = vec2(0.1 + float(i) * 0.05, 0.08);
        vec2 d = uv - center;
        d.x *= aspect;
        if (length(d) < 0.015) {
            int ci = int(mod(float(i), 4.0));
            vec3 dotCol = ci == 0 ? vec3(0.46, 0.72, 1.0) : gray;
            col = (float(i) == beat) ? vec3(1.0) : dotCol;
        }
    }

    // Peak/RMS
    float h = uv.y - 0.2;
    if (h > 0.0 && h < 0.9) {
        float n = h / 0.5;
        float x = uv.x - 0.5;
        if (x < -0.01 && x > -0.03) col = n < iPeaks.z ? green : n < iPeaks.x ? gray : col;
        if (x > 0.01 && x < 0.03) col = n < iPeaks.w ? green : n < iPeaks.y ? gray : col;
    }

    fragColor = vec4(col, 1.0);
}