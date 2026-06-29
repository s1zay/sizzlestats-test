// ==========================================
// SIZZLESTATS SPLASH PAGE LOGIC (V2.0 Launcher)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tell the browser to stop auto-scrolling on refresh
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }

    // 2. Snap instantly to the absolute top of the page
    window.scrollTo(0, 0);

    // 3. Render the 8-bit dithered background spray
    initRetroDither();
});

function initRetroDither() {
    const canvas = document.getElementById("dither-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    const BRAND_COLOR = { r: 255, g: 255, b: 255 }; // Pure White
    const FALLOFF_POWER = 1.15;       // Lower = spreads further horizontally
    const MAX_X_PERCENT = 1.15;       // Pushes the horizontal scatter right to the edge
    const SOLID_CORE_PERCENT = 0.55;  // Width of the central solid core
    const STRIP_HEIGHT_PERCENT = 0.58; // Base vertical height of the main banner
    const VERTICAL_FUZZ_PIXELS = 3.5;  // Number of pixels of "sprayed fuzzy bleed" on top/bottom
    const RANDOMNESS_BLEND = 0.55;     // 0 = perfect grid pattern, 1 = chaotic noise spray

    // ==========================================
    // SEED LOCK CONTROLS
    // ==========================================
    // Change this number (e.g., 101, 777, 1337) to "roll" a brand new static pattern.
    // Once you find the layout you love, leave this number alone to keep it permanent.
    const SEED = 48; 

    // Simple deterministic random generator
    let seedTracker = SEED;
    function seededRandom() {
        const x = Math.sin(seedTracker++) * 10000;
        return x - Math.floor(x);
    }

    // Classic 8x8 Bayer Ordered Dither Matrix
    const bayer8x8 = [
        [ 0, 48, 12, 60,  3, 51, 15, 63],
        [32, 16, 44, 28, 35, 19, 47, 31],
        [ 8, 56,  4, 52, 11, 59,  7, 55],
        [40, 24, 36, 20, 43, 27, 39, 23],
        [ 2, 50, 14, 62,  1, 49, 13, 61],
        [34, 18, 46, 30, 33, 17, 45, 29],
        [10, 58,  6, 54,  9, 57,  5, 53],
        [42, 26, 38, 22, 41, 25, 37, 21]
    ];

    const cx = width / 2;
    const cy = height / 2;
    
    const stripHeight = height * STRIP_HEIGHT_PERCENT;
    const maxXDistance = cx * MAX_X_PERCENT;
    const solidXDistance = maxXDistance * SOLID_CORE_PERCENT;

    for (let y = 0; y < height; y++) {
        const dy = Math.abs(y - cy);
        
        // 1. Calculate vertical decay (for the top & bottom fuzziness)
        let verticalIntensity = 1.0;
        if (dy > stripHeight / 2) {
            if (dy > stripHeight / 2 + VERTICAL_FUZZ_PIXELS) {
                // Completely outside vertical boundaries
                for (let x = 0; x < width; x++) {
                    const pixelIndex = (y * width + x) * 4;
                    data[pixelIndex + 3] = 0;
                }
                continue;
            }
            // Vertical decay slope for top/bottom fuzzy edges
            verticalIntensity = 1.0 - (dy - stripHeight / 2) / VERTICAL_FUZZ_PIXELS;
        }

        for (let x = 0; x < width; x++) {
            const dx = Math.abs(x - cx);
            const pixelIndex = (y * width + x) * 4;

            // 2. Calculate horizontal decay (for left & right dissolve)
            let horizontalIntensity = 1.0;
            if (dx > solidXDistance) {
                if (dx > maxXDistance) {
                    data[pixelIndex + 3] = 0;
                    continue;
                }
                const normDist = (dx - solidXDistance) / (maxXDistance - solidXDistance);
                horizontalIntensity = 1.0 - normDist;
                horizontalIntensity = Math.pow(horizontalIntensity, FALLOFF_POWER);
            }

            // Combine both vertical and horizontal decay models
            const finalIntensity = horizontalIntensity * verticalIntensity;

            // Keep the absolute core 100% solid white
            if (dx <= solidXDistance && dy <= stripHeight / 2) {
                data[pixelIndex]     = BRAND_COLOR.r;
                data[pixelIndex + 1] = BRAND_COLOR.g;
                data[pixelIndex + 2] = BRAND_COLOR.b;
                data[pixelIndex + 3] = 255;
            } else {
                // Outer dither zone: Blend ordered Bayer grid with deterministic pseudo-noise
                const bayerVal = bayer8x8[y % 8][x % 8] / 64;
                const noiseVal = seededRandom();
                const mixedThreshold = (bayerVal * (1 - RANDOMNESS_BLEND)) + (noiseVal * RANDOMNESS_BLEND);

                if (finalIntensity > mixedThreshold) {
                    data[pixelIndex]     = BRAND_COLOR.r;
                    data[pixelIndex + 1] = BRAND_COLOR.g;
                    data[pixelIndex + 2] = BRAND_COLOR.b;
                    
                    // Smoothly fade pixel opacity (alpha) the further out they drift
                    const alphaValue = Math.round(110 + 145 * finalIntensity); 
                    data[pixelIndex + 3] = alphaValue;
                } else {
                    data[pixelIndex + 3] = 0;
                }
            }
        }
    }
    
    ctx.putImageData(imageData, 0, 0);
}