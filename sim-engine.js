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
