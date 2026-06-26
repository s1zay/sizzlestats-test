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
    return; // Stop the engine if JSON fails
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

  // Gear Button Logic (The UI Protector + Auto-Select)
  gearBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      gearBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const pieceKey = btn.dataset.piece.replace('_weights', '');
      pieceInput.value = pieceKey;

      // Visually disable invalid primary stats for this piece
      const validPrimaries = gearData.GameRules.Primaries[pieceKey] || [];
      
      statBtns.forEach(sBtn => {
        if (validPrimaries.includes(sBtn.dataset.stat)) {
          sBtn.style.opacity = '1';
          sBtn.style.pointerEvents = 'auto';
        } else {
          sBtn.style.opacity = '0.2';
          sBtn.style.pointerEvents = 'none';
          
          // If the user had an invalid stat selected from a previous click, clear it
          if (sBtn.classList.contains('active')) {
            sBtn.classList.remove('active');
            statInput.value = "";
          }
        }
      });

      // --- NEW: Auto-select if there is only one valid primary stat (Top Row) ---
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
    btn.addEventListener('click', () => {
      statBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      statInput.value = btn.dataset.stat;
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
    outputDiv.innerHTML = "Select a gear piece and primary stat to begin...";
    return;
  }

  // --- The General Advice Compiler ---
  const baseSubstats = gearData.GameRules.ValidSubstats[pieceKey];
  if (!baseSubstats) {
    outputDiv.innerHTML = "Error: Invalid gear piece selected.";
    return;
  }

  // 1. Remove the Primary Stat from the possible Substat Pool
  const validSubstats = baseSubstats.filter(stat => stat !== primaryStat);

  // 2. Load the Weight Profile based ONLY on the Primary Stat
  const primaryProfile = gearData.PrimaryWeights[primaryStat];

  if (!primaryProfile) {
    outputDiv.innerHTML = `<span style="color: #ff4444;">Error: Weight data missing for primary stat <strong>${primaryStat}</strong>.</span>`;
    return;
  }

  // 3. Build the specific weights object for this exact piece
  const weightsObj = {};
  validSubstats.forEach(stat => {
    // If a stat exists in the valid pool but not in our profile, default to 0
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

  let html = `<h3>Analyzed: ${pieceKey.toUpperCase()} (${primaryStat})</h3>`;
  html += `<p>Total Combinations: <strong>${totalCombos}</strong> | Keeping: <strong>${keepCount}</strong> | Selling: <strong style="color: #ff4444;">${sellCount}</strong></p>`;

  html += `
  <div style="margin-bottom: 20px; padding: 15px; background: #222; border: 2px solid #00ff00;">
    <h3 style="margin-top: 0; color: #00ff00;">Recommended Filter Passes</h3>
    <p><em>Execute these passes one at a time. After each pass, Select All, Sell, and hit the Clear button.</em></p>
  `;

  finalPlan.rounds.forEach((round, index) => {
    html += `
    <div class="pass-container">
      <h4 style="margin-top: 0; color: #00aaff;">Filter Pass ${index + 1} <span style="color: #aaa; font-size: 0.8em; float: right;">(-${round.removed} items)</span></h4>
      <ul style="list-style-type: none; padding-left: 0;">`;

    round.filters.forEach(f => {
      const isHide = f.action === "Hide";
      const icon = isHide ? '✖' : '✔';
      const iconColor = isHide ? '#ff4444' : '#00ff00';

      html += `
        <li style="display: inline-block; margin-right: 15px; padding: 5px 10px; background: #000; border: 1px solid #333; border-radius: 4px;">
          <strong>${f.stat}</strong> <span style="color: ${iconColor}; font-weight: bold; margin-left: 5px;">${icon}</span>
        </li>`;
    });

    html += `</ul></div>`;
  });

  if (finalPlan.trashLeft > 0) {
    html += `<p style="color: #ffaa00;"><em>Note: ${finalPlan.trashLeft} pieces of trash remain, but further filters were unsafe. Sell leftovers manually.</em></p>`;
  } else {
    html += `<p style="color: #00ff00;"><em>Success! 100% of the targeted trash was isolated cleanly.</em></p>`;
  }
  html += `</div>`;

  html += `
  <details>
    <summary>View Entire Ranked List</summary>
    <div style="padding: 10px; background: #1a1a1a; max-height: 400px; overflow-y: auto;">
      <table style="width: 100%; text-align: left; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="border-bottom: 2px solid #00ff00; padding: 8px;">Rank</th>
            <th style="border-bottom: 2px solid #00ff00; padding: 8px;">Score</th>
            <th style="border-bottom: 2px solid #00ff00; padding: 8px;">Substats</th>
          </tr>
        </thead>
        <tbody>`;

  ranked.forEach((item, index) => {
    const isTrash = index >= keepCount;
    const rowColor = isTrash ? 'color: #ffaa00;' : 'color: #aaa;';
    html += `
      <tr style="${rowColor}">
        <td style="padding: 6px; border-bottom: 1px solid #333;">#${index + 1}</td>
        <td style="padding: 6px; border-bottom: 1px solid #333;"><strong>${item.score}</strong></td>
        <td style="padding: 6px; border-bottom: 1px solid #333;">[${item.combo.join(", ")}] ${isTrash ? ' (SELL)' : ''}</td>
      </tr>`;
  });

  html += `</tbody></table></div></details>`;
  outputDiv.innerHTML = html;
}

window.onload = initEngine;