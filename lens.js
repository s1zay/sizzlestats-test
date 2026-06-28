// ==========================================
// STAT-LENS UI: lens.js (V3.12 - The UI Visibility Override)
// ==========================================

// 1. Establish the Global Vault
window.SizzleState = window.SizzleState || { currentScan: null };

// ==========================================
// LENS STATE MACHINE
// ==========================================
window.setLensState = function(state) {
    const idle = document.getElementById('lens-state-idle');
    const scanning = document.getElementById('lens-state-scanning');
    const results = document.getElementById('lens-state-results');

    if (idle) idle.style.display = state === 'idle' ? 'flex' : 'none';
    if (scanning) scanning.style.display = state === 'scanning' ? 'flex' : 'none';
    if (results) results.style.display = state === 'results' ? 'block' : 'none';
};

let championDatabase = [];

fetch(`champs.json?v=${new Date().getTime()}`, { cache: "no-store" })
    .then(response => response.json())
    .then(data => {
        championDatabase = data;
    })
    .catch(err => { });

function getChampionDetails(scannedName) {
    if (!scannedName || championDatabase.length === 0) return null;
    const cleanOcr = scannedName.toLowerCase().replace(/[^a-z]/g, '');
    if (cleanOcr.length < 3) return null;

    let exactMatch = championDatabase.find(champ => {
        const dbName = (champ.name || champ.Name || "").toLowerCase().replace(/[^a-z]/g, '');
        return dbName === cleanOcr;
    });

    if (exactMatch) return exactMatch;

    return championDatabase.find(champ => {
        const dbName = (champ.name || champ.Name || "").toLowerCase().replace(/[^a-z]/g, '');
        return dbName.includes(cleanOcr) || cleanOcr.includes(dbName);
    });
}

function generateChampionStars(rank, ascension, awakening) {
    if (!rank || rank < 1) return '';

    const starSvgBase = `
        <svg class="champ-star {COLOR_CLASS}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
    `;

    let htmlOutput = '<div class="star-container">';

    for (let i = 1; i <= rank; i++) {
        let colorClass = 'star-yellow';

        if (i <= awakening) {
            colorClass = 'star-red';
        } else if (i <= ascension) {
            colorClass = 'star-purple';
        }

        htmlOutput += starSvgBase.replace('{COLOR_CLASS}', colorClass);
    }

    htmlOutput += '</div>';
    return htmlOutput;
}

// ==========================================
// THE UI PAINTER (Decoupled for Re-entrancy)
// ==========================================
function paintLensUI(scanData) {
    // Lock Identity Card into Results State
    if (window.setLensState) window.setLensState('results');

    const rowKeys = ["HP", "ATK", "DEF", "SPD", "CRate", "CDMG", "RES", "ACC", "IDEF"];

    const baseHp = scanData.Stats["HP"]?.Basic || 0;
    const empHp = scanData.Stats["HP"]?.Empowerment || 0;
    let currentEmpowerment = 0;
    let displayName = scanData.Identity.Champion;

    if (baseHp > 0 && empHp > 0) {
        currentEmpowerment = Math.round(empHp / (baseHp * 0.10));
        if (currentEmpowerment > 0 && currentEmpowerment <= 4) {
            displayName += ` <span class="empowerment-tag">+${currentEmpowerment}</span>`;
        }
    }

    // --- 1. CHAMPION IDENTITY ---
    const nameEl = document.getElementById('champ-name');
    const lvlEl = document.getElementById('champ-lvl');
    const starsEl = document.getElementById('champ-stars');
    const affEl = document.getElementById('champ-affinity');
    const facEl = document.getElementById('champ-faction');
    const roleEl = document.getElementById('champ-role');
    const cardEl = document.getElementById('champ-identity-card');
    const mythBadgeEl = document.getElementById('lens-mythical-badge');

    if (cardEl && scanData.Identity.Rarity) {
        cardEl.classList.forEach(className => {
            if (className.startsWith('glow-')) cardEl.classList.remove(className);
        });
        const rarityTier = scanData.Identity.Rarity.toLowerCase();
        cardEl.classList.add(`glow-${rarityTier}`);
    }

    if (nameEl) nameEl.innerHTML = displayName;
    if (lvlEl && scanData.Identity.Level) lvlEl.innerText = `Lvl ${scanData.Identity.Level}`;

    if (starsEl) {
        starsEl.innerHTML = generateChampionStars(
            scanData.Identity.Rank,
            scanData.Identity.AscensionLevel,
            scanData.Identity.AwakeningLevel
        );
    }

    if (mythBadgeEl) {
        if (scanData.Identity.Rarity && scanData.Identity.Rarity.toLowerCase() === 'mythical') {
            const isAlt = scanData.Identity.Form && scanData.Identity.Form.toLowerCase().includes('alternate');
            mythBadgeEl.innerText = isAlt ? "ALT" : "BASE";
            mythBadgeEl.classList.remove('hidden'); // Override protection
            mythBadgeEl.style.display = "inline-block";
        } else {
            mythBadgeEl.classList.add('hidden'); // Override protection
            mythBadgeEl.style.display = "none";
        }
    }

    if (facEl) facEl.innerText = scanData.Identity.Faction;
    if (roleEl) roleEl.innerText = scanData.Identity.Type;

    if (affEl) {
        const aff = scanData.Identity.Affinity;
        affEl.innerText = aff;
        affEl.className = 'trait-affinity';
        if (aff === "Magic") affEl.classList.add("affinity-magic");
        if (aff === "Force") affEl.classList.add("affinity-force");
        if (aff === "Spirit") affEl.classList.add("affinity-spirit");
        if (aff === "Void") affEl.classList.add("affinity-void");
    }

    // --- 2. 3x3 MATRIX ---
    const getStatTotal = (statName) => {
        if (scanData.Stats[statName] && scanData.Stats[statName]["Total"] !== undefined) {
            return scanData.Stats[statName]["Total"].toLocaleString();
        }
        return "-";
    };

    const hpEl = document.getElementById('val-hp'); if (hpEl) hpEl.innerText = getStatTotal("HP");
    const atkEl = document.getElementById('val-atk'); if (atkEl) atkEl.innerText = getStatTotal("ATK");
    const defEl = document.getElementById('val-def'); if (defEl) defEl.innerText = getStatTotal("DEF");
    const spdEl = document.getElementById('val-spd'); if (spdEl) spdEl.innerText = getStatTotal("SPD");

    const crVal = getStatTotal("CRate");
    const crEl = document.getElementById('val-cr'); if (crEl) crEl.innerText = crVal !== "-" ? crVal + "%" : "-";

    const cdVal = getStatTotal("CDMG");
    const cdEl = document.getElementById('val-cd'); if (cdEl) cdEl.innerText = cdVal !== "-" ? cdVal + "%" : "-";

    const resEl = document.getElementById('val-res'); if (resEl) resEl.innerText = getStatTotal("RES");
    const accEl = document.getElementById('val-acc'); if (accEl) accEl.innerText = getStatTotal("ACC");

    const ignVal = getStatTotal("IDEF");
    const ignEl = document.getElementById('val-ign'); if (ignEl) ignEl.innerText = ignVal !== "-" ? ignVal + "%" : "0%";

    // --- 3. BUILD WARNINGS ---
    const warningsEl = document.getElementById('val-warnings');
    if (warningsEl) {
        let masteriesSum = 0;
        let relicSum = 0;

        rowKeys.forEach(row => {
            if (scanData.Stats[row]) {
                masteriesSum += scanData.Stats[row]["Masteries"] || 0;
                relicSum += scanData.Stats[row]["Relic"] || 0;
            }
        });

        if (masteriesSum === 0 && relicSum === 0) {
            warningsEl.innerText = "No Masteries and Relic detected.";
            warningsEl.classList.remove('hidden'); // Override protection
            warningsEl.style.display = "block";
        } else if (masteriesSum === 0) {
            warningsEl.innerText = "No Masteries detected.";
            warningsEl.classList.remove('hidden'); // Override protection
            warningsEl.style.display = "block";
        } else if (relicSum === 0) {
            warningsEl.innerText = "No Relic detected.";
            warningsEl.classList.remove('hidden'); // Override protection
            warningsEl.style.display = "block";
        } else {
            warningsEl.innerText = "";
            warningsEl.classList.add('hidden'); // Override protection
            warningsEl.style.display = "none";
        }
    }

    // --- 4. REACTIVE ACCORDIONS ---
    const renderAccordions = (renderData) => {
        const coachName = renderData.Identity.Nickname || "champion";

        if (typeof window.calculateChampionStyle === "function") {
            renderData.Identity.StyleTag = window.calculateChampionStyle(renderData);
        } else {
            renderData.Identity.StyleTag = [];
        }

        if (typeof window.calculateDamageEfficiency === "function") {
            renderData.Identity.EfficiencyData = window.calculateDamageEfficiency(renderData);
        } else {
            renderData.Identity.EfficiencyData = { isValid: false };
        }

        const styleNameEl = document.getElementById('val-style-name');
        const styleMatchEl = document.getElementById('val-style-match');
        const styleDetailsEl = document.getElementById('val-style-details');

        if (Array.isArray(renderData.Identity.StyleTag) && renderData.Identity.StyleTag.length > 0) {
            const sortedStyles = [...renderData.Identity.StyleTag].sort((a, b) => b.match - a.match);
            const topResult = sortedStyles[0];

            if (styleNameEl) styleNameEl.innerText = topResult.style;
            if (styleMatchEl) {
                styleMatchEl.innerText = topResult.veto ? "Incompatible" : `${topResult.match}% Match`;
                styleMatchEl.className = topResult.veto ? "text-muted" : "affinity-magic";
            }

            if (styleDetailsEl) {
                const runnersUp = sortedStyles.slice(1).filter(s => !s.veto && s.match && s.match > 0);
                if (runnersUp.length > 0) {
                    let htmlString = `<div class="alt-builds-header">Alternate Builds</div>`;
                    runnersUp.forEach(style => {
                        htmlString += `
                            <div class="alt-build-row">
                                <span class="alt-build-name">${style.style}</span>
                                <span class="alt-build-match">${style.match}%</span>
                            </div>
                        `;
                    });
                    styleDetailsEl.innerHTML = htmlString;
                } else {
                    styleDetailsEl.innerHTML = `<span class="alt-build-empty">No viable alternate styles detected.</span>`;
                }
            }
        } else {
            if (styleNameEl) styleNameEl.innerText = "Style Appraisal";
            if (styleMatchEl) {
                styleMatchEl.innerText = "--";
                styleMatchEl.className = "text-muted";
            }
            if (styleDetailsEl) styleDetailsEl.innerHTML = `<span class="alt-build-empty">No styles calculated.</span>`;
        }

        const effAccordionTitle = document.getElementById('eff-accordion-title');
        const effData = renderData.Identity.EfficiencyData;

        if (effAccordionTitle) {
            if (effData && (effData.isValid || effData.isMulti)) {
                effAccordionTitle.style.color = "#ef4444";

                const waitEl = document.getElementById('eff-waiting');
                const coachUiEl = document.getElementById('eff-coach-ui');
                if (waitEl) waitEl.style.display = 'none';
                if (coachUiEl) {
                    coachUiEl.classList.remove('hidden'); // Override protection
                    coachUiEl.style.display = 'block';
                }

                const multiWarning = document.getElementById('eff-multi-warning');
                const standardUi = document.getElementById('eff-standard-ui');

                const populateStandardEffUi = (data) => {
                    const inlineScoreEl = document.getElementById('eff-inline-score');
                    if (inlineScoreEl) inlineScoreEl.innerText = `${data.score}%`;

                    let dmgPct = Math.max(0, Math.min(100, data.score));
                    const marker = document.getElementById('dmg-marker');
                    if (marker) marker.style.left = `${dmgPct}%`;

                    const isZeroed = (parseFloat(data.ledger.statGain) === 0 && parseFloat(data.ledger.cdGain) === 0 && parseFloat(data.ledger.crGain) === 0);

                    let bestStat = data.primaryStat;
                    let maxGain = parseFloat(data.ledger.statGain);

                    if (!isZeroed) {
                        if (parseFloat(data.ledger.cdGain) > maxGain) {
                            bestStat = "C.DMG";
                            maxGain = parseFloat(data.ledger.cdGain);
                        }
                        if (parseFloat(data.ledger.crGain) > maxGain) {
                            bestStat = "C.RATE";
                            maxGain = parseFloat(data.ledger.crGain);
                        }
                    }

                    let displayPrimaryStat = data.primaryStat;
                    if (['ATK', 'DEF', 'HP'].includes(displayPrimaryStat.toUpperCase())) {
                        displayPrimaryStat += '%';
                    }

                    let displayBestStat = bestStat;
                    if (['ATK', 'DEF', 'HP'].includes(displayBestStat.toUpperCase())) {
                        displayBestStat += '%';
                    }

                    const effCoachDesc = document.getElementById('eff-coach-desc');
                    if (effCoachDesc) {
                        effCoachDesc.innerHTML = `Damage efficiency evaluates the balance between ${coachName}’s <strong>${data.primaryStat.toUpperCase()}</strong>, <strong>C.DMG</strong>, and <strong>C.RATE</strong>. To improve your ${coachName}’s damage, <strong id="eff-coach-target" class="stat-highlight-white">${displayBestStat}</strong> is the most efficient investment.`;
                    }

                    const ledgerStatName = document.getElementById('dmg-ledger-stat-name');
                    if (ledgerStatName) ledgerStatName.innerText = displayPrimaryStat;

                    const gainStatEl = document.getElementById('sheet-gain-stat');
                    const gainCdEl = document.getElementById('sheet-gain-cd');
                    const gainCrEl = document.getElementById('sheet-gain-cr');
                    const bestStatEl = document.getElementById('sheet-dmg-best-stat');

                    const statRow = gainStatEl ? gainStatEl.parentElement : null;
                    const cdRow = gainCdEl ? gainCdEl.parentElement : null;
                    const crRow = gainCrEl ? gainCrEl.parentElement : null;
                    const bestStatContainer = bestStatEl ? bestStatEl.parentElement : null;
                    const rollDisclaimerEl = document.getElementById('dmg-roll-disclaimer');

                    if (statRow) statRow.style.display = '';
                    if (cdRow) cdRow.style.display = '';
                    if (crRow) crRow.style.display = '';
                    if (bestStatContainer) bestStatContainer.style.display = '';

                    let zeroMsgEl = document.getElementById('dmg-zero-message');
                    if (!zeroMsgEl && statRow) {
                        zeroMsgEl = document.createElement('div');
                        zeroMsgEl.id = 'dmg-zero-message';
                        zeroMsgEl.className = 'dmg-zero-msg-container';
                        zeroMsgEl.innerHTML = `
                            <div class="dmg-zero-title">Excellent Balance</div>
                            <div class="dmg-zero-desc">Additional rolls will have little impact on efficiency</div>
                        `;
                        statRow.parentElement.insertBefore(zeroMsgEl, statRow);
                    }

                    let strategyMsgEl = document.getElementById('dmg-strategy-message');
                    if (!strategyMsgEl && statRow) {
                        strategyMsgEl = document.createElement('div');
                        strategyMsgEl.id = 'dmg-strategy-message';
                        strategyMsgEl.className = 'dmg-strategy-container';
                        statRow.parentElement.insertBefore(strategyMsgEl, statRow);
                    }

                    const outlierUi = document.getElementById('eff-outlier-ui');
                    let emhpBanner = document.getElementById('eff-emhp-banner');

                    if (data.outlier) {
                        if (data.outlier.stat === "EMHP") {
                            if (outlierUi) {
                                outlierUi.classList.add('hidden'); // Override protection
                                outlierUi.style.display = 'none';
                            }

                            if (!emhpBanner) {
                                emhpBanner = document.createElement('div');
                                emhpBanner.id = 'eff-emhp-banner';
                                const primaryBar = document.getElementById('eff-primary-bar');
                                if (primaryBar) primaryBar.parentNode.insertBefore(emhpBanner, primaryBar);
                            }
                            emhpBanner.innerHTML = `
                                <div class="emhp-banner-text">${coachName}'s kit uses Enemy Max HP as a damage multiplier.</div>
                                <div class="emhp-banner-subtext">Efficiency is only part of the equation. Check the strategy below.</div>
                                <div class="outlier-divider"></div>
                            `;
                            emhpBanner.style.display = 'block';

                        } else {
                            if (emhpBanner) emhpBanner.style.display = 'none';
                            if (outlierUi) {
                                outlierUi.classList.remove('hidden'); // Override protection
                                outlierUi.style.display = 'block';
                                const scoreTextEl = outlierUi.querySelector('.coach-score-text');
                                if (scoreTextEl) {
                                    scoreTextEl.innerHTML = `Utility Scaling: <strong id="outlier-inline-score" class="stat-highlight purple-text">${data.outlier.total.toLocaleString()}</strong> <span id="outlier-stat-label">${data.outlier.stat}</span>`;
                                }
                                document.getElementById('outlier-max-label').innerText = data.outlier.max >= 1000000 ? (data.outlier.max / 1000000).toFixed(1) + 'M' : data.outlier.max;
                                document.getElementById('outlier-marker').style.left = `${data.outlier.pct}%`;
                            }
                        }

                        if (statRow) statRow.style.display = 'none';
                        if (cdRow) cdRow.style.display = 'none';
                        if (crRow) crRow.style.display = 'none';
                        if (bestStatContainer) bestStatContainer.style.display = 'none';
                        if (zeroMsgEl) zeroMsgEl.style.display = 'none';
                        if (rollDisclaimerEl) rollDisclaimerEl.style.display = 'none';

                        if (strategyMsgEl) {
                            let strategyText = "";
                            if (data.outlier.stat === "SPD") strategyText = `This champion double-dips into Speed. Pushing SPD not only increases your raw damage output but gives you more opportunities to inflict damage.`;
                            else if (data.outlier.stat === "ACC" || data.outlier.stat === "RES") strategyText = `This champion converts utility into damage. Hitting your ${data.outlier.stat} requirements is your absolute first priority.`;
                            else if (data.outlier.stat === "EMHP") strategyText = `Enemy MAX HP skills deal most of their damage through C.RATE and C.DMG. Base stats still contribute, but provide smaller damage gains.`;
                            strategyMsgEl.innerHTML = `<strong class="outlier-strategy-title">Strategy</strong>${strategyText}`;
                            strategyMsgEl.style.display = 'block';
                        }
                    } else {
                        if (emhpBanner) emhpBanner.style.display = 'none';
                        if (outlierUi) {
                            outlierUi.classList.add('hidden'); // Override protection
                            outlierUi.style.display = 'none';
                        }
                        if (strategyMsgEl) strategyMsgEl.style.display = 'none';

                        if (isZeroed) {
                            if (statRow) statRow.style.display = 'none';
                            if (cdRow) cdRow.style.display = 'none';
                            if (crRow) crRow.style.display = 'none';
                            if (bestStatContainer) bestStatContainer.style.display = 'none';
                            if (zeroMsgEl) zeroMsgEl.style.display = 'block';
                            if (rollDisclaimerEl) rollDisclaimerEl.style.display = 'none';
                        } else {
                            if (zeroMsgEl) zeroMsgEl.style.display = 'none';
                            if (rollDisclaimerEl) rollDisclaimerEl.style.display = 'block';
                            if (gainStatEl) { gainStatEl.innerText = `≈ +${data.ledger.statGain}% Balance`; gainStatEl.style.color = bestStat === data.primaryStat ? "#22c55e" : "#f87171"; }
                            if (gainCdEl) { gainCdEl.innerText = `≈ +${data.ledger.cdGain}% Balance`; gainCdEl.style.color = bestStat === "C.DMG" ? "#22c55e" : "#f87171"; }
                            if (gainCrEl) { gainCrEl.innerText = `≈ +${data.ledger.crGain}% Balance`; gainCrEl.style.color = bestStat === "C.RATE" ? "#22c55e" : "#f87171"; }
                            if (bestStatEl) bestStatEl.innerText = displayBestStat;
                        }
                    }
                };

                if (effData.isMulti) {
                    if (multiWarning) {
                        multiWarning.classList.remove('hidden'); // Override protection
                        multiWarning.style.display = 'block';
                    }
                    if (standardUi) standardUi.style.display = 'none';
                    const pillsContainer = document.getElementById('eff-multi-pills');
                    if (pillsContainer) {
                        pillsContainer.innerHTML = '';
                        let pureStats = [];
                        const rawScaling = renderData.Identity.ScalingStats || [];
                        rawScaling.forEach(s => {
                            const splitItems = s.toLowerCase().split(/&|and|,|\//i).map(item => item.trim());
                            splitItems.forEach(item => {
                                if (['atk', 'def', 'hp'].includes(item) && !pureStats.includes(item)) pureStats.push(item);
                            });
                        });
                        pureStats.forEach(stat => {
                            const pill = document.createElement('button');
                            pill.className = 'build-pill';
                            let statLabel = stat.toUpperCase();
                            if (['ATK', 'DEF', 'HP'].includes(statLabel)) statLabel += '%';
                            pill.innerText = `${statLabel} Build`;
                            pill.onclick = () => {
                                document.querySelectorAll('.build-pill').forEach(p => p.classList.remove('active-pill'));
                                pill.classList.add('active-pill');
                                const targetedEffData = window.calculateDamageEfficiency(renderData, stat.toUpperCase());
                                if (targetedEffData && targetedEffData.isValid) {
                                    populateStandardEffUi(targetedEffData);
                                    if (standardUi) standardUi.style.display = 'block';
                                }
                            };
                            pillsContainer.appendChild(pill);
                        });
                    }
                } else {
                    if (multiWarning) {
                        multiWarning.classList.add('hidden'); // Override protection
                        multiWarning.style.display = 'none';
                    }
                    if (standardUi) standardUi.style.display = 'block';
                    populateStandardEffUi(effData);
                }
            } else {
                effAccordionTitle.style.color = "var(--text-primary)";
                const waitEl = document.getElementById('eff-waiting');
                if (waitEl) waitEl.innerText = effData?.message || "Waiting for scan data...";
            }
        }

        // ==========================================
        // eHP / SURVIVABILITY CALCULATOR
        // ==========================================
        const ehpAccordionTitle = document.getElementById('ehp-accordion-title');
        if (ehpAccordionTitle) {
            const totalHP = renderData.Stats["HP"]?.Total || 0;
            const totalDEF = renderData.Stats["DEF"]?.Total || 0;
            const baseHP = renderData.Stats["HP"]?.Basic || 15000;
            const baseDEF = renderData.Stats["DEF"]?.Basic || 1000;

            if (totalHP > 0 && totalDEF > 0) {
                const calcEhpLocal = (h, d) => Math.round(h / (1 - (0.85 * (1 - Math.exp(-d / 1500)))));
                const currentEhp = calcEhpLocal(totalHP, totalDEF);
                ehpAccordionTitle.style.color = "#22c55e";

                const waitEl = document.getElementById('ehp-waiting');
                const coachUiEl = document.getElementById('ehp-coach-ui');
                if (waitEl) waitEl.style.display = 'none';
                if (coachUiEl) {
                    coachUiEl.classList.remove('hidden'); // Override protection
                    coachUiEl.style.display = 'block';
                }

                const ehpScoreTextEl = document.getElementById('ehp-score-text');
                if (ehpScoreTextEl) {
                    ehpScoreTextEl.innerHTML = `Your ${coachName} has <strong id="ehp-inline-score" class="stat-highlight kraken-text">${currentEhp.toLocaleString()}</strong> Effective Hit Points (eHP)`;
                }

                const maxKrakenEhp = 1200000;
                let krakenPct = (currentEhp / maxKrakenEhp) * 100;
                krakenPct = Math.max(0, Math.min(100, krakenPct));
                const marker = document.getElementById('kraken-marker');
                if (marker) marker.style.left = `${krakenPct}%`;

                let tierName = "Low";
                let tierColor = "#14532d";
                const thresh = window.EHP_THRESHOLDS || { low: 100000, average: 250000, high: 450000, elite: 750000, kraken: 1200000 };

                if (currentEhp >= thresh.kraken) { tierName = "Kraken"; tierColor = "#22c55e"; }
                else if (currentEhp >= thresh.elite) { tierName = "Elite"; tierColor = "#16a34a"; }
                else if (currentEhp >= thresh.high) { tierName = "High"; tierColor = "#15803d"; }
                else if (currentEhp >= thresh.average) { tierName = "Average"; tierColor = "#166534"; }

                const tierLabel = document.getElementById('kraken-tier-label');
                if (tierLabel) { tierLabel.innerText = `${tierName} Tier`; tierLabel.style.color = tierColor; }

                const gainHp = calcEhpLocal(totalHP + (baseHP * 0.06), totalDEF) - currentEhp;
                const gainDef = calcEhpLocal(totalHP, totalDEF + (baseDEF * 0.06)) - currentEhp;
                const bestStat = gainHp > gainDef ? "HP%" : "DEF%";
                const multiplier = (Math.max(gainHp, gainDef) / Math.max(1, Math.min(gainHp, gainDef))).toFixed(1);

                const ehpCoachDesc = document.getElementById('ehp-coach-desc');
                if (ehpCoachDesc) ehpCoachDesc.innerHTML = `eHP combines your <strong>HP</strong> and <strong>DEF</strong>. To improve your ${coachName}’s eHP, <strong id="inline-coach-target" class="stat-highlight-white">${bestStat}</strong> is the most efficient investment.`;

                const gainDefEl = document.getElementById('sheet-gain-def');
                const gainHpEl = document.getElementById('sheet-gain-hp');
                if (gainDefEl) { gainDefEl.innerText = `≈ +${gainDef.toLocaleString()} eHP`; gainDefEl.style.color = bestStat === "DEF%" ? "#22c55e" : "#f87171"; }
                if (gainHpEl) { gainHpEl.innerText = `≈ +${gainHp.toLocaleString()} eHP`; gainHpEl.style.color = bestStat === "HP%" ? "#22c55e" : "#f87171"; }

                const bestStatEl = document.getElementById('sheet-best-stat');
                if (bestStatEl) bestStatEl.innerText = bestStat;

                const multiEl = document.getElementById('sheet-multiplier');
                if (multiEl) multiEl.innerText = multiplier;

            } else {
                ehpAccordionTitle.style.color = "var(--text-primary)";
            }
        }
    };
    renderAccordions(scanData);

    // --- 5. AREA SELECTOR ---
    const areaNameEl = document.getElementById('val-area-name');
    const areaDetailsEl = document.getElementById('val-area-details');

    if (typeof window.matchArea === "function" && window.simDatabase) {
        const matchedArea = window.matchArea(scanData.Context);

        if (areaNameEl) {
            if (matchedArea) {
                areaNameEl.innerHTML = `${matchedArea} <span class="area-selected-highlight">Selected</span>`;
            } else {
                areaNameEl.innerText = "No Area Selected";
            }
        }

        if (areaDetailsEl) {
            const targetArea = matchedArea || "No Selection -Chimera";
            const statsObj = window.simDatabase.AreaStats?.[targetArea];

            if (statsObj) {
                let htmlString = `<div class="area-target-header">Target: ${targetArea}</div>`;

                Object.keys(statsObj).forEach(diff => {
                    const reqs = statsObj[diff];
                    htmlString += `
                        <div class="area-diff-card">
                            <div class="area-diff-title">${diff}</div>
                            <div class="area-req-row">
                                <span class="req-label">Fastest Enemy: <span class="req-val-spd">${reqs.maxENEMY_SPD} SPD</span></span>
                                <span class="req-label-acc">Required ACC: <span class="req-val-acc">${reqs.recACC}</span></span>
                                <span class="req-label-res">Required RES: <span class="req-val-res">${reqs.recRES}</span></span>
                            </div>
                        </div>
                    `;
                });
                areaDetailsEl.innerHTML = htmlString;
            } else {
                areaDetailsEl.innerHTML = `<span class="area-error-text">Error loading area stats.</span>`;
            }
        }
    }
} 

// ==========================================
// CORE SCAN PROCESSOR (Math Audit & Routing)
// ==========================================
function processScanResults(engine) {
    const scanData = engine.masterData;
    const rowKeys = ["HP", "ATK", "DEF", "SPD", "CRate", "CDMG", "RES", "ACC", "IDEF"];
    const colKeys = ["Basic", "Artifacts", "Affinity", "CArena", "Masteries", "FGuardian", "Empowerment", "Blessing", "Relic", "AreaB", "Total"];

    // 1. OCR Sanitization
    rowKeys.forEach(row => {
        if (scanData.Stats[row]) {
            colKeys.forEach(col => {
                if (scanData.Stats[row][col] !== undefined) {
                    const raw = String(scanData.Stats[row][col]).replace(/,/g, '').replace(/%/g, '').trim();
                    scanData.Stats[row][col] = Number(raw) || 0;
                }
            });
        }
    });

    // 2. Identity Verification & Data Enrichment 
    const champName = scanData.Identity.Champion || "Unknown";
    const dbInfo = getChampionDetails(champName);

    if (!dbInfo) {
        throw new Error(`CHAMPION_NOT_FOUND|The engine scanned "${champName}" but could not find a match in the champion database.`);
    }

    // --- MYTHICAL FORM CHECK ---
    const isAlt = scanData.Identity.Form && scanData.Identity.Form.toLowerCase().includes('alternate');
    const activeForm = (isAlt && dbInfo.altForm) ? dbInfo.altForm : (dbInfo.baseForm || dbInfo);

    scanData.Identity.Champion = dbInfo.name || dbInfo.Name || champName;
    scanData.Identity.Nickname = dbInfo.nickname || dbInfo.name || dbInfo.Name || champName;
    scanData.Identity.Rarity = dbInfo.rarity || dbInfo.Rarity || "Unknown";
    scanData.Identity.Faction = dbInfo.faction || dbInfo.Faction || "Unknown";
    scanData.Identity.Affinity = dbInfo.affinity || dbInfo.Affinity || "Unknown";
    scanData.Identity.Type = activeForm.type || activeForm.Type || "Unknown";
    scanData.Identity.ScalingStats = activeForm.damageScaling || activeForm.ScalingStats || ["Unknown"];

    window.SizzleState.currentScan = JSON.parse(JSON.stringify(scanData));

    // 3. Human-in-the-Loop Audit Engine
    const renderAuditUI = () => {
        let auditContainer = document.getElementById('audit-container');
        if (!auditContainer) {
            auditContainer = document.createElement('div');
            auditContainer.id = 'audit-container';
            const identityCard = document.getElementById('champ-identity-card');
            if (identityCard && identityCard.parentNode) {
                identityCard.parentNode.insertBefore(auditContainer, identityCard.nextSibling);
            }
        }

        let errorRows = [];
        rowKeys.forEach(row => {
            let partsSum = 0;
            let totalVal = 0;
            colKeys.forEach(col => {
                const val = (scanData.Stats[row] && scanData.Stats[row][col] !== undefined) ? scanData.Stats[row][col] : 0;
                if (col === "Total") totalVal = val;
                else partsSum += val;
            });
            if (Math.abs(partsSum - totalVal) > 2) {
                errorRows.push(row);
            }
        });

        if (errorRows.length > 0) {
            let auditHtml = `
                <div class="action-bar open audit-warning-bar" style="margin-top: 15px;">
                    <div class="action-content">
                        <span class="action-highlight text-warning">Something isn't adding up.</span>
                    </div>
                </div>
                <div class="action-drawer audit-warning-drawer" style="display: block;">
                    <p class="audit-instructions">Check these rows and make adjustments to fix the misread.</p>
                    <div id="audit-pills" class="audit-pills-container">
            `;

            errorRows.forEach(row => {
                auditHtml += `<button class="audit-pill" data-row="${row}">${row}</button>`;
            });

            auditHtml += `
                    </div>
                    <div id="audit-detail-view" class="audit-detail-view" style="display: none;"></div>
                </div>
            `;

            auditContainer.innerHTML = auditHtml;

            document.querySelectorAll('.audit-pill').forEach(pill => {
                pill.addEventListener('click', (e) => {
                    document.querySelectorAll('.audit-pill').forEach(p => p.classList.remove('active-audit-pill'));
                    e.target.classList.add('active-audit-pill');

                    const targetRow = e.target.getAttribute('data-row');
                    const detailContainer = document.getElementById('audit-detail-view');
                    const imgSrc = engine.exportRowCrop(targetRow);

                    let detailHtml = `<div class="audit-verify-title">Verifying ${targetRow}</div>`;
                    if (imgSrc) {
                        detailHtml += `
                            <div class="audit-crop-wrapper" style="position: relative;">
                                <div id="audit-preview-${targetRow}" class="audit-preview-box" style="background-image: url('${imgSrc}');"></div>
                                <img id="audit-img-${targetRow}" src="${imgSrc}" class="audit-crop-img" onclick="this.classList.toggle('mobile-zoomed')">
                            </div>
                            <span class="audit-zoom-hint">Desktop: Hover to magnify | Mobile: Tap & swipe</span>
                        `;
                    }
                    detailHtml += `<div class="audit-grid">`;
                    colKeys.forEach(col => {
                        const currentVal = scanData.Stats[targetRow][col] || 0;
                        detailHtml += `
                            <div class="audit-col-group">
                                <label class="audit-col-label">${col}</label>
                                <input type="number" id="edit-${targetRow}-${col}" value="${currentVal}" class="audit-col-input">
                            </div>
                        `;
                    });

                    detailHtml += `</div>
                        <button id="apply-${targetRow}" class="btn-clear-sim btn-apply-audit">Apply to ${targetRow}</button>
                    `;

                    detailContainer.innerHTML = detailHtml;
                    detailContainer.style.display = 'block';

                    // --- DESKTOP MAGNIFIER LOGIC ---
                    const cropImg = document.getElementById(`audit-img-${targetRow}`);
                    const previewBox = document.getElementById(`audit-preview-${targetRow}`);

                    if (cropImg && previewBox) {
                        cropImg.addEventListener('mousemove', (e) => {
                            const rect = cropImg.getBoundingClientRect();
                            const x = e.clientX - rect.left; // Find mouse X relative to the image
                            const xPercent = (x / rect.width) * 100; // Convert to percentage

                            // Pan the background image of the preview box to match
                            previewBox.style.backgroundPosition = `${xPercent}% center`;
                        });
                    }

                    // --- SMART SCROLL: Push the expanded UI safely into view ---
                    setTimeout(() => {
                        const yOffset = -20; // 20px breathing room above the card
                        const y = auditContainer.getBoundingClientRect().top + window.scrollY + yOffset;
                        window.scrollTo({ top: y, behavior: 'smooth' });
                    }, 50); // 50ms delay ensures the DOM has painted the new height before scrolling

                    document.getElementById(`apply-${targetRow}`).addEventListener('click', () => {
                        colKeys.forEach(col => {
                            const inputEl = document.getElementById(`edit-${targetRow}-${col}`);
                            if (inputEl) scanData.Stats[targetRow][col] = Number(inputEl.value) || 0;
                        });

                        window.SizzleState.currentScan = JSON.parse(JSON.stringify(scanData));
                        renderAuditUI();
                        paintLensUI(scanData);
                    });
                });
            });

        } else {
            auditContainer.innerHTML = '';
        }
    };

    renderAuditUI();
    paintLensUI(scanData);
}

// ==========================================
// INTAKE LISTENER & DUAL-THREAT ERROR NET
// ==========================================
const imageLoaderEl = document.getElementById('imageLoader');
const dropZone = document.getElementById('drop-zone');

// Adopted Drag and Drop Listeners for the Lens State
if (dropZone && imageLoaderEl) {
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = 'rgba(234, 179, 8, 0.1)'; 
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.backgroundColor = '';

        if (e.dataTransfer.files.length > 0) {
            imageLoaderEl.files = e.dataTransfer.files;
            imageLoaderEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

imageLoaderEl.addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    window.SizzleState = {};

    // --- 1. SHIFT STATE MACHINE ---
    if (window.setLensState) window.setLensState('scanning');

    // --- 2. SILENT BACKGROUND UI WIPE ---
    const nameEl = document.getElementById('champ-name');
    if (nameEl) nameEl.innerText = '-';

    const starsEl = document.getElementById('champ-stars');
    if (starsEl) starsEl.innerHTML = '';

    const badgeEl = document.getElementById('lens-mythical-badge');
    if (badgeEl) { badgeEl.classList.add('hidden'); badgeEl.style.display = 'none'; } 

    ['champ-lvl', 'champ-affinity', 'champ-faction', 'champ-role'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '-';
    });

    const statIds = ['val-hp', 'val-atk', 'val-def', 'val-spd', 'val-cr', 'val-cd', 'val-res', 'val-acc', 'val-ign'];
    statIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '-';
    });

    const styleNameEl = document.getElementById('val-style-name');
    if (styleNameEl) styleNameEl.innerText = "Build Style";
    const styleMatchEl = document.getElementById('val-style-match');
    if (styleMatchEl) { styleMatchEl.innerText = ""; styleMatchEl.className = "text-muted"; }
    const styleDetailsEl = document.getElementById('val-style-details');
    if (styleDetailsEl) styleDetailsEl.innerHTML = `<span style="color: var(--text-muted); text-align: center">-</span>`;

    const effAccordionTitle = document.getElementById('eff-accordion-title');
    if (effAccordionTitle) effAccordionTitle.style.color = "var(--text-primary)";
    const effWaiting = document.getElementById('eff-waiting');
    if (effWaiting) { effWaiting.innerText = "-"; effWaiting.style.display = 'block'; }
    const effCoach = document.getElementById('eff-coach-ui');
    if (effCoach) { effCoach.classList.add('hidden'); effCoach.style.display = 'none'; } 

    const ehpAccordionTitle = document.getElementById('ehp-accordion-title');
    if (ehpAccordionTitle) ehpAccordionTitle.style.color = "var(--text-primary)";
    const ehpWaiting = document.getElementById('ehp-waiting');
    if (ehpWaiting) { ehpWaiting.innerText = "-"; ehpWaiting.style.display = 'block'; }
    const ehpCoach = document.getElementById('ehp-coach-ui');
    if (ehpCoach) { ehpCoach.classList.add('hidden'); ehpCoach.style.display = 'none'; } 

    const areaNameEl = document.getElementById('val-area-name');
    if (areaNameEl) areaNameEl.innerText = "No Area Selected";
    const areaDetailsEl = document.getElementById('val-area-details');
    if (areaDetailsEl) areaDetailsEl.innerHTML = `<span style="color: var(--text-muted); text-align: center">-</span>`;

    const auditContainer = document.getElementById('audit-container');
    if (auditContainer) auditContainer.innerHTML = '';
    // --------------------------------------------------------

    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = async () => {
        if (window.SizzleState) window.SizzleState.currentScan = null;

        const scanner = new window.SizzleScanner();
        
        // YIELD THE MAIN THREAD: 
        setTimeout(async () => {
            try {
                await scanner.scanImage(img);
                processScanResults(scanner);
                URL.revokeObjectURL(img.src);

                // ==========================================
                // ANALYTICS TRACKER
                // ==========================================
                const liveDomains = ['sizzlestats.com', 'www.sizzlestats.com'];
                if (liveDomains.includes(window.location.hostname)) {
                    fetch('https://snowy-unit-c9e5.anthonyyerhot.workers.dev/', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.error) {
                            console.error(`[Analytics] Server Error: ${data.error}`);
                        } else {
                            console.log(`[Analytics] Scan recorded. Total live scans: ${data.total}`);
                        }
                    })
                    .catch(err => console.log("[Analytics] Ping failed completely."));
                } else {
                    console.log("[Analytics] Dev environment: Scan ignored.");
                }
                // ==========================================

            } catch (err) {
                console.error("[Sizzle Engine] Scan aborted:", err);

                // Shift state so Error UI renders visibly
                if (window.setLensState) window.setLensState('results');

                const isNameError = err && err.message && String(err.message).includes('CHAMPION_NOT_FOUND|');

                // ==========================================
                // STRIKE 2: INVISIBLE RETRY
                // ==========================================
                if (isNameError && typeof scanner.runStrikeTwoRescue === 'function') {
                    console.log("[Sizzle Engine] Deploying Strike 2...");
                    try {
                        const strikeTwoName = await scanner.runStrikeTwoRescue();
                        const strikeTwoCheck = getChampionDetails(strikeTwoName);

                        if (strikeTwoCheck) {
                            console.log(`[Sizzle Engine] Strike 2 SUCCESS! Recovered: ${strikeTwoName}`);
                            scanner.masterData.Identity.Champion = strikeTwoCheck.name || strikeTwoCheck.Name;
                            processScanResults(scanner);
                            return; // Exit the catch block early—the day is saved!
                        } else {
                            console.warn("[Sizzle Engine] Strike 2 FAILED. Falling back to manual entry.");
                        }
                    } catch (strikeTwoErr) {
                        console.error("[Sizzle Engine] Strike 2 crashed:", strikeTwoErr);
                    }
                }

                // ==========================================
                // STRIKE 3: MANUAL UI RECOVERY
                // ==========================================
                const nameTargetEl = document.getElementById('champ-name');
                if (nameTargetEl) nameTargetEl.innerHTML = 'Scan Failed';

                let auditContainer = document.getElementById('audit-container');
                if (!auditContainer) {
                    auditContainer = document.createElement('div');
                    auditContainer.id = 'audit-container';
                    const identityCard = document.getElementById('champ-identity-card');
                    if (identityCard && identityCard.parentNode) {
                        identityCard.parentNode.insertBefore(auditContainer, identityCard.nextSibling);
                    }
                }

                if (isNameError) {
                    auditContainer.innerHTML = `
                        <div class="action-bar open audit-warning-bar" style="margin-top: 15px;">
                            <div class="action-content">
                                <span class="action-highlight text-warning">Champion Name Unreadable</span>
                            </div>
                        </div>
                        <div class="action-drawer audit-warning-drawer" style="display: block;">
                            <p class="audit-instructions">Please enter the champion's name and level manually.</p>
                            <div style="display: flex; gap: 10px; align-items: flex-start; margin-top: 5px;">
                                <div class="manual-name-wrapper" style="flex: 1; margin-top: 0;">
                                    <input type="text" id="manual-champ-input" class="manual-champ-input" placeholder="Champion name..." autocomplete="off">
                                    <ul id="manual-champ-list" class="manual-champ-list hidden-dropdown"></ul>
                                </div>
                                <input type="number" id="manual-level-input" class="manual-champ-input" placeholder="Lvl" value="60" min="1" max="60" style="width: 70px; text-align: center;">
                                <button id="manual-submit-btn" class="btn-clear-sim btn-apply-audit" style="margin-top: 0; padding: 11px 16px; width: auto;">OK</button>
                            </div>
                        </div>
                    `;

                    const inputEl = document.getElementById('manual-champ-input');
                    const listEl = document.getElementById('manual-champ-list');
                    const levelEl = document.getElementById('manual-level-input');
                    const submitBtn = document.getElementById('manual-submit-btn');

                    if (inputEl && listEl && submitBtn) {
                        setTimeout(() => inputEl.focus(), 100);

                        inputEl.addEventListener('input', (event) => {
                            const rawVal = event.target.value;
                            const searchVal = rawVal.toLowerCase().replace(/[^a-z]/g, '');

                            listEl.innerHTML = '';

                            if (searchVal.length < 2) {
                                listEl.classList.add('hidden-dropdown');
                                return;
                            }

                            const matches = championDatabase.filter(c => {
                                const dbName = (c.name || c.Name || "").toLowerCase().replace(/[^a-z]/g, '');
                                return dbName.includes(searchVal);
                            }).slice(0, 6);

                            if (matches.length > 0) {
                                listEl.classList.remove('hidden-dropdown');
                                matches.forEach(match => {
                                    const li = document.createElement('li');
                                    li.className = 'manual-champ-item';
                                    li.innerText = match.name || match.Name;

                                    li.addEventListener('click', () => {
                                        inputEl.value = match.name || match.Name;
                                        listEl.classList.add('hidden-dropdown');
                                    });
                                    listEl.appendChild(li);
                                });
                            } else {
                                listEl.classList.add('hidden-dropdown');
                            }
                        });

                        document.addEventListener('click', (clickEvent) => {
                            if (!inputEl.contains(clickEvent.target) && !listEl.contains(clickEvent.target)) {
                                listEl.classList.add('hidden-dropdown');
                            }
                        });

                        submitBtn.addEventListener('click', () => {
                            const finalName = inputEl.value.trim();
                            if (!finalName) {
                                inputEl.style.borderColor = "var(--accent-warning)";
                                return;
                            }

                            scanner.masterData.Identity.Champion = finalName;
                            scanner.masterData.Identity.Level = parseInt(levelEl.value) || 60;
                            auditContainer.innerHTML = '';

                            try {
                                processScanResults(scanner);
                            } catch (retryErr) {
                                console.error("[Sizzle Engine] Override failed:", retryErr);
                            }
                        });
                    }
                } else {
                    let errorTitle = "Scan Failed";
                    let errorDesc = err && err.message ? err.message : "The stat matrix could not be detected. Please ensure you uploaded a clear, full-screen screenshot of a champion's stat page.";

                    auditContainer.innerHTML = `
                        <div class="action-bar open audit-warning-bar" style="margin-top: 15px;">
                            <div class="action-content">
                                <span class="action-icon" style="color: var(--accent-warning);">❌</span>
                                <span class="action-highlight text-warning">${errorTitle}</span>
                            </div>
                        </div>
                        <div class="action-drawer audit-warning-drawer" style="display: block;">
                            <p class="audit-instructions" style="color: var(--text-primary); margin-bottom: 0;">${errorDesc}</p>
                        </div>
                    `;
                }
            }
        }, 150); // The critical 150ms delay
    };
});

// ==========================================
// ACCORDION UI LISTENER & SMART SCROLLING
// ==========================================
document.querySelectorAll('.action-bar').forEach(bar => {
    bar.addEventListener('click', function () {
        // Check if the one we clicked is already open
        const isCurrentlyOpen = this.classList.contains('open');

        // 1. Close ALL accordions
        document.querySelectorAll('.action-bar').forEach(b => b.classList.remove('open'));

        // 2. If the clicked one wasn't open, open it and scroll
        if (!isCurrentlyOpen) {
            this.classList.add('open');
            setTimeout(() => {
                const yOffset = -20;
                const y = this.getBoundingClientRect().top + window.scrollY + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }, 300);
        }
    });
});

function copySizzleEmail() {
    navigator.clipboard.writeText("sizzlestats@gmail.com").then(() => {
        const toast = document.getElementById('email-toast');
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 2000);
    }).catch(err => { });
}

// ==========================================
// BOTTOM SHEET CONTROLLER (Native Feel & Multi-Sheet)
// ==========================================
window.openLedgerSheet = function () {
    document.getElementById('ledger-sheet').classList.add('open');
    document.body.classList.add('no-scroll');
    history.pushState({ bottomSheet: 'open' }, '', '');
};

window.closeLedgerSheet = function (fromHistory = false) {
    const sheet = document.getElementById('ledger-sheet');
    if (sheet && sheet.classList.contains('open')) {
        sheet.classList.remove('open');
        document.body.classList.remove('no-scroll');
        if (!fromHistory && history.state && history.state.bottomSheet === 'open') {
            history.back();
        }
    }
};

window.openDmgLedgerSheet = function () {
    document.getElementById('ledger-sheet-dmg').classList.add('open');
    document.body.classList.add('no-scroll');
    history.pushState({ bottomSheet: 'open-dmg' }, '', '');
};

window.closeDmgLedgerSheet = function (fromHistory = false) {
    const sheet = document.getElementById('ledger-sheet-dmg');
    if (sheet && sheet.classList.contains('open')) {
        sheet.classList.remove('open');
        document.body.classList.remove('no-scroll');
        if (!fromHistory && history.state && history.state.bottomSheet === 'open-dmg') {
            history.back();
        }
    }
};

window.addEventListener('popstate', (e) => {
    const sheetEhp = document.getElementById('ledger-sheet');
    if (sheetEhp && sheetEhp.classList.contains('open')) {
        window.closeLedgerSheet(true);
    }

    const sheetDmg = document.getElementById('ledger-sheet-dmg');
    if (sheetDmg && sheetDmg.classList.contains('open')) {
        window.closeDmgLedgerSheet(true);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const sheets = document.querySelectorAll('.sheet-content');

    sheets.forEach(sheetContent => {
        let startY = 0;
        let currentY = 0;

        sheetContent.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        sheetContent.addEventListener('touchmove', (e) => {
            if (sheetContent.scrollTop > 0) return;

            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            if (deltaY > 0) {
                sheetContent.style.transform = `translateY(${deltaY}px)`;
                sheetContent.style.transition = 'none';
            }
        }, { passive: true });

        sheetContent.addEventListener('touchend', (e) => {
            const deltaY = currentY - startY;

            sheetContent.style.transition = 'transform 0.2s cubic-bezier(0.32, 0.72, 0, 1)';
            sheetContent.style.transform = '';

            if (deltaY > 75) {
                const parent = sheetContent.closest('.bottom-sheet');
                if (parent.id === 'ledger-sheet') window.closeLedgerSheet();
                if (parent.id === 'ledger-sheet-dmg') window.closeDmgLedgerSheet();
            }
        });
    });
});
