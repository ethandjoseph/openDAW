# openDAW Audio-Playback Implementation

## TimeBase

| TimeBase | Description                                                                                                                            |
|----------|----------------------------------------------------------------------------------------------------------------------------------------|
| Seconds  | Absolute time. Duration, loopDuration, and loopOffset are in seconds. Audio plays at fixed rate regardless of tempo.                   |
| Musical  | Relative to tempo. Duration, loopDuration, and loopOffset are in PPQN (pulses per quarter note). Audio playback follows tempo changes. |

When switching AudioPlayback mode, the `AudioRegionBoxAdapter` converts duration, loopDuration, and loopOffset by
looking at the current tempo-map and updates TimeBase accordingly.

### TODO

* ~~`AudioClipBoxAdapter` needs the same conversion logic~~
* ~~Check and fix all tools including cutting~~
* ~~Fix No Warp waveform rendering in track~~
* ~~Move transient detection into worker~~
* Does PitchVoice work without warp-markers? (When switching from timestretch to pitch, we get glitches, good on the
  next repeat)
* When Pitch is without warping, the editor cannot create warp-markers
* Transients might be better off in a ByteArray after all
* ~~Create warping when changing a clip to timestretch mode~~
* ~~When switching to no-sync, ask the user to delete the warping information.~~
* Idea to handle the shared nature of the warping information
* Move AudioAdapterEditing to SDK

## Playback Modes

| TimeBase | AudioPlayback | Warp Markers | Transient Markers | Voice                                   | Notes                                                   |
|----------|---------------|--------------|-------------------|-----------------------------------------|---------------------------------------------------------|
| Seconds  | NoSync        | Ignored      | Ignored           | PitchVoice                              | Fixed rate 1.0, no sync                                 |
| Seconds  | Pitch         | N/A          | N/A               | N/A                                     |                                                         |
| Seconds  | Timestretch   | N/A          | N/A               | N/A                                     |                                                         |
| Musical  | NoSync        | N/A          | N/A               | N/A                                     |                                                         |
| Musical  | Pitch         | Optional     | Ignored           | PitchVoice                              | Rate changes with tempo, warp markers adjust local rate |
| Musical  | Timestretch   | Required     | Required          | OnceVoice / RepeatVoice / PingpongVoice | Transient-based stretching                              |

## Voice Overview

| Voice         | Playback Rate | Looping                          | Use Case                                      |
|---------------|---------------|----------------------------------|-----------------------------------------------|
| PitchVoice    | Dynamic       | No                               | NoSync, Pitch mode                            |
| OnceVoice     | Fixed 1.0     | No                               | Timestretch, short segments or matching tempo |
| RepeatVoice   | Fixed 1.0     | Yes, forward jump with crossfade | Timestretch, slowing down                     |
| PingpongVoice | Fixed 1.0     | Yes, reverses direction          | Timestretch, slowing down, alternate mode     |