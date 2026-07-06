/**
 * ShapeEngine v2.2.0
 * Core Deterministic Behavioral Analysis Engine
 */
const ENGINE_CONFIG = {
    VERSION: "2.2.0",
    EVENT_WEIGHTS: {
        'click': 1.0, 'keypress': 0.8, 'input': 0.8, 'scroll': 0.4,
        'mousemove': 0.1, 'touchstart': 0.6, 'touchmove': 0.1, 'touchend': 0.6, 'default': 0.1
    },
    COHERENCE_MATRIX: {
        'mousemove': { 'mousemove': 0.1, 'click': 1.0, 'scroll': 0.1, 'touchstart': 0.2 },
        'click': { 'mousemove': 0.6, 'keypress': 0.8, 'scroll': 0.0, 'touchstart': 0.4 },
        'scroll': { 'scroll': 0.9, 'mousemove': 0.1, 'click': 0.8, 'touchstart': 0.5 },
        'keypress': { 'keypress': 0.9, 'click': 0.1, 'mousemove': 0.0, 'input': 0.9 },
        'input': { 'input': 0.9, 'click': 0.2, 'keypress': 0.9 },
        'touchstart': { 'touchmove': 0.9, 'touchend': 0.8, 'scroll': 0.3 },
        'touchmove': { 'touchmove': 0.9, 'touchend': 0.9, 'scroll': 0.5 },
        'touchend': { 'touchstart': 0.8, 'scroll': 0.6, 'click': 0.9, 'mousemove': 0.1 }
    },
    THRESHOLDS: {
        INTENSITY_SCALE: 3.5,
        MIN_EVENTS: 3
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

    preprocess(events) {
        return events
            .filter(e => e && typeof e.ts === 'number' && typeof e.type === 'string')
            .sort((a, b) => a.ts - b.ts);
    }

    /**
     * Logic preserved exactly from v2.1.2
     */
    calculateIntensity() {
        if (this.processed.length < 2) return 0;
        const duration = Math.max((this.processed[this.processed.length - 1].ts - this.processed[0].ts) / 1000, 0.5);
        const totalWeight = this.processed.reduce((sum, e) => {
            return sum + (ENGINE_CONFIG.EVENT_WEIGHTS[e.type] || ENGINE_CONFIG.EVENT_WEIGHTS.default);
        }, 0);
        return Math.min(totalWeight / (duration * ENGINE_CONFIG.THRESHOLDS.INTENSITY_SCALE), 1.0);
    }

    calculateRhythm() {
        if (this.processed.length < 5) return 0;
        const intervals = [];
        for (let i = 1; i < this.processed.length; i++) {
            intervals.push(this.processed[i].ts - this.processed[i - 1].ts);
        }
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / intervals.length;
        const cv = Math.sqrt(variance) / (mean || 1);
        return Math.max(0, 1 - Math.min(cv, 1.2));
    }

    calculateExploration() {
        const types = new Set(this.processed.map(e => e.type));
        const possible = Object.keys(ENGINE_CONFIG.EVENT_WEIGHTS).length - 1;
        return Math.min(types.size / possible, 1.0);
    }

    calculateCoherence() {
        if (this.processed.length < 2) return 0;
        let score = 0, transitions = 0;
        for (let i = 1; i < this.processed.length; i++) {
            const prev = this.processed[i - 1].type;
            const curr = this.processed[i].type;
            const matrix = ENGINE_CONFIG.COHERENCE_MATRIX[prev];
            if (matrix) {
                // If transition not in matrix, it is penalized as noise (0.0)
                score += (matrix[curr] !== undefined ? matrix[curr] : 0.0);
                transitions++;
            }
        }
        return transitions > 0 ? score / transitions : 0;
    }

    getShapeScores(m) {
        const getMidRangeFit = (val) => 1 - (Math.abs(val - 0.5) * 2);

        // Continuous burst rhythm penalty: smoothly penalizes burst as rhythm falls below 0.5 and intensity rises
        const burstRhythmPenalty = Math.max(0, 0.5 - m.rhythm) * m.intensity * 0.3;

        // Continuous burst fragmentation penalty: reduces burst score when transition coherence is low
        const burstFragmentationPenalty = Math.max(0, 0.65 - m.coherence) * 0.55;

        // Continuous steady variety penalty: penalizes steady as exploratory variety rises
        const steadyVarietyPenalty = Math.max(0, m.exploration - 0.4) * 0.25;

        // Continuous idle-then-active boost: scales smoothly when coherence is high and rhythm is low
        const idleActiveBoost = Math.max(0, m.coherence - 0.6) * Math.max(0, 0.3 - m.rhythm) * 3.0;

        // Continuous drift fragmentation penalty: smoothly penalizes drift as both coherence and rhythm drop below 0.5
        const driftFragmentationPenalty = Math.max(0, 0.5 - m.coherence) * Math.max(0, 0.5 - m.rhythm) * 0.8;

        // Balanced flat score: prevents long sessions with active exploration and structure from collapsing into Flat
        const flatScore = Math.max(0, 0.95 * (1 - m.intensity) - (m.rhythm * 0.4) - (m.coherence * 0.45) - (m.exploration * 0.35));

        return [
            {
                name: 'steady',
                score: Math.max(0, (m.rhythm * 0.3) + (m.coherence * 0.6) + (m.exploration * 0.1) - steadyVarietyPenalty),
                reasoning: `Strong rhythmic patterns (${(m.rhythm * 100).toFixed(0)}%) and highly logical behavior flow.`
            },
            {
                name: 'burst',
                score: Math.max(0, (m.intensity * 0.6) + (m.coherence * 0.2) + (m.rhythm * 0.2) - burstRhythmPenalty - burstFragmentationPenalty + idleActiveBoost),
                reasoning: `High-velocity interaction (${(m.intensity * 10).toFixed(1)} intensity) with identifiable intent.`
            },
            {
                name: 'drift',
                score: Math.max(0, (m.exploration * 0.5) + (getMidRangeFit(m.rhythm) * 0.25) + (getMidRangeFit(m.coherence) * 0.25) - driftFragmentationPenalty),
                reasoning: `Sustained exploratory behavior (${(m.exploration * 100).toFixed(0)}% variety) with natural variance in timing.`
            },
            {
                name: 'chaotic',
                score: (m.intensity * 0.5) + ((1 - m.coherence) * 0.3) + ((1 - m.rhythm) * 0.2),
                reasoning: `High activity levels combined with fragmented structural coherence.`
            },
            {
                name: 'flat',
                score: flatScore,
                reasoning: `Minimal structural presence; session dominated by behavioral idleness.`
            }
        ];
    }

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

    getNullShape(msg) {
        return {
            shape_version: ENGINE_CONFIG.VERSION, primary_shape: "flat",
            intensity: 0, rhythm: 0, exploration: 0, coherence: 0, confidence: 0,
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