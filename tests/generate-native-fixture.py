"""Run from repository root. Generates local-only files; remove qa-* before packaging."""
from pathlib import Path
import wave, math, struct
q=Path('dist/cris/quadro')
h=Path('tests/fixtures/native-board-harness.js').read_text()
s=(q/'quadro-cris-v7.js').read_text()
(q/'qa-engine.js').write_text(s.replace('// CRIS integration: account, clues and local interaction sounds.',h+'\n// CRIS integration: account, clues and local interaction sounds.'))
(q/'qa.html').write_text(Path('tests/fixtures/native-board.html').read_text())
(q/'qa-sizes.html').write_text(Path('tests/fixtures/native-board-sizes.html').read_text())
with wave.open(str(q/'qa-tone.wav'),'w') as w:
 w.setparams((1,2,8000,0,'NONE','not compressed'))
 w.writeframes(b''.join(struct.pack('<h',int(2000*math.sin(i*.17))) for i in range(240000)))
