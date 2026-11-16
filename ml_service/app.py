"""
SMART MSME: Python ML Ranking Microservice
Flask API running on Port 5001 (or PORT env var)

Endpoints:
  - POST /recommend : Accepts candidate eligible schemes from Node.js, computes ML ranking scores,
                      and returns ordered schemes with explainable match reasons.
  - GET  /health    : Healthcheck endpoint for service monitoring.
  - GET  /evaluate  : Runs evaluation against expert labeled profiles and returns Precision@K and NDCG@K.
"""

import os
import sys
import time
from pathlib import Path

# Add current directory to path for robust imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from flask import Flask, request, jsonify
from ranking_engine import HybridSchemeRanker
from evaluate import run_evaluation, SCHEME_CANDIDATES
from expert_data import EXPERT_LABELED_PROFILES

app = Flask(__name__)
ranker = HybridSchemeRanker(alpha=0.6, beta=0.4, use_phase3=True)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "service": "SMART MSME Python ML Ranking Service",
        "version": "1.0.0",
        "pipeline": "Phase 1 (Weighted) + Phase 2 (TF-IDF Cosine Sim) + Phase 3 (Supervised Re-ranker)",
        "timestamp": time.time()
    }), 200

@app.route('/recommend', methods=['POST'])
def recommend():
    """
    Core Ranking Endpoint:
    Expects JSON:
      {
        "profile": { "sector": "manufacturing", "stage": "new", "investment": 1500000, "purpose": "machinery", "description": "..." },
        "candidates": [ { "id": 1, "name": "NEEDS", ... }, { "id": 2, ... } ]
      }
    """
    t_start = time.perf_counter()
    data = request.get_json(force=True, silent=True) or {}

    profile = data.get('profile', {})
    candidates = data.get('candidates', [])

    if not isinstance(candidates, list) or len(candidates) == 0:
        return jsonify({
            "success": True,
            "ranked": [],
            "count": 0,
            "message": "No candidate schemes provided for ranking",
            "latency_ms": round((time.perf_counter() - t_start) * 1000.0, 2)
        }), 200

    # Execute ML ranking pipeline
    ranked = ranker.rank_candidates(profile, candidates)
    latency_ms = round((time.perf_counter() - t_start) * 1000.0, 3)

    # Clean response format as specified by Joy Mam's architecture sketch
    output_ranked = []
    for item in ranked:
        output_ranked.append({
            "id": item['id'],
            "name": item['name'],
            "score": item['score'],
            "match_percentage": item['match_percentage'],
            "match_reasons": item['match_reasons'],
            "phase1_feature_score": item['phase1_feature_score'],
            "phase2_text_similarity": item['phase2_text_similarity'],
            "scheme": item['scheme']
        })

    return jsonify({
        "success": True,
        "count": len(output_ranked),
        "ranked": output_ranked,
        "latency_ms": latency_ms,
        "throughput_estimate_rps": round(1000.0 / latency_ms, 0) if latency_ms > 0 else 5000
    }), 200

@app.route('/evaluate', methods=['GET', 'POST'])
def evaluate_api():
    """
    Returns Precision@K and NDCG@K evaluation metrics computed on expert labeled profiles.
    """
    results = run_evaluation()
    return jsonify({
        "success": True,
        "dataset": "Tamil Nadu MSME Portal Expert Labeled Profiles",
        "sample_count": len(EXPERT_LABELED_PROFILES),
        "metrics": results
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"🚀 SMART MSME Python ML Ranking Service running on http://127.0.0.1:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
