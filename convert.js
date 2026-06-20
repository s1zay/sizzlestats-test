const fs = require('fs');
const csv = require('csv-parser');

// File Paths
const rawDataPath = 'champs_full.json';
const csvPath = 'scale_exceptions.csv';
const outputPath = 'champs.json';

const exceptions = {};

fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (row) => {
        const cleanStats = (val) => {
            if (!val || val.trim() === "") return null;
            return val.toLowerCase()
                .replace('hax', 'max') 
                .split(',')            
                .map(s => s.trim())
                .filter(Boolean);
        };

        const champName = row.champ ? row.champ.trim() : null;
        if (champName) {
            const lookupKey = champName.toLowerCase().replace(/[^a-z0-9]/g, '');
            exceptions[lookupKey] = {
                base: [
                    ...(cleanStats(row.scale1) || []),
                    ...(cleanStats(row.scale2) || []),
                    ...(cleanStats(row.scale3) || [])
                ],
                alt: [
                    ...(cleanStats(row.alt_scale1) || []),
                    ...(cleanStats(row.alt_scale2) || [])
                ]
            };
        }
    })
    .on('end', () => {
        console.log(`[CSV] Loaded ${Object.keys(exceptions).length} manual overrides.`);
        processJson();
    });

function processJson() {
    const rawDataRaw = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
    const rawData = rawDataRaw.champions;

    if (!Array.isArray(rawData)) {
        console.error("Error: Could not find the 'champions' array.");
        process.exit(1);
    }

    // --- DELTA DETECTION: Look at current file before overwriting ---
    const existingNames = new Set();
    if (fs.existsSync(outputPath)) {
        try {
            const currentChamps = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
            if (Array.isArray(currentChamps)) {
                currentChamps.forEach(c => {
                    if (c.name) existingNames.add(c.name.trim());
                });
            }
        } catch (e) {
            console.warn("[Warning] Could not read existing champs.json for delta check.");
        }
    }

    const formatFaction = (str) => {
        if (!str) return "Unknown";
        let formatted = str.split('-')
                           .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                           .join(' ');

        const corrections = {
            "Knight Revenant": "Knights Revenant", 
            "Orc": "Orcs", 
            "Undead Horde": "Undead Hordes",
            "Sacred Order": "The Sacred Order" 
        };
        return corrections[formatted] || formatted;
    };

    const formatRole = (role) => {
        const roleMap = { "ATK": "Attack", "DEF": "Defense", "HP": "HP", "Supp": "Support" };
        return roleMap[role] || role || "Unknown";
    };

    const champMap = new Map();

    rawData.forEach(champ => {
        const isAlt = champ.shortname ? champ.shortname.includes(' - Alt') : false;
        const baseName = champ.champion ? champ.champion.trim() : "Unknown";
        const lookupKey = baseName.toLowerCase().replace(/[^a-z0-9]/g, '');

        let scaling = [champ.role === "DEF" ? "def" : champ.role === "HP" ? "hp" : "atk"];
        const manualData = exceptions[lookupKey];
        
        if (manualData) {
            if (isAlt && manualData.alt.length > 0) {
                scaling = manualData.alt;
            } else if (!isAlt && manualData.base.length > 0) {
                scaling = manualData.base;
            }
        }

        if (!champMap.has(baseName)) {
            // Extract and clean the shortname for the [NN] placeholder
            let cleanNickname = champ.shortname ? champ.shortname : baseName;

            // Scrub out ' - Alt', ' - Base', and any '(Mythical)' tags
            cleanNickname = cleanNickname
                .replace(/ - Alt/gi, '')
                .replace(/ - Base/gi, '')
                .replace(/\s*[\(\[]?Mythical[\)\]]?/gi, '')
                .trim();

            champMap.set(baseName, {
                name: baseName,
                nickname: cleanNickname,
                rarity: champ.rarity,
                affinity: champ.affinity_index,
                faction: formatFaction(champ.faction_index)
            });
        }

        const champRecord = champMap.get(baseName);
        const formStructure = { type: formatRole(champ.role), damageScaling: scaling };

        if (isAlt) {
            champRecord.altForm = formStructure;
        } else {
            champRecord.baseForm = formStructure;
        }
    });

    const finalArray = Array.from(champMap.values());

    // --- REPORT THE NEW ARRIVALS ---
    if (existingNames.size > 0) {
        const newArrivals = finalArray.filter(c => !existingNames.has(c.name));
        if (newArrivals.length > 0) {
            console.log(`\n🔥 DETECTED ${newArrivals.length} NEW CHAMPIONS IN DATA DUMP:`);
            newArrivals.forEach(c => {
                console.log(` ➔  ${c.name} [${c.rarity} | ${c.affinity} | ${c.faction}]`);
            });
            console.log('');
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(finalArray, null, 2));
    console.log(`[Success] Cleaned ${finalArray.length} champions! Saved to ${outputPath}.`);
}