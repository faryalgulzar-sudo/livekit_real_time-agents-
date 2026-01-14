import os
import time
import logging
import requests
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()  # loads .env from current working directory (or nearest parent)

logger = logging.getLogger(__name__)

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

    def _patch(self, path: str) -> Dict[str, Any]:
        """Make PATCH request with retries"""
        url = f"{API_BASE_URL}{path}"
        last_err = None

        for attempt in range(1, API_RETRIES + 1):
            try:
                r = requests.patch(url, timeout=API_TIMEOUT)
                if r.status_code >= 400:
                    raise RuntimeError(f"HTTP {r.status_code}: {r.text}")
                return r.json() if r.text else {}
            except Exception as e:
                last_err = e
                time.sleep(0.3 * attempt)

        raise RuntimeError(f"PATCH request failed after retries: {url} :: {last_err}")

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

    def finalize_session(self) -> None:
        """
        Mark session as completed (best-effort, doesn't raise on failure).
        Called during cleanup to properly close the session.
        """
        if not self.session_id:
            logger.warning("No session_id set, skipping finalization")
            return

        try:
            logger.debug(f"Finalizing session: {self.session_id}")
            self._patch(f"/v1/sessions/{self.session_id}/finalize")
            logger.info(f"Session finalized: {self.session_id}")
        except Exception as e:
            # Don't raise - cleanup should be best-effort
            logger.warning(f"Failed to finalize session {self.session_id}: {e}")
