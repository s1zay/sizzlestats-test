--- START OF FILE shape-engine.js ---

/**
 * ShapeEngine v3.0.0
 * Core Dynamic State Estimator and Chronological Segmenter
 */
const ENGINE_CONFIG = {
    VERSION: "3.0.0",
    EVENT_WEIGHTS: {
        'click': 1.0, 
        'keypress': 0.8, 
        'input': 0.8, 
        'scroll': 0.4, 
        'mousemove': 0.1, 
        'touchstart': 0.45,  
        'touchmove': 0.1, 
        'touchend': 0.45,    
        'default': 0.1
    },
    COHERENCE_MATRIX: {
        'mousemove': { 'mousemove': 0.3, 'click': 0.8, 'scroll': 0.5, 'touchstart': 0.5, 'touchend': 0.5 },
        'click': { 'mousemove': 0.5, 'click': 0.9, 'keypress': 0.8, 'scroll': 0.6, 'touchstart': 0.6, 'touchend': 0.6, 'input': 0.8 },
        'scroll': { 'scroll': 0.9, 'mousemove': 0.6, 'click': 0.7, 'touchstart': 0.8, 'touchmove': 0.8, 'touchend': 0.8 },
        'keypress': { 'keypress': 0.9, 'click': 0.7, 'mousemove': 0.2, 'input': 0.9 },
        'input': { 'input': 0.9, 'click': 0.8, 'keypress': 0.9, 'touchstart': 0.8, 'touchend': 0.8, 'touchmove': 0.6 },
        'touchstart': { 'touchmove': 0.7, 'touchend': 0.9, 'scroll': 0.8, 'input': 0.8, 'touchstart': 0.4, 'click': 0.6 },
        'touchmove': { 'touchmove': 0.6, 'touchend': 0.9, 'scroll': 0.8, 'touchstart': 0.8 },
        'touchend': { 'touchstart': 0.9, 'touchmove': 0.8, 'scroll': 0.8, 'click': 0.8, 'input': 0.8, 'touchend': 0.4 }
    },
    THRESHOLDS: {
        INTENSITY_SCALE: 3.5, 
        MIN_EVENTS: 3,
        MIN_SEGMENT_EVENTS: 4,      // Minimum events required to establish a segment
        VARIANCE_SPLIT: 0.32,        // Threshold of metric deviation to trigger segment split
        IDLE_GAP_MS: 5000,          // Gap size above which a timeline split is forced
        MAX_RHYTHM_GAP_MS: 3000     // Upper bound limit on intervals for rhythm analysis
    },
    ACTIVATION_THRESHOLDS: {
        'steady': 0.35,
        'burst': 0.40,
        'drift': 0.30,
        'chaotic': 0.35,
        'flat': 0.20
    },
    CONFIDENCE_FLOOR: 0.08          // Minimum separation margin between top shapes before declaring Unresolved
};

/**
 * Extensible Metric Registry
 */
class MetricRegistry {
    constructor() {
        this.metrics = new Map();
        this.initDefaults();
    }

    register(name, calculationFn) {
        this.metrics.set(name, calculationFn);
    }

    initDefaults() {
        // 1. Intensity Metric
        this.register('intensity', (processed, config) => {
            if (processed.length < 2) return 0;
            const duration = this.calculateDuration(processed);
            let totalWeight = 0;

            for (let i = 0; i < processed.length; i++) {
                const currentEvent = processed[i];
                let weight = config.EVENT_WEIGHTS[currentEvent.type] || config.EVENT_WEIGHTS.default;

                if (i > 0) {
                    const prevEvent = processed[i - 1];
                    const dt = currentEvent.ts - prevEvent.ts;
                    if (currentEvent.type === prevEvent.type && dt < 100) {
                        if (['mousemove', 'touchmove', 'scroll'].includes(currentEvent.type)) {
                            weight *= 0.15;
                        } else {
                            weight *= 0.50;
                        }
                    }
                }
                totalWeight += weight;
            }

            const rawDensity = totalWeight / (duration * config.THRESHOLDS.INTENSITY_SCALE);
            return Math.tanh(rawDensity);
        });

        // 2. Rhythm Metric
        this.register('rhythm', (processed, config) => {
            if (processed.length < 5) return 0;

            const intervals = [];
            for (let i = 1; i < processed.length; i++) {
                const dt = processed[i].ts - processed[i - 1].ts;
                if (dt >= 5 && dt < config.THRESHOLDS.MAX_RHYTHM_GAP_MS) {
                    intervals.push(dt);
                }
            }

            if (intervals.length < 3) return 0;

            const sorted = [...intervals].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)] || 1;
            const filteredIntervals = intervals.filter(v => v >= median * 0.2 && v <= median * 3.0);

            if (filteredIntervals.length < 2) return 0;

            const mean = filteredIntervals.reduce((a, b) => a + b, 0) / filteredIntervals.length;
            const variance = filteredIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / filteredIntervals.length;
            const stdDev = Math.sqrt(variance);
            const cv = stdDev / (mean || 1);

            return Math.exp(-1.5 * Math.pow(cv, 2));
        });

        // 3. Exploration Metric
        this.register('exploration', (processed) => {
            if (processed.length === 0) return 0;

            const counts = {};
            for (const e of processed) {
                counts[e.type] = (counts[e.type] || 0) + 1;
            }

            let entropy = 0;
            const total = processed.length;
            for (const type in counts) {
                const p = counts[type] / total;
                entropy -= p * Math.log(p);
            }

            const targetMaxEntropy = 1.3863; // ln(4)
            return Math.min(entropy / targetMaxEntropy, 1.0);
        });

        // 4. Coherence Metric
        this.register('coherence', (processed, config) => {
            if (processed.length < 2) return 0;
            let score = 0, transitions = 0;

            for (let i = 1; i < processed.length; i++) {
                const prev = processed[i - 1].type;
                const curr = processed[i].type;
                const matrix = config.COHERENCE_MATRIX[prev];
                
                if (matrix) {
                    score += (matrix[curr] !== undefined ? matrix[curr] : 0.15);
                } else {
                    score += 0.15;
                }
                transitions++;
            }

            return transitions > 0 ? score / transitions : 0;
        });
    }

    calculateDuration(processed) {
        if (processed.length < 2) return 0.5;
        const totalDurationMs = processed[processed.length - 1].ts - processed[0].ts;
        let idleTimeMs = 0;

        for (let i = 1; i < processed.length; i++) {
            const gap = processed[i].ts - processed[i - 1].ts;
            if (gap > 5000) {
                idleTimeMs += (gap - 5000);
            }
        }

        return Math.max(500, totalDurationMs - idleTimeMs) / 1000;
    }

    evaluateAll(processedEvents, config) {
        const results = {};
        this.metrics.forEach((calcFn, name) => {
            results[name] = Number(calcFn(processedEvents, config).toFixed(3));
        });
        return results;
    }
}

// Global Metric Engine Registry
const GlobalMetrics = new MetricRegistry();

class ShapeEngine {
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
     * Segments chronological events dynamically using sliding variance calculations
     */
    segmentEvents() {
        const segments = [];
        if (this.processed.length === 0) return segments;

        let activeSegment = [];
        const minSize = ENGINE_CONFIG.THRESHOLDS.MIN_SEGMENT_EVENTS;

        for (let i = 0; i < this.processed.length; i++) {
            const currentEvent = this.processed[i];
            activeSegment.push(currentEvent);

            if (activeSegment.length >= minSize) {
                const nextEvent = this.processed[i + 1];
                if (nextEvent) {
                    const segmentDuration = currentEvent.ts - activeSegment[0].ts;
                    const temporalGap = nextEvent.ts - currentEvent.ts;

                    let trigger = null;

                    // 1. Time gap trigger (Overrides temporal constraints)
                    if (temporalGap > ENGINE_CONFIG.THRESHOLDS.IDLE_GAP_MS) {
                        trigger = {
                            metric: 'temporal_gap',
                            delta: Number(temporalGap.toFixed(0)),
                            duration_ms: temporalGap
                        };
                    } 
                    // 2. Metric drift trigger: Only allow if the active segment has matured for at least 2.5 seconds
                    else if (segmentDuration >= 2500) {
                        const currentMetrics = GlobalMetrics.evaluateAll(activeSegment, ENGINE_CONFIG);
                        const mockNextSegment = [...activeSegment, nextEvent];
                        const nextMetrics = GlobalMetrics.evaluateAll(mockNextSegment, ENGINE_CONFIG);

                        let maxDelta = 0;
                        for (const key in currentMetrics) {
                            // Guard: prevent unactivated metric jump anomaly
                            if (key === 'rhythm' && activeSegment.length < 5) continue;

                            const delta = Math.abs(nextMetrics[key] - currentMetrics[key]);
                            if (delta > ENGINE_CONFIG.THRESHOLDS.VARIANCE_SPLIT && delta > maxDelta) {
                                maxDelta = delta;
                                trigger = {
                                    metric: key,
                                    delta: Number(delta.toFixed(3)),
                                    duration_ms: nextEvent.ts - activeSegment[0].ts
                                };
                            }
                        }
                    }

                    if (trigger) {
                        segments.push({
                            events: activeSegment,
                            change_trigger: trigger
                        });
                        activeSegment = [];
                    }
                }
            }
        }

        if (activeSegment.length > 0) {
            segments.push({
                events: activeSegment,
                change_trigger: {
                    metric: 'session_end',
                    delta: 0,
                    duration_ms: 0
                }
            });
        }

        return segments;
    }

    /**
     * Maps calculated metrics to continuous shape candidates
     */
    getShapeScores(m) {
        const i = m.intensity;
        const r = m.rhythm;
        const e = m.exploration;
        const c = m.coherence;

        const getMidRangeFit = (val) => Math.exp(-4.0 * Math.pow(val - 0.5, 2));

        const steadyScore = Math.max(0, Math.pow(r * c, 1.2) * (1.0 - 0.4 * Math.pow(i, 2)) * (1.0 - 0.3 * Math.pow(e, 2)));
        const burstScore = Math.max(0, (i * c) * (1.0 - 0.4 * e) * (0.7 + 0.3 * r));
        const driftScore = Math.max(0, e * getMidRangeFit(r) * getMidRangeFit(c) * (1.0 - 0.5 * i));
        const chaoticScore = Math.max(0, i * (1.0 - c) * (1.0 - 0.5 * r));
        const flatScore = Math.max(0, (1.0 - i) * (1.0 - 0.7 * c) * (1.0 - 0.7 * r) * (1.0 - 0.5 * e));

        return [
            { name: 'steady', score: steadyScore },
            { name: 'burst', score: burstScore },
            { name: 'drift', score: driftScore },
            { name: 'chaotic', score: chaoticScore },
            { name: 'flat', score: flatScore }
        ];
    }

    /**
     * Analyzes a single segment array to find the classification
     */
    evaluateSegment(events) {
        const metrics = GlobalMetrics.evaluateAll(events, ENGINE_CONFIG);
        const candidates = this.getShapeScores(metrics).sort((a, b) => b.score - a.score);
        
        const top = candidates[0];
        const runnerUp = candidates[1];
        
        let primaryShape = top.name;
        let confidence = top.score - (runnerUp ? runnerUp.score : 0);
        let classificationReason = "";

        const threshold = ENGINE_CONFIG.ACTIVATION_THRESHOLDS[top.name];

        // Evaluating state conditions
        if (top.score < threshold) {
            primaryShape = 'unresolved';
            // Unresolved confidence calculated as distance from target threshold
            confidence = 1.0 - (top.score / threshold);
            classificationReason = `Low signature activation (highest candidate scored ${top.score.toFixed(2)} vs target threshold ${threshold.toFixed(2)}).`;
        } else if (confidence < ENGINE_CONFIG.CONFIDENCE_FLOOR) {
            primaryShape = 'unresolved';
            // Unresolved confidence calculated from signal conflict entropy
            confidence = 1.0 - (confidence / ENGINE_CONFIG.CONFIDENCE_FLOOR);
            classificationReason = `Conflicting shape signatures detected between '${top.name}' and '${runnerUp.name}'.`;
        } else {
            classificationReason = `Strong activation matched pattern '${top.name}'.`;
        }

        return {
            shape: primaryShape,
            metrics,
            confidence: Number(Math.max(0, Math.min(1, confidence)).toFixed(3)),
            reason: classificationReason,
            candidates: candidates.reduce((acc, curr) => {
                acc[curr.name] = Number(curr.score.toFixed(3));
                return acc;
            }, {})
        };
    }

    checkAnomaly(from, to) {
        // High risk transitions that bypass natural interaction warmups
        const rules = [
            { from: 'flat', to: 'burst' },
            { from: 'unresolved', to: 'chaotic' }
        ];
        return rules.some(r => r.from === from && r.to === to);
    }

    /**
     * Re-engineered analyze method to build behavioral graph
     */
    analyze() {
        if (this.processed.length < ENGINE_CONFIG.THRESHOLDS.MIN_EVENTS) {
            return this.getNullShape("Insufficient data for behavioral analysis.");
        }

        const segmentRuns = this.segmentEvents();
        const behavioralTimeline = [];
        const sessionStart = this.processed[0].ts;

        for (let idx = 0; idx < segmentRuns.length; idx++) {
            const rawSeg = segmentRuns[idx];
            const evalResult = this.evaluateSegment(rawSeg.events);
            const startMs = rawSeg.events[0].ts - sessionStart;
            const endMs = rawSeg.events[rawSeg.events.length - 1].ts - sessionStart;

            const prevNode = behavioralTimeline[idx - 1] || null;

            const node = {
                segment_id: idx + 1,
                shape: evalResult.shape,
                start_ms: startMs,
                end_ms: endMs,
                duration_ms: Math.max(1, endMs - startMs),
                transition: {
                    from: prevNode ? prevNode.shape : 'session_start',
                    to: evalResult.shape,
                    is_anomaly: prevNode ? this.checkAnomaly(prevNode.shape, evalResult.shape) : false
                },
                topology: {
                    segment_id: idx + 1,
                    previous_segment_id: prevNode ? prevNode.segment_id : null,
                    next_segment_id: idx < segmentRuns.length - 1 ? idx + 2 : null
                },
                metrics: evalResult.metrics,
                confidence: evalResult.confidence,
                reason: evalResult.reason,
                change_trigger: rawSeg.change_trigger,
                candidates: evalResult.candidates,
                event_count: rawSeg.events.length
            };

            behavioralTimeline.push(node);
        }

        // Apply topological connection forward
        for (let i = 0; i < behavioralTimeline.length - 1; i++) {
            behavioralTimeline[i].topology.next_segment_id = behavioralTimeline[i + 1].segment_id;
        }

        // Compile aggregated summaries across segment timeline (time and weight-averaged metrics)
        const totalDuration = behavioralTimeline.reduce((acc, curr) => acc + curr.duration_ms, 0) || 1;
        const sums = {};
        
        behavioralTimeline.forEach(node => {
            const weight = node.duration_ms / totalDuration;
            sums[node.shape] = (sums[node.shape] || 0) + (weight * 100);
        });

        const summaryProfile = {};
        for (const shape in sums) {
            summaryProfile[shape] = Number(sums[shape].toFixed(1));
        }

        // Aggregate session-level metric summaries (backwards compatible)
        const overallMetrics = GlobalMetrics.evaluateAll(this.processed, ENGINE_CONFIG);
        const overallScores = this.getShapeScores(overallMetrics).sort((a, b) => b.score - a.score);
        const overallWinner = overallScores[0];
        const overallRunner = overallScores[1];
        const sessionConfidence = overallWinner.score - (overallRunner ? overallRunner.score : 0);

        return {
            shape_version: ENGINE_CONFIG.VERSION,
            primary_shape: overallWinner.name, // Global session classification fallback
            intensity: Number(overallMetrics.intensity.toFixed(3)),
            rhythm: Number(overallMetrics.rhythm.toFixed(3)),
            exploration: Number(overallMetrics.exploration.toFixed(3)),
            coherence: Number(overallMetrics.coherence.toFixed(3)),
            confidence: Number(sessionConfidence.toFixed(3)),
            explanation: `Session comprised of ${behavioralTimeline.length} segments. Dominant signature matches '${overallWinner.name}' with global confidence of ${(sessionConfidence * 100).toFixed(0)}%.`,
            behavioral_timeline: behavioralTimeline,
            aggregated_summary: summaryProfile,
            session_duration_ms: totalDuration
        };
    }

    getNullShape(msg) {
        return {
            shape_version: ENGINE_CONFIG.VERSION, 
            primary_shape: "flat",
            intensity: 0, 
            rhythm: 0, 
            exploration: 0, 
            coherence: 0, 
            confidence: 0,
            explanation: msg,
            behavioral_timeline: [],
            aggregated_summary: { "unresolved": 100.0 },
            session_duration_ms: 0
        };
    }

    // Explicit Static Properties to handle state without IIFE scoping issues
    static interactionEvents = [];

    static recordEvent(type) {
        ShapeEngine.interactionEvents.push({
            type: type,
            ts: Date.now()
        });
        
        if (ShapeEngine.interactionEvents.length > 2000) {
            ShapeEngine.interactionEvents.shift();
        }
    }

    static getSessionShape() {
        const engineInstance = new ShapeEngine(ShapeEngine.interactionEvents);
        return engineInstance.analyze();
    }
}

// Global Export
window.ShapeEngine = ShapeEngine;
window.GlobalMetrics = GlobalMetrics;

// Attach passive event listeners to populate the static state
(function initListeners() {
    const eventTypes = ['click', 'keypress', 'scroll', 'mousemove', 'touchstart', 'touchmove', 'touchend', 'input'];
    eventTypes.forEach(function (type) {
        window.addEventListener(type, function () {
            ShapeEngine.recordEvent(type);
        }, { passive: true, capture: true });
    });
})();
