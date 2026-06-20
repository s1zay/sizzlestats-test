// ==========================================
// EHP ENGINE: ehp-engine.js
// Simplified 1-to-1 Roll Comparison
// ==========================================

// The eHP Kraken Scale (Adjust these thresholds anytime)
window.EHP_THRESHOLDS = {
    low: 100000,      // 0 - 100k (Squishy Nukers)
    average: 250000,  // 100k - 250k (Standard Support)
    high: 450000,     // 250k - 450k (Solid Tanks)
    elite: 750000,    // 450k - 750k (Endgame Tanks)
    kraken: 1200000   // 750k+ (Platinum Arena Walls)
};

let ehpDatabase = [];
let rollAvgs = { hpP: 0.06, defP: 0.06 }; 

// 1. BOOTSTRAP THE DATABASES
Promise.all([
    fetch('ehp-example.json').then(res => res.json()),
    fetch('sim-database.json').then(res => res.json())
])
    .then(([bossData, simData]) => {
        ehpDatabase = bossData;
        const bounds = simData.ArtifactSettings.RngRollBounds;

        // Percent Averages 
        rollAvgs.hpP = ((bounds.hpP.AR["5"][0] + bounds.hpP.AR["6"][1]) / 2) / 100;
        rollAvgs.defP = ((bounds.defP.AR["5"][0] + bounds.defP.AR["6"][1]) / 2) / 100;

        // console.log(`[eHP Engine] Economy Loaded.`);
    })
    .catch(err => {
        // console.error("[eHP Engine] DB Fetch Failure:", err);
    });

// 2. THE MATH ENGINE
function calculateTrueEHP(hp, def) {
    if (!hp || !def) return 0;
    const mitigation = 0.85 * (1 - Math.exp(-def / 1500));
    return Math.round(hp / (1 - mitigation));
}

// 3. THE DATA EXPORT
window.getEhpData = function(hp, def, baseHP, baseDef) {
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
