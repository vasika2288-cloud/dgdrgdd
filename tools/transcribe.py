"""Word-level timestamps for the voiceover (used to sync captions and scenes)."""
import json
import subprocess
import sys

import numpy as np

from faster_whisper import WhisperModel

src = sys.argv[1] if len(sys.argv) > 1 else "assets/audio/voice.mp3"
out = sys.argv[2] if len(sys.argv) > 2 else "assets/audio/words.json"

model = WhisperModel("medium", device="cpu", compute_type="int8", cpu_threads=2)
# Decode with ffmpeg ourselves: the bundled PyAV decoder is version-sensitive.
pcm = subprocess.run(
    ["ffmpeg", "-v", "error", "-i", src, "-f", "f32le", "-ac", "1", "-ar", "16000", "-"],
    check=True,
    capture_output=True,
).stdout
audio = np.frombuffer(pcm, dtype=np.float32)
segments, _ = model.transcribe(audio, language="ru", word_timestamps=True, beam_size=5)
words = [
    {"w": w.word.strip(), "s": round(w.start, 2), "e": round(w.end, 2)}
    for seg in segments
    for w in seg.words
]
with open(out, "w", encoding="utf-8") as f:
    json.dump(words, f, ensure_ascii=False)
print(" ".join(f'{w["w"]}[{w["s"]}-{w["e"]}]' for w in words))
