/**
 * Sizzle Stats - Vision Engine (V3.0: The Detail Crop Update)
 * Optimized for SizzleStats.com 
 * Includes dynamic row-cropping for human-in-the-loop UI audits.
 */

// ==========================================
// GLOBAL TESSERACT WORKER (The "Warm Engine")
// ==========================================
let globalTessWorker = null;

(async function initTesseract() {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.innerText = "Warming up Neural Engine...";
        statusEl.style.color = "#eab308"; // Amber
    }

    // Create and keep the worker alive globally using local files
    globalTessWorker = await Tesseract.createWorker('eng', 1, {
        workerPath: '/libs/worker.min.js',
        corePath: '/libs/tesseract-core.wasm.js',
        langPath: '/libs'
    });

    if (statusEl) {
        statusEl.innerText = "SCANNER READY";
        statusEl.style.color = "#a1a1aa"; // Back to muted
    }
    console.log("[Sizzle Engine] Tesseract Worker is hot and standing by.");
})();

class SizzleScanner {
    constructor() {
        this.masterData = this.initDataBucket();
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.rawImage = null;
    }

    initDataBucket() {
        return {
            GridAnchor: null,
            Identity: {
                Champion: null,
                Level: null,
                Rank: null,
                AscensionLevel: null,
                AwakeningLevel: null,
                Form: "Base Form"
            },
            Stats: {},
            Context: "",
            RawWords: []
        };
    }

    async scanImage(imgSource) {
        console.log("==========================================");
        console.log("[Sizzle Engine] INITIATING SCAN SEQUENCE");
        console.log("==========================================");
        console.time("TOTAL SCAN TIME");

        this.rawImage = imgSource;
        this.masterData = this.initDataBucket();

        this.canvas.width = imgSource.width;
        this.canvas.height = imgSource.height;
        this.ctx.drawImage(imgSource, 0, 0);

        console.time("OpenCV: Find L-Bracket");
        if (!this.findStatsBox()) {
            console.timeEnd("OpenCV: Find L-Bracket");
            console.error("[Sizzle Engine] CRITICAL: Could not lock onto the stat matrix UI.");
            throw new Error("UI Structure not found. Ensure the stats summary is visible.");
        }
        console.timeEnd("OpenCV: Find L-Bracket");

        console.time("OpenCV: Count Stars");
        this.countStars();
        console.timeEnd("OpenCV: Count Stars");

        console.time("OpenCV & OCR: Build & Scan Receipt");
        await this.buildAndScanReceipt();
        console.timeEnd("OpenCV & OCR: Build & Scan Receipt");

        console.timeEnd("TOTAL SCAN TIME");
        console.log("[Sizzle Engine] SCAN SEQUENCE COMPLETE", this.masterData);
        return this.masterData;
    }

    cleanOcrNumber(text) {
        let cleaned = text.replace(/[^0-9]/g, '').replace(/O/g, '0');
        return cleaned === "" ? 0 : parseInt(cleaned);
    }

    findStatsBox() {
        let src = cv.imread(this.canvas);
        let hsv = new cv.Mat();
        cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

        let low = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [80, 90, 120, 0]);
        let high = new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [100, 255, 255, 255]);
        let mask = new cv.Mat();
        cv.inRange(hsv, low, high, mask);

        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(17, 17));
        cv.morphologyEx(mask, mask, cv.MORPH_CLOSE, kernel);

        let contours = new cv.MatVector(), hierarchy = new cv.Mat();
        cv.findContours(mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let leftW = null, bottomF = null, maxH = 0, maxW = 0;

        for (let i = 0; i < contours.size(); ++i) {
            let rect = cv.boundingRect(contours.get(i));
            if (rect.height > maxH && rect.height > src.rows * 0.1) { maxH = rect.height; leftW = rect; }
            if (rect.width > maxW && rect.width > src.cols * 0.1) { maxW = rect.width; bottomF = rect; }
        }

        if (leftW && bottomF) {
            this.masterData.GridAnchor = {
                x: leftW.x,
                y: leftW.y,
                width: (bottomF.x + bottomF.width) - leftW.x,
                height: (bottomF.y + bottomF.height) - leftW.y
            };
            console.log(`[Sizzle Engine] L-Bracket Locked! Anchor Coordinates: X:${leftW.x}, Y:${leftW.y}`);
        } else {
            console.warn(`[Sizzle Engine] L-Bracket not found in image.`);
        }

        src.delete(); hsv.delete(); low.delete(); high.delete(); mask.delete(); kernel.delete(); contours.delete(); hierarchy.delete();
        return !!this.masterData.GridAnchor;
    }

    countStars() {
        const anchor = this.masterData.GridAnchor;
        const loc = sizzleGridLocations.rows.Header;
        const cropTop = Math.max(0, anchor.y + Math.floor(anchor.height * (loc.top / 100)));
        const cropHeight = Math.floor(anchor.height * (Math.abs(loc.top) / 100));

        let src = cv.imread(this.rawImage);
        let cropped = src.roi(new cv.Rect(anchor.x, cropTop, anchor.width, cropHeight));
        let hsv = new cv.Mat();
        cv.cvtColor(cropped, hsv, cv.COLOR_RGBA2RGB);
        cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

        let masks = { purple: new cv.Mat(), red: new cv.Mat(), yellow: new cv.Mat() };
        
        // YELLOW: 16 to 40
        cv.inRange(hsv, new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [16, 100, 100, 0]), new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [40, 255, 255, 0]), masks.yellow);
        
        // PURPLE: 130 to 160 
        cv.inRange(hsv, new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [130, 100, 100, 0]), new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [160, 255, 255, 0]), masks.purple);

        let m1 = new cv.Mat(), m2 = new cv.Mat();
        
        // RED MASK 1: 0 to 15
        cv.inRange(hsv, new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [0, 100, 100, 0]), new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [15, 255, 255, 0]), m1);
        
        // RED MASK 2: 161 to 180 
        cv.inRange(hsv, new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [161, 100, 100, 0]), new cv.Mat(hsv.rows, hsv.cols, hsv.type(), [180, 255, 255, 0]), m2);

        cv.bitwise_or(m1, m2, masks.red);

        let blobs = [];
        Object.keys(masks).forEach(color => {
            let contours = new cv.MatVector(), hi = new cv.Mat();
            cv.findContours(masks[color], contours, hi, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            for (let i = 0; i < contours.size(); ++i) {
                if (cv.contourArea(contours.get(i)) > 5) {
                    let b = cv.boundingRect(contours.get(i));
                    blobs.push({ color, x: b.x, width: b.width, height: b.height, right: b.x + b.width });
                }
            }
            contours.delete(); hi.delete();
        });

        blobs.sort((a, b) => b.x - a.x);
        let trueStars = [], currentChain = [];
        for (let blob of blobs) {
            if (currentChain.length === 0) { currentChain.push({ ...blob }); continue; }
            let prev = currentChain[currentChain.length - 1];
            if (Math.abs(prev.x - blob.x) < Math.max(15, prev.width * 0.85)) {
                const prio = { 'red': 3, 'purple': 2, 'yellow': 1 };
                if (prio[blob.color] > prio[prev.color]) currentChain[currentChain.length - 1].color = blob.color;
            } else if (prev.x - blob.right < Math.max(15, prev.width * 1.5)) {
                if (currentChain.length < 6) currentChain.push({ ...blob });
            } else {
                if (currentChain.length > trueStars.length) trueStars = [...currentChain];
                currentChain = [{ ...blob }];
            }
        }
        if (currentChain.length > trueStars.length) trueStars = [...currentChain];
        trueStars = trueStars.slice(0, 6);

        this.masterData.Identity.Rank = trueStars.length;
        this.masterData.Identity.AscensionLevel = trueStars.filter(b => b.color !== 'yellow').length;
        this.masterData.Identity.AwakeningLevel = trueStars.filter(b => b.color === 'red').length;

        console.log(`[Sizzle Engine] Star Count: ${this.masterData.Identity.Rank} Rank, ${this.masterData.Identity.AscensionLevel} Ascended, ${this.masterData.Identity.AwakeningLevel} Awakened`);

        src.delete(); cropped.delete(); hsv.delete(); m1.delete(); m2.delete();
        Object.values(masks).forEach(m => m.delete());
    }

    exportRowCrop(rowKey) {
        const anchor = this.masterData.GridAnchor;
        if (!anchor || typeof sizzleGridLocations === 'undefined') return null;

        const gridRow = sizzleGridLocations.rows[rowKey];
        if (!gridRow) return null;

        const y = Math.max(0, anchor.y + Math.floor(anchor.height * (gridRow.top / 100)));
        const h = Math.floor(anchor.height * ((gridRow.bottom - gridRow.top) / 100));

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = anchor.width;
        cropCanvas.height = h;
        const cCtx = cropCanvas.getContext('2d');

        cCtx.drawImage(this.rawImage, anchor.x, y, anchor.width, h, 0, 0, anchor.width, h);
        return cropCanvas.toDataURL('image/png');
    }

    async buildAndScanReceipt() {
        const anchor = this.masterData.GridAnchor;
        if (!anchor) return;

        let src = cv.imread(this.rawImage);

        this.receiptCanvas = document.createElement('canvas');
        const rCtx = this.receiptCanvas.getContext('2d', { willReadFrequently: true });

        const MAX_CANVAS_WIDTH = 4000;
        this.receiptCanvas.width = MAX_CANVAS_WIDTH;
        this.receiptCanvas.height = 4000;

        rCtx.fillStyle = "#FFFFFF";
        rCtx.fillRect(0, 0, this.receiptCanvas.width, this.receiptCanvas.height);

        // --- THE SPRITE SHEET TRACKERS ---
        let currentX = 0;
        let currentY = 0;
        let highestY = 0;
        let maxX = 0;
        const TARGET_HEIGHT = 80;
        const PADDING = 30;
        const receiptMap = [];

        const tempCanvas = document.createElement('canvas');
        const resized = new cv.Mat();
        const filtered = new cv.Mat();
        const rgbaPlanes = new cv.MatVector();

        const addSnippet = (x, y, w, h, filterType, typeLabel, rowKey, colKey) => {
            if (w <= 0 || h <= 0) return;

            let roi = src.roi(new cv.Rect(x, y, w, h));
            const scale = TARGET_HEIGHT / roi.rows;
            const scaledWidth = Math.round(roi.cols * scale);

            if (currentX + scaledWidth > MAX_CANVAS_WIDTH) {
                currentX = 0;
                currentY += (TARGET_HEIGHT + PADDING);
            }

            cv.resize(roi, resized, new cv.Size(scaledWidth, TARGET_HEIGHT), 0, 0, cv.INTER_CUBIC);

            if (filterType === 'TEXT') {
                if (typeLabel === 'FORM') {
                    cv.split(resized, rgbaPlanes);
                    let greenChannel = rgbaPlanes.get(1);
                    cv.threshold(greenChannel, filtered, 100, 255, cv.THRESH_BINARY_INV);
                    greenChannel.delete();
                } else {
                    cv.cvtColor(resized, filtered, cv.COLOR_RGBA2GRAY);
                    cv.bitwise_not(filtered, filtered);
                }
            } else if (filterType === 'MATRIX') {
                if (colKey === 'Artifacts') {
                    cv.split(resized, rgbaPlanes);
                    let greenChannel = rgbaPlanes.get(1);
                    cv.threshold(greenChannel, filtered, 130, 255, cv.THRESH_BINARY_INV);
                    greenChannel.delete();
                } else {
                    cv.cvtColor(resized, filtered, cv.COLOR_RGBA2GRAY);
                    let minMax = cv.minMaxLoc(filtered);

                    if (minMax.maxVal < 130) {
                        filtered.setTo(new cv.Scalar(255));
                    } else {
                        cv.adaptiveThreshold(filtered, filtered, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 41, -15);
                    }
                }
            }
            
            cv.imshow(tempCanvas, filtered);
            rCtx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, currentX, currentY, tempCanvas.width, TARGET_HEIGHT);

            receiptMap.push({
                type: typeLabel, row: rowKey, col: colKey,
                origX: x, origY: y, scale: scale,
                x0: currentX, x1: currentX + scaledWidth,
                y0: currentY, y1: currentY + TARGET_HEIGHT, text: ""
            });

            if (currentX + scaledWidth > maxX) {
                maxX = currentX + scaledWidth;
            }

            currentX += (scaledWidth + PADDING);
            highestY = currentY + TARGET_HEIGHT;
            roi.delete();
        };

        console.time("   -> OpenCV: 102 Image Crops & Filters");

        // 1. ADD HEADER
        const hLoc = sizzleGridLocations.rows.Header;
        addSnippet(
            anchor.x, Math.max(0, anchor.y + Math.floor(anchor.height * (hLoc.top / 100))),
            anchor.width, Math.floor(anchor.height * (Math.abs(hLoc.top) / 100)),
            'TEXT', 'HEADER', 'Header', 'None'
        );

        if (currentX > 0) {
            currentX = 0;
            currentY += (TARGET_HEIGHT + PADDING);
            highestY = currentY;
        }

        // 2. ADD FORM
        const fRow = sizzleGridLocations.rows.Mythical;
        const fCol = sizzleGridLocations.columns.Mythical;
        addSnippet(
            anchor.x + Math.floor(anchor.width * (fCol.left / 100)), anchor.y + Math.floor(anchor.height * (fRow.top / 100)),
            Math.floor(anchor.width * ((fCol.right - fCol.left) / 100)), Math.floor(anchor.height * ((fRow.bottom - fRow.top) / 100)),
            'TEXT', 'FORM', 'Mythical', 'Mythical'
        );

        // 3. ADD AREA
        const aRow = sizzleGridLocations.rows.ASelect;
        const aCol = sizzleGridLocations.columns.ASelect;
        addSnippet(
            anchor.x + Math.floor(anchor.width * (aCol.left / 100)), anchor.y + Math.floor(anchor.height * (aRow.top / 100)),
            Math.floor(anchor.width * ((aCol.right - aCol.left) / 100)), Math.floor(anchor.height * ((aRow.bottom - aRow.top) / 100)),
            'TEXT', 'CONTEXT', 'ASelect', 'ASelect'
        );

        if (currentX > 0) {
            currentX = 0;
            currentY += (TARGET_HEIGHT + PADDING);
            highestY = currentY;
        }

        const dynamicSplitY = currentY;

        // 4. ADD THE 99 MATRIX CELLS
        const rowKeys = ["HP", "ATK", "DEF", "SPD", "CRate", "CDMG", "RES", "ACC", "IDEF"];
        const colKeys = ["Basic", "Artifacts", "Affinity", "CArena", "Masteries", "FGuardian", "Empowerment", "Blessing", "Relic", "AreaB", "Total"];

        rowKeys.forEach(r => {
            this.masterData.Stats[r] = {};
            colKeys.forEach(c => {
                this.masterData.Stats[r][c] = 0;
                let gridRow = sizzleGridLocations.rows[r];
                let gridCol = sizzleGridLocations.columns[c];

                addSnippet(
                    anchor.x + Math.floor(anchor.width * (gridCol.left / 100)), anchor.y + Math.floor(anchor.height * (gridRow.top / 100)),
                    Math.floor(anchor.width * ((gridCol.right - gridCol.left) / 100)), Math.floor(anchor.height * ((gridRow.bottom - gridRow.top) / 100)),
                    'MATRIX', 'MATRIX', r, c
                );
            });
        });

        src.delete();
        resized.delete();
        filtered.delete();
        rgbaPlanes.delete();
        console.timeEnd("   -> OpenCV: 102 Image Crops & Filters");

        const finalWidth = maxX > 0 ? maxX + PADDING : MAX_CANVAS_WIDTH;
        const finalHeight = highestY > 0 ? highestY + PADDING : 4000;

        const trimmedCanvas = document.createElement('canvas');
        trimmedCanvas.width = finalWidth;
        trimmedCanvas.height = finalHeight;
        const tCtx = trimmedCanvas.getContext('2d');
        tCtx.drawImage(this.receiptCanvas, 0, 0, finalWidth, finalHeight, 0, 0, finalWidth, finalHeight);

        this.receiptCanvas = trimmedCanvas;

        console.log(`[Sizzle Engine] Sprite Sheet Built: ${finalWidth}x${finalHeight}. Splitting at Y=${dynamicSplitY}`);

        // Initialize local Tesseract Worker if not already running
        if (!globalTessWorker) {
            globalTessWorker = await Tesseract.createWorker('eng', 1, {
                workerPath: '/libs/worker.min.js',
                corePath: '/libs/tesseract-core.wasm.js',
                langPath: '/libs'
            });
        }

        // ==========================================
        // 5. TWO-STAGE TESSERACT EXECUTION
        // ==========================================
        const splitY = dynamicSplitY;

        const headerTrim = document.createElement('canvas');
        headerTrim.width = finalWidth;
        headerTrim.height = splitY;
        headerTrim.getContext('2d').drawImage(trimmedCanvas, 0, 0, finalWidth, splitY, 0, 0, finalWidth, splitY);

        console.time("   -> Tesseract: Text Block (PSM 6)");
        const headerResult = await globalTessWorker.recognize(headerTrim, { tessedit_pageseg_mode: '6' });
        console.timeEnd("   -> Tesseract: Text Block (PSM 6)");
        console.log(`[Sizzle Engine] Text Block parsed ${headerResult.data.words.length} words.`);

        const gridTrim = document.createElement('canvas');
        gridTrim.width = finalWidth;
        gridTrim.height = finalHeight - splitY;
        gridTrim.getContext('2d').drawImage(trimmedCanvas, 0, splitY, finalWidth, gridTrim.height, 0, 0, finalWidth, gridTrim.height);

        console.time("   -> Tesseract: Number Grid (PSM 11)");
        const gridResult = await globalTessWorker.recognize(gridTrim, { tessedit_pageseg_mode: '11' });
        console.timeEnd("   -> Tesseract: Number Grid (PSM 11)");
        console.log(`[Sizzle Engine] Number Grid parsed ${gridResult.data.words.length} digits.`);

        gridResult.data.words.forEach(w => {
            w.bbox.y0 += splitY;
            w.bbox.y1 += splitY;
        });
        const combinedWords = [...headerResult.data.words, ...gridResult.data.words];

        let successfullyRouted = 0;
        combinedWords.forEach(word => {
            const cx = (word.bbox.x0 + word.bbox.x1) / 2;
            const cy = (word.bbox.y0 + word.bbox.y1) / 2;

            console.log(`🔍 [OCR X-Ray] Found: "${word.text}" at Center(X: ${Math.round(cx)}, Y: ${Math.round(cy)})`);

            const mapItem = receiptMap.find(item =>
                cx >= item.x0 && cx <= item.x1 &&
                cy >= item.y0 && cy <= item.y1
            );

            if (!mapItem) {
                console.warn(`🚨 [OCR X-Ray] DROPPED! "${word.text}" did not fit inside any map boundaries.`);
                return;
            }
            successfullyRouted++;

            const val = this.cleanOcrNumber(word.text);
            
            console.log(`✅ [OCR X-Ray] ROUTED "${word.text}" (Cleaned to: ${val}) -> ${mapItem.row} / ${mapItem.col}`);

            this.masterData.RawWords.push({
                text: word.text,
                val: val,
                bbox: {
                    x0: mapItem.origX + ((word.bbox.x0 - mapItem.x0) / mapItem.scale),
                    y0: mapItem.origY + ((word.bbox.y0 - mapItem.y0) / mapItem.scale),
                    x1: mapItem.origX + ((word.bbox.x1 - mapItem.x0) / mapItem.scale),
                    y1: mapItem.origY + ((word.bbox.y1 - mapItem.y0) / mapItem.scale)
                }
            });

            if (mapItem.type === 'HEADER' || mapItem.type === 'FORM' || mapItem.type === 'CONTEXT') {
                mapItem.text = (mapItem.text || "") + " " + word.text;
            } else if (mapItem.type === 'MATRIX') {
                if (val !== 0 || word.text === "0") {
                    let current = this.masterData.Stats[mapItem.row][mapItem.col];
                    this.masterData.Stats[mapItem.row][mapItem.col] = current === 0 ? val : parseInt("" + current + val);
                }
            }
        });

        // 7. CLEANUP TEXT FIELDS
        receiptMap.filter(i => i.type !== 'MATRIX').forEach(item => {
            if (!item.text) return;
            let rawText = item.text.trim();

            if (item.type === 'HEADER') {
                console.log(`[Sizzle Engine] RAW HEADER OCR: "${rawText}"`);

                rawText = rawText.replace(/^[^a-zA-Z]+/, "").trim();

                const match = rawText.match(/(.+?)\s*(?:Lvl|Lvi|Lv|Level)\.?\s*([0-9OlI|]+)/i);

                if (match) {
                    this.masterData.Identity.Champion = match[1].replace(/^[^a-zA-Z]+/, '').trim();

                    let dirtyLevel = match[2].replace(/[Il|]/g, '1');
                    this.masterData.Identity.Level = this.cleanOcrNumber(dirtyLevel);

                    console.log(`[Sizzle Engine] HEADER MATCH: Champ: ${this.masterData.Identity.Champion}, Level: ${this.masterData.Identity.Level}`);
                } else {
                    console.warn(`[Sizzle Engine] HEADER REGEX FAILED: "${rawText}" - Attempting fallback.`);
                    this.masterData.Identity.Champion = rawText.split('\n')[0].trim();
                }
            } else if (item.type === 'FORM') {
                console.log(`[Sizzle Engine] RAW FORM OCR: "${rawText}"`);
                let cleanForm = rawText.replace(/BaseForm/i, "Base Form").replace(/AlternateForm/i, "Alternate Form");
                this.masterData.Identity.Form = cleanForm || this.masterData.Identity.Form;
            } else if (item.type === 'CONTEXT') {
                console.log(`[Sizzle Engine] RAW AREA OCR: "${rawText}"`);
                this.masterData.Context = rawText;
            }
        });
    }

    // ==========================================
    // STRIKE 2: AGGRESSIVE HEADER WASH
    // ==========================================
    async runStrikeTwoRescue() {
        console.log("⚠️ [Sizzle Engine] STRIKE 2: Initiating Aggressive Header Wash...");
        const anchor = this.masterData.GridAnchor;
        if (!anchor) return null;

        const hLoc = sizzleGridLocations.rows.Header;
        const cropTop = Math.max(0, anchor.y + Math.floor(anchor.height * (hLoc.top / 100)));
        const cropHeight = Math.floor(anchor.height * (Math.abs(hLoc.top) / 100));

        let src = cv.imread(this.rawImage);
        let roi = src.roi(new cv.Rect(anchor.x, cropTop, anchor.width, cropHeight));

        let blownUp = new cv.Mat();
        cv.resize(roi, blownUp, new cv.Size(0, 0), 2.5, 2.5, cv.INTER_CUBIC);

        cv.cvtColor(blownUp, blownUp, cv.COLOR_RGBA2GRAY);
        cv.threshold(blownUp, blownUp, 140, 255, cv.THRESH_BINARY_INV); 

        const tempCanvas = document.createElement('canvas');
        cv.imshow(tempCanvas, blownUp);

        const result = await globalTessWorker.recognize(tempCanvas, { tessedit_pageseg_mode: '6' });
        let rawText = result.data.text.trim();
        
        console.log(`[Sizzle Engine] STRIKE 2 OCR Result: "${rawText}"`);

        rawText = rawText.replace(/^[^a-zA-Z]+/, "").trim();

        const match = rawText.match(/(.+?)\s*(?:Lvl|Lvi|Lv|Level)\.?\s*([0-9OlI|]+)/i);
        if (match) {
            this.masterData.Identity.Champion = match[1].replace(/^[^a-zA-Z]+/, '').trim();
            let dirtyLevel = match[2].replace(/[Il|]/g, '1');
            this.masterData.Identity.Level = this.cleanOcrNumber(dirtyLevel);
        } else {
            this.masterData.Identity.Champion = rawText.split('\n')[0].trim();
        }

        src.delete(); roi.delete(); blownUp.delete();
        
        return this.masterData.Identity.Champion;
    }
}

window.SizzleScanner = SizzleScanner;
