// ==========================================
// DAMAGE ENGINE: damage-engine.js
// Golden Ratio & C.RATE Volume Knob + Outliers
// ==========================================

let dmgRollAvgs = { statP: 0.06, cd: 6, cr: 5 };

// 1. BOOTSTRAP THE DATABASE
fetch('sim-database.json')
    .then(res => res.json())
    .then(simData => {
        const bounds = simData.ArtifactSettings.RngRollBounds;

        // We use atkP as the universal scaling average since ATK/DEF/HP % bounds are identical
        dmgRollAvgs.statP = ((bounds.atkP.AR["5"][0] + bounds.atkP.AR["6"][1]) / 2) / 100;
        dmgRollAvgs.cd = (bounds.cd.AR["5"][0] + bounds.cd.AR["6"][1]) / 2;
        dmgRollAvgs.cr = (bounds.cr.AR["5"][0] + bounds.cr.AR["6"][1]) / 2;

        // console.log(`[Damage Engine] Economy Loaded.`);
    })
    .catch(err => {
        // console.error("[Damage Engine] DB Fetch Failure:", err);
    });

// 2. THE MATH ENGINE
function getGoldenRatio(base, total, cdmg) {
    if (!base || base === 0) return 0;
    const statMult = total / base;
    const cdMult = 1 + (cdmg / 100);
    return (Math.min(statMult, cdMult) / Math.max(statMult, cdMult)) * 100;
}

function calculateEfficiencyScore(base, total, cdmg, crate) {
    const ratio = getGoldenRatio(base, total, cdmg);

    // Volume Knob: Cap at 100%, floor at 0%
    const cappedCRate = Math.max(0, Math.min(100, crate));

    return ratio * (cappedCRate / 100);
}

// 3. THE DATA EXPORT
window.calculateDamageEfficiency = function (masterData, forcedStat = null) {

    // 1. EXTRACT SCALING DATA
    let rawScaling = masterData.Identity.ScalingStats || ["unknown"];
    let scalingArray = Array.isArray(rawScaling) ? rawScaling : [rawScaling];
    const lowerScaling = scalingArray.map(s => String(s).toLowerCase());

    let flatScaling = [];
    lowerScaling.forEach(s => {
        const splitItems = s.split(/&|and|,|\//i).map(item => {
            let clean = item.trim();
            // --- THE RUNTIME INTERCEPTOR ---
            // Catch Enemy Max HP champs and tag them for the Outlier UI
            if (clean.includes('enemy max hp') || clean.includes('enemy')) {
                return 'emhp';
            }
            return clean;
        });
        flatScaling.push(...splitItems);
    });
    flatScaling = [...new Set(flatScaling)];

    // Define categories
    const pureStats = ["atk", "def", "hp"];
    const outlierStats = ["spd", "acc", "res", "emhp"];

    // Identify what we are working with
    let presentPure = flatScaling.filter(s => pureStats.includes(s));
    let presentOutliers = flatScaling.filter(s => outlierStats.includes(s));

    let primaryStat;

    // 2. DETERMINE PRIMARY ENGINE STAT
    // If the UI is forcing a specific stat (from a pill click), use it
    if (forcedStat) {
        primaryStat = forcedStat.toUpperCase();
    } else {
        // VETO: Multi-scalers that haven't been forced yet
        if (presentPure.length > 1) {
            return {
                isValid: false,
                isMulti: true,
                message: "Multi-scaler logic coming soon."
            };
        }
        // VETO: No standard stat found at all
        if (presentPure.length === 0) {
            return { isValid: false, isMulti: false, message: "No standard scaling stat found." };
        }

        primaryStat = presentPure[0].toUpperCase();
    }

    // Safety check for missing base stat
    if (!masterData.Stats[primaryStat] || masterData.Stats[primaryStat].Basic === 0) {
        return { isValid: false, isMulti: false, message: "Base stat missing." };
    }

    // 3. CALCULATE STANDARD EFFICIENCY (Bar 1)
    const baseStat = masterData.Stats[primaryStat].Basic;
    const totalStat = masterData.Stats[primaryStat].Total;
    const critDamage = masterData.Stats.CDMG?.Total || 0;
    const critRate = masterData.Stats.CRate?.Total || 0;

    const currentScore = calculateEfficiencyScore(baseStat, totalStat, critDamage, critRate);

    // Ledger Simulations (+1 Avg Roll)
    const statRollAmount = baseStat * dmgRollAvgs.statP;

    const scoreWithStat = calculateEfficiencyScore(baseStat, totalStat + statRollAmount, critDamage, critRate);
    const scoreWithCD = calculateEfficiencyScore(baseStat, totalStat, critDamage + dmgRollAvgs.cd, critRate);
    const scoreWithCR = calculateEfficiencyScore(baseStat, totalStat, critDamage, critRate + dmgRollAvgs.cr);

    // Calculate Deltas (Gains)
    const statGain = Math.max(0, scoreWithStat - currentScore);
    const cdGain = Math.max(0, scoreWithCD - currentScore);
    const crGain = Math.max(0, scoreWithCR - currentScore);

    // 4. CALCULATE OUTLIER DATA (Bar 2)
    let outlierData = null;
    if (presentOutliers.length > 0) {
        const outName = presentOutliers[0].toUpperCase();
        let outTotal = masterData.Stats[outName]?.Total || 0;

        // Dynamic Min/Max & 20% Even Slices (Recalibrated for Endgame Reality)
        const OUTLIER_THRESHOLDS = {
            SPD: { min: 50, fair: 150, good: 250, elite: 350, godlike: 450, max: 550 },
            ACC: { min: 0, fair: 180, good: 360, elite: 540, godlike: 720, max: 900 },
            RES: { min: 0, fair: 200, good: 400, elite: 600, godlike: 800, max: 1000 },
            EMHP: { min: 0, fair: 240000, good: 480000, elite: 720000, godlike: 960000, max: 1200000 }
        };

        const thresh = OUTLIER_THRESHOLDS[outName] || { min: 0, fair: 200, good: 400, elite: 600, godlike: 800, max: 1000 };

        // Naming matching your new 5-tier schema
        let tierName = "Low";
        let tierColor = "#a855f7"; // Brightest purple for Low

        if (outTotal >= thresh.godlike) {
            tierName = "Godlike"; tierColor = "#3b0764"; // Deepest dark purple for Godlike
        } else if (outTotal >= thresh.elite) {
            tierName = "Elite"; tierColor = "#581c87";
        } else if (outTotal >= thresh.good) {
            tierName = "Good"; tierColor = "#7e22ce";
        } else if (outTotal >= thresh.fair) {
            tierName = "Fair"; tierColor = "#9333ea";
        }

        // True Percentage relative to the floor (Min) and ceiling (Max)
        let safeTotal = Math.max(thresh.min, Math.min(thresh.max, outTotal));
        let truePct = ((safeTotal - thresh.min) / (thresh.max - thresh.min)) * 100;

        outlierData = {
            stat: outName,
            total: outTotal,
            max: thresh.max,
            pct: truePct,
            tierName: tierName,
            tierColor: tierColor
        };
    }

    return {
        isValid: true,
        isMulti: false,
        primaryStat: primaryStat,
        score: Math.round(currentScore),
        rawRatio: Math.round(getGoldenRatio(baseStat, totalStat, critDamage)),
        outlier: outlierData,
        ledger: {
            statGain: statGain.toFixed(1),
            cdGain: cdGain.toFixed(1),
            crGain: crGain.toFixed(1)
        }
    };
};
