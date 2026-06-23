// ==========================================
// SIMULATION ENGINE: sim-engine.js
// Handles Area matching and What-If scenarios
// ==========================================

window.simDatabase = null;

// 1. BOOTSTRAP THE JSON
fetch('sim-database.json')
    .then(response => response.json())
    .then(data => {
        window.simDatabase = data;
        // console.log(`[Sim Engine] Online: Simulation Matrix & Area DB Loaded.`);
    })
    .catch(err => {
        // console.error("[Sim Engine] DB Failure:", err);
    });

// 2. AREA FUZZY MATCHER (Used by Area Accordion)
window.matchArea = function (ocrText) {
    if (!window.simDatabase || !window.simDatabase.AreaStats) return null;
    if (!ocrText || ocrText.trim() === "") return null;

    const cleanOCR = ocrText.toLowerCase().replace(/[^a-z]/g, '');
    const areas = Object.keys(window.simDatabase.AreaStats);

    for (let area of areas) {
        if (area === "No Selection -Chimera") continue;
        const cleanArea = area.toLowerCase().replace(/[^a-z]/g, '');
        if (cleanOCR.includes(cleanArea) || cleanArea.includes(cleanOCR)) return area;
    }
    return null;
};

// 3. THE SIMULATION UI BUILDER (Used by Simulate Accordion)
window.generateSimulationUI = function (scanData, onSimulateCallback) {
    const simDetailsEl = document.getElementById('val-sim-details');
    const resetBtn = document.getElementById('clear-simulation-btn');

    if (!simDetailsEl || !window.simDatabase) return;

    // --- Affinity Audit Engine ---
    const rowKeys = ["HP", "ATK", "DEF", "SPD", "CRate", "CDMG", "RES", "ACC"];
    let currentAffinitySum = 0;

    rowKeys.forEach(row => {
        if (scanData.Stats[row]) {
            currentAffinitySum += scanData.Stats[row]["Affinity"] || 0;
        }
    });

    const baseHP = scanData.Stats["HP"]?.Basic || 0;
    const baseATK = scanData.Stats["ATK"]?.Basic || 0;
    const baseDEF = scanData.Stats["DEF"]?.Basic || 0;

    // Calculate maximum theoretical Affinity stats (20% HP/ATK/DEF, 25 CDMG, 80 RES/ACC)
    const maxAffinitySum = Math.round(baseHP * 0.20) + Math.round(baseATK * 0.20) + Math.round(baseDEF * 0.20) + 25 + 80 + 80;

    // Check if maxed (allowing a tiny 5-point margin for OCR rounding quirks)
    const isAffinityMaxed = maxAffinitySum > 0 && currentAffinitySum >= (maxAffinitySum - 5);

    let simHTML = "";

    // 3B. Interactive Toggles & Filter Logic
    const champDisplay = scanData.Identity.Champion || "Champion";
    const rarityDisplay = scanData.Identity.Rarity || "Legendary";
    const awakenCount = parseInt(scanData.Identity.AwakeningLevel) || 0;

    const canEmpower = window.simDatabase.Empowerment[rarityDisplay] !== null && window.simDatabase.Empowerment[rarityDisplay] !== undefined;
    const canGuard = window.simDatabase.FactionGuardians[rarityDisplay] !== null && window.simDatabase.FactionGuardians[rarityDisplay] !== undefined;

    let togglesRendered = 0;
    let togglesHTML = `<div style="color: #94a3b8; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Bonus Stats Setup</div>`;

    // 1. Affinity Filter
    if (!isAffinityMaxed) {
        togglesHTML += `
            <div style="background: var(--bg-canvas); border: 1px solid var(--border-lowkey); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                <div style="color: #f8fafc; font-weight: 600; margin-bottom: 6px;">Affinity</div>
                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px;">Simulate max Great Hall bonuses.</div>
                <label style="color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.95rem;">
                    <input type="checkbox" id="sim-affinity" class="sim-toggle" style="cursor: pointer; accent-color: #38bdf8; width: 16px; height: 16px;">
                    Simulate max Affinity
                </label>
            </div>`;
        togglesRendered++;
    }

    // 2. Guardians Filter
    if (canGuard) {
        togglesHTML += `
            <div style="background: var(--bg-canvas); border: 1px solid var(--border-lowkey); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                <div style="color: #f8fafc; font-weight: 600; margin-bottom: 6px;">Guardians</div>
                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px;">0/5 ${rarityDisplay} Guardians.</div>
                <label style="color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.95rem;">
                    <input type="checkbox" id="sim-faction" class="sim-toggle" style="cursor: pointer; accent-color: #38bdf8; width: 16px; height: 16px;">
                    Simulate max Guardians
                </label>
            </div>`;
        togglesRendered++;
    }

    // 3. Empowerment Filter
    if (canEmpower) {
        togglesHTML += `
            <div style="background: var(--bg-canvas); border: 1px solid var(--border-lowkey); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                <div style="color: #f8fafc; font-weight: 600; margin-bottom: 6px;">Empowerment</div>
                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px;">0 copies sacrificed.</div>
                <label style="color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.95rem;">
                    <input type="checkbox" id="sim-empower" class="sim-toggle" style="cursor: pointer; accent-color: #38bdf8; width: 16px; height: 16px;">
                    Simulate +4 Empowerment
                </label>
            </div>`;
        togglesRendered++;
    }

    // 4. Blessings Filter (Only render if they are under level 6)
    if (awakenCount < 6) {
        togglesHTML += `
            <div style="background: var(--bg-canvas); border: 1px solid var(--border-lowkey); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                <div style="color: #f8fafc; font-weight: 600; margin-bottom: 6px;">Blessings</div>
                <div style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 8px;">${awakenCount}/6 Awakened.</div>
                <label style="color: var(--text-primary); cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.95rem;">
                    <input type="checkbox" id="sim-blessing" class="sim-toggle" style="cursor: pointer; accent-color: #38bdf8; width: 16px; height: 16px;">
                    Simulate 6 Star Awakened
                </label>
            </div>`;
        togglesRendered++;
    }

    // 3C. The Master Fallback
    if (togglesRendered === 0) {
        simHTML += `
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; color: #34d399; padding: 15px; border-radius: 6px; text-align: center; font-weight: 600;">
                All Stat Bonuses Maxed.<br>Nothing to Simulate.
            </div>`;
    } else {
        simHTML += togglesHTML;
    }

    simDetailsEl.innerHTML = simHTML;

    // 4. EVENT LISTENERS
    const checkboxes = simDetailsEl.querySelectorAll('.sim-toggle');

    const triggerUpdate = () => {
        const activeSims = {
            affinity: simDetailsEl.querySelector('#sim-affinity')?.checked || false,
            faction: simDetailsEl.querySelector('#sim-faction')?.checked || false,
            empower: simDetailsEl.querySelector('#sim-empower')?.checked || false,
            blessing: simDetailsEl.querySelector('#sim-blessing')?.checked || false
        };
        if (typeof onSimulateCallback === 'function') onSimulateCallback(activeSims);
    };

    checkboxes.forEach(cb => cb.addEventListener('change', triggerUpdate));

    if (resetBtn) {
        const newBtn = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newBtn, resetBtn);

        newBtn.addEventListener("click", () => {
            simDetailsEl.querySelectorAll('.sim-toggle').forEach(cb => cb.checked = false);
            triggerUpdate();
        });
    }
};

// ==========================================
// SANDBOX ENGINE: sandbox.js (Formerly mirage.js)
// Phase 1 & 2 - Canvas, Math, and DOM Logic
// ==========================================

const Sandbox = {
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

    // ==========================================
    // 1. DOM PAINTERS
    // ==========================================
    paintGhostGrid: function () {
        const grid = document.getElementById('mainGrid');
        if (!grid) return;

        grid.innerHTML = this.config.map(p => `
            <div class="gear-card slot-empty" id="card_${p.id}">
                <div class="card-header" style="justify-content: flex-end; border: none; padding-bottom: 0;">
                    <span id="title_${p.id}" class="card-title" style="color: var(--text-muted); opacity: 0.25; font-size: 0.9em; letter-spacing: 1px;">${p.n}</span>
                </div>
            </div>
        `).join('');
    },

    updateModifierUI: function (level, type) {
        const dropdown = document.getElementById('awakening-dropdown');
        const scanData = window.SizzleState?.currentScan;

        if (type === 'awakening') {
            const rank = parseInt(scanData?.Identity?.Rank, 10) || 6;
            const ascensionLevel = parseInt(scanData?.Identity?.AscensionLevel || scanData?.Identity?.Ascended, 10) || 0;

            if (dropdown) {
                const awkBtns = dropdown.querySelectorAll('.champ-menu-col:nth-child(1) .champ-menu-btn');
                awkBtns.forEach(btn => btn.classList.remove('active-awk'));
                if (awkBtns[level]) awkBtns[level].classList.add('active-awk');
            }

            const starsContainer = document.getElementById('mirage-champ-stars');
            if (starsContainer) {
                let starsHTML = '';
                for (let i = 1; i <= rank; i++) {
                    let color = i <= level ? '#ef4444' : (i <= ascensionLevel ? '#a855f7' : '#facc15');
                    starsHTML += `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${color}" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 2px;">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                        </svg>
                    `;
                }
                starsContainer.innerHTML = starsHTML;
            }
        } else if (type === 'empowerment') {
            if (dropdown) {
                const empBtns = dropdown.querySelectorAll('.col-empowerment .champ-menu-btn');
                empBtns.forEach(btn => btn.classList.remove('active-emp'));
                if (empBtns[level]) empBtns[level].classList.add('active-emp');
            }

            const nameEl = document.getElementById('mirage-champ-name');
            if (nameEl) {
                let tag = nameEl.querySelector('.empowerment-tag');
                if (!tag && level > 0) {
                    tag = document.createElement('span');
                    tag.className = 'empowerment-tag';
                    nameEl.appendChild(tag);
                }
                if (tag) tag.innerText = level > 0 ? ` +${level}` : '';
            }
        }
    },

    syncUIStates: function (scanData, currentAwk, currentEmp) {
        const rarity = scanData.Identity?.Rarity || "Legendary";
        const canEmpower = window.simDatabase?.Empowerment?.[rarity];
        const ascensionLevel = parseInt(scanData.Identity?.AscensionLevel || scanData.Identity?.Ascended, 10) || 0;

        const empColumn = document.querySelector('.col-empowerment');
        if (empColumn) {
            empColumn.style.opacity = canEmpower ? '1' : '0.3';
            empColumn.style.pointerEvents = canEmpower ? 'auto' : 'none';
            empColumn.style.filter = canEmpower ? 'none' : 'grayscale(100%)';
        }

        const awkColumn = document.querySelector('.champ-menu-col:nth-child(1)');
        if (awkColumn) {
            const canAwaken = ascensionLevel >= 6;
            awkColumn.style.opacity = canAwaken ? '1' : '0.3';
            awkColumn.style.pointerEvents = canAwaken ? 'auto' : 'none';
            awkColumn.style.filter = canAwaken ? 'none' : 'grayscale(100%)';
        }
    },

    // ==========================================
    // 2. MATH & DATA ENGINES
    // ==========================================
    setModifier: function (level, type) {
        const parsedLevel = parseInt(level, 10) || 0;
        const selectId = type === 'awakening' ? 'awkSelect' : 'empSelect';

        const selectEl = document.getElementById(selectId);
        if (selectEl) selectEl.value = parsedLevel;

        const dropdown = document.getElementById('awakening-dropdown');
        if (dropdown) dropdown.style.display = 'none';

        if (type === 'awakening') this.calculateAwakeningDelta(parsedLevel);
        else this.calculateEmpowermentDelta(parsedLevel);

        this.updateModifierUI(parsedLevel, type);
        this.updateSummary();
    },

    _calculateDeltaCore: function (targetLevel, dbCategory, scannedLevelKey, stateKey) {
        window.SizzleState = window.SizzleState || {};
        window.SizzleState.mirage = window.SizzleState.mirage || {};

        let deltas = { HP: 0, ATK: 0, DEF: 0, SPD: 0, CRate: 0, CDMG: 0, ACC: 0, RES: 0 };
        window.SizzleState.mirage[stateKey] = deltas;

        const scanData = window.SizzleState.currentScan;
        if (!scanData || !window.simDatabase?.[dbCategory]) return;

        const rarity = scanData.Identity?.Rarity || "Legendary";
        const db = window.simDatabase[dbCategory][rarity];
        if (!db) return;

        const scannedLevel = parseInt(scanData.Identity?.[scannedLevelKey], 10) || 0;
        const keyMap = { "C_DMG": "CDMG", "C_RATE": "CRate" };
        const maxLevel = dbCategory === 'Blessings' ? 6 : 4;

        for (let i = 1; i <= maxLevel; i++) {
            if (!db[i]) continue;
            Object.entries(db[i]).forEach(([dbKey, val]) => {
                const mirageKey = keyMap[dbKey] || dbKey;
                if (deltas[mirageKey] !== undefined) {
                    if (i <= targetLevel) deltas[mirageKey] += val;
                    if (i <= scannedLevel) deltas[mirageKey] -= val;
                }
            });
        }
    },

    calculateAwakeningDelta: function (targetLevel) {
        this._calculateDeltaCore(targetLevel, 'Blessings', 'AwakeningLevel', 'awakeningBonuses');
    },

    calculateEmpowermentDelta: function (targetLevel) {
        this._calculateDeltaCore(targetLevel, 'Empowerment', 'EmpowermentLevel', 'empowermentBonuses');
    },

    updateGoal: function (utilityName, statKey, value) {
        if (!window.RollEngine?.db) return;

        let blueprintDB = window.RollEngine.db.UtilityBlueprints || window.RollEngine.db.ArtifactSettings?.UtilityBlueprints;
        if (!blueprintDB?.[utilityName]) return;

        blueprintDB[utilityName].preset_goals = blueprintDB[utilityName].preset_goals || {};

        let parsedVal = parseInt(value, 10);
        if (isNaN(parsedVal)) {
            delete blueprintDB[utilityName].preset_goals[statKey];
        } else {
            blueprintDB[utilityName].preset_goals[statKey] = parsedVal;
        }
    },

    // ==========================================
    // 3. MASTER RENDER CONTROLLER
    // ==========================================
    updateSummary: function () {
        const summaryDiv = document.getElementById('summaryOutput');
        if (!summaryDiv) return;

        const scanData = window.SizzleState?.currentScan;
        if (!scanData?.Stats) {
            summaryDiv.innerHTML = '<div class="sum-empty-state">Awaiting scan data...</div>';
            return;
        }

        window.SizzleState.mirage = window.SizzleState.mirage || {};
        const currentChampId = scanData.Identity?.Champion || "Unknown";

        const awkSelect = document.getElementById('awkSelect');
        const empSelect = document.getElementById('empSelect');

        // Handle fresh champ scan reset
        if (window.SizzleState.mirage.lastChamp !== currentChampId) {
            if (awkSelect) awkSelect.value = parseInt(scanData.Identity?.AwakeningLevel, 10) || 0;
            if (empSelect) empSelect.value = parseInt(scanData.Identity?.EmpowermentLevel, 10) || 0;
            window.SizzleState.mirage.lastChamp = currentChampId;
        }

        const currentAwk = parseInt(awkSelect?.value, 10) || 0;
        const currentEmp = parseInt(empSelect?.value, 10) || 0;

        this.syncUIStates(scanData, currentAwk, currentEmp);
        this.calculateAwakeningDelta(currentAwk);
        this.calculateEmpowermentDelta(currentEmp);
        this.updateModifierUI(currentAwk, 'awakening');
        this.updateModifierUI(currentEmp, 'empowerment');

        // Force 5-column layout dynamically
        summaryDiv.style.gridTemplateColumns = "minmax(45px, 1fr) minmax(45px, 1fr) minmax(55px, 1fr) minmax(65px, 1fr) minmax(50px, 1fr)";
        summaryDiv.style.gap = "6px";

        this.renderSummaryGrid(summaryDiv, scanData);
    },

    renderSummaryGrid: function (summaryDiv, scanData) {
        const currentUtility = window.sandboxState?.activeUtility || 'Custom';
        let blueprint = window.RollEngine?.db?.UtilityBlueprints?.[currentUtility] ||
            window.RollEngine?.db?.ArtifactSettings?.UtilityBlueprints?.[currentUtility];

        const jsonKeyMap = { 'HP': 'hp', 'ATK': 'atk', 'DEF': 'def', 'SPD': 'spd', 'CRate': 'cr', 'CDMG': 'cd', 'ACC': 'acc', 'RES': 'res' };

        let gearTotals = { hp: 0, hpP: 0, atk: 0, atkP: 0, def: 0, defP: 0, spd: 0, cr: 0, cd: 0, acc: 0, res: 0 };
        if (typeof window.RollEngine?.evaluateStats === 'function') {
            gearTotals = window.RollEngine.evaluateStats() || gearTotals;
        }

        let simulatedTotals = {};
        let html = `
            <div class="col-header" style="text-align: center;">Scanned</div>
            <div class="col-header col-hdr-delta">+/-</div>
            <div class="col-header col-hdr-stat">Stat</div>
            <div class="col-header col-hdr-total">Total</div>
            <div class="col-header sum-goal">Goal</div>
        `;

        const coreStats = [
            { key: 'HP', label: 'HP', isPct: false }, { key: 'ATK', label: 'ATK', isPct: false },
            { key: 'DEF', label: 'DEF', isPct: false }, { key: 'SPD', label: 'SPD', isPct: false },
            { key: 'CRate', label: 'C. RATE', isPct: true }, { key: 'CDMG', label: 'C. DMG', isPct: true },
            { key: 'ACC', label: 'ACC', isPct: false }, { key: 'RES', label: 'RES', isPct: false }
        ];

        coreStats.forEach(stat => {
            const jKey = jsonKeyMap[stat.key];
            const parsedTotal = parseInt(String(scanData.Stats[stat.key]?.Total || 0).replace(/,/g, ''), 10) || 0;
            const parsedArtifacts = parseInt(String(scanData.Stats[stat.key]?.Artifacts || 0).replace(/,/g, ''), 10) || 0;
            let baseline = parsedTotal - parsedArtifacts;

            const activeAwkDelta = window.SizzleState.mirage.awakeningBonuses?.[stat.key] || 0;
            let activeEmpDelta = window.SizzleState.mirage.empowermentBonuses?.[stat.key] || 0;

            if (!stat.isPct && activeEmpDelta !== 0) {
                const parsedBasic = parseInt(String(scanData.Stats[stat.key]?.Basic || 0).replace(/,/g, ''), 10) || 0;
                activeEmpDelta = Math.round(parsedBasic * (activeEmpDelta / 100));
            }

            const empoweredBaseline = baseline + activeEmpDelta;
            let gearFlat = gearTotals[jKey] || 0;
            let gearPct = gearTotals[jKey + 'P'] || 0;

            let gearPctValue = stat.isPct ? 0 : Math.round(empoweredBaseline * (gearPct / 100));
            if (stat.isPct) gearFlat += gearPct;

            const currentMirageTotal = empoweredBaseline + activeAwkDelta + gearFlat + gearPctValue;
            simulatedTotals[jKey] = currentMirageTotal;

            const rawDelta = currentMirageTotal - parsedTotal;
            const pctStr = stat.isPct ? '%' : '';
            const deltaText = rawDelta === 0 ? '-' : (rawDelta > 0 ? `+${rawDelta.toLocaleString()}${pctStr}` : `${rawDelta.toLocaleString()}${pctStr}`);
            const deltaClass = rawDelta === 0 ? 'delta-neutral' : (rawDelta > 0 ? 'delta-positive' : 'delta-negative');
            const targetNumber = blueprint?.preset_goals?.[jKey] ?? '';

            html += `
                <div class="sum-ranges" style="text-align: center;">${parsedTotal.toLocaleString()}${pctStr}</div>
                <div class="sum-delta ${deltaClass}">${deltaText}</div>
                <div class="sum-label">${stat.label}</div>
                <div class="sum-final">${currentMirageTotal.toLocaleString()}${pctStr}</div>
                <div class="sum-goal">
                    <input type="text" inputmode="numeric" pattern="[0-9]*" class="goal-input"
                           placeholder="-" id="goal_${stat.key}" value="${targetNumber}"
                           oninput="window.clampGoal(this, '${stat.key}'); Sandbox.updateGoal('${currentUtility}', '${jKey}', this.value)"
                           onclick="event.stopPropagation()">
                </div>
            `;
        });

        const ehpVal = window.getEhpData ? (window.getEhpData(simulatedTotals['hp'] || 0, simulatedTotals['def'] || 0)?.score?.toLocaleString() || '--') : '--';
        if (window.getEhpData) {
            const ehpInfo = window.getEhpData(simulatedTotals['hp'] || 0, simulatedTotals['def'] || 0);
            if (ehpInfo) {
                const drawer = document.getElementById('val-ehp-compare');
                const scoreBar = document.getElementById('val-ehp-score');
                if (drawer) drawer.innerHTML = ehpInfo.comparisonText;
                if (scoreBar) scoreBar.innerText = ehpVal;
            }
        }

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
                ${this.generateBalanceText(scanData, simulatedTotals)}
            </div>
        `;
        summaryDiv.innerHTML = html;
    },

    generateBalanceText: function (scanData, simulatedTotals) {
        if (!scanData?.Identity?.ScalingStats) return "Balance: N/A";

        let scalingArray = Array.isArray(scanData.Identity.ScalingStats) ? scanData.Identity.ScalingStats : [scanData.Identity.ScalingStats];
        let flatScaling = [...new Set(scalingArray.map(s => String(s).toLowerCase()).flatMap(s => s.split(/&|and|,|\//i).map(i => i.trim())))];
        const pureStats = ["atk", "def", "hp"];

        if (flatScaling.length > 1 || !pureStats.includes(flatScaling[0])) {
            return `<span style="color: var(--text-muted);">Split-Scaling:</span> <span style="color: #a855f7;">${scalingArray.join(" | ").toUpperCase()}</span>`;
        }

        const primaryStat = flatScaling[0].toUpperCase();
        const jKey = primaryStat.toLowerCase();
        const baseStat = scanData.Stats[primaryStat]?.Basic;

        if (!baseStat) return "Balance: N/A";

        const totalStat = simulatedTotals[jKey] || 0;
        const critDamage = simulatedTotals['cd'] || 0;
        const statMultiplier = totalStat / baseStat;
        const cdMultiplier = 1 + (critDamage / 100);

        const idealCD = (statMultiplier - 1) * 100;
        const idealStat = cdMultiplier * baseStat;
        const efficiencyScore = (Math.min(statMultiplier, cdMultiplier) / Math.max(statMultiplier, cdMultiplier)) * 100;

        const deltaStat = Math.abs(Math.round(idealStat - totalStat));
        const deltaCD = Math.abs(Math.round(idealCD - critDamage));
        const scoreBadge = `<span style="color:${efficiencyScore >= 95 ? '#4ade80' : '#eab308'};">[${Math.round(efficiencyScore)}%]</span>`;

        if (Math.round(efficiencyScore) >= 100) {
            return `Balance ${scoreBadge} <span style="color: #4ade80;">Perfectly Aligned</span>`;
        } else if (statMultiplier > cdMultiplier) {
            return `Balance ${scoreBadge} <span style="color: #4ade80;">+${deltaCD}% C.DMG</span> <span style="color: var(--text-muted);">or</span> <span style="color: #f87171;">-${deltaStat} ${primaryStat}</span>`;
        } else {
            return `Balance ${scoreBadge} <span style="color: #4ade80;">+${deltaStat} ${primaryStat}</span> <span style="color: var(--text-muted);">or</span> <span style="color: #f87171;">-${deltaCD}% C.DMG</span>`;
        }
    }
};

// ==========================================
// GLOBAL EVENT BINDINGS
// ==========================================

window.copyScannedToGoals = function (event) {
    if (event) event.stopPropagation();
    const scanData = window.SizzleState?.currentScan;
    if (!scanData?.Stats) return;

    window.sandboxState = window.sandboxState || {};
    window.sandboxState.activeUtility = 'Custom';

    const utilityDropdown = document.getElementById('utilitySelect');
    if (utilityDropdown) utilityDropdown.value = 'Custom';

    const jsonKeyMap = { 'HP': 'hp', 'ATK': 'atk', 'DEF': 'def', 'SPD': 'spd', 'CRate': 'cr', 'CDMG': 'cd', 'ACC': 'acc', 'RES': 'res' };

    Object.keys(jsonKeyMap).forEach(statKey => {
        const jKey = jsonKeyMap[statKey];
        const parsedTotal = parseInt(String(scanData.Stats[statKey]?.Total || 0).replace(/,/g, ''), 10) || 0;
        Sandbox.updateGoal('Custom', jKey, parsedTotal);
    });

    Sandbox.updateSummary();
};

window.clearGoals = function (event) {
    if (event) event.stopPropagation();
    let currentUtility = window.sandboxState?.activeUtility || 'Custom';

    ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'acc', 'res'].forEach(jKey => {
        Sandbox.updateGoal(currentUtility, jKey, '');
    });

    Sandbox.updateSummary();
};

window.toggleMath = function (event) {
    if (event.target.tagName.toLowerCase() !== 'input' && event.target.tagName.toLowerCase() !== 'button') {
        document.getElementById('summaryOutput')?.classList.toggle('hide-math');
    }
};

window.setAwakening = function (level) { Sandbox.setModifier(level, 'awakening'); };
window.setEmpowerment = function (level) { Sandbox.setModifier(level, 'empowerment'); };
window.updateSummary = function () { Sandbox.updateSummary(); };

window.setRollQuality = function (quality) {
    document.querySelectorAll('.pill-btn').forEach(btn => btn.classList.remove('active-pill'));
    document.getElementById('pill-' + (quality === 'random' ? 'rng' : quality)).classList.add('active-pill');

    window.SizzleState = window.SizzleState || {};
    window.SizzleState.rollQuality = quality;

    if (typeof window.applyGlyphs === 'function') window.applyGlyphs();
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

    // --- SWEEP AND CLEAR MASTERY CHECKBOXES ---
    document.querySelectorAll('.m-check').forEach(cb => {
        cb.checked = false;
        cb.disabled = false;
    });

    if (typeof window.RollEngine?.purge === 'function') window.RollEngine.purge();

    const awkSelect = document.getElementById('awkSelect');
    if (awkSelect) awkSelect.value = parseInt(scanData?.Identity?.AwakeningLevel, 10) || 0;

    const empSelect = document.getElementById('empSelect');
    if (empSelect) empSelect.value = parseInt(scanData?.Identity?.EmpowermentLevel, 10) || 0;

    // --- THE NEW DEFAULT GLYPH LOGIC ---
    const glyphDropdown = document.getElementById('glyphSelect');
    if (glyphDropdown) {
        glyphDropdown.value = 'green5'; // Force it to Max 5★ Basic

        // Force the math engine to register the change!
        if (typeof window.updateGlobal === 'function') {
            window.updateGlobal();
        }
    }

    if (typeof window.applyGlyphs === 'function') {
        window.applyGlyphs();
    }
    // Default the ascension toggle to ON during load/hard reset
    const ascToggle = document.getElementById('ascensionToggle');
    if (ascToggle) {
        ascToggle.checked = true;
    }

    Sandbox.updateSummary();
};

window.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#awakening-dropdown span[onclick]').forEach(span => span.removeAttribute('onclick'));

    // --- FORCE DEFAULT GLYPHS ON INITIAL PAGE LOAD ---
    const glyphDropdown = document.getElementById('glyphSelect');
    if (glyphDropdown) {
        glyphDropdown.value = 'green5';
    }
});

window.clampGoal = function (inputEl, statKey) {
    let cleanValue = inputEl.value.replace(/[^0-9]/g, '');
    if (cleanValue !== '') {
        let maxLimit = (statKey === 'HP') ? 250000 : 15000;
        if (parseInt(cleanValue, 10) > maxLimit) cleanValue = maxLimit.toString();
    }
    inputEl.value = cleanValue;
};

// ==========================================
// NEW: POPULATE SANDBOX MASTERIES
// ==========================================
window.populateSandboxMasteries = function (scanData) {
    if (!scanData || !scanData.Stats) return;

    // Helper to check the box (and disable it so it's read-only for today)
    const checkMastery = (id) => {
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = true;
            checkbox.disabled = true; // Locks it down for today's goal!
        }
    };

    // --- 1. OFFENSE TREE ---
    const crMastery = scanData.Stats["CRate"]?.Masteries || 0;
    const cdMastery = scanData.Stats["CDMG"]?.Masteries || 0;
    const atkMastery = scanData.Stats["ATK"]?.Masteries || 0;

    if (atkMastery >= 75) checkMastery('m_blade');
    if (crMastery >= 5) checkMastery('m_deadly');

    // C.DMG logic (handles if they have Tier 2, Tier 6, or both)
    if (cdMastery === 10 || cdMastery === 30) checkMastery('m_keen');
    if (cdMastery === 20 || cdMastery === 30) checkMastery('m_flawless');

    // --- 2. DEFENSE TREE ---
    const defMastery = scanData.Stats["DEF"]?.Masteries || 0;
    const resMastery = scanData.Stats["RES"]?.Masteries || 0;

    if (defMastery === 75 || defMastery === 275) checkMastery('m_tough');
    if (defMastery === 200 || defMastery === 275) checkMastery('m_iron');

    // RES logic
    if (resMastery === 10 || resMastery === 60) checkMastery('m_defiant');
    if (resMastery === 50 || resMastery === 60) checkMastery('m_unshakable');

    // --- 3. SUPPORT TREE ---
    const accMastery = scanData.Stats["ACC"]?.Masteries || 0;
    const hpMastery = scanData.Stats["HP"]?.Masteries || 0;

    if (hpMastery === 810 || hpMastery === 3810) checkMastery('m_steadfast');
    if (hpMastery === 3000 || hpMastery === 3810) checkMastery('m_elixir');

    // ACC logic
    if (accMastery === 10 || accMastery === 60) checkMastery('m_pinpoint');
    if (accMastery === 50 || accMastery === 60) checkMastery('m_eagle');
};