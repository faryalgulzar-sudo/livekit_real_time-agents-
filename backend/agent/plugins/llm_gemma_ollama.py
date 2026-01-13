# LLM using Ollama
import ollama

class QwenOllamaLLM:
    def __init__(self, model="qwen2.5:3b"):
        self.model = model

    def chat(self, prompt: str) -> str:
        response = ollama.chat(model=self.model, messages=[{"role": "user", "content": prompt}])
        return response['message']['content']

def create():
    return QwenOllamaLLM()
