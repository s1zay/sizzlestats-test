let gearData = {};

async function initEngine() {
  console.log("Engine initialized! Waiting for JSON...");

  try {
    const response = await fetch('master.json');
    gearData = await response.json();
    console.log("JSON loaded successfully:", gearData);
  } catch (error) {
    console.error("Failed to load master.json.", error);
    document.getElementById("output").innerText = "Error loading data. Check console.";
    return; 
  }

  const gearBtns = document.querySelectorAll('.gear-btn');
  const statBtns = document.querySelectorAll('.stat-btn');
  const pieceInput = document.getElementById('selectedPiece');
  const statInput = document.getElementById('selectedStat');

  const checkAndRun = () => {
    if (pieceInput.value !== "" && statInput.value !== "") {
      runDebug();
    }
  };

  // Gear Button Logic
  gearBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Prevent child elements from stealing the click
      const targetBtn = e.currentTarget; 
      
      gearBtns.forEach(b => b.classList.remove('active'));
      targetBtn.classList.add('active');
      
      const pieceKey = targetBtn.dataset.piece.replace('_weights', '');
      pieceInput.value = pieceKey;

      // Visually REMOVE invalid primary stats for this piece
      const validPrimaries = gearData.GameRules.Primaries[pieceKey] || [];
      
      statBtns.forEach(sBtn => {
        if (validPrimaries.includes(sBtn.dataset.stat)) {
          sBtn.style.display = 'flex'; // Show valid stats
        } else {
          sBtn.style.display = 'none'; // Completely hide invalid stats
          
          // Clear active state if it was hidden
          if (sBtn.classList.contains('active')) {
            sBtn.classList.remove('active');
            statInput.value = "";
          }
        }
      });

      // Auto-select if there is only one valid primary stat (e.g. Weapon, Helmet, Shield)
      if (validPrimaries.length === 1) {
        const autoStat = validPrimaries[0];
        statBtns.forEach(sBtn => {
          if (sBtn.dataset.stat === autoStat) {
            statBtns.forEach(b => b.classList.remove('active'));
            sBtn.classList.add('active');
            statInput.value = autoStat;
          }
        });
      }

      checkAndRun();
    });
  });

  // Stat Button Logic
  statBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Ensure we always target the main button, even if a user clicks the inner span/checkbox
      const targetBtn = e.currentTarget;
      
      statBtns.forEach(b => b.classList.remove('active'));
      targetBtn.classList.add('active');
      statInput.value = targetBtn.dataset.stat;
      
      checkAndRun();
    });
  });

  const slider = document.getElementById("strictnessSlider");
  if (slider) {
    slider.addEventListener("input", (e) => {
      document.getElementById("sliderValue").innerText = e.target.value;
      checkAndRun();
    });
  }

  const clicksInput = document.getElementById("maxClicks");
  if (clicksInput) {
    clicksInput.addEventListener("input", checkAndRun);
  }
}

function getCombinations(array, size) {
  const result = [];
  function combine(temp, index) {
    if (temp.length === size) {
      result.push(temp);
      return;
    }
    if (index + 1 <= array.length) {
      combine(temp.concat(array[index]), index + 1);
      combine(temp, index + 1);
    }
  }
  combine([], 0);
  return result;
}

function generateAllFilterSets(substats, maxButtons) {
  const sets = [];
  for (let size = 1; size <= maxButtons; size++) {
    const statCombos = getCombinations(substats, size);
    statCombos.forEach(stats => {
      const numPerms = Math.pow(2, size);
      for (let p = 0; p < numPerms; p++) {
        const currentFilter = [];
        for (let i = 0; i < size; i++) {
          const isRequire = (p & (1 << i)) !== 0;
          currentFilter.push({
            stat: stats[i],
            action: isRequire ? "Require" : "Hide"
          });
        }
        sets.push(currentFilter);
      }
    });
  }
  return sets;
}

function itemMatchesFilter(gearCombo, filterSet) {
  for (let f of filterSet) {
    if (f.action === "Require" && !gearCombo.includes(f.stat)) return false;
    if (f.action === "Hide" && gearCombo.includes(f.stat)) return false;
  }
  return true;
}

function generateBatchedRecommendations(keepPool, trashPool, validSubstats, maxButtons) {
  let remainingTrash = [...trashPool];
  const rounds = [];

  const allPossibleFilters = generateAllFilterSets(validSubstats, Math.min(maxButtons, 6));

  let safetyBreaker = 0;
  while (remainingTrash.length > 0 && safetyBreaker < 10) {
    safetyBreaker++;
    let bestFilterSet = null;
    let maxTrashCaught = 0;

    for (const fSet of allPossibleFilters) {
      let keepCaught = 0;
      for (const keepItem of keepPool) {
        if (itemMatchesFilter(keepItem.combo, fSet)) {
          keepCaught++;
          break;
        }
      }

      if (keepCaught === 0) {
        let trashCaught = 0;
        for (const trashItem of remainingTrash) {
          if (itemMatchesFilter(trashItem.combo, fSet)) {
            trashCaught++;
          }
        }

        if (trashCaught > maxTrashCaught || (trashCaught === maxTrashCaught && bestFilterSet && fSet.length < bestFilterSet.length)) {
          maxTrashCaught = trashCaught;
          bestFilterSet = fSet;
        }
      }
    }

    if (maxTrashCaught === 0 || !bestFilterSet) break;

    rounds.push({
      filters: bestFilterSet,
      removed: maxTrashCaught
    });

    remainingTrash = remainingTrash.filter(item => !itemMatchesFilter(item.combo, bestFilterSet));
  }

  return { rounds: rounds, trashLeft: remainingTrash.length };
}

function runDebug() {
  const pieceKey = document.getElementById("selectedPiece").value;
  const primaryStat = document.getElementById("selectedStat").value;
  const outputDiv = document.getElementById("output");
  const sliderPercent = parseInt(document.getElementById("strictnessSlider").value, 10);
  const maxClicks = parseInt(document.getElementById("maxClicks").value, 10) || 4;

  if (!pieceKey || !primaryStat) {
    outputDiv.innerHTML = "<div style='color: var(--text-muted); text-align: center; padding: 30px 10px; font-family: monospace;'>Select a gear piece and primary stat to begin...</div>";
    return;
  }

  const baseSubstats = gearData.GameRules.ValidSubstats[pieceKey];
  if (!baseSubstats) {
    outputDiv.innerHTML = "<span style='color: var(--accent-warning);'>Error: Invalid gear piece selected.</span>";
    return;
  }

  const validSubstats = baseSubstats.filter(stat => stat !== primaryStat);
  const primaryProfile = gearData.PrimaryWeights[primaryStat];

  if (!primaryProfile) {
    outputDiv.innerHTML = `<span style="color: var(--accent-warning);">Error: Weight data missing for primary stat <strong>${primaryStat}</strong>.</span>`;
    return;
  }

  // Define clean display labels for stats
  const statLabels = {
    "FLAT_HP": "HP",
    "HP_PCT": "HP%",
    "FLAT_ATK": "ATK",
    "ATK_PCT": "ATK%",
    "FLAT_DEF": "DEF",
    "DEF_PCT": "DEF%",
    "CRATE": "C. RATE%",
    "CDMG": "C. DMG%",
    "SPD": "SPD",
    "RES": "RES",
    "ACC": "ACC"
  };

  const weightsObj = {};
  validSubstats.forEach(stat => {
    weightsObj[stat] = primaryProfile[stat] || 0;
  });

  const allCombos = getCombinations(validSubstats, 4);

  const ranked = allCombos.map(combo => {
    const score = combo.reduce((sum, stat) => sum + weightsObj[stat], 0);
    return { combo, score };
  }).sort((a, b) => b.score - a.score);

  const totalCombos = ranked.length;
  const sellCount = Math.floor(totalCombos * (sliderPercent / 100));
  const keepCount = totalCombos - sellCount;
  const keepPool = ranked.slice(0, keepCount);
  const trashPool = ranked.slice(keepCount);

  const finalPlan = generateBatchedRecommendations(keepPool, trashPool, validSubstats, maxClicks);

  const displayPrimaryStat = statLabels[primaryStat] || primaryStat;

  let html = `<h3 style="color: var(--indicator-active); text-transform: uppercase; margin-bottom: 5px;">Analyzed: ${pieceKey} (${displayPrimaryStat})</h3>`;
  html += `<p style="color: var(--text-muted); font-size: 0.9em;">Total Combinations: <strong>${totalCombos}</strong> | Keeping: <strong>${keepCount}</strong> | Selling: <strong style="color: var(--accent-warning);">${sellCount}</strong></p>`;

  html += `
  <div style="margin-top: 15px; padding: 15px; background: var(--bg-canvas); border: 1px dashed var(--indicator-active); border-radius: 6px;">
    <h3 style="margin-top: 0; color: var(--text-primary);">Recommended Filter Passes</h3>
    <p style="color: var(--text-muted); font-size: 0.85em; margin-bottom: 15px;"><em>Execute these passes one at a time. After each pass, Select All, Sell, and hit the Clear button.</em></p>
  `;

  finalPlan.rounds.forEach((round, index) => {
    html += `
    <div style="background: var(--bg-card); border: 1px solid var(--border-lowkey); padding: 10px; margin-bottom: 10px; border-radius: 6px;">
      <h4 style="margin-top: 0; color: var(--indicator-active); margin-bottom: 10px;">Filter Pass ${index + 1} <span style="color: var(--text-muted); font-size: 0.8em; float: right;">(-${round.removed} items)</span></h4>
      <div style="display: flex; flex-wrap: wrap; gap: 8px;">`;

    round.filters.forEach(f => {
      const isHide = f.action === "Hide";
      const icon = isHide ? '✖' : '✔';
      const iconColor = isHide ? 'var(--accent-warning)' : '#22c55e';
      const bgColor = isHide ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)';
      const displayName = statLabels[f.stat] || f.stat;

      html += `
        <div style="padding: 4px 10px; background: ${bgColor}; border: 1px solid ${iconColor}; border-radius: 4px; font-size: 0.85em; font-weight: bold; color: var(--text-primary);">
          ${displayName} <span style="color: ${iconColor}; margin-left: 4px;">${icon}</span>
        </div>`;
    });

    html += `</div></div>`;
  });

  if (finalPlan.trashLeft > 0) {
    html += `<p style="color: #facc15; font-size: 0.85em;"><em>Note: ${finalPlan.trashLeft} pieces of trash remain, but further filters were unsafe. Sell leftovers manually.</em></p>`;
  } else {
    html += `<p style="color: #22c55e; font-size: 0.85em; font-weight: bold;"><em>Success! 100% of the targeted trash was isolated cleanly.</em></p>`;
  }
  html += `</div>`;

  html += `
  <details style="margin-top: 15px;">
    <summary style="color: var(--text-muted); font-size: 0.9em;">View Entire Ranked List</summary>
    <div style="padding: 10px; background: var(--bg-canvas); max-height: 300px; overflow-y: auto; border-top: 1px solid var(--border-lowkey);">
      <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 0.85em;">
        <thead>
          <tr>
            <th style="border-bottom: 1px solid var(--border-lowkey); padding: 8px; color: var(--text-muted);">Rank</th>
            <th style="border-bottom: 1px solid var(--border-lowkey); padding: 8px; color: var(--text-muted);">Score</th>
            <th style="border-bottom: 1px solid var(--border-lowkey); padding: 8px; color: var(--text-muted);">Substats</th>
          </tr>
        </thead>
        <tbody>`;

  ranked.forEach((item, index) => {
    const isTrash = index >= keepCount;
    const rowColor = isTrash ? 'color: var(--accent-warning);' : 'color: var(--text-primary);';
    const displayCombo = item.combo.map(s => statLabels[s] || s).join(", ");

    html += `
      <tr style="${rowColor}">
        <td style="padding: 6px; border-bottom: 1px dashed var(--border-lowkey);">#${index + 1}</td>
        <td style="padding: 6px; border-bottom: 1px dashed var(--border-lowkey);"><strong>${item.score}</strong></td>
        <td style="padding: 6px; border-bottom: 1px dashed var(--border-lowkey);">[${displayCombo}] ${isTrash ? ' (SELL)' : ''}</td>
      </tr>`;
  });

  html += `</tbody></table></div></details>`;
  outputDiv.innerHTML = html;
}

window.onload = initEngine;
