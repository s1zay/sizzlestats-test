const fs = require('fs');
const path = require('path');

// 1. Define the path to your index.html
const indexPath = path.join(__dirname, 'index.html');

// 2. Generate a unique version string using the current timestamp
// This guarantees the browser always sees it as a brand new file
const newVersion = Date.now(); 

try {
    // 3. Read the current HTML file
    let htmlContent = fs.readFileSync(indexPath, 'utf8');

    // 4. Use Regex to find any existing version tags and replace them
    // Matches ".css?v=ANYTHING" and ".js?v=ANYTHING"
    htmlContent = htmlContent.replace(/(\.css\?v=)[0-9.]+/g, `$1${newVersion}`);
    htmlContent = htmlContent.replace(/(\.js\?v=)[0-9.]+/g, `$1${newVersion}`);
    
    // 5. Save the updated HTML back to the file
    fs.writeFileSync(indexPath, htmlContent);
    
    console.log(`✅ [Cache-Buster] Success! Updated all file links in index.html to ?v=${newVersion}`);
} catch (err) {
    console.error(`❌ [Cache-Buster] Failed to update index.html:`, err);
    // Tell Cloudflare to halt the deployment if the cache buster fails
    process.exit(1); 
}