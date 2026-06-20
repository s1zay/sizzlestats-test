const fs = require('fs');

// 1. Load the database
const dbPath = './champs.json';

if (!fs.existsSync(dbPath)) {
    console.error(`❌ Error: Could not find ${dbPath} in the current directory.`);
    process.exit(1);
}

const rawData = fs.readFileSync(dbPath, 'utf8');
const champions = JSON.parse(rawData);

const pureStats = ["atk", "def", "hp"];
const fringeChampions = [];

// 2. The Evaluation Engine
function isFringe(scalingArray) {
    if (!scalingArray || !Array.isArray(scalingArray)) return true;

    let flatScaling = [];
    scalingArray.forEach(s => {
        const splitItems = s.toLowerCase().split(/&|and|,|\//i).map(item => item.trim());
        flatScaling.push(...splitItems);
    });
    
    flatScaling = [...new Set(flatScaling)];

    if (flatScaling.length > 1 || !pureStats.includes(flatScaling[0])) {
        return true;
    }
    return false;
}

// 3. Scan the Database (Now separates Base and Alt forms)
champions.forEach(champ => {
    // Check Base Form
    if (champ.baseForm && champ.baseForm.damageScaling) {
        if (isFringe(champ.baseForm.damageScaling)) {
            fringeChampions.push({
                name: champ.name,
                rarity: champ.rarity,
                scalings: [...champ.baseForm.damageScaling] // Pure data
            });
        }
    }

    // Check Alt Form
    if (champ.altForm && champ.altForm.damageScaling) {
        if (isFringe(champ.altForm.damageScaling)) {
            fringeChampions.push({
                name: `${champ.name} (Alt)`, // Appended directly to the name
                rarity: champ.rarity,
                scalings: [...champ.altForm.damageScaling] // Pure data
            });
        }
    }
});

// 4. Find the Maximum Number of Columns Needed
let maxScalingCols = 0;
fringeChampions.forEach(c => {
    if (c.scalings.length > maxScalingCols) {
        maxScalingCols = c.scalings.length;
    }
});

// 5. Generate CSV Format with Dynamic Columns
let csvOutput = "Name,Rarity";
for (let i = 1; i <= maxScalingCols; i++) {
    csvOutput += `,Scaling ${i}`;
}
csvOutput += "\n";

fringeChampions.forEach(c => {
    let row = `"${c.name}",${c.rarity}`;
    
    // Fill in the columns, leaving blanks if the champ has fewer skills than the max
    for (let i = 0; i < maxScalingCols; i++) {
        if (c.scalings[i]) {
            row += `,"${c.scalings[i]}"`;
        } else {
            row += `,`; 
        }
    }
    csvOutput += row + "\n";
});

// 6. Output the Results
console.log(`\n🔍 Scanned ${champions.length} champions.`);
console.log(`⚠️ Found ${fringeChampions.length} fringe/multi-scaling forms.`);
console.log(`📊 Generated CSV with ${maxScalingCols} distinct scaling columns.\n`);

fs.writeFileSync('./fringe-champs.csv', csvOutput);
console.log(`✅ Saved clean spreadsheet format to fringe-champs.csv\n`);
