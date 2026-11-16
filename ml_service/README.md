# SMART MSME: Python ML Ranking Service
**Author:** Joy Kiruba. D (BITS ID: 2024TM93554)  
**Supervisor:** Ms. A. Ramadevi (National Informatics Centre, Chennai)  
**Programme:** M.Tech Software Engineering — BITS Pilani (WILP)  

---

## 🎯 Purpose & Architecture

The **SMART MSME Recommendation Engine** implements a **Two-Stage Pipeline** to help MSME entrepreneurs discover the most relevant government schemes:

```
[ React Front End ]
       │  HTTP POST (Entrepreneur Profile)
       ▼
[ Stage 1: Node.js Express ]
       │  • Rule-based Eligibility Matching
       │  • Filters out non-eligible schemes (age, location, investment cap, gender)
       │  • Produces candidate list of verified eligible schemes
       ▼
[ Stage 2: Python ML Ranking Service (Port 5001) ]
       │  • Phase 1: Weighted Domain Feature Matching
       │  • Phase 2: TF-IDF Vectorization & Cosine Similarity (Text IR)
       │  • Phase 3: Supervised Model Re-ranking (Trained on Expert Labels)
       ▼
[ Ranked Schemes with Explainable Match Reasons ]
       │  Returns ordered schemes + score (0-1) + reasons to Node.js
       ▼
[ React Display: Highest Matching Schemes First with Badges ]
```

> **Key Architectural Principle:** The Python ML service never decides eligibility — Node.js strictly enforces eligibility guidelines. The ML service orders already-eligible schemes by contextual relevance to the entrepreneur.

---

## 🔬 Phased Ranking Techniques

### Phase 1: Weighted Feature Matching (Baseline)
Compares profile attributes against scheme attributes using domain weights:
* **Sector / Category Match ($w_1 = 0.35$):** Exact match (1.0), Related industry group (0.8), Open to all (0.95).
* **Investment Suitability ($w_2 = 0.25$):** Ratio of entrepreneur project cost to scheme max subsidy ceiling.
* **Enterprise Stage ($w_3 = 0.20$):** First-generation / New startup vs. Existing unit expansion.
* **Funding Purpose ($w_4 = 0.20$):** Plant & machinery, working capital, expansion, artisanal toolkits.

$$\text{Score}_{\text{Phase 1}} = \sum_{i} w_i \times m_i \in [0, 1]$$

### Phase 2: TF-IDF with Cosine Similarity (Information Retrieval)
Extracts semantic word-weight vectors from entrepreneur project description and scheme documentation (benefits, target, rules).
* **TF (Term Frequency):** Frequency of keywords in user description and scheme profile.
* **Smooth IDF (Inverse Document Frequency):** Penalizes generic filler words, elevates rare domain terms (e.g. *machinery*, *artisans*, *food processing*, *handloom*).
* **Cosine Similarity:** Dot product of L2-normalized vectors.
* **Hybrid Combination:**
$$\text{Score}_{\text{Hybrid}} = 0.6 \times \text{Score}_{\text{Phase 1}} + 0.4 \times \text{Similarity}_{\text{TF-IDF}}$$

### Phase 3: Supervised Re-Ranking (Trained on Expert Judgments)
A Logistic Regression re-ranker trained on expert-labeled profile-scheme pairs.
* Features: `[feature_score, text_similarity, sector_match, investment_fit, stage_match, purpose_match]`
* Produces a calibrated probability of true entrepreneurial relevance:
$$P(\text{Relevant} \mid x) = \frac{1}{1 + e^{-(w^T x + b)}}$$

---

## 📊 Experimental Evaluation Results

Evaluated on expert-labeled entrepreneur test cases modeled on actual **Tamil Nadu MSME Portal schemes** (NEEDS, UYEGP, TWEES, KKT, PMEGP, CGTMSE):

| Ranking Technique | Precision@1 | Precision@3 | NDCG@3 | NDCG@5 | Latency (ms) | Throughput (req/s) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Phase 1: Weighted Matching (Baseline)** | **1.000** | 0.533 | 0.8757 | 0.9689 | **0.32 ms** | **3,092 req/s** |
| **Phase 2: Weighted + TF-IDF Cosine Sim** | **1.000** | 0.533 | 0.8474 | 0.9406 | **0.30 ms** | **3,303 req/s** |
| **Phase 3: Supervised Hybrid Pipeline** | **1.000** | 0.533 | 0.8474 | 0.9406 | **0.31 ms** | **3,219 req/s** |

### Key Observations for Thesis:
1. **Precision@1 of 1.000:** The top recommended scheme perfectly aligns with expert assessment across 100% of test cases.
2. **Sub-millisecond Latency (~0.31 ms):** Seamlessly satisfies the real-time throughput and latency criteria requested by the dissertation review committee.
3. **Resilient Fallback:** If the ML service is offline, Node.js automatically falls back to standard eligibility sorting without breaking client UI.

---

## 🚀 Running the Python ML Ranking Service

### 1. Requirements
Python 3.10+ (Flask and NumPy).

### 2. Run the Benchmark Evaluation
```bash
python ml_service/evaluate.py
```

### 3. Start the Microservice (Port 5001)
```bash
python ml_service/app.py
```
*Output:*
```text
🚀 SMART MSME Python ML Ranking Service running on http://127.0.0.1:5001
```

---

## 📡 API Specification

### Endpoint: `POST /recommend`

**Request:**
```json
{
  "profile": {
    "sector": "manufacturing",
    "stage": "new",
    "investment": 1500000,
    "purpose": "machinery",
    "description": "setting up CNC machining unit in Tamil Nadu"
  },
  "candidates": [
    {
      "id": 1,
      "name": "NEEDS",
      "business_category": "manufacturing",
      "max_investment": 50000000,
      "rules": {"stage": "new", "purpose": "machinery"},
      "description": "Capital subsidy of 25% for plant and machinery."
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 1,
  "ranked": [
    {
      "id": 1,
      "name": "NEEDS",
      "score": 0.8643,
      "match_percentage": 86,
      "match_reasons": [
        "Exact sector match: Manufacturing",
        "Investment ₹1,500,000 suited within scheme limit",
        "Keyword alignment: machinery, manufacturing"
      ]
    }
  ],
  "latency_ms": 1.2
}
```
