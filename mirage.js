// ==========================================
// MIRAGE ENGINE: mirage.js (Phase 1 & 2 - Canvas & Logic)
// ==========================================

const Mirage = {
    config: [
        { id: 'WEA', n: 'WEAPON' },
        { id: 'HEL', n: 'HELMET' },
        { id: 'SHI', n: 'SHIELD' },
        { id: 'GAU', n: 'GLOVES' },
        { id: 'CHE', n: 'CHEST' },
        { id: 'BOO', n: 'BOOTS' },
        { id: 'RIN', n: 'RING' },
        { id: 'AMU', n: 'AMULET' },
        { id: 'BAN', n: 'BANNER' }
    ],

    paintGhostGrid: function () {
        const grid = document.getElementById('mainGrid');
        if (!grid) return;

        let html = '';
        this.config.forEach(p => {
            html += `
            <div class="gear-card slot-empty" id="card_${p.id}">
                <div class="card-header" style="justify-content: flex-end; border: none; padding-bottom: 0;">
                    <span id="title_${p.id}" class="card-title" style="color: var(--text-muted); opacity: 0.25; font-size: 0.9em; letter-spacing: 1px;">${p.n}</span>
                </div>
            </div>`;
        });

        grid.innerHTML = html;
    },

    setAwakening: function (level) {
        const parsedLevel = isNaN(parseInt(level, 10)) ? 0 : parseInt(level, 10);

        const awkSelect = document.getElementById('awkSelect');
        if (awkSelect) awkSelect.value = parsedLevel;

        const dropdown = document.getElementById('awakening-dropdown');
        if (dropdown) dropdown.style.display = 'none';

        this.calculateDelta(parsedLevel);
        this.updateUI(parsedLevel, 'awakening');
        this.updateSummary();
    },

    setEmpowerment: function (level) {
        const parsedLevel = isNaN(parseInt(level, 10)) ? 0 : parseInt(level, 10);

        const empSelect = document.getElementById('empSelect');
        if (empSelect) empSelect.value = parsedLevel;

        const dropdown = document.getElementById('awakening-dropdown');
        if (dropdown) dropdown.style.display = 'none';

        this.calculateEmpowerment(parsedLevel);
        this.updateUI(parsedLevel, 'empowerment');
        this.updateSummary();
    },

    updateUI: function (level, type) {
        const parsedLevel = parseInt(level, 10) || 0;
        const dropdown = document.getElementById('awakening-dropdown');

        if (type === 'awakening') {
            const scanData = window.SizzleState?.currentScan;
            const rank = parseInt(scanData?.Identity?.Rank, 10) || 6;
            const ascensionLevel = parseInt(scanData?.Identity?.AscensionLevel || scanData?.Identity?.Ascended, 10) || 0;

            if (dropdown) {
                const awkBtns = dropdown.querySelectorAll('.champ-menu-col:nth-child(1) .champ-menu-btn');
                awkBtns.forEach(btn => btn.classList.remove('active-awk'));
                if (awkBtns[parsedLevel]) awkBtns[parsedLevel].classList.add('active-awk');
            }

            const starsContainer = document.getElementById('mirage-champ-stars');
            if (starsContainer) {
                let starsHTML = '';
                for (let i = 1; i <= rank; i++) {
                    let color = '#facc15';
                    if (i <= parsedLevel) {
                        color = '#ef4444';
                    } else if (i <= ascensionLevel) {
                        color = '#a855f7';
                    }
                    starsHTML += `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 2px;">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                    `;
                }
                starsContainer.innerHTML = starsHTML;
            }
        }

        if (type === 'empowerment') {
            if (dropdown) {
                const empBtns = dropdown.querySelectorAll('.col-empowerment .champ-menu-btn');
                empBtns.forEach(btn => btn.classList.remove('active-emp'));
                if (empBtns[parsedLevel]) empBtns[parsedLevel].classList.add('active-emp');
            }

            const nameEl = document.getElementById('mirage-champ-name');
            if (nameEl) {
                let tag = nameEl.querySelector('.empowerment-tag');
                if (!tag && parsedLevel > 0) {
                    tag = document.createElement('span');
                    tag.className = 'empowerment-tag';
                    nameEl.appendChild(tag);
                }
                if (tag) {
                    tag.innerText = parsedLevel > 0 ? ` +${parsedLevel}` : '';
                }
            }
        }
    },

    calculateDelta: function (targetLevel) {
        window.SizzleState = window.SizzleState || {};
        window.SizzleState.mirage = window.SizzleState.mirage || {};

        let deltas = { HP: 0, ATK: 0, DEF: 0, SPD: 0, CRate: 0, CDMG: 0, ACC: 0, RES: 0 };
        window.SizzleState.mirage.awakeningBonuses = deltas;

        const scanData = window.SizzleState.currentScan;
        if (!scanData || !window.simDatabase) return;

        const rarity = scanData.Identity?.Rarity || "Legendary";
        const scannedLevel = parseInt(scanData.Identity?.AwakeningLevel, 10) || 0;
        const blessingDB = window.simDatabase.Blessings?.[rarity];

        if (!blessingDB) return;

        const keyMap = { "C_DMG": "CDMG", "C_RATE": "CRate" };

        for (let i = 1; i <= 6; i++) {
            if (!blessingDB[i]) continue;
            Object.entries(blessingDB[i]).forEach(([dbKey, val]) => {
                const mirageKey = keyMap[dbKey] || dbKey;
                if (deltas[mirageKey] !== undefined) {
                    if (i <= targetLevel) deltas[mirageKey] += val;
                    if (i <= scannedLevel) deltas[mirageKey] -= val;
                }
            });
        }
        window.SizzleState.mirage.awakeningBonuses = deltas;
    },

    calculateEmpowerment: function (targetLevel) {
        window.SizzleState = window.SizzleState || {};
        window.SizzleState.mirage = window.SizzleState.mirage || {};

        let empDeltas = { HP: 0, ATK: 0, DEF: 0, SPD: 0, CRate: 0, CDMG: 0, ACC: 0, RES: 0 };
        window.SizzleState.mirage.empowermentBonuses = empDeltas;

        const scanData = window.SizzleState.currentScan;
        if (!scanData || !window.simDatabase || !window.simDatabase.Empowerment) return;

        const rarity = scanData.Identity?.Rarity || "Legendary";
        const empDB = window.simDatabase.Empowerment[rarity];

        if (!empDB) return;

        const scannedEmpLevel = parseInt(scanData.Identity?.EmpowermentLevel, 10) || 0;
        const keyMap = { "C_DMG": "CDMG", "C_RATE": "CRate" };

        for (let i = 1; i <= 4; i++) {
            if (!empDB[i]) continue;
            Object.entries(empDB[i]).forEach(([dbKey, val]) => {
                const mirageKey = keyMap[dbKey] || dbKey;
                if (empDeltas[mirageKey] !== undefined) {
                    if (i <= targetLevel) empDeltas[mirageKey] += val;
                    if (i <= scannedEmpLevel) empDeltas[mirageKey] -= val;
                }
            });
        }
        window.SizzleState.mirage.empowermentBonuses = empDeltas;
    },

    updateGoal: function (utilityName, statKey, value) {
        if (!window.RollEngine || !window.RollEngine.db) return;

        let blueprintDB = window.RollEngine.db.UtilityBlueprints || window.RollEngine.db.ArtifactSettings?.UtilityBlueprints;
        if (!blueprintDB || !blueprintDB[utilityName]) return;

        blueprintDB[utilityName].preset_goals = blueprintDB[utilityName].preset_goals || {};

        let parsedVal = parseInt(value, 10);
        if (isNaN(parsedVal)) {
            delete blueprintDB[utilityName].preset_goals[statKey];
        } else {
            blueprintDB[utilityName].preset_goals[statKey] = parsedVal;
        }
    },

    updateSummary: function () {
        const summaryDiv = document.getElementById('summaryOutput');
        if (!summaryDiv) return;

        // Dynamically force 5 columns to accommodate the new "Scanned" column without CSS changes
        summaryDiv.style.gridTemplateColumns = "minmax(45px, 1fr) minmax(45px, 1fr) minmax(55px, 1fr) minmax(65px, 1fr) minmax(50px, 1fr)";
        summaryDiv.style.gap = "6px";

        const scanData = window.SizzleState?.currentScan;
        if (!scanData || !scanData.Stats) {
            summaryDiv.innerHTML = '<div class="sum-empty-state">Awaiting scan data...</div>';
            return;
        }

        window.SizzleState.mirage = window.SizzleState.mirage || {};

        const awkSelect = document.getElementById('awkSelect');
        const empSelect = document.getElementById('empSelect');

        const rarity = scanData.Identity?.Rarity || "Legendary";
        const canEmpower = window.simDatabase && window.simDatabase.Empowerment && window.simDatabase.Empowerment[rarity];

        const currentChampId = scanData.Identity?.Champion || "Unknown";
        if (window.SizzleState.mirage.lastChamp !== currentChampId) {
            if (awkSelect) awkSelect.value = parseInt(scanData.Identity?.AwakeningLevel, 10) || 0;
            if (empSelect) empSelect.value = parseInt(scanData.Identity?.EmpowermentLevel, 10) || 0;
            window.SizzleState.mirage.lastChamp = currentChampId;
        }

        const scannedAwk = parseInt(scanData.Identity?.AwakeningLevel, 10) || 0;
        const scannedEmp = parseInt(scanData.Identity?.EmpowermentLevel, 10) || 0;

        const empColumn = document.querySelector('.col-empowerment');
        if (empColumn) {
            if (!canEmpower) {
                empColumn.style.opacity = '0.3';
                empColumn.style.pointerEvents = 'none';
                empColumn.style.filter = 'grayscale(100%)';
                if (empSelect) empSelect.value = scannedEmp;
            } else {
                empColumn.style.opacity = '1';
                empColumn.style.pointerEvents = 'auto';
                empColumn.style.filter = 'none';
            }
        }

        const awkColumn = document.querySelector('.champ-menu-col:nth-child(1)');
        const ascensionLevel = parseInt(scanData.Identity?.AscensionLevel || scanData.Identity?.Ascended, 10) || 0;

        if (awkColumn) {
            if (ascensionLevel < 6) {
                awkColumn.style.opacity = '0.3';
                awkColumn.style.pointerEvents = 'none';
                awkColumn.style.filter = 'grayscale(100%)';
                if (awkSelect) awkSelect.value = scannedAwk;
            } else {
                awkColumn.style.opacity = '1';
                awkColumn.style.pointerEvents = 'auto';
                awkColumn.style.filter = 'none';
            }
        }

        const currentAwk = parseInt(awkSelect?.value, 10) || 0;
        const currentEmp = parseInt(empSelect?.value, 10) || 0;

        this.calculateDelta(currentAwk);
        this.calculateEmpowerment(currentEmp);
        this.updateUI(currentAwk, 'awakening');
        this.updateUI(currentEmp, 'empowerment');

        let blueprint = null;
        let currentUtility = window.sandboxState?.activeUtility || 'Custom';
        try {
            if (window.sandboxState && window.RollEngine && window.RollEngine.db) {
                let blueprintDB = window.RollEngine.db.UtilityBlueprints ||
                    (window.RollEngine.db.ArtifactSettings && window.RollEngine.db.ArtifactSettings.UtilityBlueprints);
                if (blueprintDB) {
                    blueprint = blueprintDB[currentUtility];
                }
            }
        } catch (err) { }

        const jsonKeyMap = {
            'HP': 'hp', 'ATK': 'atk', 'DEF': 'def', 'SPD': 'spd',
            'CRate': 'cr', 'CDMG': 'cd', 'ACC': 'acc', 'RES': 'res'
        };

        let gearTotals = { hp: 0, hpP: 0, atk: 0, atkP: 0, def: 0, defP: 0, spd: 0, cr: 0, cd: 0, acc: 0, res: 0 };
        try {
            if (window.RollEngine && typeof window.RollEngine.evaluateStats === 'function') {
                let rolledStats = window.RollEngine.evaluateStats();
                if (rolledStats) gearTotals = rolledStats;
            }
        } catch (err) { }

        const stats = scanData.Stats;
        const coreStats = [
            { key: 'HP', label: 'HP', isPct: false },
            { key: 'ATK', label: 'ATK', isPct: false },
            { key: 'DEF', label: 'DEF', isPct: false },
            { key: 'SPD', label: 'SPD', isPct: false },
            { key: 'CRate', label: 'C. RATE', isPct: true },
            { key: 'CDMG', label: 'C. DMG', isPct: true },
            { key: 'ACC', label: 'ACC', isPct: false },
            { key: 'RES', label: 'RES', isPct: false }
        ];

        let simulatedTotals = {};

        // CENTER ALIGN THE SCANNED COLUMN HEADER
        let html = `
            <div class="col-header" style="text-align: center;">Scanned</div>
            <div class="col-header col-hdr-delta">+/-</div>
            <div class="col-header col-hdr-stat">Stat</div>
            <div class="col-header col-hdr-total">Total</div>
            <div class="col-header sum-goal">Goal</div>
        `;

        coreStats.forEach(stat => {
            const jKey = jsonKeyMap[stat.key];
            const rawTotal = stats[stat.key]?.Total || 0;
            const rawArtifacts = stats[stat.key]?.Artifacts || 0;

            const parsedTotal = typeof rawTotal === 'string' ? parseInt(rawTotal.replace(/,/g, ''), 10) : (parseInt(rawTotal, 10) || 0);
            const parsedArtifacts = typeof rawArtifacts === 'string' ? parseInt(rawArtifacts.replace(/,/g, ''), 10) : (parseInt(rawArtifacts, 10) || 0);

            let baseline = parsedTotal - parsedArtifacts;
            if (isNaN(baseline)) baseline = 0;

            const activeAwkDelta = window.SizzleState.mirage.awakeningBonuses?.[stat.key] || 0;
            let activeEmpDelta = window.SizzleState.mirage.empowermentBonuses?.[stat.key] || 0;

            if (['HP', 'ATK', 'DEF'].includes(stat.key) && activeEmpDelta !== 0) {
                const rawBasic = stats[stat.key]?.Basic || 0;
                const parsedBasic = typeof rawBasic === 'string' ? parseInt(rawBasic.replace(/,/g, ''), 10) : (parseInt(rawBasic, 10) || 0);
                activeEmpDelta = Math.round(parsedBasic * (activeEmpDelta / 100));
            }

            const empoweredBaseline = baseline + activeEmpDelta;

            let gearFlat = gearTotals[jKey] || 0;
            let gearPct = gearTotals[jKey + 'P'] || 0;

            let gearPctValue = 0;
            if (!stat.isPct && gearPct > 0) {
                gearPctValue = Math.round(empoweredBaseline * (gearPct / 100));
            } else if (stat.isPct) {
                gearFlat += gearPct;
            }

            const currentMirageTotal = empoweredBaseline + activeAwkDelta + gearFlat + gearPctValue;
            simulatedTotals[jKey] = currentMirageTotal;

            const rawDelta = currentMirageTotal - parsedTotal;
            const pctStr = stat.isPct ? '%' : '';

            let deltaText = '-';
            let deltaClass = 'delta-neutral';

            if (rawDelta > 0) {
                deltaText = `+${rawDelta.toLocaleString()}${pctStr}`;
                deltaClass = 'delta-positive';
            } else if (rawDelta < 0) {
                deltaText = `${rawDelta.toLocaleString()}${pctStr}`;
                deltaClass = 'delta-negative';
            }

            let targetNumber = '';
            if (blueprint && blueprint.preset_goals && blueprint.preset_goals[jKey] !== undefined) {
                targetNumber = blueprint.preset_goals[jKey];
            }

            // CENTER ALIGN THE SCANNED COLUMN NUMBERS
            html += `
                <div class="sum-ranges" style="text-align: center;">${parsedTotal.toLocaleString()}${pctStr}</div>
                <div class="sum-delta ${deltaClass}">${deltaText}</div>
                <div class="sum-label">${stat.label}</div>
                <div class="sum-final">${currentMirageTotal.toLocaleString()}${pctStr}</div>
                <div class="sum-goal">
                    <input type="text" 
                           inputmode="numeric"
                           pattern="[0-9]*"
                           class="goal-input"
                           placeholder="-" 
                           id="goal_${stat.key}" 
                           value="${targetNumber}"
                           oninput="window.clampGoal(this, '${stat.key}'); Mirage.updateGoal('${currentUtility}', '${jKey}', this.value)"
                           onclick="event.stopPropagation()">
                </div>
            `;
        });

        let ehpVal = '--';
        let finalHP = simulatedTotals['hp'] || 0;
        let finalDEF = simulatedTotals['def'] || 0;

        if (window.getEhpData) {
            let ehpInfo = window.getEhpData(finalHP, finalDEF);
            if (ehpInfo) {
                ehpVal = ehpInfo.score.toLocaleString();

                const ehpDrawer = document.getElementById('val-ehp-compare');
                if (ehpDrawer) ehpDrawer.innerHTML = ehpInfo.comparisonText;

                const ehpScoreBar = document.getElementById('val-ehp-score');
                if (ehpScoreBar) ehpScoreBar.innerText = ehpVal;
            }
        }

        let balanceText = "Balance: N/A";

        if (scanData && scanData.Identity && scanData.Identity.ScalingStats) {
            let rawScaling = scanData.Identity.ScalingStats;
            let scalingArray = Array.isArray(rawScaling) ? rawScaling : [rawScaling];

            let flatScaling = [...new Set(scalingArray.map(s => String(s).toLowerCase()).flatMap(s => s.split(/&|and|,|\//i).map(i => i.trim())))];
            const pureStats = ["atk", "def", "hp"];

            if (flatScaling.length > 1 || !pureStats.includes(flatScaling[0])) {
                balanceText = `<span style="color: var(--text-muted);">Split-Scaling:</span> <span style="color: #a855f7;">${scalingArray.join(" | ").toUpperCase()}</span>`;
            } else {
                const primaryStat = flatScaling[0].toUpperCase();
                const jKey = primaryStat.toLowerCase();

                if (scanData.Stats[primaryStat] && scanData.Stats[primaryStat].Basic > 0) {
                    const baseStat = scanData.Stats[primaryStat].Basic;
                    const totalStat = simulatedTotals[jKey] || 0;
                    const critDamage = simulatedTotals['cd'] || 0;

                    const statMultiplier = totalStat / baseStat;
                    const cdMultiplier = 1 + (critDamage / 100);

                    const idealCD = (statMultiplier - 1) * 100;
                    const idealStat = cdMultiplier * baseStat;

                    const efficiencyScore = (Math.min(statMultiplier, cdMultiplier) / Math.max(statMultiplier, cdMultiplier)) * 100;

                    const deltaStat = Math.abs(Math.round(idealStat - totalStat));
                    const deltaCD = Math.abs(Math.round(idealCD - critDamage));

                    let colorClass = efficiencyScore >= 95 ? '#4ade80' : '#eab308';
                    let scoreBadge = `<span style="color:${colorClass};">[${Math.round(efficiencyScore)}%]</span>`;

                    if (Math.round(efficiencyScore) >= 100) {
                        balanceText = `Balance ${scoreBadge} <span style="color: #4ade80;">Perfectly Aligned</span>`;
                    } else if (statMultiplier > cdMultiplier) {
                        balanceText = `Balance ${scoreBadge} <span style="color: #4ade80;">+${deltaCD}% C.DMG</span> <span style="color: var(--text-muted);">or</span> <span style="color: #f87171;">-${deltaStat} ${primaryStat}</span>`;
                    } else {
                        balanceText = `Balance ${scoreBadge} <span style="color: #4ade80;">+${deltaStat} ${primaryStat}</span> <span style="color: var(--text-muted);">or</span> <span style="color: #f87171;">-${deltaCD}% C.DMG</span>`;
                    }
                }
            }
        }

        // PERFECTLY ALIGNED COPY BUTTON & CLEAR BUTTON
        html += `
            <div style="display: flex; justify-content: center; align-items: center;">
                <button class="keep-rollin-btn" style="padding: 3px 8px; font-size: 0.6em; border-style: dashed; letter-spacing: 0; white-space: nowrap;" onclick="window.copyScannedToGoals(event)" title="Copy scanned stats into goal fields">COPY TO GOALS</button>
            </div>
            <div></div>
            <div class="sum-label ehp-row">eHP</div>
            <div class="sum-final ehp-row">${ehpVal}</div>
            <div class="sum-goal" style="display: flex; justify-content: center; align-items: center;">
                <button class="keep-rollin-btn" style="padding: 3px 8px; font-size: 0.6em; border-style: dashed; letter-spacing: 0; white-space: nowrap;" onclick="window.clearGoals(event)" title="Clear all goal fields">CLEAR</button>
            </div>
            
            <div style="grid-column: 1/-1; text-align: center; margin-top: 15px; padding-top: 10px; font-family: monospace; font-size: 0.9em; font-weight: bold; border-top: 1px solid var(--border-lowkey); color: var(--text-primary);">
                ${balanceText}
            </div>
        `;

        summaryDiv.innerHTML = html;
    }
};

// ==========================================
// GLOBAL EVENT BINDINGS
// ==========================================

// Copy the Scanned values straight into the Goal inputs AND snap to Custom!
window.copyScannedToGoals = function (event) {
    if (event) event.stopPropagation();

    const scanData = window.SizzleState?.currentScan;
    if (!scanData || !scanData.Stats) return;

    window.sandboxState = window.sandboxState || {};
    window.sandboxState.activeUtility = 'Custom';

    const utilityDropdown = document.getElementById('utilitySelect');
    if (utilityDropdown) {
        utilityDropdown.value = 'Custom';
    }

    let currentUtility = 'Custom';

    const jsonKeyMap = {
        'HP': 'hp', 'ATK': 'atk', 'DEF': 'def', 'SPD': 'spd',
        'CRate': 'cr', 'CDMG': 'cd', 'ACC': 'acc', 'RES': 'res'
    };

    Object.keys(jsonKeyMap).forEach(statKey => {
        const jKey = jsonKeyMap[statKey];
        const rawTotal = scanData.Stats[statKey]?.Total || 0;
        const parsedTotal = typeof rawTotal === 'string' ? parseInt(rawTotal.replace(/,/g, ''), 10) : (parseInt(rawTotal, 10) || 0);

        Mirage.updateGoal(currentUtility, jKey, parsedTotal);
    });

    Mirage.updateSummary(); // Re-render the grid instantly
};

// NEW: Clear all goal inputs for the current profile
window.clearGoals = function (event) {
    if (event) event.stopPropagation();

    let currentUtility = window.sandboxState?.activeUtility || 'Custom';
    const allStatKeys = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'acc', 'res'];

    allStatKeys.forEach(jKey => {
        // Passing an empty string evaluates to NaN and triggers the deletion in updateGoal
        Mirage.updateGoal(currentUtility, jKey, '');
    });

    Mirage.updateSummary(); // Re-render instantly
};

window.toggleMath = function (event) {
    if (event.target.tagName.toLowerCase() !== 'input' && event.target.tagName.toLowerCase() !== 'button') {
        const grid = document.getElementById('summaryOutput');
        if (grid) {
            grid.classList.toggle('hide-math');
        }
    }
};

window.setAwakening = function (level) { Mirage.setAwakening(level); };
window.setEmpowerment = function (level) { Mirage.setEmpowerment(level); };
window.updateSummary = function () { Mirage.updateSummary(); };

window.setRollQuality = function (quality) {
    document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active-pill'));
    document.getElementById('pill-' + (quality === 'random' ? 'rng' : quality)).classList.add('active-pill');

    window.SizzleState = window.SizzleState || {};
    window.SizzleState.rollQuality = quality;

    if (typeof window.applyGlyphs === 'function') {
        window.applyGlyphs();
    }
};

window.resetSandbox = function () {
    const scanData = window.SizzleState?.currentScan;

    if (window.SizzleState) {
        window.SizzleState.mirage = {
            lastChamp: null,
            awakeningBonuses: {},
            empowermentBonuses: {}
        };
    }

    if (window.RollEngine && typeof window.RollEngine.purge === 'function') {
        window.RollEngine.purge();
    }

    const scannedAwk = parseInt(scanData?.Identity?.AwakeningLevel, 10) || 0;
    const scannedEmp = parseInt(scanData?.Identity?.EmpowermentLevel, 10) || 0;

    const awkSelect = document.getElementById('awkSelect');
    if (awkSelect) awkSelect.value = scannedAwk;

    const empSelect = document.getElementById('empSelect');
    if (empSelect) empSelect.value = scannedEmp;

    Mirage.updateSummary();
};

window.addEventListener('DOMContentLoaded', () => {
    const dropSpans = document.querySelectorAll('#awakening-dropdown span[onclick]');
    dropSpans.forEach(span => { span.removeAttribute('onclick'); });
});

window.clampGoal = function (inputEl, statKey) {
    // 1. Strip out any letters, decimals, or negative signs
    let cleanValue = inputEl.value.replace(/[^0-9]/g, '');

    // 2. Prevent users from typing a number so massive it breaks the math engine
    if (cleanValue !== '') {
        let maxLimit = (statKey === 'HP') ? 250000 : 15000;
        if (parseInt(cleanValue, 10) > maxLimit) {
            cleanValue = maxLimit.toString();
        }
    }

    // 3. Set the clean, safe number back into the text box so the updateGoal function can save it
    inputEl.value = cleanValue;
};
