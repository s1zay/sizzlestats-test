// ==========================================
// ROLL ENGINE: roll-engine.js (Cleanse Coach Edition)
// ==========================================

window.RollEngine = {
    db: null,

    boot: async function () {
        try {
            await window.SizzleApp.init();
            this.db = window.simDatabase;
        } catch (error) {
            console.error("[Roll Engine] Failed to load sim-database.json", error);
        }
    },

    // --- CORE MATH ENGINE ---
    // Calculates the numeric value of substat hits (used by the Coach)
    calculateSubstatValue: function (statId, itemType, stars, hits, mode = 'avg') {
        if (hits === 0) return 0;
        if (!this.db || !this.db.ArtifactSettings || !this.db.ArtifactSettings.RngRollBounds[statId]) return 0;

        const bounds = this.db.ArtifactSettings.RngRollBounds[statId][itemType][stars];
        const min = bounds[0];
        const max = bounds[1];

        let total = 0;

        switch (mode) {
            case 'max':
                total = max * hits;
                break;
            case 'min':
                total = min * hits;
                break;
            case 'avg':
            default:
                total = Math.round(((min + max) / 2) * hits);
                break;
        }

        return total;
    },

    // --- NEW: CLEANSE COACH ROLL SIMULATOR ---
    // Generates 3 random +16 artifact scenarios (Low, Avg, High) for a specific piece/primary combo
    simulatePieceRolls: function (pieceId, primaryStat) {
        if (!this.db || !this.db.ArtifactSettings) return null;

        const slotConfig = this.db.ArtifactSettings.SlotConfig.find(p => p.id === pieceId);
        if (!slotConfig) return null;

        const itemType = slotConfig.t;
        const substatPool = this.db.ArtifactSettings.SubstatPools[pieceId].filter(stat => stat !== primaryStat);

        // We assume 6-star gear for these educational simulations
        const rank = "6";

        // Helper to generate a realistic +16 artifact layout
        const generateMockArtifact = (qualityMode) => {
            // Pick 4 unique substats from the valid pool
            let shuffledPool = [...substatPool].sort(() => 0.5 - Math.random());
            let chosenStats = shuffledPool.slice(0, 4);

            let artifact = {
                primary: primaryStat,
                quality: qualityMode,
                substats: {}
            };

            chosenStats.forEach(stat => {
                artifact.substats[stat] = { hits: 1, value: 0 }; // Base hit for being a legendary piece
            });

            // Distribute 4 upgrade rolls randomly among the 4 substats
            for (let i = 0; i < 4; i++) {
                let randomStat = chosenStats[Math.floor(Math.random() * chosenStats.length)];
                artifact.substats[randomStat].hits++;
            }

            // Calculate final numeric values based on the quality mode (min/avg/max)
            Object.keys(artifact.substats).forEach(stat => {
                let hits = artifact.substats[stat].hits;
                artifact.substats[stat].value = this.calculateSubstatValue(stat, itemType, rank, hits, qualityMode);
            });

            return artifact;
        };

        // Return 3 distinct scenarios for the UI to display
        return {
            lowRoll: generateMockArtifact('min'),
            avgRoll: generateMockArtifact('avg'),
            highRoll: generateMockArtifact('max')
        };
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.RollEngine.boot();
});