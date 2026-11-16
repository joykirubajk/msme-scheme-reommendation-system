"""
SMART MSME: Expert Labeled Profiles Dataset
Designed for Evaluation of Recommendation Accuracy using Precision@K and NDCG@K
Domain Ground Truth validated against Tamil Nadu MSME Portal Scheme Guidelines.
"""

# Expert Labeled Profiles with Ground Truth Relevance Judgments (1 = Relevant, 0 = Not Relevant)
# Each profile contains entrepreneur attributes and an expert ranking of candidate schemes.
EXPERT_LABELED_PROFILES = [
    {
        "id": "PROF_01",
        "name": "First-gen Engineering Graduate (Machinery Project in Coimbatore)",
        "profile": {
            "sector": "manufacturing",
            "stage": "new",
            "investment": 2500000,
            "purpose": "machinery",
            "education": "graduation",
            "location": "tamil_nadu",
            "age": 26,
            "gender": "male",
            "description": "Setting up an auto-component precision machining manufacturing unit with CNC lathe machinery in Coimbatore industrial estate."
        },
        # Ground-truth relevance labels for evaluation
        "ground_truth": {
            1: 1,  # NEEDS - Ideal match (first generation, manufacturing, 25L, machinery subsidy)
            5: 1,  # PMEGP - Highly relevant manufacturing credit-linked subsidy
            6: 0,  # CGTMSE - Collateral-free guarantee, but secondary compared to direct capital subsidy
            2: 0,  # UYEGP - Cap is 15L max, 25L exceeds UYEGP scope
            3: 0,  # TWEES - Women only
            4: 0   # KKT - Traditional artisans
        },
        "ideal_ranking": [1, 5, 6, 2, 4, 3]
    },
    {
        "id": "PROF_02",
        "name": "Woman Entrepreneur Starting Food Processing Unit in Madurai",
        "profile": {
            "sector": "manufacturing",
            "stage": "new",
            "investment": 900000,
            "purpose": "machinery",
            "education": "12th",
            "location": "tamil_nadu",
            "age": 32,
            "gender": "female",
            "social_category": "obc",
            "beneficiary_category": "women",
            "description": "Establishing an organic spice processing and packaging micro-enterprise with modern pulverizing machines in Madurai."
        },
        "ground_truth": {
            3: 1,  # TWEES - Primary target (Women entrepreneur, micro enterprise, 9L)
            2: 1,  # UYEGP - Highly relevant for 9L manufacturing with 25% subsidy
            5: 1,  # PMEGP - Relevant rural/urban manufacturing subsidy
            1: 0,  # NEEDS - Minimum project cost is 10L, 9L is below threshold
            6: 0,  # CGTMSE - Secondary
            4: 0   # KKT - Artisans
        },
        "ideal_ranking": [3, 2, 5, 6, 1, 4]
    },
    {
        "id": "PROF_03",
        "name": "Unemployed Youth Starting Service Center in Tiruchirappalli",
        "profile": {
            "sector": "service",
            "stage": "new",
            "investment": 450000,
            "purpose": "working_capital",
            "education": "10th",
            "location": "tamil_nadu",
            "age": 24,
            "gender": "male",
            "social_category": "sc",
            "description": "Starting a two-wheeler multi-brand repair and servicing center with diagnostic tools in Trichy."
        },
        "ground_truth": {
            2: 1,  # UYEGP - Primary match (Service up to 5L, unemployed youth, 25% subsidy)
            5: 1,  # PMEGP - Service scheme up to 20L
            1: 0,  # NEEDS - Min 10L project cost
            3: 0,  # TWEES - Female only
            4: 0,  # KKT - Artisans
            6: 0   # CGTMSE - Small scale
        },
        "ideal_ranking": [2, 5, 6, 1, 4, 3]
    },
    {
        "id": "PROF_04",
        "name": "Traditional Bronze Artisan Modernizing Workshop in Thanjavur",
        "profile": {
            "sector": "manufacturing",
            "stage": "existing",
            "investment": 350000,
            "purpose": "equipment",
            "education": "8th",
            "location": "tamil_nadu",
            "age": 42,
            "gender": "male",
            "description": "Traditional handicraft artisan modernizing casting equipment and polishing tools for Thanjavur art plates and bronze idols."
        },
        "ground_truth": {
            4: 1,  # KKT - Primary match (Traditional artisans and craftsmen, toolkit grant, soft loan)
            2: 1,  # UYEGP - Micro enterprise subsidy
            5: 0,  # PMEGP - Secondary
            1: 0,  # NEEDS - Min 10L
            3: 0,  # TWEES - Women only
            6: 0   # CGTMSE - Non-collateral guarantee
        },
        "ideal_ranking": [4, 2, 5, 6, 1, 3]
    },
    {
        "id": "PROF_05",
        "name": "Existing Tech Service Firm Expanding Infrastructure in Chennai",
        "profile": {
            "sector": "service",
            "stage": "existing",
            "investment": 12000000,
            "purpose": "expansion",
            "education": "postgraduation",
            "location": "tamil_nadu",
            "age": 38,
            "gender": "male",
            "description": "Expanding cloud IT services, server hardware, and testing infrastructure for enterprise clients in Chennai."
        },
        "ground_truth": {
            6: 1,  # CGTMSE - Primary match (Collateral-free credit up to 5 Cr for existing MSMEs)
            1: 0,  # NEEDS - First generation/new units primarily
            2: 0,  # UYEGP - Max 5L service
            3: 0,  # TWEES - Women only, max 10L
            4: 0,  # KKT - Artisans only
            5: 0   # PMEGP - New units primarily
        },
        "ideal_ranking": [6, 1, 5, 2, 4, 3]
    }
]
