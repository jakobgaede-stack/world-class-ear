# Bach chorale data pack: source and license

## What this is

`r001.json` … `r371.json` (351 files) and `index.json` are a derived dataset: a compact JSON
rendering (pitches, offsets, durations, ties, fermatas, measure map, phrase boundaries) of
the four-part chorales by Johann Sebastian Bach in the 371-chorale Riemenschneider
numbering. The files were generated with the music21 toolkit from the encodings that ship
in the music21 corpus; no notation was created or edited by hand.

## The music

The chorale harmonisations themselves (J. S. Bach, 1685–1750, as collected by
C. P. E. Bach / Kirnberger and numbered in the Riemenschneider edition of 1941) are in the
public domain.

## The encodings

* **MusicXML files `bach/bwv*.mxl`** (348 of the exported chorales): the music21 corpus
  copies of the encodings compiled by Margaret Greentree (formerly jsbchorales.net),
  distributed with music21 with the encoders' permission.
* **Humdrum/kern files `bach/bwv277.krn`, `bach/bwv281.krn`, `bach/bwv366.krn`**
  (exported as r015, r006, r161, flagged `kernSource` in `index.json`): encodings
  © 1994 Center for Computer Assisted Research in the Humanities (CCARH), converted from
  MuseData. Their headers state "Rights to all derivative electronic formats reserved.
  Refer to licensing agreement for further details." If that restriction matters for your
  use, drop those three files; the `kernSource` flag identifies them.

music21's corpus license (`music21/corpus/license.txt`) states that the encodings are
distributed with permission of the encoders and "may be under copyright but have been
licensed for use, though there may be restrictions on commercial use", and that some
encodings "may not be used for commercial uses or have other restrictions".

## Terms for this dataset

* This JSON dataset is a non-commercial derived work intended for use in a free
  ear-training application. It is not licensed for commercial use.
* Attribution: "Chorale data derived from the music21 corpus (Margaret Greentree
  encodings; three chorales from CCARH kern files), © the respective encoders."
* The music21 software itself is BSD-licensed (Michael Scott Asato Cuthbert and
  the music21 contributors); it is not redistributed here.

## Provenance details

* Generated with music21 10.5.0 on 2026-10-19 by
  `wce-build/scripts/export_chorales.py` (corpus iterator
  `music21.corpus.chorales.Iterator(numberingSystem='riemenschneider')`,
  titles and BWV numbers from `music21.corpus.chorales.ChoraleListRKBWV`).
* Each file's `source` field names the corpus file it was derived from.
* 20 Riemenschneider numbers are not exported because the corpus file has instrumental
  parts in addition to SATB (19) or five vocal voices (1); they are listed with reasons
  under `excluded` in `index.json`.
* 20 exported files are duplicates of another Riemenschneider number (the music21
  mapping points two or three numbers at the same corpus file); these carry
  `duplicateOf` and the `duplicateOf:rNNN` flag.
