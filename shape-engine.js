/**
 * ShapeEngine v2.2.0
 * Core Deterministic Behavioral Analysis Engine
 */
const ENGINE_CONFIG = {
    VERSION: "2.2.0",
    EVENT_WEIGHTS: {
        'click': 1.0, 
        'keypress': 0.8, 
        'input': 0.8, 
        'scroll': 0.4, 
        'mousemove': 0.1, 
        'touchstart': 0.45,  // Dropped from 0.6. Combined with touchend, a tap is now 0.9 (normalized to a click)
        'touchmove': 0.1, 
        'touchend': 0.45,    // Dropped from 0.6. 
        'default': 0.1
    },
    // Comprehensive transition matrix incorporating symmetric relations,
    // self-loops, and cross-modality (mobile/desktop) transitions.
    COHERENCE_MATRIX: {
        'mousemove': { 'mousemove': 0.3, 'click': 0.8, 'scroll': 0.5, 'touchstart': 0.5, 'touchend': 0.5 },
        // Dropped 'mousemove' from 0.8 to 0.5 to punish erratic mashing
        'click': { 'mousemove': 0.5, 'click': 0.9, 'keypress': 0.8, 'scroll': 0.6, 'touchstart': 0.6, 'touchend': 0.6, 'input': 0.8 },
        'scroll': { 'scroll': 0.9, 'mousemove': 0.6, 'click': 0.7, 'touchstart': 0.8, 'touchmove': 0.8, 'touchend': 0.8 },
        // Dropped 'mousemove' from 0.4 to 0.2 to further isolate chaotic key-mashing
        'keypress': { 'keypress': 0.9, 'click': 0.7, 'mousemove': 0.2, 'input': 0.9 },
        'input': { 'input': 0.9, 'click': 0.8, 'keypress': 0.9, 'touchstart': 0.8, 'touchend': 0.8, 'touchmove': 0.6 },
        // Dropped 'touchmove' from 0.9 to 0.7 to prevent mobile swiping from auto-maxing coherence
        'touchstart': { 'touchmove': 0.7, 'touchend': 0.9, 'scroll': 0.8, 'input': 0.8, 'touchstart': 0.4, 'click': 0.6 },
        // Dropped 'touchmove' self-loop from 0.9 to 0.6 to allow casual swiping to register as Drift
        'touchmove': { 'touchmove': 0.6, 'touchend': 0.9, 'scroll': 0.8, 'touchstart': 0.8 },
        'touchend': { 'touchstart': 0.9, 'touchmove': 0.8, 'scroll': 0.8, 'click': 0.8, 'input': 0.8, 'touchend': 0.4 }
    },
    THRESHOLDS: {
        INTENSITY_SCALE: 3.5, 
        MIN_EVENTS: 3,
        IDLE_GAP_MS: 5000,          // Gap size above which intervals are labeled as idle phases
        MAX_RHYTHM_GAP_MS: 3000     // Upper bound limit on intervals to be considered in active rhythm analysis
    }
};

class ShapeEngine {
    /**
     * @param {Array} events - Collection of behavior events {type, ts}
     */
    constructor(events = []) {
        this.rawEvents = Array.isArray(events) ? events : [];
        this.processed = this.preprocess(this.rawEvents);
    }

    /**
     * Filters, validates, and chronologically sorts session events.
     */
    preprocess(events) {
        return events
            .filter(e => e && typeof e.ts === 'number' && typeof e.type === 'string')
            .sort((a, b) => a.ts - b.ts);
    }

    /**
     * Calculates the active interaction duration of the session.
     * Subtracts long idle gaps to prevent overall intensity dilution.
     * @returns {number} Active duration in seconds (clamped to a minimum of 0.5s).
     */
    getActiveDuration() {
        if (this.processed.length < 2) return 0.5;
        const totalDurationMs = this.processed[this.processed.length - 1].ts - this.processed[0].ts;
        let idleTimeMs = 0;

        for (let i = 1; i < this.processed.length; i++) {
            const gap = this.processed[i].ts - this.processed[i - 1].ts;
            if (gap > ENGINE_CONFIG.THRESHOLDS.IDLE_GAP_MS) {
                // Keep the threshold limit as active transition margin, subtract the rest
                idleTimeMs += (gap - ENGINE_CONFIG.THRESHOLDS.IDLE_GAP_MS);
            }
        }

        const activeDurationMs = Math.max(500, totalDurationMs - idleTimeMs);
        return activeDurationMs / 1000;
    }

    /**
     * Evaluates normalized interaction intensity.
     * Applies soft-saturation mapping and high-frequency event dampening
     * to prevent artificial inflation from mouse/touch movement spam.
     * @returns {number} Soft-saturated intensity score [0.0, 1.0].
     */
    calculateIntensity() {
        if (this.processed.length < 2) return 0;

        const activeDuration = this.getActiveDuration();
        let totalWeight = 0;

        for (let i = 0; i < this.processed.length; i++) {
            const currentEvent = this.processed[i];
            let weight = ENGINE_CONFIG.EVENT_WEIGHTS[currentEvent.type] || ENGINE_CONFIG.EVENT_WEIGHTS.default;

            // Apply dampening discount to high-frequency duplicate actions of the same event type
            if (i > 0) {
                const prevEvent = this.processed[i - 1];
                const dt = currentEvent.ts - prevEvent.ts;
                if (currentEvent.type === prevEvent.type && dt < 100) {
                    if (currentEvent.type === 'mousemove' || currentEvent.type === 'touchmove' || currentEvent.type === 'scroll') {
                        weight *= 0.15; // Heavily discount continuous high-frequency physical drifts
                    } else {
                        weight *= 0.50; // Moderately discount fast repetitive taps/clicks
                    }
                }
            }
            totalWeight += weight;
        }

        // Calculate raw density over active duration
        const rawDensity = totalWeight / (activeDuration * ENGINE_CONFIG.THRESHOLDS.INTENSITY_SCALE);
        
        // Use hyperbolic tangent (tanh) for smooth mathematical saturation instead of hard clamping
        return Math.tanh(rawDensity);
    }

    /**
     * Analyzes temporal regularity (rhythm) using the Coefficient of Variation (CV).
     * Incorporates robust outlier filtering and an exponential decay mapping curve.
     * @returns {number} Normalized rhythm score [0.0, 1.0].
     */
    calculateRhythm() {
        if (this.processed.length < 5) return 0;

        const intervals = [];
        for (let i = 1; i < this.processed.length; i++) {
            const dt = this.processed[i].ts - this.processed[i - 1].ts;
            // Exclude micro-jitters (< 5ms) and macro pauses (> 3000ms)
            if (dt >= 5 && dt < ENGINE_CONFIG.THRESHOLDS.MAX_RHYTHM_GAP_MS) {
                intervals.push(dt);
            }
        }

        if (intervals.length < 3) return 0;

        // Perform statistical filtering relative to the median interval
        const sorted = [...intervals].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] || 1;
        
        // Isolate active interaction intervals within a realistic human pacing band
        const filteredIntervals = intervals.filter(v => v >= median * 0.2 && v <= median * 3.0);

        if (filteredIntervals.length < 2) return 0;

        const mean = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
        const variance = filteredIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / filteredIntervals.length;
        const stdDev = Math.sqrt(variance);
        const cv = stdDev / (mean || 1);

        // Map CV to rhythm score via continuous Gaussian decay function.
        // A low CV (high timing consistency) yields a score near 1.0.
        return Math.exp(-1.5 * Math.pow(cv, 2));
    }

    /**
     * Quantifies exploratory diversity using Shannon Entropy of interaction event types.
     * Replaces discrete event counting with a continuous distribution measurement.
     * @returns {number} Normalized entropy-based exploration score [0.0, 1.0].
     */
    calculateExploration() {
        if (this.processed.length === 0) return 0;

        const counts = {};
        for (const e of this.processed) {
            counts[e.type] = (counts[e.type] || 0) + 1;
        }

        let entropy = 0;
        const total = this.processed.length;
        for (const type in counts) {
            const p = counts[type] / total;
            entropy -= p * Math.log(p);
        }

        // Normalize Shannon Entropy. Log of 4 active categories represents fully active exploration.
        // ln(4) ≈ 1.3863
        const targetMaxEntropy = 1.3863;
        return Math.min(entropy / targetMaxEntropy, 1.0);
    }

    /**
     * Quantifies sequential interaction flow.
     * Transitions not present in the matrix receive a default baseline 
     * to avoid over-penalizing uncommon but valid structural sequences.
     * @returns {number} Normalized coherence score [0.0, 1.0].
     */
    calculateCoherence() {
        if (this.processed.length < 2) return 0;
        let score = 0, transitions = 0;

        for (let i = 1; i < this.processed.length; i++) {
            const prev = this.processed[i - 1].type;
            const curr = this.processed[i].type;
            const matrix = ENGINE_CONFIG.COHERENCE_MATRIX[prev];
            
            if (matrix) {
                score += (matrix[curr] !== undefined ? matrix[curr] : 0.15);
            } else {
                score += 0.15;
            }
            transitions++;
        }

        return transitions > 0 ? score / transitions : 0;
    }

    /**
     * Maps inputs to continuous candidate functions, maximizing shape separability 
     * and reducing classification overlap.
     * @param {Object} m - Object containing calculated metrics {intensity, rhythm, exploration, coherence}
     * @returns {Array} Array of candidate scoring objects
     */
    getShapeScores(m) {
        const i = m.intensity;
        const r = m.rhythm;
        const e = m.exploration;
        const c = m.coherence;

        // Gaussian fit centered at 0.5 for mid-range distribution matching
        const getMidRangeFit = (val) => Math.exp(-4.0 * Math.pow(val - 0.5, 2));

        // --- Steady ---
        // Requires high rhythm AND high coherence. Multiplicative coupling ensures 
        // that failure in either metric strongly suppresses the overall score.
        // Attenuated slightly at high intensity levels (which are inherently bursts).
        const steadyScore = Math.max(0, Math.pow(r * c, 1.2) * (1.0 - 0.4 * Math.pow(i, 2)) * (1.0 - 0.3 * Math.pow(e, 2)));

        // --- Burst ---
        // Driven by intensity and coherence. Penalized when coherence drops
        // (fragmentation) to distinguish purposeful bursts from high-speed noise.
        const burstScore = Math.max(0, (i * c) * (1.0 - 0.4 * e) * (0.7 + 0.3 * r));

        // --- Drift ---
        // Defined by active exploratory variety combined with relaxed, natural rhythm 
        // and coherence pacing (centered around 0.5). Suppressed at high intensities.
        const driftScore = Math.max(0, e * getMidRangeFit(r) * getMidRangeFit(c) * (1.0 - 0.5 * i));

        // --- Chaotic ---
        // High intensity coupled with poor rhythm and poor coherence.
        // Formulated to fall to near-zero when coherence or rhythm rises, preventing false positives.
        const chaoticScore = Math.max(0, i * (1.0 - c) * (1.0 - 0.5 * r));

        // --- Flat ---
        // Represents baseline inactivity. Formulated as a smooth mathematical inverse
        // of overall active metrics, decaying rapidly when any structured behavior emerges.
        const flatScore = Math.max(0, (1.0 - i) * (1.0 - 0.7 * c) * (1.0 - 0.7 * r) * (1.0 - 0.5 * e));

        return [
            {
                name: 'steady',
                score: steadyScore,
                reasoning: `Strong rhythmic patterns (${(r * 100).toFixed(0)}%) and highly logical behavior flow.`
            },
            {
                name: 'burst',
                score: burstScore,
                reasoning: `High-velocity interaction (${(i * 10).toFixed(1)} intensity) with identifiable intent.`
            },
            {
                name: 'drift',
                score: driftScore,
                reasoning: `Sustained exploratory behavior (${(e * 100).toFixed(0)}% variety) with natural variance in timing.`
            },
            {
                name: 'chaotic',
                score: chaoticScore,
                reasoning: `High activity levels combined with fragmented structural coherence.`
            },
            {
                name: 'flat',
                score: flatScore,
                reasoning: `Minimal structural presence; session dominated by behavioral idleness.`
            }
        ];
    }

    /**
     * Conducts deterministic behavioral analysis and returns the primary classification payload.
     * @returns {Object} Analytical assessment result
     */
    analyze() {
        if (this.processed.length < ENGINE_CONFIG.THRESHOLDS.MIN_EVENTS) {
            return this.getNullShape("Insufficient data for behavioral analysis.");
        }

        const metrics = {
            intensity: this.calculateIntensity(),
            rhythm: this.calculateRhythm(),
            exploration: this.calculateExploration(),
            coherence: this.calculateCoherence()
        };

        const candidates = this.getShapeScores(metrics).sort((a, b) => b.score - a.score);
        const winner = candidates[0];
        const runnerUp = candidates[1];
        
        // Compute relative difference (gap) between winner and runner-up
        const confidence = Math.min(Math.max(winner.score - (runnerUp ? runnerUp.score : 0), 0), 1);

        return {
            shape_version: ENGINE_CONFIG.VERSION,
            primary_shape: winner.name,
            intensity: Number(metrics.intensity.toFixed(3)),
            rhythm: Number(metrics.rhythm.toFixed(3)),
            exploration: Number(metrics.exploration.toFixed(3)),
            coherence: Number(metrics.coherence.toFixed(3)),
            confidence: Number(confidence.toFixed(3)),
            explanation: winner.reasoning
        };
    }

    /**
     * Safe fallback shape when minimum event thresholds are not satisfied.
     */
    getNullShape(msg) {
        return {
            shape_version: ENGINE_CONFIG.VERSION, 
            primary_shape: "flat",
            intensity: 0, 
            rhythm: 0, 
            exploration: 0, 
            coherence: 0, 
            confidence: 0,
            explanation: msg
        };
    }
}

// Global browser interaction tracker hook
(function () {
    const interactionEvents = [];
    
    function recordEvent(type) {
        interactionEvents.push({
            type: type,
            ts: Date.now()
        });
        
        // Cap local storage buffer size safely to prevent memory bloat over long sessions
        if (interactionEvents.length > 2000) {
            interactionEvents.shift();
        }
    }

    // Set passive listeners to prevent scroll/touch stuttering
    const eventTypes = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'input'];
    eventTypes.forEach(function (type) {
        window.addEventListener(type, function () {
            recordEvent(type);
        }, { passive: true });
    });

    // Provide static initialization method for tracking hook on unload
    ShapeEngine.getSessionShape = function () {
        const engineInstance = new ShapeEngine(interactionEvents);
        return engineInstance.analyze();
    };
})();
