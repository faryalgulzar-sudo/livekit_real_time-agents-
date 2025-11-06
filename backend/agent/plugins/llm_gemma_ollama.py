# LLM using gemma 0lama
import ollama

class QwenOllamaLLM:
    def __init__(self, model="gemma3:1b"):

    def chat(self, prompt: str) -> str:
        response = ollama.chat(model=self.model, messages=[{"role": "user", "content": prompt}])
        return response['message']['content']

def create():
    return QwenOllamaLLM()
