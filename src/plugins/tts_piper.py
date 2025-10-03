# Text-to-Speech using Piper
import subprocess
import tempfile
import os

class PiperTTS:
    def __init__(self, voice="en_US-amy-low"):
        self.voice = voice

    def synthesize(self, text: str, out_path: str = None) -> str:
        if out_path is None:
            fd, out_path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)

        subprocess.run(
            ["piper", "--model", f"voices/{self.voice}.onnx", "--output_file", out_path],
            input=text.encode("utf-8"),
            check=True
        )
        return out_path

def create():
    return PiperTTS()
