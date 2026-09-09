const CW_TOTAL = 1200, CH_TOTAL = 700;
const BLEED = 20;

const GRID_W = 480, GRID_H = 640;
const COLS = 8, ROWS = 8;
const cellW = GRID_W / COLS, cellH = GRID_H / ROWS;

let rightX, rightY;
let leftX0, leftY0, leftW, leftH;

const VW = 640, VH = 480;

let video;
let faceMesh;
let faces = [];

let mainG;

let gridSourceG;
let rightMaskG;
let rightFaceLayerG;


let bgVideoG;
let bgBlurG;
let bgClearMaskedG;
let bgNoiseMaskSmallG;

let rightCoverScale, rightDrawW, rightDrawH, rightOffX, rightOffY;
let bgCoverScale, bgDrawW, bgDrawH, bgOffX, bgOffY;

let skinColor = null;

let currentStage = 4;


let slotOfSource = [];
let rankOfCell = [];
let cellLevel = [];
let correctCountTarget = 0;


let uiLineText = "fragment received. model updated. autonomy index: 75%";

let floatingTexts = [];
let statusMessages = [
  "Identity Verified", "Deviation Detected", "Correcting...",
  "Calculating...", "Updating...", "Accepted...", "Approved...",
  "Subject detected...", "Collecting landmarks...", "Comparing against dataset...",
  "Deviation detected.", "Correcting proportions...", "Updating identity...",
  "Rendering output...", "Saving profile...", "Variance: Reduced",
  "Individuality: Removed", "Compliance: Increased", "Accepted by Model",
  "Target: Average"
];

let featureBoxes = [];
const MAX_FEATURE_BOXES = 4;

let faceOvalIdx = [10,338,297,332,284,251,389,356,454,323,361,288,397,
  365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,
  162,21,54,103,67,109];

const FEATURE_GROUPS = [
  { name: "EYE_L", idx: [33,133,160,159,158,157,173,153,144,145,246] },
  { name: "EYE_R", idx: [263,362,387,386,385,384,398,380,374,373,466] },
  { name: "NOSE",  idx: [1,2,98,327,168,197,5,4,45,275,195] },
  { name: "MOUTH", idx: [61,291,78,308,13,14,87,317,0,17,178,402] }
];

function preload() {
  faceMesh = ml5.faceMesh({ maxFaces: 1, refineLandmarks: false, flipHorizontal: false });
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture({ video: { width: VW, height: VH } });
  video.size(VW, VH);
  video.hide();

  rightX = CW_TOTAL - BLEED - GRID_W;
  rightY = (CH_TOTAL - GRID_H) / 2;

  leftX0 = BLEED;
  leftY0 = BLEED;
  let leftGap = 30;
  leftW = rightX - leftGap - leftX0;
  leftH = CH_TOTAL - 2 * BLEED;

  mainG = createGraphics(CW_TOTAL, CH_TOTAL);
  mainG.textFont('monospace');

  gridSourceG = createGraphics(GRID_W, GRID_H);
  rightMaskG = createGraphics(GRID_W, GRID_H);
  rightFaceLayerG = createGraphics(GRID_W, GRID_H);

 
  bgVideoG = createGraphics(CW_TOTAL, CH_TOTAL);
  bgBlurG = createGraphics(CW_TOTAL, CH_TOTAL);
  bgClearMaskedG = createGraphics(CW_TOTAL, CH_TOTAL);
  bgNoiseMaskSmallG = createGraphics(70, 42);

  rightCoverScale = max(GRID_W / VW, GRID_H / VH);
  rightDrawW = VW * rightCoverScale;
  rightDrawH = VH * rightCoverScale;
  rightOffX = (GRID_W - rightDrawW) / 2;
  rightOffY = (GRID_H - rightDrawH) / 2;

  bgCoverScale = max(CW_TOTAL / VW, CH_TOTAL / VH);
  bgDrawW = VW * bgCoverScale;
  bgDrawH = VH * bgCoverScale;
  bgOffX = (CW_TOTAL - bgDrawW) / 2;
  bgOffY = (CH_TOTAL - bgDrawH) / 2;

  faceMesh.detectStart(video, gotFaces);

  let slots = [];
  for (let i = 0; i < COLS * ROWS; i++) slots.push(i);
  slotOfSource = shuffle(slots);

  let order = shuffle([...Array(COLS * ROWS).keys()]);
  rankOfCell = new Array(COLS * ROWS);
  order.forEach((cellIdx, i) => { rankOfCell[cellIdx] = i; });

  cellLevel = new Array(COLS * ROWS).fill(0);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function gotFaces(results) {
  faces = results;
}

function videoPtToRight(vx, vy) {
  let ux = vx * rightCoverScale + rightOffX;
  let uy = vy * rightCoverScale + rightOffY;
  return { x: GRID_W - ux, y: uy };
}


function videoPtToCanvas(vx, vy) {
  let ux = vx * bgCoverScale + bgOffX;
  let uy = vy * bgCoverScale + bgOffY;
  return { x: CW_TOTAL - ux, y: uy };
}

function draw() {
  updateGridSource();
  updateBackgroundMirror();

  mainG.background(8);
  drawBackground(mainG);
  updateFeatureBoxes();
  drawFeatureBoxes(mainG);
  drawRightPanel(mainG);
  drawUILine(mainG);
  updateFloatingTexts();
  drawFloatingTexts(mainG);
  drawCropMarks(mainG);

  background(0);
  let scaleFactor = min(width / CW_TOTAL, height / CH_TOTAL);
  let dw = CW_TOTAL * scaleFactor;
  let dh = CH_TOTAL * scaleFactor;
  let dx = (width - dw) / 2;
  let dy = (height - dh) / 2;
  image(mainG, dx, dy, dw, dh);
}

// 
// 
// 
function updateGridSource() {
  gridSourceG.push();
  gridSourceG.translate(GRID_W, 0);
  gridSourceG.scale(-1, 1);
  gridSourceG.image(video, rightOffX, rightOffY, rightDrawW, rightDrawH);
  gridSourceG.pop();

  if (faces.length > 0) {
    let kp = faces[0].keypoints;
    updateSkinColor(kp);

    let pts = faceOvalIdx.map(idx => videoPtToRight(kp[idx].x, kp[idx].y));
    let cx0 = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    let cy0 = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    let scaleOut = 1.08;
    let expanded = pts.map(p => ({
      x: cx0 + (p.x - cx0) * scaleOut,
      y: cy0 + (p.y - cy0) * scaleOut
    }));

    rightMaskG.clear();
    rightMaskG.noStroke();
    rightMaskG.fill(255);
    rightMaskG.beginShape();
    expanded.forEach(p => rightMaskG.vertex(p.x, p.y));
    rightMaskG.endShape(CLOSE);
    rightMaskG.filter(BLUR, 16);

    rightFaceLayerG.clear();
    rightFaceLayerG.image(gridSourceG, 0, 0);
    rightFaceLayerG.filter(BLUR, 26);
    if (skinColor) {
      rightFaceLayerG.noStroke();
      rightFaceLayerG.fill(skinColor.r, skinColor.g, skinColor.b, 0.15 * 255);
      rightFaceLayerG.rect(0, 0, GRID_W, GRID_H);
    }
    rightFaceLayerG.drawingContext.save();
    rightFaceLayerG.drawingContext.globalCompositeOperation = 'destination-in';
    rightFaceLayerG.image(rightMaskG, 0, 0);
    rightFaceLayerG.drawingContext.restore();

    gridSourceG.image(rightFaceLayerG, 0, 0);
  }
}

// 
// 
// 
function drawRightPanel(g) {
  for (let c = 0; c < COLS * ROWS; c++) {
    let targetLevel = rankOfCell[c] < correctCountTarget ? 1 : 0;
    cellLevel[c] = lerp(cellLevel[c], targetLevel, 0.06);
  }

  g.push();
  g.translate(rightX, rightY);

  for (let c = 0; c < COLS * ROWS; c++) {
    let homeCol = c % COLS, homeRow = floor(c / COLS);
    let homeX = homeCol * cellW, homeY = homeRow * cellH;

    let slot = slotOfSource[c];
    let slotCol = slot % COLS, slotRow = floor(slot / COLS);
    let slotX = slotCol * cellW, slotY = slotRow * cellH;

    let level = cellLevel[c];
    let dx = lerp(slotX, homeX, level);
    let dy = lerp(slotY, homeY, level);

    let piece = gridSourceG.get(homeX, homeY, cellW, cellH);
    g.image(piece, dx, dy, cellW, cellH);

    let labelAlpha = (1 - level) * 170;
    if (labelAlpha > 4) {
      g.noStroke();
      g.fill(255, labelAlpha);
      g.textSize(7);
      g.textAlign(LEFT, TOP);
      g.text(`${homeCol},${homeRow}`, dx + 2, dy + 2);
    }
  }

  g.pop();

  g.noFill();
  g.stroke(255, 60);
  g.strokeWeight(1);
  g.rect(rightX, rightY, GRID_W, GRID_H);
}

function drawUILine(g) {
  let barY = rightY + GRID_H + 4;
  g.noStroke();
  g.fill(0, 0, 0, 190);
  g.rect(rightX, barY, GRID_W, 24);

  g.fill(190, 255, 210);
  g.textSize(11);
  g.textAlign(LEFT, TOP);
  g.text(uiLineText, rightX + 8, barY + 6);
}

// 
// 
// 
function updateBackgroundMirror() {
  bgVideoG.clear();
  bgVideoG.push();
  bgVideoG.translate(CW_TOTAL, 0);
  bgVideoG.scale(-1, 1);
  bgVideoG.image(video, bgOffX, bgOffY, bgDrawW, bgDrawH);
  bgVideoG.pop();

  bgBlurG.clear();
  bgBlurG.image(bgVideoG, 0, 0);
  bgBlurG.filter(BLUR, 11);

  bgNoiseMaskSmallG.clear();
  bgNoiseMaskSmallG.noStroke();
  let t = frameCount * 0.003;
  let blocksX = 16, blocksY = 10;
  let bw = bgNoiseMaskSmallG.width / blocksX;
  let bh = bgNoiseMaskSmallG.height / blocksY;
  for (let i = 0; i < blocksX; i++) {
    for (let j = 0; j < blocksY; j++) {
      let n = noise(i * 0.32, j * 0.32, t);
      let bright = n > 0.6 ? map(n, 0.6, 1, 0, 255) : 0;
      bgNoiseMaskSmallG.fill(255, bright);
      bgNoiseMaskSmallG.rect(i * bw, j * bh, bw, bh);
    }
  }
  bgNoiseMaskSmallG.filter(BLUR, 2);

  bgClearMaskedG.clear();
  bgClearMaskedG.image(bgVideoG, 0, 0);
  bgClearMaskedG.drawingContext.save();
  bgClearMaskedG.drawingContext.globalCompositeOperation = 'destination-in';
  bgClearMaskedG.image(bgNoiseMaskSmallG, 0, 0, CW_TOTAL, CH_TOTAL);
  bgClearMaskedG.drawingContext.restore();
}

function drawBackground(g) {
  g.push();
  g.tint(255, 140);   // 第二个数字 0~255，越小背景越淡
  g.image(bgBlurG, 0, 0);
  g.image(bgClearMaskedG, 0, 0);
  g.pop();
  g.noTint();
}

function updateFeatureBoxes() {
  if (faces.length > 0 && featureBoxes.length < MAX_FEATURE_BOXES && random() < 0.02) {
    let kp = faces[0].keypoints;
    let group = random(FEATURE_GROUPS);
    let pts = group.idx.map(idx => videoPtToCanvas(kp[idx].x, kp[idx].y));

    let xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    let minX = min(xs), maxX = max(xs), minY = min(ys), maxY = max(ys);
    let cx0 = (minX + maxX) / 2, cy0 = (minY + maxY) / 2;
    let bw = (maxX - minX) * 1.6 + 20;
    let bh = (maxY - minY) * 1.6 + 16;

    let sx = constrain(cx0 - bw / 2, 0, CW_TOTAL - 4);
    let sy = constrain(cy0 - bh / 2, 0, CH_TOTAL - 4);
    let sw = constrain(bw, 8, CW_TOTAL - sx);
    let sh = constrain(bh, 8, CH_TOTAL - sy);

    let dispW = random(120, 190);
    let dispH = dispW * (sh / sw);

    let x = leftX0 + random(0, max(1, leftW - dispW));
    let y = leftY0 + random(0, max(1, leftH - dispH - 18));

    featureBoxes.push({
      name: group.name,
      sx, sy, sw, sh,
      x, y, w: dispW, h: dispH,
      label: `${group.name}  x:${floor(sx)} y:${floor(sy)}  conf:${random(0.82, 0.99).toFixed(2)}`,
      life: 0,
      maxLife: random(150, 260),
      alpha: 0
    });
  }

  featureBoxes.forEach(b => {
    b.life++;
    if (b.life < b.maxLife * 0.15) b.alpha = map(b.life, 0, b.maxLife * 0.15, 0, 255);
    else if (b.life > b.maxLife * 0.85) b.alpha = map(b.life, b.maxLife * 0.85, b.maxLife, 255, 0);
    else b.alpha = 255;
  });
  featureBoxes = featureBoxes.filter(b => b.life < b.maxLife);
}

function drawFeatureBoxes(g) {
  featureBoxes.forEach(b => {
    let a = b.alpha / 255;
    if (a <= 0.01) return;

    g.drawingContext.save();
    g.drawingContext.shadowColor = `rgba(0,0,0,${0.55 * a})`;
    g.drawingContext.shadowBlur = 18;
    g.drawingContext.shadowOffsetX = 3;
    g.drawingContext.shadowOffsetY = 6;
    g.noStroke();
    g.fill(12, 12, 12, a * 230);
    g.rect(b.x - 4, b.y - 4, b.w + 8, b.h + 24);
    g.drawingContext.restore();

    let crop = bgVideoG.get(int(b.sx), int(b.sy), int(b.sw), int(b.sh));
    g.push();
    g.tint(255, a * 255);
    g.image(crop, b.x, b.y, b.w, b.h);
    g.noTint();
    g.pop();

    g.noFill();
    g.stroke(255, a * 190);
    g.strokeWeight(1);
    g.rect(b.x, b.y, b.w, b.h);

    g.noStroke();
    g.fill(180, 255, 200, a * 235);
    g.textSize(10);
    g.textAlign(LEFT, TOP);
    g.text(b.label, b.x, b.y + b.h + 5);
  });
}

// 
// 
// 
function updateSkinColor(kp) {
  let sampleIdx = [10, 50, 280, 152, 4];
  let r = 0, g = 0, b = 0, n = 0;
  sampleIdx.forEach(idx => {
    let p = kp[idx];
    let c = video.get(int(p.x), int(p.y));
    r += c[0]; g += c[1]; b += c[2]; n++;
  });
  let newColor = { r: r / n, g: g / n, b: b / n };
  if (!skinColor) skinColor = newColor;
  else {
    skinColor.r = lerp(skinColor.r, newColor.r, 0.05);
    skinColor.g = lerp(skinColor.g, newColor.g, 0.05);
    skinColor.b = lerp(skinColor.b, newColor.b, 0.05);
  }
}

function updateFloatingTexts() {
  let spawnChance = 0.02;
  if (random() < spawnChance) {
    let str = random(statusMessages);
    let charColors = str.split('').map(() => (random() < 0.5 ? 0 : 255));
    floatingTexts.push({
      text: str,
      charColors: charColors,
      x: random(leftX0 + 10, CW_TOTAL - BLEED - 160),
      y: random(leftY0 + 10, CH_TOTAL - BLEED - 20),
      life: 0, maxLife: random(90, 170), alpha: 0
    });
  }
  floatingTexts.forEach(t => {
    t.life++;
    if (t.life < t.maxLife * 0.2) t.alpha = map(t.life, 0, t.maxLife * 0.2, 0, 255);
    else if (t.life > t.maxLife * 0.8) t.alpha = map(t.life, t.maxLife * 0.8, t.maxLife, 255, 0);
    else t.alpha = 255;
  });
  floatingTexts = floatingTexts.filter(t => t.life < t.maxLife);
}

function drawFloatingTexts(g) {
  g.textSize(13);
  g.textAlign(LEFT, TOP);
  floatingTexts.forEach(t => {
    let x = t.x;
    for (let i = 0; i < t.text.length; i++) {
      let ch = t.text[i];
      let c = t.charColors[i];
      g.fill(c, c, c, t.alpha);
      g.text(ch, x, t.y);
      x += g.textWidth(ch);
    }
  });
}

function drawCropMarks(g) {
  g.stroke(255, 120);
  g.strokeWeight(1);
  let m = 10;
  let corners = [
    [BLEED, BLEED], [CW_TOTAL - BLEED, BLEED],
    [BLEED, CH_TOTAL - BLEED], [CW_TOTAL - BLEED, CH_TOTAL - BLEED]
  ];
  corners.forEach(([x, y]) => {
    g.line(x - m, y, x + m, y);
    g.line(x, y - m, x, y + m);
  });
}

function keyPressed() {
  const stageFractions = { 4: 0, 3: 0.35, 2: 0.7, 1: 1.0 };
  const autonomyPct = { 4: 75, 3: 50, 2: 25, 1: 0 };
  if (key === '1' || key === '2' || key === '3' || key === '4') {
    currentStage = Number(key);
    correctCountTarget = round(stageFractions[currentStage] * COLS * ROWS);
    uiLineText = `fragment received. model updated. autonomy index: ${autonomyPct[currentStage]}%`;
  }
}