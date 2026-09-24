"""ChromaDB semantic index. PostgreSQL is the source of truth.
Every search MUST be filtered by patient_id.

Dynamic path: Mistral embeddings via agent.llm.embed_texts().
Offline fallback (hash vectors) is used ONLY when MISTRAL_API_KEY is missing,
so unit tests and local dev work without a key. With a key set, 100% dynamic.
"""
import hashlib
import math
from typing import List

from config.settings import CHROMA_DIR, MISTRAL_API_KEY

_collection = None


def _fallback_embed(texts: List[str]) -> List[List[float]]:
    vectors = []
    for text in texts:
        dims = [0.0] * 32
        for i in range(32):
            h = hashlib.sha256(f"{i}:{text}".encode()).digest()
            dims[i] = (int.from_bytes(h[:4], "big") % 1000) / 1000.0
        norm = math.sqrt(sum(v * v for v in dims)) or 1.0
        vectors.append([v / norm for v in dims])
    return vectors


def _embed(texts: List[str]) -> List[List[float]]:
    if MISTRAL_API_KEY:
        try:
            from agent.llm import embed_texts

            return embed_texts(texts)
        except Exception as e:
            raise RuntimeError(f"Mistral embedding failed: {e}")
    return _fallback_embed(texts)


def get_collection():
    global _collection
    if _collection is not None:
        return _collection
    try:
        import chromadb

        client = chromadb.PersistentClient(path=CHROMA_DIR)
        _collection = client.get_or_create_collection(
            name="cognicare_memories", metadata={"hnsw:space": "cosine"}
        )
        return _collection
    except Exception:
        return None


def upsert_memory_vector(
    patient_id: str, memory_id: str, text: str, memory_type: str, status: str = "ACTIVE"
) -> bool:
    col = get_collection()
    if col is None:
        return False
    try:
        vec = _embed([f"{text}"])
        col.upsert(
            ids=[memory_id],
            embeddings=vec,
            documents=[text[:4000]],
            metadatas=[{
                "patient_id": patient_id,
                "memory_id": memory_id,
                "memory_type": memory_type,
                "status": status,
            }],
        )
        return True
    except Exception:
        return False


def delete_memory_vector(patient_id: str, memory_id: str) -> bool:
    """Safely remove a vector record from ChromaDB (for expired/rejected/deleted memories)."""
    col = get_collection()
    if col is None:
        return False
    try:
        col.delete(ids=[memory_id])
        return True
    except Exception:
        return False


def search_memory_vectors(
    patient_id: str, query: str, k: int = 5
) -> List[dict]:
    """Patient-scoped semantic search. Never global."""
    col = get_collection()
    if col is None or not query.strip():
        return []
    try:
        vec = _embed([query])
        res = col.query(
            query_embeddings=vec,
            n_results=k,
            where={"patient_id": patient_id},
        )
        out = []
        ids = (res.get("ids") or [[]])[0]
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[]])[0]
        for i, mid in enumerate(ids):
            meta = metas[i] if i < len(metas) and metas[i] else {}
            # Verify patient_id matches filter
            if meta.get("patient_id") and meta.get("patient_id") != patient_id:
                continue
            out.append({
                "memory_id": meta.get("memory_id", mid),
                "snippet": docs[i] if i < len(docs) else "",
                "distance": dists[i] if i < len(dists) else None,
                "status": meta.get("status", "ACTIVE"),
            })
        return out
    except Exception:
        return []

