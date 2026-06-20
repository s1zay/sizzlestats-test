// style-card-engine.js

/**
 * Evaluates champion stats and returns an array of Build Style confidence scores.
 * @param {Object} masterData - The parsed scanner object.
 * @returns {Array} Array of objects sorted by highest match percentage.
 */
function calculateChampionStyle(masterData) {
    // 1. EXTRACT DATA 
    const stats = masterData.Stats;

    // Safety check: Ensure ScalingStats is an array and lowercase
    const scaling = Array.isArray(masterData.Identity.ScalingStats)
        ? masterData.Identity.ScalingStats.map(s => s.toLowerCase())
        : ["unknown"];

    // 2. CALCULATE PERCENTAGES & ROLLS
    const calcRatio = (t, b) => t > 0 ? (t - b) / t : 0;

    const hpRatio = calcRatio(stats.HP.Total, stats.HP.Basic);
    const defRatio = calcRatio(stats.DEF.Total, stats.DEF.Basic);
    const atkRatio = calcRatio(stats.ATK.Total, stats.ATK.Basic);
    const crateRatio = calcRatio(stats.CRate.Total, stats.CRate.Basic);
    const cdmgRatio = calcRatio(stats.CDMG.Total, stats.CDMG.Basic);

    const spdRolls = (stats.SPD.Artifacts || 0) / 5;
    const accRolls = (stats.ACC.Artifacts || 0) / 10;
    const resRolls = (stats.RES.Artifacts || 0) / 10;

    // 3. FUZZY LOGIC MATH HELPERS
    // Grades a stat up to 100% of the target threshold
    const score = (val, target) => Math.min(val / target, 1) * 100;

    // Penalizes a stat (e.g., must be under target limit). 0 = 100%, Limit = 0%
    const scoreInv = (val, limit) => Math.max(1 - (val / limit), 0) * 100;

    // Averages an array of scores
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

    // 4. THE SCORECARD
    const results = [];

    // -- SPEED & SETUP --
    results.push({
        style: "Speed Lead",
        score: score(spdRolls, 35),
        veto: false
    });

    results.push({
        style: "Setup Champ",
        score: avg([
            score(spdRolls, 27),
            score(accRolls, 35),
            scoreInv(atkRatio, 0.6),
            scoreInv(hpRatio, 0.6),
            scoreInv(defRatio, 0.6)
        ]),
        veto: false
    });

    // -- THE NUKERS --
    const hasAtk = scaling.includes("atk") || scaling.includes("enemy max hp");
    results.push({
        style: "ATK Nuker",
        score: hasAtk ? avg([score(crateRatio, 0.8), score(cdmgRatio, 0.75), score(atkRatio, 0.7)]) : 0,
        veto: !hasAtk
    });

    const hasHp = scaling.includes("hp") || scaling.includes("enemy max hp");
    results.push({
        style: "HP Nuker",
        score: hasHp ? avg([score(crateRatio, 0.8), score(cdmgRatio, 0.75), score(hpRatio, 0.7)]) : 0,
        veto: !hasHp
    });

    const hasDef = scaling.includes("def") || scaling.includes("enemy max hp");
    results.push({
        style: "DEF Nuker",
        score: hasDef ? avg([score(crateRatio, 0.8), score(cdmgRatio, 0.75), score(defRatio, 0.7)]) : 0,
        veto: !hasDef
    });

    const isBomber = scaling.includes("atk");
    results.push({
        style: "Bomber",
        score: isBomber ? avg([score(atkRatio, 0.7), score(accRolls, 35), scoreInv(crateRatio, 0.5)]) : 0,
        veto: !isBomber
    });

    // -- THE TANKS --
    results.push({
        style: "Brick Wall",
        score: avg([score(hpRatio, 0.8), score(defRatio, 0.8), scoreInv(resRolls, 25)]),
        veto: false
    });

    results.push({
        style: "Res Tank",
        score: avg([score(resRolls, 40), score(hpRatio, 0.5), score(defRatio, 0.5)]),
        veto: false
    });

    // -- THE HYBRID --
    const bestSurvival = Math.max(score(hpRatio, 0.5), score(defRatio, 0.5));
    const bestDamage = Math.max(score(crateRatio, 0.6), score(cdmgRatio, 0.6));
    const bestUtility = Math.max(score(accRolls, 27), score(resRolls, 27));

    results.push({
        style: "Hybrid/Flex",
        score: avg([bestSurvival, bestDamage, bestUtility]),
        veto: false
    });

    // 5. SORT AND FORMAT
    return results
        .map(r => ({
            style: r.style,
            match: Math.round(r.score),
            veto: r.veto
        }))
        .sort((a, b) => b.match - a.match); // Highest match first
}

document.addEventListener('DOMContentLoaded', () => {
    const utilityBtn = document.getElementById('utilityMenuBtn');

    if (utilityBtn) {
        utilityBtn.addEventListener('click', (e) => {
            console.log('[Mirage UI] Utility header clicked. Ready to spawn menu!');

            // We will build the logic to inject/toggle the actual dropdown list right here next.
        });
    }
});

window.calculateChampionStyle = calculateChampionStyle;