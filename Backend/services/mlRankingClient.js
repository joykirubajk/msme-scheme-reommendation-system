import http from 'http';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001';

/**
 * Calls the Python ML Ranking Microservice to rank candidate schemes.
 * Flow:
 *   1. Node.js sends { profile, candidates } to Python POST /recommend
 *   2. Python computes Phase 1 (Weighted) + Phase 2 (TF-IDF) + Phase 3 (ML Score)
 *   3. Returns ranked schemes with scores and explainable match reasons.
 *   4. If Python is offline, gracefully falls back to default candidate order.
 */
export async function rankSchemesWithML(profile, candidates) {
    if (!candidates || candidates.length === 0) {
        return [];
    }

    const payload = JSON.stringify({
        profile: {
            sector: profile.sector || profile.business_category,
            stage: profile.stage || (profile.experience > 0 ? 'existing' : 'new'),
            investment: profile.investment || profile.project_cost || 0,
            purpose: profile.purpose || 'machinery',
            location: profile.location,
            social_category: profile.social_category,
            beneficiary_category: profile.beneficiary_category,
            education: profile.education,
            experience: profile.experience,
            age: profile.age,
            gender: profile.gender,
            description: profile.description || `${profile.business_category || 'MSME'} enterprise project in ${profile.location || 'Tamil Nadu'}`
        },
        candidates: candidates
    });

    const url = new URL(`${ML_SERVICE_URL}/recommend`);

    return new Promise((resolve) => {
        const req = http.request(
            {
                hostname: url.hostname,
                port: url.port || 5001,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                },
                timeout: 3000 // 3 seconds timeout
            },
            (res) => {
                let responseData = '';
                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(responseData);
                        if (parsed.success && Array.isArray(parsed.ranked)) {
                            console.log(`🤖 Python ML Ranking Service: Ranked ${parsed.ranked.length} schemes in ${parsed.latency_ms} ms`);
                            // Map ranked data with scheme attributes
                            const rankedSchemes = parsed.ranked.map((item) => {
                                const originalScheme = candidates.find((c) => c.id === item.id) || item.scheme;
                                return {
                                    ...originalScheme,
                                    ranking_score: item.score,
                                    match_percentage: item.match_percentage,
                                    match_reasons: item.match_reasons || [],
                                    phase1_feature_score: item.phase1_feature_score,
                                    phase2_text_similarity: item.phase2_text_similarity
                                };
                            });
                            return resolve(rankedSchemes);
                        }
                    } catch (parseErr) {
                        console.warn('⚠️ Could not parse Python ML response, using fallback order:', parseErr.message);
                    }
                    resolve(candidates);
                });
            }
        );

        req.on('error', (err) => {
            console.warn(`⚠️ Python ML Service unreachable at ${ML_SERVICE_URL} (${err.message}). Using eligibility fallback.`);
            // Fallback: return candidates with default match notice
            const fallback = candidates.map((scheme) => ({
                ...scheme,
                ranking_score: 0.75,
                match_percentage: 75,
                match_reasons: ['Eligible government scheme based on standard criteria']
            }));
            resolve(fallback);
        });

        req.on('timeout', () => {
            req.destroy();
            console.warn('⚠️ Python ML service request timed out. Using fallback.');
            resolve(candidates);
        });

        req.write(payload);
        req.end();
    });
}
