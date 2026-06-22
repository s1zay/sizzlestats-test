// ==========================================
// ROLL ENGINE: roll-engine.js (The Blacksmith v2.4.4 - The Real Ascension Fix)
// ==========================================

window.sandboxState = {
    activeUtility: 'Custom',
};

// --- GLOBAL MATH ENGINE ---
window.calculateSubstatValue = function (statId, itemType, stars, hits, storedRolls) {
    if (hits === 0) return 0;

    const mode = window.SizzleState?.rollQuality || 'random';

    if (mode === 'random') {
        return storedRolls.reduce((a, b) => a + b, 0);
    }

    const bounds = window.RollEngine.db.ArtifactSettings.RngRollBounds[statId][itemType][stars];
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
            total = Math.round(((min + max) / 2) * hits);
            break;
    }

    return total;
};

window.RollEngine = {
    db: null,

    boot: async function () {
        try {
            const response = await fetch('sim-database.json');
            this.db = await response.json();

            this.initState(this.db.ArtifactSettings.SlotConfig, this.db.ArtifactSettings.SubstatPools);

            window.RenderEngine.buildGrid();
            Object.keys(window.sandboxState).forEach(pId => {
                if (pId !== 'activeUtility') window.RenderEngine.renderPiece(pId);
            });
        } catch (error) { }
    },

    initState: function (slotConfig, substatPools) {
        let currentUtility = window.sandboxState.activeUtility || 'Custom';
        window.sandboxState = { activeUtility: currentUtility };

        slotConfig.forEach(piece => {
            let pId = piece.id;
            window.sandboxState[pId] = {
                rank: 6,
                primaryStat: 'none',
                ascension: { stat: 'none', value: 0 },
                substats: {}
            };

            substatPools[pId].forEach(subKey => {
                window.sandboxState[pId].substats[subKey] = { hits: 0, rolls: [], glyph: 0 };
            });
        });
    },

    purge: function () {
        if (!this.db || !this.db.ArtifactSettings) return;

        this.initState(this.db.ArtifactSettings.SlotConfig, this.db.ArtifactSettings.SubstatPools);

        if (window.RenderEngine && typeof window.RenderEngine.buildGrid === 'function') {
            window.RenderEngine.buildGrid();
            Object.keys(window.sandboxState).forEach(pId => {
                if (pId !== 'activeUtility') {
                    window.RenderEngine.renderPiece(pId);
                }
            });
        }
    },

    updateUtilityProfile: function (profileKey) {
        window.sandboxState.activeUtility = profileKey;
        if (typeof window.updateSummary === "function") window.updateSummary();
    },

    generateRollsFor: function (piece, stat, count) {
        let rank = window.sandboxState[piece].rank.toString();
        let slotConfig = this.db.ArtifactSettings.SlotConfig.find(p => p.id === piece);
        let itemType = slotConfig.t;

        let bounds = this.db.ArtifactSettings.RngRollBounds[stat][itemType][rank];
        let rollArray = [];

        for (let i = 0; i < count; i++) {
            let min = bounds[0];
            let max = bounds[1];
            rollArray.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }

        window.sandboxState[piece].substats[stat].hits = count;
        window.sandboxState[piece].substats[stat].rolls = rollArray;

        return rollArray;
    },

    evaluateStats: function () {
        let totals = {
            hp: 0, hpP: 0, atk: 0, atkP: 0, def: 0, defP: 0,
            spd: 0, cr: 0, cd: 0, acc: 0, res: 0, ign: 0
        };

        const pieces = Object.keys(window.sandboxState).filter(k => k !== 'activeUtility' && k !== 'pieceLimits');

        pieces.forEach(pId => {
            let pieceData = window.sandboxState[pId];
            let rank = pieceData.rank.toString();
            let itemType = this.db.ArtifactSettings.SlotConfig.find(p => p.id === pId).t;

            let pStat = pieceData.primaryStat;
            if (pStat !== 'none' && this.db.ArtifactSettings.PrimaryValues[pStat]) {
                totals[pStat] += this.db.ArtifactSettings.PrimaryValues[pStat][rank][itemType];
            }

            let aStat = pieceData.ascension.stat;
            if (aStat && aStat !== 'none' && this.db.ArtifactSettings.AscensionValues[aStat]) {
                if (['BAN', 'RIN', 'AMU'].includes(pId) && aStat.toLowerCase() === 'spd') {
                    // Illegal stat injected by legacy memory, ignore
                } else {
                    let aVal = this.db.ArtifactSettings.AscensionValues[aStat][itemType]?.[rank] || 0;
                    totals[aStat] += aVal;
                }
            }

            Object.keys(pieceData.substats).forEach(sub => {
                let hits = pieceData.substats[sub].hits;
                if (hits > 0) {
                    let sumOfRolls = window.calculateSubstatValue(sub, itemType, rank, hits, pieceData.substats[sub].rolls);
                    totals[sub] += (sumOfRolls + pieceData.substats[sub].glyph);
                }
            });
        });

        return totals;
    }
};

window.RenderEngine = {
    buildGrid: function () {
        const grid = document.getElementById('mainGrid');
        if (!grid) return;

        let html = '';
        window.RollEngine.db.ArtifactSettings.SlotConfig.forEach(p => {
            html += `
            <div class="gear-card" id="card_${p.id}" onclick="window.expandCard('${p.id}', event)" style="cursor: pointer;">
                
                <div class="card-header" style="display: flex; align-items: center; justify-content: space-between; position: relative;">
                    
                    <button class="btn-rank" id="btn_rank_${p.id}" onclick="event.stopPropagation(); window.toggleRank('${p.id}')">-</button>
                    
                    <div class="expand-indicator" style="position: absolute; left: 50%; transform: translateX(-50%); top: 0px;">
                        <svg class="icon-maximize" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <polyline points="9 21 3 21 3 15"></polyline>
                            <line x1="21" y1="3" x2="14" y2="10"></line>
                            <line x1="3" y1="21" x2="10" y2="14"></line>
                            <polyline points="21 15 21 21 15 21"></polyline>
                            <polyline points="3 9 3 3 9 3"></polyline>
                            <line x1="21" y1="21" x2="14" y2="14"></line>
                            <line x1="3" y1="3" x2="10" y2="10"></line>
                        </svg>
                        <svg class="icon-minimize" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none;">
                            <polyline points="4 10 10 10 10 4"></polyline>
                            <polyline points="20 14 14 14 14 20"></polyline>
                            <line x1="10" y1="10" x2="3" y2="3"></line>
                            <line x1="14" y1="14" x2="21" y2="21"></line>
                            <polyline points="14 4 14 10 20 10"></polyline>
                            <polyline points="4 14 10 14 10 20"></polyline> <line x1="14" y1="10" x2="21" y2="3"></line>
                            <line x1="10" y1="14" x2="3" y2="21"></line>
                        </svg>
                    </div>

                    <span id="title_${p.id}" class="card-title">${p.n}</span>
                </div>
                <div class="primary-display" id="p_disp_${p.id}"></div>
                <div class="ascension-display" id="a_disp_${p.id}"></div>
                
                <div class="limits-bar" id="limits_${p.id}" style="display: none; justify-content: space-between; font-size: 0.75em; color: var(--text-muted); margin: 8px 0; padding-bottom: 4px; border-bottom: 1px solid var(--border-lowkey);">
                    <span>Stats: <b id="l_stat_${p.id}" style="color: var(--text-primary);">0/4</b></span>
                    <span>Rolls: <b id="l_rolls_${p.id}" style="color: var(--text-primary);">0/0</b></span>
                </div>

                <div class="sub-stat-list" id="subs_${p.id}"></div>
            </div>`;
        });
        grid.innerHTML = html;
    },

    renderPiece: function (piece) {
        const memory = window.sandboxState[piece];
        if (!memory) return;

        const cardEl = document.getElementById(`card_${piece}`);
        const isExp = cardEl.classList.contains('expanded');

        const rank = memory.rank;
        const pStat = memory.primaryStat;
        let aStat = memory.ascension.stat;
        const config = window.RollEngine.db.ArtifactSettings.SlotConfig.find(p => p.id === piece);
        const itemType = config.t;

        document.getElementById(`btn_rank_${piece}`).innerText = (pStat === 'none') ? '-' : rank + '★';

        let pHTML = '';
        if (pStat === 'none') {
            pHTML = `<span class="primary-name" style="color: var(--text-muted); opacity: 0.5;">-</span>`;
        } else {
            let pVal = window.RollEngine.db.ArtifactSettings.PrimaryValues[pStat][rank][itemType];
            let pSuffix = window.RollEngine.db.ArtifactSettings.RngRollBounds[pStat].p ? "%" : "";

            if (isExp && config.po.length > 1) {
                let options = config.po.map(opt => {
                    let optData = window.RollEngine.db.ArtifactSettings.RngRollBounds[opt];
                    let oBase = optData.n.replace('%', '');
                    let oSuf = optData.p ? "%" : "";
                    let oName = oBase + oSuf;

                    return `<option value="${opt}" ${pStat === opt ? 'selected' : ''}>${oName}</option>`;
                }).join('');

                pHTML = `<select class="primary-native-select p-sel" onchange="window.changePrimary('${piece}', this.value)" onclick="event.stopPropagation()" data-piece="${piece}">${options}</select>`;
            } else {
                let pBase = window.RollEngine.db.ArtifactSettings.RngRollBounds[pStat].n.replace('%', '');
                let pSuf = window.RollEngine.db.ArtifactSettings.RngRollBounds[pStat].p ? "%" : "";
                pHTML = `<span class="primary-name">${pBase}${pSuf}</span>`;
            }

            pHTML += `<span class="primary-val">${pVal}${pSuffix}</span>`;
        }
        document.getElementById(`p_disp_${piece}`).innerHTML = pHTML;

        const aDisp = document.getElementById(`a_disp_${piece}`);
        let aHTML = '';

        let dbPools = window.RollEngine.db.ArtifactSettings?.AscensionPools || window.RollEngine.db?.AscensionPools || {};
        let validAscensions = dbPools[piece] || [];

        // STRICT PURGE: Accessories CANNOT roll Speed Ascension
        if (['BAN', 'RIN', 'AMU'].includes(piece)) {
            validAscensions = validAscensions.filter(opt => opt.toLowerCase() !== 'spd');

            // Cleanse illegal state if it somehow got injected
            if (aStat && aStat.toLowerCase() === 'spd') {
                aStat = 'none';
                memory.ascension.stat = 'none';
            }
        }

        if (aStat && aStat !== 'none') {
            cardEl.classList.add('has-ascension');
            cardEl.style.boxShadow = "inset 0 0 8px rgba(168, 85, 247, 0.15)";
            let aVal = window.RollEngine.db.ArtifactSettings.AscensionValues[aStat][itemType]?.[rank] || 0;
            let aSuffix = window.RollEngine.db.ArtifactSettings.RngRollBounds[aStat].p ? "%" : "";

            if (isExp) {
                let options = `<option value="none">Remove Ascension</option>` + validAscensions.map(opt => {
                    let oName = window.RollEngine.db.ArtifactSettings.RngRollBounds[opt].n;
                    return `<option value="${opt}" ${aStat === opt ? 'selected' : ''}>${oName}</option>`;
                }).join('');
                aHTML = `<select class="rng-btn" onchange="window.changeAscension('${piece}', this.value)" onclick="event.stopPropagation()" style="font-size: 0.8em; padding: 2px 5px; background: rgba(168, 85, 247, 0.1); color: #a855f7; border: 1px solid #a855f7; border-radius: 4px; margin-bottom:4px;">${options}</select>`;
            } else {
                let aName = window.RollEngine.db.ArtifactSettings.RngRollBounds[aStat].n.replace('%', '');
                aHTML = `<span style="color: #a855f7; font-size: 0.8em; font-weight: bold; text-transform: uppercase;">${aName}</span>`;
            }
            aHTML += `<span style="color: #a855f7; font-size: 0.9em; font-family: monospace;">+${aVal}${aSuffix}</span>`;
        } else {
            cardEl.style.boxShadow = "none";
            if (isExp && validAscensions.length > 0 && pStat !== 'none') {
                cardEl.classList.add('has-ascension');
                let options = `<option value="none" selected>+ Add Ascension</option>` + validAscensions.map(opt => {
                    let oName = window.RollEngine.db.ArtifactSettings.RngRollBounds[opt].n;
                    return `<option value="${opt}">${oName}</option>`;
                }).join('');
                aHTML = `<select class="rng-btn" onchange="window.changeAscension('${piece}', this.value)" onclick="event.stopPropagation()" style="font-size: 0.8em; padding: 2px 5px; background: transparent; color: var(--text-muted); border: 1px dashed var(--border-lowkey); border-radius: 4px; margin-bottom:4px;">${options}</select>`;
            } else {
                cardEl.classList.remove('has-ascension');
            }
        }
        aDisp.innerHTML = aHTML;

        const limitsBar = document.getElementById(`limits_${piece}`);
        let activeStatsCount = 0;
        let totalUpgrades = 0;

        let pieceLimit = window.sandboxState.pieceLimits?.[piece] || 9;
        let maxUpgrades = 5;

        Object.keys(memory.substats).forEach(k => {
            let h = memory.substats[k].hits;
            if (h > 0) {
                activeStatsCount++;
                totalUpgrades += (h - 1);
            }
        });

        let totalPieceHits = activeStatsCount + totalUpgrades;

        let mythicStatKey = null;
        let activeKeys = Object.keys(memory.substats).filter(k => memory.substats[k].hits > 0);

        if (activeStatsCount === 4 && totalPieceHits >= 9) {
            let forcedMythic = activeKeys.find(k => memory.substats[k].hits >= 6);

            if (forcedMythic) {
                memory.mythicKey = forcedMythic;
            } else if (!memory.mythicKey || !activeKeys.includes(memory.mythicKey)) {
                let randomIndex = Math.floor(Math.random() * activeKeys.length);
                memory.mythicKey = activeKeys[randomIndex];
            }
            mythicStatKey = memory.mythicKey;
        } else {
            memory.mythicKey = null;
        }

        if (isExp && pStat !== 'none') {
            limitsBar.style.display = "flex";
            document.getElementById(`l_stat_${piece}`).innerText = `${activeStatsCount}/4`;
            document.getElementById(`l_rolls_${piece}`).innerText = `${totalUpgrades}/${maxUpgrades}`;

            document.getElementById(`l_stat_${piece}`).style.color = activeStatsCount >= 4 ? '#ef4444' : 'var(--text-primary)';
            document.getElementById(`l_rolls_${piece}`).style.color = totalUpgrades >= maxUpgrades ? '#ef4444' : 'var(--text-primary)';
        } else {
            limitsBar.style.display = "none";
        }

        const subContainer = document.getElementById(`subs_${piece}`);
        let subHtml = '';

        let allPool = window.RollEngine.db.ArtifactSettings.SubstatPools[piece];

        allPool.forEach(subKey => {
            if (subKey === pStat) return;

            let hits = memory.substats[subKey].hits;
            let isAct = hits > 0;

            if (isExp || isAct) {
                let sData = window.RollEngine.db.ArtifactSettings.RngRollBounds[subKey];
                let sName = sData.n.replace('%', '');
                let sSuffix = sData.p ? "%" : "";

                let sum = isAct ? window.calculateSubstatValue(subKey, itemType, rank, hits, memory.substats[subKey].rolls) : 0;
                let glyphVal = memory.substats[subKey].glyph || 0;

                let rCnt = isAct ? hits - 1 : 0;
                let displayRolls = rCnt;
                let isMythicBase = (subKey === mythicStatKey);

                let colorCls = "hit-default";
                if (hits === 4) colorCls = "hit-epic";
                if (hits === 5) colorCls = "hit-leggo";

                if (isMythicBase) {
                    colorCls = "hit-mythic";
                    displayRolls = Math.max(0, rCnt - 1);
                } else if (hits >= 6) {
                    colorCls = "hit-mythic";
                    displayRolls = 4;
                }

                let dict = window.RollEngine.db?.ArtifactSettings?.GlyphDictionary;
                let maxGlyphAllowed = 0;
                let pieceRank = parseInt(memory.rank, 10) || 6;

                if (dict) {
                    Object.keys(dict).forEach(tierName => {
                        let glyphRank = parseInt(tierName.match(/\d+/)?.[0] || "6", 10);
                        if (glyphRank <= pieceRank && dict[tierName][subKey] && dict[tierName][subKey] > maxGlyphAllowed) {
                            maxGlyphAllowed = dict[tierName][subKey];
                        }
                    });
                }

                let rInd = (displayRolls > 0) ? `<span class="roll-ind ${colorCls}">[${displayRolls}]</span>` : '';

                let isGlyphable = (maxGlyphAllowed > 0 && subKey !== 'cr' && subKey !== 'cd');

                let gInd = '';
                if (isExp && isAct && isGlyphable) {
                    gInd = `<input type="number" class="custom-glyph-input" value="${glyphVal}" min="0" max="${maxGlyphAllowed}" 
                                   onclick="event.stopPropagation()" 
                                   onchange="event.stopPropagation(); window.setCustomGlyph('${piece}', '${subKey}', this.value, ${maxGlyphAllowed})" 
                                   title="Max allowed: +${maxGlyphAllowed}${sSuffix}">`;

                    gInd += `<span style="display: inline-block; width: 14px; font-size: 0.85em; margin-left: 2px; color: var(--indicator-active); font-weight: bold; text-align: left; visibility: ${sSuffix ? 'visible' : 'hidden'};">%</span>`;

                } else if (glyphVal > 0 && isGlyphable) {
                    gInd = `<span class="glyph-val">+${glyphVal}${sSuffix}</span>`;
                }

                let disableAdd = (!isAct && activeStatsCount >= 4) || (isAct && totalUpgrades >= 5) || (totalPieceHits >= 9) || (isAct && hits >= 6);
                let disableSub = (!isAct);

                subHtml += `
                <div class="sub-row single-line ${!isAct ? 'dimmed' : ''}">
                    
                    ${isExp ? `
                        <input type="checkbox" id="chk_${piece}_${subKey}" class="row-check" 
                               ${isAct ? 'checked' : ''} ${(!isAct && activeStatsCount >= 4) ? 'disabled' : ''} 
                               onclick="event.stopPropagation(); window.toggleStatBox('${piece}', '${subKey}')">
                    ` : ''}

                    <label class="sub-label ${colorCls}" ${isExp ? `for="chk_${piece}_${subKey}"` : ''} style="cursor: ${isExp ? 'pointer' : 'default'};">
                        ${sName}
                    </label>

                    <div class="row-controls">
                        <span class="sub-val ${colorCls}" style="${!isAct ? 'display:none;' : ''}">${sum}${sSuffix}${rInd}</span>
                        
                        ${(isExp && isAct) ? `
                            <div class="btn-group">
                                <button class="roll-btn left" ${disableSub ? 'disabled' : ''} onclick="event.stopPropagation(); window.changeRoll('${piece}', '${subKey}', -1)"></button>
                                <button class="roll-btn right" ${disableAdd ? 'disabled' : ''} onclick="event.stopPropagation(); window.changeRoll('${piece}', '${subKey}', 1)"></button>
                            </div>
                        ` : ''}
                    </div>

                    <div class="glyph-container">
                        ${gInd}
                    </div>
                    
                </div>`;
            }
        });

        let titleEl = document.getElementById(`title_${piece}`);
        if (titleEl) {
            titleEl.className = 'card-title';

            if (totalPieceHits >= 9) titleEl.classList.add('glow-gear-mythical');
            else if (totalPieceHits === 8) titleEl.classList.add('glow-gear-legendary');
            else if (totalPieceHits === 7) titleEl.classList.add('glow-gear-epic');
        }

        subContainer.innerHTML = subHtml || '<div style="text-align:center; color:#555; font-size:0.8em; margin-top:10px;">-</div>';
    }
};

window.expandCard = function (piece, event) {
    if (event && (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || event.target.tagName === 'SELECT' || event.target.tagName === 'OPTION')) return;

    let card = document.getElementById(`card_${piece}`);
    if (card) {
        card.classList.toggle('expanded');
        if (card.classList.contains('expanded')) {
            card.style.borderColor = 'var(--text-muted)';
        } else {
            card.style.borderColor = 'var(--border-lowkey)';
        }
        window.RenderEngine.renderPiece(piece);
    }
};

window.syncGlyphDropdownUI = function () {
    let glyphSelect = document.getElementById('glyphSelect');
    if (!glyphSelect) return;

    let pieces = Object.keys(window.sandboxState).filter(k => k !== 'activeUtility' && k !== 'pieceLimits');
    let has5Star = pieces.some(p => window.sandboxState[p].rank === 5);

    Array.from(glyphSelect.options).forEach(opt => {
        if (opt.value.includes('6')) {
            opt.disabled = has5Star;
            opt.style.display = has5Star ? 'none' : 'block';
        }
    });

    if (glyphSelect.options[glyphSelect.selectedIndex]?.disabled) {
        glyphSelect.value = 'custom';
        setTimeout(() => window.applyGlyphs(), 0);
    }
};

window.toggleRank = function (piece) {
    let pState = window.sandboxState[piece];
    pState.rank = pState.rank === 6 ? 5 : 6;

    Object.keys(pState.substats).forEach(stat => {
        let hits = pState.substats[stat].hits;
        if (hits > 0) window.RollEngine.generateRollsFor(piece, stat, hits);
    });

    window.syncGlyphDropdownUI();
    window.updatePieceGlyphs(piece);
    window.RenderEngine.renderPiece(piece);
    if (typeof window.updateSummary === 'function') window.updateSummary();
};

window.changePrimary = function (piece, newPrimary) {
    let pState = window.sandboxState[piece];
    pState.primaryStat = newPrimary;

    if (pState.substats[newPrimary] && pState.substats[newPrimary].hits > 0) {
        pState.substats[newPrimary].hits = 0;
        pState.substats[newPrimary].rolls = [];
        pState.substats[newPrimary].glyph = 0;
    }

    window.RenderEngine.renderPiece(piece);
    if (typeof window.updateSummary === 'function') window.updateSummary();
};

window.changeAscension = function (piece, newAsc) {
    if (['BAN', 'RIN', 'AMU'].includes(piece) && newAsc.toLowerCase() === 'spd') {
        newAsc = 'none';
    }
    window.sandboxState[piece].ascension.stat = newAsc;

    let ascToggle = document.getElementById('ascensionToggle');
    if (ascToggle && ascToggle.checked) {
        ascToggle.checked = false;
    }

    window.RenderEngine.renderPiece(piece);
    if (typeof window.updateSummary === 'function') window.updateSummary();
};

window.toggleStatBox = function (piece, stat) {
    let pState = window.sandboxState[piece];
    let isAct = pState.substats[stat].hits > 0;

    if (isAct) {
        pState.substats[stat].hits = 0;
        pState.substats[stat].rolls = [];
        pState.substats[stat].glyph = 0;
    } else {
        pState.substats[stat].hits = 1;
        window.RollEngine.generateRollsFor(piece, stat, 1);
    }

    window.updatePieceGlyphs(piece);
    window.RenderEngine.renderPiece(piece);
    if (typeof window.updateSummary === 'function') window.updateSummary();
};

window.changeRoll = function (piece, stat, dir) {
    let pState = window.sandboxState[piece];
    let curHits = pState.substats[stat].hits;

    if (dir === 1) {
        pState.substats[stat].hits++;
        let newRolls = window.RollEngine.generateRollsFor(piece, stat, pState.substats[stat].hits);
        pState.substats[stat].rolls = newRolls;
    } else if (dir === -1 && curHits > 1) {
        pState.substats[stat].hits--;
        pState.substats[stat].rolls.pop();
    }

    window.updatePieceGlyphs(piece);
    window.RenderEngine.renderPiece(piece);
    if (typeof window.updateSummary === 'function') window.updateSummary();
};

window.setCustomGlyph = function (piece, stat, val, maxVal) {
    let pState = window.sandboxState[piece];
    let numVal = parseInt(val, 10);
    let absoluteMax = parseInt(maxVal, 10) || 0;

    if (isNaN(numVal)) numVal = 0;

    if (numVal < 0) {
        numVal = 0;
    } else if (absoluteMax === 0) {
        numVal = 0;
    } else if (numVal > absoluteMax) {
        numVal = absoluteMax;
    }

    pState.substats[stat].glyph = numVal;

    let glyphDropdown = document.getElementById('glyphSelect');
    if (glyphDropdown) {
        let hasCustom = Array.from(glyphDropdown.options).some(opt => opt.value === 'custom');
        if (!hasCustom) {
            let customOpt = new Option("Custom / Manual", "custom");
            glyphDropdown.add(customOpt);
        }
        glyphDropdown.value = 'custom';
    }

    window.RenderEngine.renderPiece(piece);
    if (typeof window.updateSummary === 'function') window.updateSummary();
};

window.updatePieceGlyphs = function (piece) {
    let pState = window.sandboxState[piece];
    if (!pState) return;

    let glyphDropdown = document.getElementById('glyphSelect');

    let glyphTier = glyphDropdown?.value || "0";
    let pieceRank = parseInt(pState.rank, 10) || 6;
    let dict = window.RollEngine.db?.ArtifactSettings?.GlyphDictionary;

    if (glyphTier === 'custom') {
        Object.keys(pState.substats).forEach(subKey => {
            if (pState.substats[subKey].hits === 0) {
                pState.substats[subKey].glyph = 0;
            } else if (pState.substats[subKey].glyph > 0 && dict) {
                let maxForRank = 0;
                Object.keys(dict).forEach(tierName => {
                    let glyphRank = parseInt(tierName.match(/\d+/)?.[0] || "6", 10);
                    if (glyphRank <= pieceRank && dict[tierName][subKey] && dict[tierName][subKey] > maxForRank) {
                        maxForRank = dict[tierName][subKey];
                    }
                });
                if (pState.substats[subKey].glyph > maxForRank) {
                    pState.substats[subKey].glyph = maxForRank;
                }
            }
        });
        return;
    }

    let glyphDict = null;
    if (glyphTier !== "0" && dict) {
        let selectedGlyphRank = parseInt(glyphTier.match(/\d+/)?.[0] || "6", 10);
        if (selectedGlyphRank > pieceRank) {
            glyphDict = "dynamic_max";
        } else {
            glyphDict = dict[glyphTier];
        }
    }

    Object.keys(pState.substats).forEach(subKey => {
        if (pState.substats[subKey].hits > 0 && glyphDict) {
            if (glyphDict === "dynamic_max") {
                let maxForRank = 0;
                Object.keys(dict).forEach(tierName => {
                    let glyphRank = parseInt(tierName.match(/\d+/)?.[0] || "6", 10);
                    if (glyphRank <= pieceRank && dict[tierName][subKey] && dict[tierName][subKey] > maxForRank) {
                        maxForRank = dict[tierName][subKey];
                    }
                });
                pState.substats[subKey].glyph = maxForRank;
            } else if (glyphDict[subKey]) {
                pState.substats[subKey].glyph = glyphDict[subKey];
            } else {
                pState.substats[subKey].glyph = 0;
            }
        } else {
            pState.substats[subKey].glyph = 0;
        }
    });
};

window.applyGlyphs = function () {
    const pieces = Object.keys(window.sandboxState).filter(k => k !== 'activeUtility' && k !== 'pieceLimits');
    pieces.forEach(pId => {
        window.updatePieceGlyphs(pId);
        window.RenderEngine.renderPiece(pId);
    });
    if (typeof window.updateSummary === 'function') window.updateSummary();
};

window.handleAscensionModeChange = function () {
    const isChecked = document.getElementById('ascensionToggle')?.checked;
    const mode = isChecked ? 'ideal' : 'off';
    
    const pieces = Object.keys(window.sandboxState).filter(k => k !== 'activeUtility' && k !== 'pieceLimits');

    let currentBlueprintKey = window.sandboxState.activeUtility || 'Custom';
    let blueprintDB = window.RollEngine.db.UtilityBlueprints || (window.RollEngine.db.ArtifactSettings && window.RollEngine.db.ArtifactSettings.UtilityBlueprints);
    let activeBlueprint = blueprintDB ? blueprintDB[currentBlueprintKey] : null;

    pieces.forEach(pId => {
        let pState = window.sandboxState[pId];

        if (mode === 'off') {
            pState.ascension.stat = 'none';
        } else if (mode === 'ideal' && activeBlueprint && activeBlueprint.ascension_targets && activeBlueprint.ascension_targets[pId]) {
            let target = activeBlueprint.ascension_targets[pId];
            if (['BAN', 'RIN', 'AMU'].includes(pId) && target.toLowerCase() === 'spd') {
                pState.ascension.stat = 'none';
            } else {
                pState.ascension.stat = target;
            }
        }
    });

    pieces.forEach(pId => window.RenderEngine.renderPiece(pId));
    if (typeof window.updateSummary === 'function') window.updateSummary();
};

window.toggleSection = function (id) {
    document.getElementById(id).classList.toggle('collapsed');
};

window.updateGlobal = function () {
    window.applyGlyphs();
};

// ==========================================
// THE KRAKEN ROLL ENGINE (v2.4.4 - The Real Ascension Fix)
// ==========================================
window.rollDice = function () {
    let currentBlueprintKey = window.sandboxState.activeUtility || 'Custom';

    let blueprintDB = window.RollEngine.db.UtilityBlueprints || (window.RollEngine.db.ArtifactSettings && window.RollEngine.db.ArtifactSettings.UtilityBlueprints);
    let activeBlueprint = blueprintDB ? blueprintDB[currentBlueprintKey] : null;

    let raritySlider = document.getElementById('raritySlider');
    let rarityPctRaw = raritySlider ? parseFloat(raritySlider.value) : 50;
    let rarityPower = rarityPctRaw / 100;

    let realismSlider = document.getElementById('realismSlider');
    let realismPctRaw = realismSlider ? parseFloat(realismSlider.value) : 50;

    let krakenPower = (100 - realismPctRaw) / 100;

    let wPresetBase = 10 + (190 * krakenPower);
    let wPrimaryBase = 10 + (90 * krakenPower);
    let wSecondaryBase = 10 + (30 * krakenPower);
    let wJunkBase = Math.max(1, 10 - (9 * krakenPower));

    let clumpBase = 0.5 + (0.1 * krakenPower) + (3.0 * Math.pow(krakenPower, 12));

    window.sandboxState.pieceLimits = window.sandboxState.pieceLimits || {};
    let pieces = Object.keys(window.sandboxState).filter(k => k !== 'activeUtility' && k !== 'pieceLimits');

    pieces.forEach(pId => {
        window.sandboxState[pId].rank = (Math.random() * 100 <= rarityPctRaw) ? 6 : 5;
        window.sandboxState.pieceLimits[pId] = 7;
    });

    let totalBumps = Math.round(18 * rarityPower);
    for (let i = 0; i < totalBumps; i++) {
        let minLimit = Math.min(...pieces.map(p => window.sandboxState.pieceLimits[p]));
        let eligible = pieces.filter(p => window.sandboxState.pieceLimits[p] === minLimit && minLimit < 9);

        if (eligible.length > 0) {
            let chosenId = eligible[Math.floor(Math.random() * eligible.length)];
            window.sandboxState.pieceLimits[chosenId]++;
        }
    }

    let primaryGoals = activeBlueprint?.stat_goals?.g || [];
    let secondaryGoals = activeBlueprint?.stat_goals?.s || [];
    let presetGoals = activeBlueprint?.preset_goals || {};
    let presetKeys = Object.keys(presetGoals);

    // --- ARMORED AI BLACKSMITH CHECK ---
    let desiredPris = {
        'HP': 1, 'ATK': 1, 'DEF': 1, 'SPD': 1, 'CRate': 1, 'CDMG': 1, 'ACC': 1, 'RES': 1
    };

    let isAiActive = false;
    let scanData = window.SizzleState?.currentScan;

    try {
        if (currentBlueprintKey === 'Custom' && scanData && scanData.Stats) {
            let base = {
                'hp': scanData.Stats.HP?.Basic || 15000,
                'atk': scanData.Stats.ATK?.Basic || 1000,
                'def': scanData.Stats.DEF?.Basic || 1000,
                'spd': scanData.Stats.SPD?.Basic || 100,
                'cr': 15, 'cd': 50, 'acc': 0, 'res': 30
            };

            if (presetGoals['hp']) desiredPris['HP'] += Math.max(0, (presetGoals['hp'] - base['hp']) / base['hp']) * 20;
            if (presetGoals['atk']) desiredPris['ATK'] += Math.max(0, (presetGoals['atk'] - base['atk']) / base['atk']) * 20;
            if (presetGoals['def']) desiredPris['DEF'] += Math.max(0, (presetGoals['def'] - base['def']) / base['def']) * 20;
            if (presetGoals['spd']) desiredPris['SPD'] += Math.max(0, (presetGoals['spd'] - base['spd']) / base['spd']) * 100;
            if (presetGoals['cr']) desiredPris['CRate'] += Math.max(0, (presetGoals['cr'] - base['cr']) / 100) * 80;
            if (presetGoals['cd']) desiredPris['CDMG'] += Math.max(0, (presetGoals['cd'] - base['cd']) / 100) * 50;
            if (presetGoals['acc']) desiredPris['ACC'] += Math.max(0, (presetGoals['acc'] - base['acc']) / 100) * 40;
            if (presetGoals['res']) desiredPris['RES'] += Math.max(0, (presetGoals['res'] - base['res']) / 100) * 40;

            isAiActive = true;
        }
    } catch (err) {
        isAiActive = false;
    }

    pieces.forEach(pId => {
        let pState = window.sandboxState[pId];
        let forcedPrimary = null;

        if (currentBlueprintKey !== 'Custom' && activeBlueprint && activeBlueprint.primary_targets && activeBlueprint.primary_targets[pId]) {
            let targets = activeBlueprint.primary_targets[pId];
            forcedPrimary = targets[Math.floor(Math.random() * targets.length)];
        }

        if (forcedPrimary) {
            pState.primaryStat = forcedPrimary;
        } else {
            let availablePris = window.RollEngine.db.ArtifactSettings.SlotConfig.find(s => s.id === pId).po;

            if (isAiActive) {
                try {
                    let weightedPool = [];
                    availablePris.forEach(statOption => {
                        let baseWeight = 10;
                        if (['HP', 'ATK', 'DEF'].includes(statOption) && ['GAU', 'CHE', 'BOO'].includes(pId)) baseWeight = 20;

                        let aiWeight = desiredPris[statOption] || 1;
                        let finalWeight = baseWeight + (aiWeight * Math.pow(krakenPower, 2) * 100);
                        weightedPool.push({ stat: statOption, weight: finalWeight });
                    });

                    let totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);
                    let rnd = Math.random() * totalWeight;
                    let picked = availablePris[0];

                    for (let j = 0; j < weightedPool.length; j++) {
                        if (rnd < weightedPool[j].weight) {
                            picked = weightedPool[j].stat;
                            break;
                        }
                        rnd -= weightedPool[j].weight;
                    }
                    pState.primaryStat = picked;
                } catch (err) {
                    pState.primaryStat = availablePris[Math.floor(Math.random() * availablePris.length)];
                }
            } else {
                pState.primaryStat = availablePris[Math.floor(Math.random() * availablePris.length)];
            }
        }

        let dbPools = window.RollEngine.db.ArtifactSettings?.AscensionPools || window.RollEngine.db?.AscensionPools || {};
        let validAscensions = dbPools[pId] || [];

        // STRICT PURGE: Accessories CANNOT roll Speed Ascension
        if (['BAN', 'RIN', 'AMU'].includes(pId)) {
            validAscensions = validAscensions.filter(opt => opt.toLowerCase() !== 'spd');
        }

        if (isAiActive) {
            try {
                if (validAscensions.length > 0) {
                    let ascWeightedPool = [];
                    validAscensions.forEach(statOption => {
                        let aiWeight = desiredPris[statOption] || 1;
                        let finalWeight = 10 + (aiWeight * Math.pow(krakenPower, 2) * 50);
                        ascWeightedPool.push({ stat: statOption, weight: finalWeight });
                    });

                    let totalWeight = ascWeightedPool.reduce((sum, item) => sum + item.weight, 0);
                    let rnd = Math.random() * totalWeight;
                    let picked = validAscensions[0];

                    for (let j = 0; j < ascWeightedPool.length; j++) {
                        if (rnd < ascWeightedPool[j].weight) {
                            picked = ascWeightedPool[j].stat;
                            break;
                        }
                        rnd -= ascWeightedPool[j].weight;
                    }
                    pState.ascension.stat = picked;
                } else {
                    pState.ascension.stat = 'none';
                }
            } catch (err) {
                pState.ascension.stat = validAscensions.length > 0 ? validAscensions[Math.floor(Math.random() * validAscensions.length)] : 'none';
            }
        } else {
            if (currentBlueprintKey !== 'Custom' && activeBlueprint && activeBlueprint.ascension_targets && activeBlueprint.ascension_targets[pId]) {
                pState.ascension.stat = activeBlueprint.ascension_targets[pId];
            } else if (validAscensions.length > 0) {
                pState.ascension.stat = validAscensions[Math.floor(Math.random() * validAscensions.length)];
            } else {
                pState.ascension.stat = 'none';
            }
        }

        let ascToggle = document.getElementById('ascensionToggle');
        if (ascToggle && !ascToggle.checked) {
            ascToggle.checked = true;
        }

        Object.keys(pState.substats).forEach(sub => {
            pState.substats[sub].hits = 0;
            pState.substats[sub].rolls = [];
            pState.substats[sub].glyph = 0;
        });
    });

    let totalHitsNeeded = 0;
    let totalBaseHits = 0;
    pieces.forEach(pId => {
        totalHitsNeeded += window.sandboxState.pieceLimits[pId];
        totalBaseHits += 4;
    });

    let halftimeThreshold = totalHitsNeeded - totalBaseHits;
    let halftimeTriggered = false;
    let halftimeModifiers = {};

    let allPossibleSubs = [...new Set(Object.values(window.RollEngine.db.ArtifactSettings.SubstatPools).flat())];
    let draftFailsafe = 0;
    let penaltyWeights = {};

    let baseMap = {
        'hp': scanData?.Stats?.HP?.Basic || 15000,
        'atk': scanData?.Stats?.ATK?.Basic || 1000,
        'def': scanData?.Stats?.DEF?.Basic || 1000,
        'spd': scanData?.Stats?.SPD?.Basic || 100,
        'cr': scanData?.Stats?.CRate?.Basic || 15,
        'cd': scanData?.Stats?.CDMG?.Basic || 50,
        'acc': scanData?.Stats?.ACC?.Basic || 0,
        'res': scanData?.Stats?.RES?.Basic || 30
    };

    while (totalHitsNeeded > 0 && draftFailsafe < 2000) {
        draftFailsafe++;

        if (totalHitsNeeded <= halftimeThreshold && !halftimeTriggered) {
            halftimeTriggered = true;
            let liveTotals = window.RollEngine.evaluateStats();
            let utility = window.sandboxState.activeUtility || 'Custom';

            if (scanData && scanData.Identity && scanData.Identity.ScalingStats && utility !== 'Custom') {
                let rawScaling = scanData.Identity.ScalingStats;
                let scalingArray = Array.isArray(rawScaling) ? rawScaling : [rawScaling];
                let flatScaling = [...new Set(scalingArray.map(s => String(s).toLowerCase()).flatMap(s => s.split(/&|and|,|\//i).map(i => i.trim())))];

                if (utility.includes('Nuker')) {
                    const pureStats = ["atk", "def", "hp"];
                    if (flatScaling.length === 1 && pureStats.includes(flatScaling[0])) {
                        const primaryStat = flatScaling[0].toUpperCase();
                        const jKey = primaryStat.toLowerCase();
                        if (scanData.Stats[primaryStat] && scanData.Stats[primaryStat].Basic > 0) {
                            const baseStat = scanData.Stats[primaryStat].Basic;
                            const totalStat = (liveTotals[jKey] || 0) + baseStat;
                            const critDamage = (liveTotals['cd'] || 0) + (scanData.Stats['CDMG']?.Basic || 50);

                            const statMultiplier = totalStat / baseStat;
                            const cdMultiplier = 1 + (critDamage / 100);

                            if (statMultiplier > cdMultiplier + 0.15) {
                                halftimeModifiers['cd'] = 2.5;
                                halftimeModifiers[jKey] = 0.25;
                                halftimeModifiers[jKey + 'P'] = 0.25;
                            } else if (cdMultiplier > statMultiplier + 0.15) {
                                halftimeModifiers[jKey] = 2.5;
                                halftimeModifiers[jKey + 'P'] = 2.5;
                                halftimeModifiers['cd'] = 0.25;
                            }
                        }
                    }
                }
                else if (utility === 'Tank' || utility === 'Support') {
                    const totalHP = (liveTotals['hp'] || 0) + baseMap['hp'];
                    const totalDEF = (liveTotals['def'] || 0) + baseMap['def'];
                    const hpDefRatio = totalHP / totalDEF;

                    if (hpDefRatio > 14) {
                        halftimeModifiers['defP'] = 2.5;
                        halftimeModifiers['def'] = 1.5;
                        halftimeModifiers['hpP'] = 0.25;
                    }
                    else if (hpDefRatio < 8) {
                        halftimeModifiers['hpP'] = 2.5;
                        halftimeModifiers['hp'] = 1.5;
                        halftimeModifiers['defP'] = 0.25;
                    }
                }
            }
        }

        let liveTotals = window.RollEngine.evaluateStats();

        let trueTotals = {};
        let activeAwkDelta = window.SizzleState?.mirage?.awakeningBonuses || {};
        let activeEmpDelta = window.SizzleState?.mirage?.empowermentBonuses || {};

        ['hp', 'atk', 'def'].forEach(k => {
            let upper = k.toUpperCase();
            let baseWithEmp = baseMap[k] + Math.round(baseMap[k] * ((activeEmpDelta[upper] || 0) / 100));
            let gearPctVal = Math.round(baseWithEmp * ((liveTotals[k + 'P'] || 0) / 100));
            trueTotals[k] = baseWithEmp + (activeAwkDelta[upper] || 0) + (liveTotals[k] || 0) + gearPctVal;
        });

        ['spd', 'acc', 'res'].forEach(k => {
            let upper = k.toUpperCase();
            trueTotals[k] = baseMap[k] + (activeAwkDelta[upper] || 0) + (activeEmpDelta[upper] || 0) + (liveTotals[k] || 0);
        });

        ['cr', 'cd'].forEach(k => {
            let mirageKey = k === 'cr' ? 'CRate' : 'CDMG';
            trueTotals[k] = baseMap[k] + (activeAwkDelta[mirageKey] || 0) + (activeEmpDelta[mirageKey] || 0) + (liveTotals[k] || 0);
        });

        let deckWeights = {};

        allPossibleSubs.forEach(stat => {
            let weight = wJunkBase;
            let isCapped = false;
            let isDesperate = false;

            let coreKey = stat.replace('P', '');

            if (presetKeys.includes(coreKey)) {
                let goal = presetGoals[coreKey];
                let currentTotal = trueTotals[coreKey] || 0;

                if (currentTotal >= goal * 0.98) isCapped = true;
                else if (currentTotal < goal * 0.85) isDesperate = true;

                if (isCapped) {
                    weight = 0.01;
                } else if (isDesperate) {
                    if (stat.endsWith('P')) weight = wPresetBase * 5;
                    else if (['hp', 'atk', 'def'].includes(stat)) weight = wPresetBase * 1.5;
                    else weight = wPresetBase * 4;
                } else {
                    if (stat.endsWith('P')) weight = wPresetBase * 2.5;
                    else weight = wPresetBase;
                }
            } else if (primaryGoals.includes(stat) || primaryGoals.includes(stat + 'P')) {
                weight = wPrimaryBase;
            } else if (secondaryGoals.includes(stat) || secondaryGoals.includes(stat + 'P')) {
                weight = wSecondaryBase;
            }

            let halftimeMod = halftimeModifiers[stat] || 1.0;
            deckWeights[stat] = (weight * halftimeMod) / (penaltyWeights[stat] || 1);
        });

        let deckKeys = Object.keys(deckWeights);
        let deckVals = Object.values(deckWeights);
        let totalDeckWeight = deckVals.reduce((a, b) => a + b, 0);
        let rndDeck = Math.random() * totalDeckWeight;

        let drawnStat = deckKeys[0];
        for (let j = 0; j < deckKeys.length; j++) {
            if (rndDeck < deckVals[j]) { drawnStat = deckKeys[j]; break; }
            rndDeck -= deckVals[j];
        }

        let eligiblePieces = [];
        pieces.forEach(pId => {
            let pState = window.sandboxState[pId];
            let limit = window.sandboxState.pieceLimits[pId];

            let totalHitsOnPiece = Object.keys(pState.substats).reduce((sum, k) => sum + pState.substats[k].hits, 0);

            if (totalHitsOnPiece >= limit) return;
            if (pState.primaryStat === drawnStat) return;
            if (!window.RollEngine.db.ArtifactSettings.SubstatPools[pId].includes(drawnStat)) return;

            let hitsOnStat = pState.substats[drawnStat].hits;
            let maxHitsForStat = limit - 3;
            if (hitsOnStat >= maxHitsForStat) return;

            let uniqueStatsCount = Object.keys(pState.substats).filter(k => pState.substats[k].hits > 0).length;
            if (hitsOnStat === 0 && uniqueStatsCount >= 4) return;

            let hitsRemaining = limit - totalHitsOnPiece;
            let emptySlotsRemaining = 4 - uniqueStatsCount;
            if (hitsRemaining <= emptySlotsRemaining && hitsOnStat > 0) return;

            eligiblePieces.push({ pId, pState, hitsOnStat });
        });

        if (eligiblePieces.length === 0) {
            penaltyWeights[drawnStat] = (penaltyWeights[drawnStat] || 1) * 10;
            continue;
        }

        penaltyWeights = {};

        let pieceWeights = eligiblePieces.map(ep => {
            if (ep.hitsOnStat > 0) return 1.0 + (ep.hitsOnStat * clumpBase);
            return 2.0;
        });

        let totalPieceWeight = pieceWeights.reduce((a, b) => a + b, 0);
        let rndPiece = Math.random() * totalPieceWeight;
        let chosenPieceIndex = 0;
        for (let j = 0; j < pieceWeights.length; j++) {
            if (rndPiece < pieceWeights[j]) { chosenPieceIndex = j; break; }
            rndPiece -= pieceWeights[j];
        }

        let target = eligiblePieces[chosenPieceIndex];

        target.pState.substats[drawnStat].hits++;
        window.RollEngine.generateRollsFor(target.pId, drawnStat, target.pState.substats[drawnStat].hits);

        totalHitsNeeded--;
    }

    pieces.forEach(pId => {
        window.updatePieceGlyphs(pId);
        let card = document.getElementById(`card_${pId}`);
        if (card) {
            card.classList.remove('expanded');
            card.style.borderColor = 'var(--border-lowkey)';
        }
        window.RenderEngine.renderPiece(pId);
    });

    window.RollEngine.evaluateStats();
    if (typeof window.updateSummary === "function") window.updateSummary();

    const targetPanel = document.getElementById('summaryOutput');
    if (targetPanel) {
        targetPanel.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
};

window.resetSubstats = function () {
    const glyphDropdown = document.getElementById('glyphSelect');
    if (glyphDropdown) {
        glyphDropdown.value = 'green5';
        if (typeof window.updateGlobal === 'function') window.updateGlobal();
    }

    const ascToggle = document.getElementById('ascensionToggle');
    if (ascToggle) {
        ascToggle.checked = true;
    }
    
    let pieces = Object.keys(window.sandboxState).filter(k => k !== 'activeUtility' && k !== 'pieceLimits');
    pieces.forEach(pId => {
        let pState = window.sandboxState[pId];
        pState.primaryStat = 'none';
        pState.ascension.stat = 'none';

        Object.keys(pState.substats).forEach(sub => {
            pState.substats[sub].hits = 0;
            pState.substats[sub].rolls = [];
            pState.substats[sub].glyph = 0;
        });
    });

    if (glyphDropdown && glyphDropdown.value === 'custom') {
        glyphDropdown.value = glyphDropdown.options.length > 1 ? glyphDropdown.options[1].value : "0";
    }

    window.RollEngine.evaluateStats();
    pieces.forEach(pId => window.RenderEngine.renderPiece(pId));

    if (typeof window.updateSummary === "function") window.updateSummary();
};

document.addEventListener('DOMContentLoaded', () => {
    window.RollEngine.boot();

    document.addEventListener('click', function (event) {
        const expandedCards = document.querySelectorAll('.gear-card.expanded');
        expandedCards.forEach(card => {
            if (!card.contains(event.target)) {
                card.classList.remove('expanded');
                card.style.borderColor = 'var(--border-lowkey)';
                let pieceId = card.id.replace('card_', '');
                if (window.RenderEngine) window.RenderEngine.renderPiece(pieceId);
            }
        });

        const openBars = document.querySelectorAll('.action-bar.open');
        openBars.forEach(bar => {
            let drawer = bar.nextElementSibling;
            if (!bar.contains(event.target) && (!drawer || !drawer.contains(event.target))) {
                bar.classList.remove('open');
            }
        });
    });
});