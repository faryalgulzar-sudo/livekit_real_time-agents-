# /home/faryal/agent-786/backend/agent/app/core/intake_flow.py
"""
MVP Intake Flow Engine
----------------------
This module reads your intake_schema.json and decides what the agent should do next:

- Ask the next missing REQUIRED field question
- Ask CONDITIONAL follow-up questions (pain/file rules)
- If everything is collected -> return CONFIRM step (summary prompt)

It does NOT save answers. Your existing endpoint:
POST /v1/sessions/{id}/answers
should keep storing answers into collected_data (JSONB).

Usage:
------
from app.core.intake_flow import load_schema, get_next_question

schema = load_schema("/home/faryal/agent-786/backend/agent/app/core/intake_schema.json")
result = get_next_question(collected_data=session.collected_data, schema=schema, language="en")

result examples:
- {"action": "ask", "key": "full_name", "prompt": "...", "field": {...}}
- {"action": "confirm", "prompt": "..."}
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Optional, List, Union


Schema = Dict[str, Any]
CollectedData = Dict[str, Any]


def load_schema(schema_path: str) -> Schema:
    """Load schema JSON from disk."""
    p = Path(schema_path)
    return json.loads(p.read_text(encoding="utf-8"))


def _is_missing(value: Any) -> bool:
    """Decide if a collected_data value should be treated as missing."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False


def _get_prompt(field: Dict[str, Any], language: str) -> str:
    """
    Pick prompt based on language.
    Schema contains prompt_en / prompt_ur.
    """
    if language == "ur" and field.get("prompt_ur"):
        return field["prompt_ur"]
    return field.get("prompt_en") or field.get("prompt_ur") or ""


def _field_by_key(schema: Schema) -> Dict[str, Dict[str, Any]]:
    """Map schema fields by key for fast lookup."""
    out: Dict[str, Dict[str, Any]] = {}
    for f in schema.get("fields", []):
        if isinstance(f, dict) and f.get("key"):
            out[f["key"]] = f
    return out


def _conditional_field_by_key(rule_fields: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    out: Dict[str, Dict[str, Any]] = {}
    for f in rule_fields:
        if isinstance(f, dict) and f.get("key"):
            out[f["key"]] = f
    return out


def _eval_when_clause(when: Dict[str, Any], collected_data: CollectedData) -> bool:
    """
    Support the following 'when' formats (as per your intake_schema.json):
    - {"field_equals": {"field": "...", "value": ...}}
    - {"field_text_contains_any": {"field": "...", "values": ["a","b"]}}
    - {"any_of": [ <when>, <when>, ... ]}
    """
    if not isinstance(when, dict):
        return False

    # any_of
    if "any_of" in when and isinstance(when["any_of"], list):
        return any(_eval_when_clause(w, collected_data) for w in when["any_of"])

    # field_equals
    if "field_equals" in when and isinstance(when["field_equals"], dict):
        field = when["field_equals"].get("field")
        expected = when["field_equals"].get("value")
        return collected_data.get(field) == expected

    # field_text_contains_any
    if "field_text_contains_any" in when and isinstance(when["field_text_contains_any"], dict):
        field = when["field_text_contains_any"].get("field")
        values = when["field_text_contains_any"].get("values", [])
        actual = collected_data.get(field)

        if actual is None:
            return False

        actual_text = str(actual).lower()
        for v in values:
            if v and str(v).lower() in actual_text:
                return True
        return False

    return False


def _format_confirmation(schema: Schema, collected_data: CollectedData, language: str) -> str:
    conf = schema.get("confirmation", {}) or {}
    template = conf.get("prompt_ur") if language == "ur" else conf.get("prompt_en")
    if not template:
        template = conf.get("prompt_en") or conf.get("prompt_ur") or "Please confirm your details."

    # Safe format: only replace placeholders that exist
    # Example placeholders: {full_name}, {phone}, ...
    class SafeDict(dict):
        def __missing__(self, key: str) -> str:
            return "{%s}" % key

    return template.format_map(SafeDict(**collected_data))


def get_next_question(
    collected_data: Union[CollectedData, None],
    schema: Schema,
    language: str = "en",
) -> Dict[str, Any]:
    """
    Decide the next action for the agent.

    Returns dict:
      - action="ask": includes key, prompt, field
      - action="confirm": includes prompt
      - action="done": includes prompt (optional)

    Priority:
      1) Required fields (in required_fields_order)
      2) Conditional rules (in conditional_rules, in order)
      3) Confirm step when complete
    """
    if collected_data is None:
        collected_data = {}
    if not isinstance(collected_data, dict):
        # best-effort conversion if something odd was passed
        collected_data = dict(collected_data)

    fields_map = _field_by_key(schema)

    # 1) REQUIRED fields (in order)
    required_order = schema.get("required_fields_order", []) or []
    for key in required_order:
        field_def = fields_map.get(key)
        # If schema missing field definition, skip safely
        if not field_def:
            continue
        if _is_missing(collected_data.get(key)):
            return {
                "action": "ask",
                "key": key,
                "prompt": _get_prompt(field_def, language),
                "field": field_def,
                "state": schema.get("states", {}).get("collecting", "COLLECTING"),
            }

    # 2) CONDITIONAL rules (in order)
    for rule in schema.get("conditional_rules", []) or []:
        if not isinstance(rule, dict):
            continue

        when = rule.get("when", {})
        if not _eval_when_clause(when, collected_data):
            continue

        then_order = rule.get("then_fields_order", []) or []
        rule_fields = rule.get("fields", []) or []
        rule_field_map = _conditional_field_by_key(rule_fields)

        for key in then_order:
            field_def = rule_field_map.get(key)
            if not field_def:
                continue
            if _is_missing(collected_data.get(key)):
                return {
                    "action": "ask",
                    "key": key,
                    "prompt": _get_prompt(field_def, language),
                    "field": field_def,
                    "state": schema.get("states", {}).get("collecting", "COLLECTING"),
                    "rule_id": rule.get("id"),
                }

    # 3) Everything collected -> CONFIRM
    confirm_prompt = _format_confirmation(schema, collected_data, language)
    return {
        "action": "confirm",
        "prompt": confirm_prompt,
        "state": schema.get("states", {}).get("confirming", "CONFIRMING"),
    }
