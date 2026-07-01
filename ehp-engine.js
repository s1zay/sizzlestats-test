// ==========================================
// EHP ENGINE: ehp-engine.js
// Simplified 1-to-1 Roll Comparison
// ==========================================

// The eHP Scale (Adjust these thresholds anytime)
window.EHP_THRESHOLDS = {
    low: 100000,      // 0 - 100k (Squishy Nukers)
    average: 250000,  // 100k - 250k (Standard Support)
    high: 450000,     // 250k - 450k (Solid Tanks)
    elite: 750000,    // 450k - 750k (Endgame Tanks)
    godTier: 1200000  // 750k+ (Platinum Arena Walls)
};

let ehpDatabase = [];
let rollAvgs = { hpP: 0.06, defP: 0.06 };

// 2. THE MATH ENGINE
function calculateTrueEHP(hp, def) {
    if (!hp || !def) return 0;
    const mitigation = 0.85 * (1 - Math.exp(-def / 1500));
    return Math.round(hp / (1 - mitigation));
}

// Classifies the calculated eHP into a display tier and color
function getEhpTier(currentEhp) {
    const thresh = window.EHP_THRESHOLDS;

    if (currentEhp >= thresh.godTier) {
        return { name: "God Tier", color: "#22c55e" };
    } else if (currentEhp >= thresh.elite) {
        return { name: "Elite", color: "#16a34a" };
    } else if (currentEhp >= thresh.high) {
        return { name: "High", color: "#15803d" };
    } else if (currentEhp >= thresh.average) {
        return { name: "Average", color: "#166534" };
    }
    return { name: "Low", color: "#14532d" };
}

// 3. THE DATA EXPORT
window.getEhpData = function (hp, def, baseHP, baseDef) {
    if (!hp || !def) return null;

    const safeBaseHp = baseHP || 15000;
    const safeBaseDef = baseDef || 1000;

    const hpRollAmount = safeBaseHp * rollAvgs.hpP;
    const defRollAmount = safeBaseDef * rollAvgs.defP;

    const currentEhp = calculateTrueEHP(hp, def);
    const hpGain = calculateTrueEHP(hp + hpRollAmount, def) - currentEhp;
    const defGain = calculateTrueEHP(hp, def + defRollAmount) - currentEhp;

    const bestStat = hpGain > defGain ? "HP%" : "DEF%";
    const maxGain = Math.max(hpGain, defGain);
    const minGain = Math.max(1, Math.min(hpGain, defGain));
    const multiplier = (maxGain / minGain).toFixed(1);

    return {
        score: currentEhp,
        hpGain: hpGain,
        defGain: defGain,
        bestStat: bestStat,
        multiplier: multiplier
    };
};

// Expose the core formula globally for other engines and views
window.calculateTrueEHP = calculateTrueEHP;
window.getEhpTier = getEhpTier;
