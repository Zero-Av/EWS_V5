"""
modules/faiss_store.py
 
Changes vs original:
  - Paths imported from config.py (no more hardcoded strings)
  - Graceful load: returns empty state instead of raising when index missing
  - exists() checks all three required files
"""
 
import os
import faiss
import joblib
import numpy as np
 
from config import INDEX_FILE, ID_FILE, META_FILE, VECTOR_DIR
 
 
class EmployeeFAISSStore:
 
    def __init__(self):
        self.index        = None
        self.employee_ids = []
        self.metadata     = {}
 
    # ─────────────────────────────────────────────────────────────────
    # Build
    # ─────────────────────────────────────────────────────────────────
 
    def build_index(
        self,
        embeddings: np.ndarray,
        employee_ids: list,
        metadata: dict,
    ) -> None:
        embeddings = np.asarray(embeddings, dtype=np.float32)
 
        if embeddings.ndim != 2:
            raise ValueError("Embeddings must be 2D: (n_samples, embedding_dim)")
 
        dim = embeddings.shape[1]
        faiss.normalize_L2(embeddings)
 
        self.index        = faiss.IndexFlatIP(dim)
        self.index.add(embeddings)
        self.employee_ids = [str(x) for x in employee_ids]
        self.metadata     = metadata
 
    # ─────────────────────────────────────────────────────────────────
    # Persist
    # ─────────────────────────────────────────────────────────────────
 
    def save(self) -> None:
        if self.index is None:
            raise ValueError("Nothing to save — build_index() first.")
 
        os.makedirs(VECTOR_DIR, exist_ok=True)
        faiss.write_index(self.index, INDEX_FILE)
        joblib.dump(self.employee_ids, ID_FILE)
        joblib.dump(self.metadata, META_FILE)
 
    def load(self) -> bool:
        """
        Loads the FAISS index from disk.
        Returns True on success, False if files don't exist yet.
        """
        if not self.exists():
            return False
 
        self.index        = faiss.read_index(INDEX_FILE)
        self.employee_ids = joblib.load(ID_FILE)
        self.metadata     = joblib.load(META_FILE)
        return True
 
    # ─────────────────────────────────────────────────────────────────
    # Search
    # ─────────────────────────────────────────────────────────────────
 
    def search(self, query_embedding: np.ndarray, top_k: int = 5) -> list:
        """
        Returns:
            [ { employee_id, similarity, metadata }, ... ]
        """
        if self.index is None:
            return []
 
        query = np.asarray(query_embedding, dtype=np.float32)
        if query.ndim == 1:
            query = query.reshape(1, -1)
 
        faiss.normalize_L2(query)
        scores, indices = self.index.search(query, top_k)
 
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            eid = self.employee_ids[idx]
            results.append({
                "employee_id": eid,
                "similarity":  float(score),
                "metadata":    self.metadata.get(eid, {}),
            })
        return results
 
    # ─────────────────────────────────────────────────────────────────
    # Utilities
    # ─────────────────────────────────────────────────────────────────
 
    def exists(self) -> bool:
        return all(os.path.exists(p) for p in [INDEX_FILE, ID_FILE, META_FILE])
 
    def employee_count(self) -> int:
        return self.index.ntotal if self.index else 0
 
    def get_employee_metadata(self, employee_id: str) -> dict:
        return self.metadata.get(str(employee_id), {})
 
    def rebuild(
        self,
        embeddings: np.ndarray,
        employee_ids: list,
        metadata: dict,
    ) -> None:
        self.build_index(embeddings, employee_ids, metadata)
        self.save()