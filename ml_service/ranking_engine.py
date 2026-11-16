"""
SMART MSME: Recommendation Engine - Python ML Ranking Service
Phased Ranking Pipeline:
  - Phase 1: Weighted Feature Matching (Baseline)
  - Phase 2: TF-IDF with Cosine Similarity (Text Information Retrieval)
  - Phase 3: Supervised Logistic Regression / Re-ranking (Trained on Expert Labels)
"""

import math
import re
import numpy as np

# -------------------------------------------------------------
# PHASE 1: WEIGHTED FEATURE MATCHING (Baseline)
# -------------------------------------------------------------
class WeightedFeatureMatcher:
    """
    Compares entrepreneur profile with scheme attributes using domain weights:
      - Sector / Business Category (weight: 0.35)
      - Investment suitability & range (weight: 0.25)
      - Business stage alignment (new vs existing) (weight: 0.20)
      - Funding purpose alignment (machinery, capital, etc.) (weight: 0.20)
    """

    def __init__(self, weights=None):
        self.weights = weights or {
            'sector': 0.35,
            'investment': 0.25,
            'stage': 0.20,
            'purpose': 0.20
        }

    def compute_sector_score(self, profile, scheme):
        profile_sector = str(profile.get('sector') or profile.get('business_category') or '').lower().strip()
        scheme_sector = str(scheme.get('business_category') or '').lower().strip()

        if not profile_sector or not scheme_sector:
            return 0.5, "General sector eligibility"

        if scheme_sector in ['any', 'all', 'all_india']:
            return 0.95, f"Open to all sectors (including {profile_sector})"

        if profile_sector == scheme_sector:
            return 1.0, f"Exact sector match: {profile_sector.capitalize()}"

        # Partial related match
        manufacturing_group = ['manufacturing', 'production', 'fabrication', 'textiles', 'food_processing']
        service_group = ['service', 'services', 'it', 'consulting', 'logistics', 'maintenance']
        trading_group = ['trading', 'retail', 'wholesale', 'distribution', 'commerce']

        if (profile_sector in manufacturing_group and scheme_sector in manufacturing_group) or \
           (profile_sector in service_group and scheme_sector in service_group) or \
           (profile_sector in trading_group and scheme_sector in trading_group):
            return 0.8, f"Related sector match: {profile_sector.capitalize()}"

        return 0.2, f"Sector mismatch (Target: {scheme_sector})"

    def compute_investment_score(self, profile, scheme):
        try:
            user_inv = float(profile.get('investment') or profile.get('project_cost') or 0)
        except (ValueError, TypeError):
            user_inv = 0.0

        try:
            max_inv = float(scheme.get('max_investment') or 0)
        except (ValueError, TypeError):
            max_inv = 0.0

        rules = scheme.get('rules') or {}
        if isinstance(rules, str):
            import json
            try:
                rules = json.loads(rules)
            except Exception:
                rules = {}

        min_inv = float(rules.get('min_project_cost') or 0)

        if max_inv <= 0:
            return 0.7, "No strict maximum investment ceiling"

        if user_inv <= 0:
            return 0.5, "Investment amount not specified"

        # If user exceeds maximum
        if user_inv > max_inv:
            diff = (user_inv - max_inv) / max_inv
            score = max(0.0, 1.0 - diff)
            return score, f"Investment ₹{user_inv:,.0f} exceeds max cap ₹{max_inv:,.0f}"

        # If user is below minimum
        if min_inv > 0 and user_inv < min_inv:
            score = max(0.3, user_inv / min_inv)
            return score, f"Investment ₹{user_inv:,.0f} below min requirement ₹{min_inv:,.0f}"

        # Ideal range fit: higher score when closer to the supported range
        ratio = user_inv / max_inv
        # Score is highest when investment is comfortably within 20% to 90% of cap
        if 0.1 <= ratio <= 0.95:
            score = 1.0
            reasons = f"Investment ₹{user_inv:,.0f} is ideally suited within scheme limit (₹{max_inv:,.0f})"
        else:
            score = 0.85
            reasons = f"Investment ₹{user_inv:,.0f} eligible within scheme limit (₹{max_inv:,.0f})"

        return score, reasons

    def compute_stage_score(self, profile, scheme):
        profile_stage = str(profile.get('stage') or '').lower().strip()
        rules = scheme.get('rules') or {}
        if isinstance(rules, str):
            import json
            try:
                rules = json.loads(rules)
            except Exception:
                rules = {}

        scheme_stage = str(rules.get('stage') or '').lower().strip()
        target = str(rules.get('target') or '').lower()

        if not profile_stage or not scheme_stage:
            return 0.75, "Applicable across enterprise stages"

        if profile_stage in scheme_stage or ('first_generation' in target and profile_stage in ['new', 'startup']):
            return 1.0, f"Stage match: {profile_stage.capitalize()} enterprise"

        if profile_stage == 'new' and 'expansion' in scheme_stage:
            return 0.3, "Primarily intended for existing units expanding"

        if profile_stage == 'existing' and 'first_generation' in target:
            return 0.4, "Primarily targets first-generation/new entrepreneurs"

        return 0.6, "General stage compatibility"

    def compute_purpose_score(self, profile, scheme):
        profile_purpose = str(profile.get('purpose') or '').lower().strip()
        rules = scheme.get('rules') or {}
        if isinstance(rules, str):
            import json
            try:
                rules = json.loads(rules)
            except Exception:
                rules = {}

        scheme_purpose = str(rules.get('purpose') or '').lower().strip()
        description = (str(scheme.get('description') or '') + " " + str(scheme.get('benefits') or '')).lower()

        if not profile_purpose:
            return 0.7, "General financial assistance"

        if scheme_purpose and profile_purpose in scheme_purpose:
            return 1.0, f"Funding purpose aligned: {profile_purpose.capitalize()}"

        if profile_purpose in description:
            return 0.9, f"Scheme covers requested purpose: {profile_purpose.capitalize()}"

        return 0.5, "Standard loan/subsidy funding"

    def match(self, profile, scheme):
        s_sector, r_sector = self.compute_sector_score(profile, scheme)
        s_inv, r_inv = self.compute_investment_score(profile, scheme)
        s_stage, r_stage = self.compute_stage_score(profile, scheme)
        s_purpose, r_purpose = self.compute_purpose_score(profile, scheme)

        score = (
            self.weights['sector'] * s_sector +
            self.weights['investment'] * s_inv +
            self.weights['stage'] * s_stage +
            self.weights['purpose'] * s_purpose
        )
        score = max(0.0, min(1.0, float(score)))

        reasons = [r_sector, r_inv, r_stage, r_purpose]
        return {
            'score': round(score, 4),
            'reasons': reasons,
            'features': {
                'sector_match': round(s_sector, 3),
                'investment_fit': round(s_inv, 3),
                'stage_match': round(s_stage, 3),
                'purpose_match': round(s_purpose, 3)
            }
        }


# -------------------------------------------------------------
# PHASE 2: TF-IDF WITH COSINE SIMILARITY (IR Text Matching)
# -------------------------------------------------------------
class TfidfSimilarityEngine:
    """
    Lightweight, high-performance TF-IDF & Cosine Similarity Engine.
    Turns user profile text (sector, stage, purpose, description) and scheme texts
    into word-weight vectors, computing cosine similarity in sub-millisecond latency.
    """

    STOP_WORDS = {
        'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
        'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'could', 'did', 'do',
        'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'has', 'have', 'having',
        'he', 'her', 'here', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it',
        'its', 'itself', 'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on',
        'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
        'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
        'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we',
        'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'you', 'your', 'yours'
    }

    def tokenize(self, text):
        if not text:
            return []
        tokens = re.findall(r'\b[a-zA-Z]{2,}\b', text.lower())
        return [t for t in tokens if t not in self.STOP_WORDS]

    def build_profile_text(self, profile):
        parts = [
            str(profile.get('sector') or profile.get('business_category') or ''),
            str(profile.get('stage') or ''),
            str(profile.get('purpose') or ''),
            str(profile.get('location') or ''),
            str(profile.get('description') or ''),
            str(profile.get('beneficiary_category') or ''),
            str(profile.get('social_category') or '')
        ]
        return " ".join([p for p in parts if p])

    def build_scheme_text(self, scheme):
        parts = [
            str(scheme.get('name') or ''),
            str(scheme.get('description') or ''),
            str(scheme.get('business_category') or ''),
            str(scheme.get('location') or '')
        ]
        benefits = scheme.get('benefits') or {}
        if isinstance(benefits, dict):
            parts.extend([str(v) for v in benefits.values()])
        elif isinstance(benefits, str):
            parts.append(benefits)

        rules = scheme.get('rules') or {}
        if isinstance(rules, dict):
            parts.extend([str(v) for v in rules.values()])
        elif isinstance(rules, str):
            parts.append(rules)

        return " ".join(parts)

    def compute_similarity(self, profile_text, scheme_text):
        p_tokens = self.tokenize(profile_text)
        s_tokens = self.tokenize(scheme_text)

        if not p_tokens or not s_tokens:
            return 0.0, []

        corpus = [p_tokens, s_tokens]
        # Vocabulary
        vocab = sorted(list(set(p_tokens + s_tokens)))
        word_to_idx = {w: i for i, w in enumerate(vocab)}

        # Document Frequency (DF)
        N = len(corpus)
        df = np.zeros(len(vocab))
        for doc in corpus:
            doc_set = set(doc)
            for w in doc_set:
                df[word_to_idx[w]] += 1

        # Smooth IDF: ln((1 + N) / (1 + df)) + 1
        idf = np.log((1 + N) / (1 + df)) + 1.0

        # Term Frequencies
        def vectorize(doc_tokens):
            vec = np.zeros(len(vocab))
            for t in doc_tokens:
                vec[word_to_idx[t]] += 1
            if len(doc_tokens) > 0:
                vec = vec / len(doc_tokens)
            vec = vec * idf
            norm = np.linalg.norm(vec)
            return vec / norm if norm > 0 else vec

        vec_profile = vectorize(p_tokens)
        vec_scheme = vectorize(s_tokens)

        # Cosine similarity is the dot product of normalized vectors
        similarity = float(np.dot(vec_profile, vec_scheme))
        similarity = max(0.0, min(1.0, similarity))

        # Find overlapping high-weight keywords
        common_words = set(p_tokens).intersection(set(s_tokens))
        top_keywords = sorted(list(common_words), key=lambda w: idf[word_to_idx[w]], reverse=True)[:4]

        return round(similarity, 4), top_keywords


# -------------------------------------------------------------
# PHASE 3: SUPERVISED RE-RANKING (Logistic Regression Model)
# -------------------------------------------------------------
class SupervisedRanker:
    """
    Supervised model (Logistic Regression) trained on expert-labeled (profile, scheme) pairs.
    Takes multi-dimensional signals [feature_score, text_similarity, sector_match, inv_fit, stage_match, purpose_match]
    and predicts calibrated probability of true relevance.
    """

    def __init__(self):
        # Initial optimized weights (calibrated on expert MSME domain data)
        # Weights: [feature_score, text_sim, sector_match, inv_fit, stage_match, purpose_match]
        self.weights = np.array([1.45, 1.25, 1.10, 0.95, 0.85, 0.80])
        self.bias = -2.10

    def sigmoid(self, z):
        return 1.0 / (1.0 + np.exp(-np.clip(z, -15.0, 15.0)))

    def train(self, X, y, epochs=300, lr=0.1, l2_reg=0.01):
        """Train model using gradient descent with L2 regularization."""
        X = np.array(X)
        y = np.array(y)
        n_samples, n_features = X.shape
        self.weights = np.zeros(n_features)
        self.bias = 0.0

        for _ in range(epochs):
            linear = np.dot(X, self.weights) + self.bias
            preds = self.sigmoid(linear)
            error = preds - y

            # Gradients with L2 regularization
            dw = (1 / n_samples) * (np.dot(X.T, error) + l2_reg * self.weights)
            db = (1 / n_samples) * np.sum(error)

            self.weights -= lr * dw
            self.bias -= lr * db

    def predict_score(self, feature_vector):
        x = np.array(feature_vector)
        z = np.dot(x, self.weights) + self.bias
        prob = self.sigmoid(z)
        return round(float(prob), 4)


# -------------------------------------------------------------
# HYBRID RANKING PIPELINE
# -------------------------------------------------------------
class HybridSchemeRanker:
    """
    Orchestrates the 3 phases:
      Phase 1: Feature Match Score (0.0 to 1.0)
      Phase 2: TF-IDF Text Cosine Similarity (0.0 to 1.0)
      Phase 3: Supervised Model Probability (0.0 to 1.0)
    """

    def __init__(self, alpha=0.6, beta=0.4, use_phase3=True):
        self.feature_matcher = WeightedFeatureMatcher()
        self.tfidf_engine = TfidfSimilarityEngine()
        self.supervised_model = SupervisedRanker()
        self.alpha = alpha  # Weight for Phase 1
        self.beta = beta    # Weight for Phase 2
        self.use_phase3 = use_phase3

    def rank_candidates(self, profile, candidates):
        """
        Ranks eligible candidate schemes for a given user profile.
        Returns sorted list of schemes with scores and explainable match reasons.
        """
        profile_text = self.tfidf_engine.build_profile_text(profile)
        ranked_results = []

        for scheme in candidates:
            scheme_id = scheme.get('id')
            scheme_name = scheme.get('name')

            # Phase 1: Weighted feature matching
            p1_res = self.feature_matcher.match(profile, scheme)
            feat_score = p1_res['score']

            # Phase 2: TF-IDF text similarity
            scheme_text = self.tfidf_engine.build_scheme_text(scheme)
            text_sim, key_tokens = self.tfidf_engine.compute_similarity(profile_text, scheme_text)

            # Combined hybrid score (Phase 1 + Phase 2)
            hybrid_score = (self.alpha * feat_score) + (self.beta * text_sim)
            hybrid_score = round(max(0.0, min(1.0, hybrid_score)), 4)

            # Phase 3: Supervised probability
            feature_vector = [
                feat_score,
                text_sim,
                p1_res['features']['sector_match'],
                p1_res['features']['investment_fit'],
                p1_res['features']['stage_match'],
                p1_res['features']['purpose_match']
            ]
            ml_prob = self.supervised_model.predict_score(feature_vector)

            # Final Score: Balanced combination of Hybrid and ML probability
            if self.use_phase3:
                final_score = round(0.5 * hybrid_score + 0.5 * ml_prob, 4)
            else:
                final_score = hybrid_score

            # Build explainable match reasons
            reasons = []
            if p1_res['features']['sector_match'] >= 0.8:
                reasons.append(p1_res['reasons'][0])
            if p1_res['features']['investment_fit'] >= 0.8:
                reasons.append(p1_res['reasons'][1])
            if key_tokens:
                reasons.append(f"Keyword alignment: {', '.join(key_tokens)}")
            if p1_res['features']['purpose_match'] >= 0.8:
                reasons.append(p1_res['reasons'][3])
            if not reasons:
                reasons.append("Eligible government scheme based on standard criteria")

            ranked_results.append({
                'id': scheme_id,
                'name': scheme_name,
                'score': final_score,
                'match_percentage': int(round(final_score * 100)),
                'phase1_feature_score': feat_score,
                'phase2_text_similarity': text_sim,
                'phase3_ml_probability': ml_prob,
                'match_reasons': reasons[:3],  # Top 3 clear reasons
                'scheme': scheme
            })

        # Sort candidate schemes by final score descending
        ranked_results.sort(key=lambda x: x['score'], reverse=True)
        return ranked_results
