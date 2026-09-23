"""Agent orchestrator: dynamic Mistral LLM + controlled backend tools.

PATIENT -> AI ASSISTANT -> ORCHESTRATOR -> Mistral LLM + TOOLS -> auth -> services
-> PostgreSQL / ChromaDB. LLM never touches infrastructure directly.

With MISTRAL_API_KEY set, tool selection, answering, reminder parsing,
memory extraction and daily summaries are ALL LLM-driven (no keyword rules).
_rule-based helpers at the bottom exist only for offline unit tests.
"""
import json
import uuid
from datetime import datetime, timezone, date
from db.supabase import supabase
from config.settings import DISCLAIMER
from agent import tools_impl
from agent.extraction import extract_memory_candidate
from agent.memory_service import create_or_update_memory
from agent.llm import chat_llm, require_key

SYSTEM_PROMPT = """You are CogniCare, a warm and friendly AI companion for elderly patients.
Talk like a natural, caring conversational agent — greet, chat, encourage, tell stories, explain general topics, and provide emotional support.
When the conversation is about the patient's own medicines, appointments, reminders, documents, family memories, or past discussions, use the provided records and stay grounded in them.
Never invent medicines, dosages, appointments, people, or document contents. If records are empty for a records-question, say so honestly.
Do not give medical diagnosis or treatment advice. For medical decisions, advise contacting a caregiver or healthcare professional.
Keep answers short, warm, and simple. Don't mention backend tools or records unless relevant to the answer."""

TOOL_CATALOG = """
Available backend tools (you can request any subset, or NONE for pure chit-chat):
- get_today_medicines: today's medicine reminders.
- get_upcoming_appointments: future appointment reminders.
- get_patient_reminders: general reminders, optionally filtered by date.
- search_patient_memories: semantic search over the patient's long-term memories.
- search_patient_documents: search the patient's documents.
- create_reminder: create a reminder when the patient explicitly asks to be reminded.
"""

PLANNER_PROMPT = """You route a patient message to backend tools.
{tool_catalog}
Recent chat:
{history}
Patient message: {message}
Today's date: {today}
Return ONLY JSON like:
{{"tools": ["get_today_medicines"], "reminders_date": "2026-09-19 or null", "memory_query": "query string or null", "create_reminder": null}}
Rules:
- For greetings, small talk, feelings, general knowledge, stories, jokes, or emotional support → return {{"tools": [], "reminders_date": null, "memory_query": null, "create_reminder": null}}. Chat normally, no records needed.
- For medicines/appointments/reminders/documents questions → pick only the relevant tools.
- For personal belongings (wallet, keys, glasses, items, where is...), people, past discussions, or memories → pick ["search_patient_memories"] with memory_query set to the item or topic.
- Set create_reminder ONLY when the patient explicitly asks to be reminded (e.g. "remind me to..."). Otherwise null.
Examples:
- "Hello, how are you?" → {{"tools": [], "reminders_date": null, "memory_query": null, "create_reminder": null}}
- "Where is my wallet?" → {{"tools": ["search_patient_memories"], "reminders_date": null, "memory_query": "wallet", "create_reminder": null}}
- "Do I have any appointment with doctor?" → {{"tools": ["get_upcoming_appointments"], "reminders_date": null, "memory_query": null, "create_reminder": null}}
- "What medicine do I take tonight?" → {{"tools": ["get_today_medicines"], "reminders_date": null, "memory_query": null, "create_reminder": null}}
- "Who is Emily?" → {{"tools": ["search_patient_memories"], "reminders_date": null, "memory_query": "Who is Emily?", "create_reminder": null}}
JSON:"""

ANSWER_PROMPT = """{system}
Records retrieved live from backend tools (may be empty for pure chit-chat):
{context}
Recent chat:
{history}
Patient: {message}
How to answer:
- If this is normal conversation (greeting, feelings, stories, general knowledge): reply naturally like a caring friend. Do NOT mention records or say "no records".
- If this is about the patient's own medicines, appointments, reminders, documents, personal belongings (wallet, keys, glasses), or medical situation:
  - Answer gently and accurately from the records above.
  - IMPORTANT: If records are empty or do not contain the answer, say honestly that you don't have that information in their records, and ask: "I don't have that information in your records. Would you like me to ask your caretaker regarding this?" (or similar warm phrasing). Never fabricate details.
- If the patient is confirming or saying yes to your previous offer to ask their caretaker:
  - Confirm warmly that you have sent a notification to their caretaker and will let them know as soon as the caretaker responds.
- If a reminder was just created, confirm its title, date and time.
Assistant:"""

SUMMARY_PROMPT = """Summarize today's AI activity for a caregiver in 2-4 short lines plus key events.
Existing events: {events}
Latest patient message: {latest}
Latest assistant reply: {reply}
Return ONLY JSON: {{"summary": "...", "important_events": ["..."]}}
JSON:"""


def _now():
    return datetime.now(timezone.utc).isoformat()


def _ensure_conversation(patient_id: str, conversation_id: str | None) -> str:
    if conversation_id:
        try:
            res = supabase.table("conversations").select("*").eq("id", conversation_id).execute()
            if res.data and res.data[0].get("patient_id") == patient_id:
                return conversation_id
        except Exception:
            pass
    cid = uuid.uuid4().hex
    try:
        supabase.table("conversations").insert({
            "id": cid, "patient_id": patient_id,
            "started_at": _now(), "status": "active",
            "created_at": _now(), "updated_at": _now(),
        }).execute()
    except Exception as e:
        raise RuntimeError(
            f"Could not create conversation ({type(e).__name__}: {e}). "
            "If the 'conversations' table is missing, run backend/db/agent_tables.sql in Supabase."
        )
    return cid


def _store_message(conversation_id: str, sender: str, content: str,
                   tool_name: str | None = None, metadata: dict | None = None):
    try:
        supabase.table("messages").insert({
            "id": uuid.uuid4().hex,
            "conversation_id": conversation_id,
            "sender_type": sender,
            "content": content[:4000],
            "created_at": _now(),
            "tool_name": tool_name,
            "metadata": metadata or {},
        }).execute()
    except Exception:
        pass


def _recent_history(conversation_id: str, limit: int = 10) -> list:
    try:
        res = (
            supabase.table("messages").select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at", desc=True).limit(limit).execute()
        )
        return list(reversed(res.data or []))
    except Exception:
        return []


def _format_medicines(rows) -> str:
    if not rows:
        return "No medicines scheduled for today in your records."
    return "Today's medicines: " + "; ".join(
        f"{r.get('title')} at {str(r.get('reminder_time'))[:5]}"
        + (f" ({r.get('dosage')})" if r.get("dosage") else "") for r in rows
    )


def _format_appointments(rows) -> str:
    if not rows:
        return "No upcoming appointments in your records."
    return "Upcoming appointments: " + "; ".join(
        f"{r.get('title')} on {r.get('reminder_date')} at {str(r.get('reminder_time'))[:5]}" for r in rows
    )


def _format_reminders(rows) -> str:
    if not rows:
        return "No reminders found in your records."
    return "Reminders: " + "; ".join(
        f"{r.get('title')} on {r.get('reminder_date')} at {str(r.get('reminder_time'))[:5]}"
        + (" [done]" if r.get("is_done") else "") for r in rows[:8]
    )


def _format_memories(rows) -> str:
    if not rows:
        return "No relevant long-term memories found."
    return "Relevant memories: " + " | ".join(
        f"{r.get('title')}: {r.get('content')}" for r in rows[:5]
    )


def _format_documents(rows) -> str:
    if not rows:
        return "No relevant medical documents or prescriptions found."
    items = []
    for r in rows[:4]:
        struct = r.get("structured_data") or {}
        meds = struct.get("medications", [])
        med_summary = ", ".join([f"{m.get('name')} ({m.get('dosage','')}, {m.get('frequency','')})" for m in meds[:5]]) if meds else ""
        text = f"Document '{r.get('title', 'Prescription')}': {struct.get('summary', '')}"
        if med_summary:
            text += f". Prescribed medicines: {med_summary}"
        if struct.get("doctor_notes"):
            text += f". Notes: {struct.get('doctor_notes')}"
        items.append(text)
    return "Medical documents & prescriptions: " + " | ".join(items)


def _parse_json(text: str) -> dict:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        return {}
    try:
        data = json.loads(text[start:end + 1])
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _llm_plan(message: str, history: list) -> dict:
    """Dynamic tool routing: fast Mistral planner decides tools every turn.
    Returns [] for pure chit-chat so the agent talks normally.
    On rate limit / transient failure, falls back to the offline router
    so chat keeps working instead of 500ing."""
    # Local shortcut: greetings never need an LLM planning call at all.
    if _is_small_talk(message):
        return {"tools": [], "reminders_date": None, "memory_query": None,
                "create_reminder": None, "shortcut": "small_talk"}
    try:
        from agent.llm import planner_llm

        llm = planner_llm()
    except Exception as e:
        raise RuntimeError(f"Mistral client init failed for planning: {e}")
    hist = "\n".join(f"{m.get('sender_type')}: {(m.get('content') or '')[:400]}" for m in history[-6:])
    prompt = PLANNER_PROMPT.format(
        tool_catalog=TOOL_CATALOG, history=hist or "(none)",
        message=message[:1000], today=date.today().isoformat(),
    )
    try:
        from agent.llm import invoke_with_retry

        resp = invoke_with_retry(lambda: llm.invoke(prompt))
    except Exception:
        # Rate-limited or unreachable → offline keyword router keeps chat alive
        return {
            "tools": _route_tools(message),
            "reminders_date": date.today().isoformat() if "today" in message.lower() else None,
            "memory_query": message,
            "create_reminder": None,
            "fallback": "offline_router_rate_limited",
        }
    plan = _parse_json(getattr(resp, "content", "") or "")
    raw_tools = plan.get("tools") or []
    allowed = {"get_today_medicines", "get_upcoming_appointments", "get_patient_reminders",
               "search_patient_memories", "search_patient_documents"}
    tools = [t for t in raw_tools if t in allowed][:4]
    plan["tools"] = tools
    return plan


def _llm_answer(system: str, context: str, history: list, message: str) -> str:
    try:
        llm = chat_llm()
    except Exception as e:
        raise RuntimeError(f"Mistral client init failed for answering: {e}")
    hist = "\n".join(f"{m.get('sender_type')}: {(m.get('content') or '')[:500]}" for m in history[-6:])
    prompt = ANSWER_PROMPT.format(
        system=system, context=context[:5000],
        history=hist or "(none)", message=message[:1000],
    )
    try:
        from agent.llm import invoke_with_retry

        resp = invoke_with_retry(lambda: llm.invoke(prompt))
    except Exception as e:
        raise RuntimeError(f"Mistral answer call failed ({type(e).__name__}: {e})")
    text = (getattr(resp, "content", "") or "").strip()
    if not text:
        raise RuntimeError("Mistral returned an empty answer.")
    return text


def _llm_update_daily_summary(patient_id: str, day: str, latest: str, reply: str):
    try:
        res = supabase.table("daily_ai_summaries").select("*").eq("patient_id", patient_id).eq("date", day).execute()
    except Exception:
        return
    events, summary, sid = [], "", None
    if res.data:
        sid = res.data[0]["id"]
        events = res.data[0].get("important_events") or []
        summary = res.data[0].get("summary") or ""
    try:
        from agent.llm import invoke_with_retry

        llm = chat_llm()
        resp = invoke_with_retry(lambda: llm.invoke(
            SUMMARY_PROMPT.format(events=json.dumps(events[-10:]), latest=latest[:400], reply=reply[:400])
        ))
        data = _parse_json(getattr(resp, "content", "") or "")
        if isinstance(data.get("summary"), str) and data["summary"].strip():
            summary = data["summary"].strip()[:1000]
        if isinstance(data.get("important_events"), list):
            merged = events + [str(e)[:200] for e in data["important_events"] if str(e).strip()]
            # de-dupe preserving order, keep last 20
            seen, deduped = set(), []
            for e in merged:
                if e not in seen:
                    seen.add(e)
                    deduped.append(e)
            events = deduped[-20:]
        else:
            raise ValueError("no events")
    except Exception:
        if latest and latest not in events:
            events.append(latest[:200])
        events = events[-20:]
        summary = f"Patient interacted with CogniCare {len(events)} time(s) on {day}."
    payload = {"patient_id": patient_id, "date": day, "summary": summary,
               "important_events": events, "updated_at": _now()}
    try:
        if sid:
            supabase.table("daily_ai_summaries").update(payload).eq("id", sid).execute()
        else:
            payload["id"] = uuid.uuid4().hex
            payload["created_at"] = _now()
            supabase.table("daily_ai_summaries").insert(payload).execute()
    except Exception:
        pass


import re

def _is_affirmation(msg: str) -> bool:
    clean = re.sub(r"[^\w\s]", "", (msg or "").lower()).strip()
    words = clean.split()
    affirmations = {
        "yes", "yeah", "yep", "sure", "please", "ok", "okay", "yup", "definitely",
        "please do", "ask them", "go ahead", "yes please", "ask caretaker",
        "yes ask my caretaker", "ask my caretaker", "yes ask", "yes tell them",
        "yes ask her", "yes ask him", "ask her", "ask him"
    }
    if clean in affirmations:
        return True
    if any(phrase in clean for phrase in ("yes please", "ask my caretaker", "ask the caretaker", "ask her", "ask him", "please ask")):
        return True
    if len(words) <= 3 and words and words[0] in ("yes", "yeah", "yep", "sure", "please"):
        return True
    return False


def _is_negation(msg: str) -> bool:
    clean = re.sub(r"[^\w\s]", "", (msg or "").lower()).strip()
    words = clean.split()
    negations = {"no", "nope", "nah", "no thanks", "no thank you", "never mind", "dont ask", "dont worry"}
    if clean in negations or "no thanks" in clean or "don't ask" in clean or "dont ask" in clean:
        return True
    if len(words) <= 3 and words and words[0] in ("no", "nope", "nah"):
        return True
    return False


def _find_pending_escalation(history: list) -> tuple[bool, str]:
    """Inspects recent history to see if the assistant previously offered to ask the caretaker,
    and returns (is_pending, original_question)."""
    prev_messages = history[:-1] if len(history) > 1 else []
    last_asst = None
    orig_question = ""
    for i in range(len(prev_messages) - 1, -1, -1):
        m = prev_messages[i]
        if m.get("sender_type") == "ASSISTANT":
            last_asst = m
            for j in range(i - 1, -1, -1):
                if prev_messages[j].get("sender_type") == "PATIENT":
                    orig_question = prev_messages[j].get("content", "")
                    break
            break

    if last_asst:
        content = (last_asst.get("content") or "").lower()
        metadata = last_asst.get("metadata") or {}
        if metadata.get("suggest_caretaker_escalation") or "ask your caretaker" in content or "ask the caretaker" in content:
            if not metadata.get("escalation_fulfilled"):
                question = metadata.get("escalation_question") or orig_question or "your question"
                return True, question
    return False, ""


class AgentOrchestrator:
    """Single entry point for chat. Fully dynamic when MISTRAL_API_KEY is set."""

    def chat(self, patient_id: str, message: str, conversation_id: str | None = None) -> dict:
        import logging
        import threading
        import time as _time

        logger = logging.getLogger("cognicare.assistant")
        t0 = _time.perf_counter()
        require_key()  # fail fast with a clear message instead of static replies
        message = (message or "").strip()
        if not message:
            raise ValueError("Message is required")
        cid = _ensure_conversation(patient_id, conversation_id)
        _store_message(cid, "PATIENT", message)
        history = _recent_history(cid)

        # Check if user is confirming or declining a pending escalation offer to ask the caretaker
        is_pending, pending_question = _find_pending_escalation(history)
        if is_pending:
            if _is_affirmation(message):
                from routes.notifications import create_inquiry_notification
                notif = create_inquiry_notification(
                    patient_id=patient_id,
                    question=pending_question,
                    category="general",
                    metadata={"conversation_id": cid}
                )
                answer = (
                    f"I've sent a notification to your caretaker regarding: '{pending_question}'. "
                    "As soon as they reply, you'll receive a notification and it will be saved in your records."
                )
                _store_message(cid, "ASSISTANT", answer, metadata={
                    "notification_id": notif["id"],
                    "escalation_fulfilled": True,
                    "sources": ["Caretaker Notification System"]
                })
                total_ms = int((_time.perf_counter() - t0) * 1000)
                from agent.llm import model_info
                return {
                    "conversation_id": cid,
                    "response": answer,
                    "tools_used": ["notify_caretaker"],
                    "sources": ["Caretaker Notification System"],
                    "memory": {"created": False},
                    "notification_created": notif,
                    "disclaimer": DISCLAIMER,
                    "model": model_info(),
                    "rate_limited": False,
                    "latency_ms": total_ms,
                }
            elif _is_negation(message):
                answer = "No problem! Let me know if there's anything else I can help you with."
                _store_message(cid, "ASSISTANT", answer, metadata={"escalation_fulfilled": True})
                total_ms = int((_time.perf_counter() - t0) * 1000)
                from agent.llm import model_info
                return {
                    "conversation_id": cid,
                    "response": answer,
                    "tools_used": [],
                    "sources": [],
                    "memory": {"created": False},
                    "disclaimer": DISCLAIMER,
                    "model": model_info(),
                    "rate_limited": False,
                    "latency_ms": total_ms,
                }

        plan = _llm_plan(message, history)
        ctx: dict = {}
        tools_used: list[dict] = []
        for name in plan.get("tools", []):
            try:
                if name == "get_today_medicines":
                    ctx["medicines"] = tools_impl.get_today_medicines(patient_id)
                elif name == "get_upcoming_appointments":
                    ctx["appointments"] = tools_impl.get_upcoming_appointments(patient_id)
                elif name == "get_patient_reminders":
                    ctx["reminders"] = tools_impl.get_patient_reminders(
                        patient_id, plan.get("reminders_date") or None)
                elif name == "search_patient_documents":
                    ctx["documents"] = tools_impl.search_patient_documents(patient_id, message)
                elif name == "search_patient_memories":
                    ctx["memories"] = tools_impl.search_patient_memories(
                        patient_id, plan.get("memory_query") or message)
                tools_used.append({"tool_name": name, "success": True})
            except Exception as e:
                tools_used.append({"tool_name": name, "success": False, "detail": str(e)[:200]})

        created_row = None
        reminder_req = plan.get("create_reminder")
        if isinstance(reminder_req, dict) and reminder_req.get("title"):
            try:
                created_row = tools_impl.create_reminder(patient_id, {
                    "title": str(reminder_req["title"]).strip()[:200],
                    "type": reminder_req.get("type") or "general",
                    "reminder_date": reminder_req.get("reminder_date") or date.today().isoformat(),
                    "reminder_time": reminder_req.get("reminder_time") or "10:00",
                    "dosage": reminder_req.get("dosage"),
                    "notes": reminder_req.get("notes") or "Created by AI assistant",
                })
                tools_used.append({"tool_name": "create_reminder", "success": True})
                ctx.setdefault("reminders", []).append(created_row)
            except Exception as e:
                tools_used.append({"tool_name": "create_reminder", "success": False, "detail": str(e)[:200]})

        context_parts = []
        if "medicines" in ctx:
            context_parts.append(_format_medicines(ctx.get("medicines", [])))
        if "appointments" in ctx:
            context_parts.append(_format_appointments(ctx.get("appointments", [])))
        if "reminders" in ctx:
            context_parts.append(_format_reminders(ctx.get("reminders", [])))
        if "memories" in ctx:
            context_parts.append(_format_memories(ctx.get("memories", [])))
        if "documents" in ctx:
            context_parts.append(_format_documents(ctx.get("documents", [])))
        context_text = "\n".join(context_parts) if context_parts else "(No records lookup needed for this message — reply as a natural conversational companion.)"
        try:
            answer = _llm_answer(SYSTEM_PROMPT, context_text, history, message)
            rate_limited = False
        except RuntimeError as e:
            from agent.llm import is_rate_limit_error

            if not is_rate_limit_error(e):
                raise
            # Rate-limited on the answer call → grounded template reply
            # built from the live tool outputs already fetched above.
            rate_limited = True
            answer = _template_answer(message, ctx)
        if created_row is not None:
            answer += f" I've created the reminder '{created_row['title']}' for {created_row['reminder_date']} at {str(created_row['reminder_time'])[:5]}."

        should_suggest_escalation = (
            "ask your caretaker" in answer.lower()
            or "ask the caretaker" in answer.lower()
            or "ask regarding it" in answer.lower()
        )

        tool_label = "+".join(t["tool_name"] for t in tools_used) if tools_used else "none"
        _store_message(cid, "TOOL", "; ".join(t["tool_name"] for t in tools_used) or "general chat (no tools)",
                       tool_name=tool_label,
                       metadata={"tools": tools_used, "plan": plan})
        _store_message(cid, "ASSISTANT", answer, metadata={
            "sources": list(ctx.keys()),
            "suggest_caretaker_escalation": should_suggest_escalation,
            "escalation_question": message if should_suggest_escalation else None,
        })

        # Slow work (memory extraction + daily summary = up to 2 extra LLM
        # calls) runs in the background so it never delays the reply.
        def _post_process():
            mem: dict = {"created": False}
            try:
                candidate = extract_memory_candidate(message, answer)
                if candidate.get("should_create_memory"):
                    mem = create_or_update_memory(patient_id, candidate, "conversation", cid)
            except Exception:
                pass
            try:
                _llm_update_daily_summary(patient_id, date.today().isoformat(), message[:120], answer[:200])
            except Exception:
                pass
            try:
                supabase.table("messages").update(
                    {"metadata": {
                        "sources": list(ctx.keys()),
                        "memory": mem,
                        "suggest_caretaker_escalation": should_suggest_escalation,
                        "escalation_question": message if should_suggest_escalation else None,
                    }}
                ).eq("conversation_id", cid).eq("sender_type", "ASSISTANT").execute()
            except Exception:
                pass

        try:
            threading.Thread(target=_post_process, daemon=True).start()
        except Exception:
            pass

        mem_result: dict = {"created": False, "deferred": True}

        sources = []
        if ctx.get("medicines"):
            sources.append("Medicine schedule")
        if ctx.get("appointments"):
            sources.append("Appointments")
        if ctx.get("reminders"):
            sources.append("Reminders")
        if ctx.get("memories"):
            sources.append("Long-term memory")

        from agent.llm import model_info

        total_ms = int((_time.perf_counter() - t0) * 1000)
        logger.info("chat patient=%s tools=%s ms=%d rate_limited=%s",
                    patient_id, [t["tool_name"] for t in tools_used],
                    total_ms, rate_limited or bool(plan.get("fallback")))
        return {
            "conversation_id": cid,
            "response": answer,
            "tools_used": [t["tool_name"] for t in tools_used],
            "sources": sources,
            "memory": mem_result,
            "suggest_caretaker_escalation": should_suggest_escalation,
            "escalation_question": message if should_suggest_escalation else None,
            "disclaimer": DISCLAIMER,
            "model": model_info(),
            "rate_limited": rate_limited or bool(plan.get("fallback")),
            "latency_ms": total_ms,
        }


orchestrator = AgentOrchestrator()


# ---- Offline helpers (rate-limit fallback + unit tests) ----
_GREETINGS = ("hi", "hii", "hiii", "hello", "hey", "good morning", "good afternoon",
              "good evening", "how are you", "namaste", "good day")


def _is_small_talk(message: str) -> bool:
    t = (message or "").strip().lower()
    if len(t) < 30 and (t in _GREETINGS or any(t.startswith(g) and len(t) <= len(g) + 3 for g in _GREETINGS)):
        return True
    return False


def _route_tools(message: str) -> list[str]:
    # Pure greetings / small talk → no tools, just chat naturally.
    if _is_small_talk(message):
        return []
    t = message.lower()
    tools: list[str] = []
    if any(k in t for k in ("medicine", "tablet", "pill", "dose", "tonight", "prescription")):
        tools.append("get_today_medicines")
    if any(k in t for k in ("appointment", "doctor", "dr.", "clinic")):
        tools.append("get_upcoming_appointments")
    if any(k in t for k in ("remind", "reminder", "tomorrow")):
        tools.append("get_patient_reminders")
    if any(k in t for k in ("report", "document", "prescription says")):
        tools.append("search_patient_documents")
    if any(k in t for k in (
        "who is", "emily", "daughter", "remember", "family", "discuss", "yesterday",
        "wallet", "keys", "glasses", "spectacles", "watch", "phone", "bag", "purse",
        "where is", "where are"
    )):
        tools.append("search_patient_memories")
    return tools[:3]


def _template_answer(message: str, ctx: dict) -> str:
    # Greetings → warm hello, never records talk, never a fake "Source".
    if _is_small_talk(message):
        return "Hello! It's good to see you. How are you feeling today?"
    t = message.lower()
    if "medicine" in t or "pill" in t or "tablet" in t or "dose" in t or "tonight" in t:
        meds = ctx.get("medicines", [])
        if not meds:
            return "I don't have that medicine scheduled in your records. Would you like me to ask your caretaker regarding this?"
        return "Your records show: " + "; ".join(f"{m.get('title')} at {str(m.get('reminder_time'))[:5]}" for m in meds) + "."
    if "appointment" in t or "doctor" in t or "dr." in t or "clinic" in t:
        appts = ctx.get("appointments", [])
        if not appts:
            return "I don't see any upcoming doctor appointments in your records. Would you like me to ask your caretaker regarding this?"
        a = appts[0]
        return f"Your next appointment in your records is '{a.get('title')}' on {a.get('reminder_date')} at {str(a.get('reminder_time'))[:5]}."
    if any(k in t for k in ("wallet", "keys", "glasses", "spectacles", "watch", "phone", "bag", "purse", "where is", "where are")):
        mems = ctx.get("memories", [])
        if not mems:
            for item in ("wallet", "keys", "glasses", "spectacles", "watch", "phone", "bag", "purse"):
                if item in t:
                    return f"I don't have information about your {item} in your records. Would you like me to ask your caretaker regarding this?"
            return "I don't have that information in your records. Would you like me to ask your caretaker regarding this?"
        return f"From your stored memories: {mems[0].get('content')}"
    if "reminder" in t:
        return _format_reminders(ctx.get("reminders", []))
    if "report" in t or "document" in t:
        return "I couldn't find a relevant document in your records." if not ctx.get("documents") else "I found a relevant document in your records."
    mems = ctx.get("memories", [])
    if mems:
        return f"From your stored memories: {mems[0].get('content')}"
    return "I don't have that information in your records. Would you like me to ask your caretaker regarding this?"

