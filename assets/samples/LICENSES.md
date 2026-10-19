# Sample pack licences and attribution

All audio in this directory is derived from permissively licensed sources. The files are
mono 44.1 kHz OGG Vorbis (q4), trimmed, faded and loudness-normalised to -20 LUFS
(ITU-R BS.1770-4) for the World Class Ear ear-training app. Nothing here is an unmodified
copy of a source file. `manifest.json` lists the source and licence per instrument.

## 1. VSCO-2 Community Edition (VSCO 2 CE) - CC0 1.0

Instruments: flute, oboe, clarinet, bassoon, horn, trumpet, trombone, tuba, violin, viola,
cello, contrabass, harp, piano (Upright Piano), organ (pipe organ, `Keys/Organ/Quiet`).

- Creators: Versilian Studios LLC / Sam Gossner (recording), Ivy Audio / Simon Dalzell
  (recording), sample cutting by Elan Hickler (Soundemote).
- Homepage: https://versilian-studios.com/vsco-community/
- Repository used: https://github.com/sgossner/VSCO-2-CE (branch `SFZ`, sample folders
  identical to `master`; the same content is mirrored at
  https://github.com/sfzinstruments/VSCO-2-CE). The files were fetched through the jsDelivr
  CDN mirror of that repository (`cdn.jsdelivr.net/gh/sgossner/VSCO-2-CE@SFZ/...`).
- Licence: the repository's `LICENSE` file is the full text of **CC0 1.0 Universal**
  (public domain dedication, https://creativecommons.org/publicdomain/zero/1.0/). The
  homepage states: "The library is under a Creative Commons 0 (i.e. public domain) license"
  and, for the raw WAV set, "Licensed under CC0 (Creative Commons Zero) you can do whatever
  you want with these samples."
- The `Readme.txt` in the repository additionally *asks* (not as a licence condition) that
  the samples are not sold directly and that credit is given to Versilian Studios / Sam
  Gossner and Ivy Audio / Simon Dalzell with a link to the VSCO CE homepage. We honour that
  request with this file.
- Modifications: one velocity layer ("mf", the layer containing velocity 80 in the sfz
  mapping) and one round-robin per pitch were selected; stereo to mono; leading/trailing
  silence trimmed; sustained notes cut to 6.0 s with a 0.25 s fade, short notes to 1.5 s;
  loudness-normalised; a lookahead limiter was applied to 7 percussive files whose peaks
  would otherwise exceed -1.5 dBTP at the target loudness; `harp/sus/101.ogg` (+30 cents)
  and the top three piano notes `piano/sus/101|105|108.ogg` (-30/-38/-60 cents, upright
  stretch tuning) were retuned to equal temperament by resampling. Pitches were taken from
  `pitch_keycenter` in the sfz files (VSCO file names use the C3 = MIDI 60 convention, one
  octave below the file names in this pack).

Suggested credit line: "Orchestral samples: VSCO 2 Community Edition by Versilian Studios
(Sam Gossner) and Ivy Audio (Simon Dalzell), CC0 - https://versilian-studios.com/vsco-community/"

## 2. FluidR3_GM SoundFont - MIT, rendered to MP3 by midi-js-soundfonts - CC BY 3.0

Instruments: choir (GM 53 "Choir Aahs"), strings_ens (GM 49 "String Ensemble 1").

- SoundFont: FluidR3_GM.sf2 by Frank Wen, Copyright (c) 2000-2002, 2008 Frank Wen.
  Licence: **MIT**. The upstream README states "I hereby release Fluid under the MIT
  license, as described in COPYING" (quoted in the Debian `fluid-soundfont` copyright file,
  https://sources.debian.org/data/main/f/fluid-soundfont/3.1-5.3/debian/copyright, which also
  reproduces the MIT licence text and the contributor list).
- Per-note MP3 renders: https://github.com/gleitz/midi-js-soundfonts by Benjamin Gleitzman
  (fetched from https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/<name>-mp3.js). The
  project README states for the Fluid soundfont: "Released under Creative Commons
  Attribution 3.0 license" (https://creativecommons.org/licenses/by/3.0/us/). The project
  has no separate LICENSE file; we treat the renders as **CC BY 3.0 US** and credit the
  renderer.
- Modifications: base64 MP3 decoded; stereo to mono; silence trimmed; 0.25 s fade applied
  at the hard end of each render (about 3.1 s); loudness-normalised. The choir preset is
  tuned 10-45 cents flat/sharp depending on the zone in the source render; every choir note
  was retuned by its measured offset (see `tune_corrections.json` in the build scripts) so
  that the pitch centre of the detuned chorus sits on the nominal pitch. The string ensemble
  was within +-10 cents and was left as rendered.

MIT licence text for FluidR3_GM:

    Permission is hereby granted, free of charge, to any person obtaining a copy of this
    software and associated documentation files (the "Software"), to deal in the Software
    without restriction, including without limitation the rights to use, copy, modify,
    merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to the following
    conditions:

    The above copyright notice and this permission notice shall be included in all copies
    or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
    INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
    PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
    CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR
    THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Suggested credit line: "Choir and string ensemble: FluidR3_GM SoundFont by Frank Wen
(MIT), pre-rendered by Benjamin Gleitzman / midi-js-soundfonts (CC BY 3.0)."

## 3. Not used

- Salamander Grand Piano (CC BY 3.0) was not needed because VSCO-2 CE contains a CC0
  upright piano.
- FluidR3 `acoustic_grand_piano` and `church_organ` were downloaded but not included (the
  organ comes from VSCO-2 CE instead).

## Summary

| Source | Licence | Attribution required |
|---|---|---|
| VSCO-2 CE (Versilian Studios) | CC0 1.0 | No (credit requested and given) |
| FluidR3_GM.sf2 (Frank Wen) | MIT | Yes (keep copyright + permission notice) |
| midi-js-soundfonts renders (B. Gleitzman) | CC BY 3.0 US | Yes |
