# Orchestral literature data pack: sources and licences

## What this is

`<workId>-<movement>-<nn>.json` and `index.json` are a derived dataset: short excerpts (4 to 12 measures)
of symphonic movements rendered as compact JSON (sounding MIDI pitches, offsets and durations in quarter
notes, ties, dynamics, measure map, key/tempo information), with every part reduced to a monophonic line
(chords and divisi are split into additional parts). The files were generated with music21 (version
noted in `build-report.json`) by `wce-build/scripts/orchestra/build_pack.py`; no notation was created or
edited by hand. Each excerpt names its source file in its `source` field and its licence in `license`.

The compositions themselves (Haydn, Mozart, Beethoven, Dvořák) are in the public domain. The
encodings are not: they are covered by the two licences below, which differ considerably.

---

## 1. Haydn, Symphonies Nos. 99–104

> **Not included in this repository.** Because the CCARH encodings are distributed under licence only,
> the derived Haydn excerpt files are *not* published here. The app loads them privately from the
> owner's sync server (Cloudflare Worker, key-protected) for the owner's own study. Only `index.json`
> lists them (flag `restricted: true`), so the public data pack contains the MIT-licensed works only.

 (`haydn-99` … `haydn-104`)

* Repository: <https://github.com/musedata/humdrum-haydn-symphonies>, files `kern/sym099a.krn` …
  `kern/sym104d.krn` (branch `master`, fetched 2026-11-03 via the jsDelivr mirror).
* Encoding: Center for Computer Assisted Research in the Humanities (CCARH), Stanford. The repository
  README states: "This electronic edition of the last six of the London Symphonies (Nos. 99 to 104) has
  been produced by the Center for Computer Assisted Research in the Humanities. The accompanying files were
  prepared from the Eulenburg edition (n.d.) published in London, and edited by Ernst Praetorius. Symphony
  No. 100 was edited by H.C. Robbins Landon. [...] Machine transcription, proof reading, and proof listening
  was done by Frances Bennion under the supervision of Dr. Eleanor Selfridge-Field. Translation to the
  Humdrum `**kern` format was carried out by Dr. David Huron using software developed by Kyle Dawkins.
  Music entry and editing was done using the dmuse facilities designed and implemented by
  Dr. Walter Hewlett." and "The accompanying files are protected by copyright and are distributed by
  license only. Refer to the accompanying license statement and original license agreement for details."
* Every kern file carries the reference records
  `!!!YEC: Copyright 1996, Center for Computer Assisted Research in the Humanities`,
  `!!!YEM: Rights to all derivative electronic formats reserved.`,
  `!!!YEM: Refer to licensing agreement for further details.`
* The repository's `LICENSE.txt` reads, verbatim:

```
             ===============================================
             Licence Information for CCARH MuseData Editions
             ===============================================

All musical data supplied by the Center for Computer Assisted Research in
the Humanities (CCARH) is protected by United States Copyright Law and by
associated international treaties.  Use of this data is regulated by a
licensing agreement printed on the original distribution package.  Opening
the distribution package indicated your acceptance of these terms and
conditions.  This license agreement places notable restrictions and
obligations on the licensee.

For convenience, the terms and conditions of the licensing agreement are
restated below:

(1)  MuseData is a registered trademark of the Center for Computer
     Assisted Research in the Humanities (hereafter "CCARH").
     MuseData designates data files produced and distributed by CCARH.

(2) The enclosed MuseData files are licensed (not sold).  CCARH grants
    to you, and you accept, a nonexclusive license to use the enclosed
    data, only as authorized in this Agreement.

(3) In some cases, MuseData files are created under special agreements
    with other copyright holders.  Distribution of the corresponding
    MuseData files occurs under the explicit understanding that MuseData
    users will also abide by these agreements.  Specifically, this
    license does not authorize the use of the enclosed MuseData files
    in the production of derivative editions intended for commercial
    distribution, nor for public performance (including broadcast),
    nor for sound recording.  Users contemplating such uses are
    advised to contact CCARH in order to obtain precise information
    on the copyright status of the enclosed material.

(4) The enclosed MuseData files are for personal use (single-user)*
    only.  This software may be used "just like a book".  The
    software may be transferred from one computer location to another,
    and may be used by any number of people provided there is NO
    POSSIBILITY of it being used by more than one person or in more
    than one location concurrently.  The individual opening this
    package is responsible for ensuring that other users of data
    originating from this specific copy are INFORMED of the terms
    and conditions of this licensing agreement.

(5) MuseData files are made available only for the purpose of academic
    research;  MuseData files may be used in the course of teaching,
    but under no circumstance is the data to be embedded or included
    in teaching materials for commercial or non-commercial distribution.
    This condition includes subsets of the MuseData files that would
    exceed the "fair use" interpretation of U.S. copyright law.

(6) CCARH must be acknowledged as the source of data in any publications,
    computer programs or other products resulting from or involving the
    use of this data.

(7) Copyright is claimed by CCARH on its data files and compilations.
    This copyright must be reproduced or acknowledged in any quotations
    of its data appearing in any medium of audible, visual, or tactile
    display.

(8) Users are authorized to make archival or "back-up" copies of
    MuseData files for the sole purpose of protecting the data from
    inadvertent loss.

(9) In the creation of its encoded materials, CCARH applies rigorous
    standards of data verification.  It cannot, however, warrant that
    the data is free of encoding errors or other defects.  CCARH may
    not be held accountable for any losses suffered by users of its
    data.  CCARH's cumulative liability for any loss or damages
    resulting from any claims, demands, or actions arising out of
    or relating to this Agreement shall not exceed the license fee
    paid for use of the data.

This agreement shall be construed, interpreted and governed by the
laws of the State of California.

* Users interested in multi-user or site licenses should contact CCARH.
```

**Consequence for this pack.** The CCARH terms allow personal, single-user, academic/teaching use with
acknowledgement, but clause (5) forbids embedding the data in teaching materials that are *distributed*
(commercially or not). The Haydn excerpts are therefore fine for a private copy of the ear-training app on
the owner's own devices, but they must not ship with a published/distributed version of the app. The
`workId` prefix `haydn-` identifies all affected files (24 movements), and `index.json` lists them under
their own `works` entries, so they can be removed with one filter.
Required acknowledgement: "Haydn symphony data: © 1996 Center for Computer Assisted Research in the
Humanities (CCARH), Stanford University, MuseData/Humdrum edition, used by permission of the licence
terms; encoded by Frances Bennion, kern conversion by David Huron."

---

## 2. Mozart, Symphony No. 41; Beethoven, Symphony No. 9; Dvořák, Symphony No. 9 (`mozart-41`, `beethoven-9`, `dvorak-9`)

* Repository: <https://github.com/iis-mctl/mctl-symphony-dataset>, files
  `symbolic_symphony_set/mo1..mo4/sheet.xml`, `be1..be4/sheet.xml`, `dv1..dv4/sheet.xml`
  (branch `main`, commit of 2024-11-16 "Update readme.md", fetched 2026-11-03 via raw.githubusercontent.com).
* Dataset: "Symbolic Symphony Set (S3)". Citation requested by the README:
  Z.-S. Lin, Y.-C. Kuo, T.-Y. Hung, W.-Y. Lin, Y.-H. Chu, T.-K. Wang, J.-H. Huang, C. Chang, C. Julio,
  G. Hsieh, and L. Su (2024), "S3: A Symbolic Music Dataset for Computational Music Analysis of
  Symphonies", Late Breaking Demo, 25th International Society for Music Information Retrieval Conference
  (ISMIR 2024), San Francisco.
* The MusicXML files are MuseScore 4.3.2 exports whose `<source>` fields point to scores uploaded by
  MuseScore.com users: Mozart <https://musescore.com/score/4861738>; Beethoven ii
  <https://musescore.com/score/1429361>, iii <http://musescore.com/user/19710/scores/5641865>,
  iv <http://musescore.com/user/19710/scores/5668962> (Beethoven i has no source field);
  Dvořák i–iii <https://musescore.com/score/4602736>, iv <https://musescore.com/score/4820736>.
  The dataset authors redistribute these engravings under the licence below.
* The repository's `LICENSE` file reads, verbatim:

```
MIT License

Copyright (c) 2024 Chia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

* Tchaikovsky's Symphony No. 6 (`tc1..tc4`) from the same dataset was downloaded but is **not** part of
  this pack: in those files the wind and brass parts are out of alignment with the strings over long
  stretches (pitch-class agreement 0.1–0.3 where 0.6–0.9 is normal), so the data could not be verified.

---

## Terms for this dataset

* Mozart, Beethoven and Dvořák excerpts: MIT-licensed source; keep the copyright notice above
  ("Copyright (c) 2024 Chia") and the S3 citation with any redistribution.
* Haydn excerpts: CCARH MuseData licence as quoted above (personal / academic use, no distribution
  inside teaching materials, acknowledgement required).
* The music21 toolkit used for the conversion is BSD-licensed (Michael Scott Asato Cuthbert and the
  music21 contributors); it is not redistributed here.
