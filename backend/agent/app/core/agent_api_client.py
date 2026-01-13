import os
import time
import requests
from typing import Optional, Dict, Any
import os
from dotenv import load_dotenv

load_dotenv()  # loads .env from current working directory (or nearest parent)

API_BASE_URL = os.getenv("AGENT_API_BASE_URL").rstrip("/")
API_TIMEOUT = float(os.getenv("AGENT_API_TIMEOUT", "5"))
API_RETRIES = int(os.getenv("AGENT_API_RETRIES", "3"))


class AgentAPIClient:
    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id
        self.session_id: Optional[str] = None

    def _post(self, path: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{API_BASE_URL}{path}"
        last_err = None

        for attempt in range(1, API_RETRIES + 1):
            try:
                r = requests.post(url, json=payload, timeout=API_TIMEOUT)
                if r.status_code >= 400:
                    raise RuntimeError(f"HTTP {r.status_code}: {r.text}")
                return r.json() if r.text else {}
            except Exception as e:
                last_err = e
                time.sleep(0.3 * attempt)  # small backoff

        raise RuntimeError(f"API call failed after retries: {url} :: {last_err}")

    def create_session(self) -> str:
        data = self._post("/v1/sessions", {"tenant_id": self.tenant_id})
        sid = data.get("session_id")
        if not sid:
            raise RuntimeError(f"Missing session_id in response: {data}")
        self.session_id = sid
        return sid

    def save_answer(self, field: str, value: Any) -> None:
        if not self.session_id:
            raise RuntimeError("session_id not set. Call create_session() first.")
        self._post(f"/v1/sessions/{self.session_id}/answers", {"field": field, "value": value})

    def append_transcript(self, text: str) -> None:
        if not self.session_id:
            raise RuntimeError("session_id not set. Call create_session() first.")
        self._post(f"/v1/sessions/{self.session_id}/transcript", {"text": text})

    def get_collected_data(self) -> Dict[str, Any]:
        """Fetch collected_data from current session"""
        if not self.session_id:
            raise RuntimeError("session_id not set. Call create_session() first.")

        url = f"{API_BASE_URL}/v1/sessions/{self.session_id}"
        try:
            r = requests.get(url, timeout=API_TIMEOUT)
            if r.status_code >= 400:
                raise RuntimeError(f"HTTP {r.status_code}: {r.text}")
            data = r.json() if r.text else {}
            return data.get("collected_data", {})
        except Exception as e:
            raise RuntimeError(f"Failed to get collected_data: {e}")

    def query_knowledge(self, query: str, top_k: int = 3) -> Dict[str, Any]:
        """
        Query the knowledge base for relevant clinic information.
        Returns top_k most relevant chunks with context ready for LLM.
        """
        payload = {
            "tenant_id": self.tenant_id,
            "query": query,
            "top_k": top_k
        }
        return self._post("/v1/kb/query", payload)
