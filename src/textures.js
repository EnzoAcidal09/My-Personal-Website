import * as THREE from "../vendor/three.module.js";

/* Small deterministic RNG so the island looks the same on every visit. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTexture(width, height, draw, options = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  ctx.imageSmoothingEnabled = false;
  draw(ctx, width, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (options.smoothMin) {
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(8, options.anisotropy || 8);
  } else {
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
  }
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = options.wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = texture.wrapS;
  if (options.repeat) texture.repeat.set(options.repeat[0], options.repeat[1]);
  texture.needsUpdate = true;
  return texture;
}

const PALETTE = {
  grass: "#6daa54",
  grassDark: "#57893f",
  grassLight: "#84c266",
  grassPale: "#9ad07a",
  path: "#d8b17a",
  pathEdge: "#b4895b",
  pathLight: "#eccf9e",
  sand: "#e7d3a1",
  sandDark: "#cdb47f",
  stone: "#94b0c2",
  stoneDark: "#5f6a7d",
  stoneLight: "#b8c9d6",
  ink: "#1a1c2c",
};

export const WORLD_SIZE = 44;
export const TILE_PATH_WIDTH = 3;

/**
 * The whole island top: grass, the crossing paths, the plaza and lots of
 * hand-placed-ish noise. 1024px over 44 world units.
 */
export function terrainTexture() {
  const rng = mulberry32(20261103);
  const size = 1024;
  const scale = size / WORLD_SIZE;
  const toPx = (v) => (v + WORLD_SIZE / 2) * scale;

  return makeTexture(
    size,
    size,
    (ctx) => {
      // base grass
      ctx.fillStyle = PALETTE.grass;
      ctx.fillRect(0, 0, size, size);

      // broad darker / lighter patches
      for (let i = 0; i < 46; i += 1) {
        const x = rng() * size;
        const y = rng() * size;
        const r = (10 + rng() * 46) * scale * 0.08 + 20;
        ctx.globalAlpha = 0.08 + rng() * 0.06;
        ctx.fillStyle = rng() > 0.5 ? PALETTE.grassDark : PALETTE.grassLight;
        ctx.beginPath();
        ctx.ellipse(x, y, r, r * (0.5 + rng() * 0.6), rng() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // noise speckles
      for (let i = 0; i < 9000; i += 1) {
        const roll = rng();
        ctx.fillStyle =
          roll > 0.72
            ? PALETTE.grassDark
            : roll > 0.44
              ? PALETTE.grassLight
              : PALETTE.grassPale;
        ctx.globalAlpha = 0.16 + rng() * 0.24;
        const s = 2 + Math.floor(rng() * 3);
        ctx.fillRect(rng() * size, rng() * size, s, s);
      }
      ctx.globalAlpha = 1;

      // little grass blades
      for (let i = 0; i < 700; i += 1) {
        const x = Math.floor(rng() * size);
        const y = Math.floor(rng() * size);
        ctx.fillStyle = rng() > 0.5 ? PALETTE.grassDark : PALETTE.grassLight;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, y, 2, 2 + Math.floor(rng() * 4));
      }
      ctx.globalAlpha = 1;

      const pathW = TILE_PATH_WIDTH * scale;
      const isOnPath = (x, y) => {
        // world-space helper used only for decoration exclusion
        const wx = x / scale - WORLD_SIZE / 2;
        const wy = y / scale - WORLD_SIZE / 2;
        if (Math.abs(wx) < 2.2 || Math.abs(wy) < 2.2) return true;
        if (Math.abs(Math.abs(wx) - 14) < 2 && wy > -11 && wy < 11) return true;
        return Math.hypot(wx, wy) < 5.4;
      };

      const drawPathRect = (x, y, w, h) => {
        ctx.fillStyle = PALETTE.pathEdge;
        ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
        ctx.fillStyle = PALETTE.path;
        ctx.fillRect(x, y, w, h);
        // worn dashes
        const horizontal = w > h;
        const length = Math.max(w, h);
        for (let i = 0; i < length; i += 16) {
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = i % 32 === 0 ? PALETTE.pathLight : PALETTE.sandDark;
          if (horizontal) ctx.fillRect(x + i, y + 4 + Math.floor(rng() * (h - 8)), 7, 4);
          else ctx.fillRect(x + 4 + Math.floor(rng() * (w - 8)), y + i, 4, 7);
        }
        ctx.globalAlpha = 1;
      };

      // main cross
      drawPathRect(toPx(-18), toPx(0) - pathW / 2, toPx(18) - toPx(-18), pathW);
      drawPathRect(toPx(0) - pathW / 2, toPx(-18), pathW, toPx(18) - toPx(-18));

      // branches to the four landmarks
      drawPathRect(toPx(-14) - pathW / 2, toPx(-9.6), pathW, toPx(-0.0) - toPx(-9.6));
      drawPathRect(toPx(14) - pathW / 2, toPx(-9.6), pathW, toPx(-0.0) - toPx(-9.6));
      drawPathRect(toPx(-14) - pathW / 2, toPx(0), pathW, toPx(9.6) - toPx(0));
      drawPathRect(toPx(14) - pathW / 2, toPx(0), pathW, toPx(9.6) - toPx(0));

      // plaza
      const cx = toPx(0);
      const cy = toPx(0);
      const rOuter = 5.1 * scale;
      const rInner = 4.5 * scale;
      ctx.fillStyle = PALETTE.stoneDark;
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.stone;
      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.fill();

      // stone tiles
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
      ctx.clip();
      const tile = 1.15 * scale;
      ctx.strokeStyle = "rgba(95, 106, 125, 0.55)";
      ctx.lineWidth = 3;
      for (let gx = cx - rInner; gx < cx + rInner; gx += tile) {
        ctx.beginPath();
        ctx.moveTo(gx, cy - rInner);
        ctx.lineTo(gx, cy + rInner);
        ctx.stroke();
      }
      for (let gy = cy - rInner; gy < cy + rInner; gy += tile) {
        ctx.beginPath();
        ctx.moveTo(cx - rInner, gy);
        ctx.lineTo(cx + rInner, gy);
        ctx.stroke();
      }
      for (let i = 0; i < 260; i += 1) {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = rng() > 0.5 ? PALETTE.stoneLight : PALETTE.stoneDark;
        const s = 2 + Math.floor(rng() * 5);
        ctx.fillRect(
          cx - rInner + rng() * rInner * 2,
          cy - rInner + rng() * rInner * 2,
          s,
          s,
        );
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // ring around the plaza
      ctx.strokeStyle = PALETTE.stoneLight;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, rOuter - 6, 0, Math.PI * 2);
      ctx.stroke();

      // centre emblem: a chunky compass star
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = PALETTE.ink;
      ctx.fillRect(-7, -7, 14, 14);
      ctx.fillStyle = "#ffcd75";
      for (let i = 0; i < 4; i += 1) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 2);
        ctx.fillRect(-4, -34, 8, 26);
        ctx.fillRect(-9, -24, 18, 7);
        ctx.restore();
      }
      ctx.fillStyle = "#41a6f6";
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = "#f4f4f4";
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();

      // flowers
      const flowerColors = ["#ffcd75", "#f4f4f4", "#ef7d57", "#73eff7", "#b13e53"];
      for (let i = 0; i < 130; i += 1) {
        const x = 40 + rng() * (size - 80);
        const y = 40 + rng() * (size - 80);
        if (isOnPath(x, y)) continue;
        const color = flowerColors[Math.floor(rng() * flowerColors.length)];
        ctx.fillStyle = color;
        const s = 3 + Math.floor(rng() * 3);
        ctx.globalAlpha = 0.85;
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = "#ffcd75";
        ctx.fillRect(x + 1, y + 1, 1, 1);
      }
      ctx.globalAlpha = 1;

      // sandy coastline ring (the box sides continue it)
      const rim = 1.5 * scale;
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(0, 0, size, rim);
      ctx.fillRect(0, size - rim, size, rim);
      ctx.fillRect(0, 0, rim, size);
      ctx.fillRect(size - rim, 0, rim, size);
      for (let i = 0; i < 2600; i += 1) {
        const side = Math.floor(rng() * 4);
        let x;
        let y;
        if (side === 0) {
          x = rng() * size;
          y = rng() * rim;
        } else if (side === 1) {
          x = rng() * size;
          y = size - rng() * rim;
        } else if (side === 2) {
          x = rng() * rim;
          y = rng() * size;
        } else {
          x = size - rng() * rim;
          y = rng() * size;
        }
        ctx.fillStyle = rng() > 0.5 ? PALETTE.sandDark : "#f3e4bb";
        ctx.globalAlpha = 0.5;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.globalAlpha = 1;

      // subtle darkening at the very edge
      const edge = ctx.createLinearGradient(0, 0, 0, 24);
      edge.addColorStop(0, "rgba(26, 28, 44, 0.35)");
      edge.addColorStop(1, "rgba(26, 28, 44, 0)");
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, size, 24);
    },
    { smoothMin: true, anisotropy: 8 },
  );
}

/** A floating pixel sign, e.g. "ABOUT". */
export function labelTexture(text, accent = "#41a6f6", textColor = "#f4f4f4") {
  const fontPx = 32;
  const padX = 22;
  const padY = 15;
  const measureCanvas = document.createElement("canvas");
  const measureCtx = measureCanvas.getContext("2d");
  measureCtx.font = `${fontPx}px "Press Start 2P", monospace`;
  const textWidth = Math.ceil(measureCtx.measureText(text).width);

  const width = textWidth + padX * 2 + 16;
  const height = fontPx + padY * 2 + 16;

  return makeTexture(width, height, (ctx) => {
    ctx.clearRect(0, 0, width, height);
    // frame
    ctx.fillStyle = "#1a1c2c";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = accent;
    ctx.fillRect(4, 4, width - 8, height - 8);
    ctx.fillStyle = "#1a1c2c";
    ctx.fillRect(9, 9, width - 18, height - 18);
    // corner pixels
    ctx.fillStyle = accent;
    ctx.fillRect(13, 13, 5, 5);
    ctx.fillRect(width - 18, 13, 5, 5);
    ctx.fillRect(13, height - 18, 5, 5);
    ctx.fillRect(width - 18, height - 18, 5, 5);
    // text
    ctx.font = `${fontPx}px "Press Start 2P", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillText(text, width / 2 + 3, height / 2 + 5);
    ctx.fillStyle = textColor;
    ctx.fillText(text, width / 2, height / 2 + 2);
  });
}

export function glowTexture() {
  return makeTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255, 244, 200, 1)");
    g.addColorStop(0.25, "rgba(255, 215, 130, 0.9)");
    g.addColorStop(0.6, "rgba(255, 190, 90, 0.35)");
    g.addColorStop(1, "rgba(255, 190, 90, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

export function dustTexture() {
  return makeTexture(16, 16, (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = "rgba(255, 244, 220, 0.16)";
    ctx.fillRect(4, 4, 8, 8);
    ctx.fillStyle = "rgba(255, 244, 220, 0.4)";
    ctx.fillRect(5, 5, 6, 6);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(6, 6, 4, 4);
  });
}

/** Arcade screen: animated colour bars + pixel sparkle, redrawn at low Hz. */
export function createScreenTexture(accent, seed) {
  const rng = mulberry32(seed);
  const stars = Array.from({ length: 34 }, () => ({
    x: Math.floor(rng() * 92) + 2,
    y: Math.floor(rng() * 30) + 2,
    c: rng() > 0.5 ? "#73eff7" : rng() > 0.5 ? "#ffcd75" : "#f4f4f4",
    s: rng() > 0.7 ? 3 : 2,
  }));
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  let last = -1;
  const redraw = (time) => {
    const tick = Math.floor(time * 8);
    if (tick === last) return;
    last = tick;
    ctx.fillStyle = "#0b0d17";
    ctx.fillRect(0, 0, 96, 64);

    // starfield
    for (const star of stars) {
      ctx.fillStyle = star.c;
      ctx.globalAlpha = 0.35 + 0.55 * ((Math.sin(tick * 0.7 + star.x) + 1) / 2);
      ctx.fillRect(star.x, star.y, star.s, star.s);
    }
    ctx.globalAlpha = 1;

    // scrolling colour bars
    for (let i = 0; i < 4; i += 1) {
      const y = ((tick * 7 + i * 17) % 72) - 8;
      ctx.fillStyle = i % 2 === 0 ? accent : "#ffcd75";
      ctx.globalAlpha = 0.75;
      ctx.fillRect(0, y, 96, 3);
    }
    ctx.globalAlpha = 1;

    // scanline
    const scan = (tick * 9) % 64;
    ctx.fillStyle = "rgba(11, 13, 23, 0.55)";
    ctx.fillRect(0, scan, 96, 6);

    // score-ish pixels
    for (let i = 0; i < 8; i += 1) {
      ctx.fillStyle = i % 3 === 0 ? "#a7f070" : "#41a6f6";
      ctx.fillRect(6 + i * 9, 51, 6, 6);
    }

    // title block
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(8, 8, 32, 4);
    ctx.fillRect(8, 15, 20, 3);

    texture.needsUpdate = true;
  };

  redraw(0);
  return { texture, redraw };
}

/** 16×16 pixel portrait used in the About window. */
export function avatarDataURL(size = 96) {
  const map = [
    "................",
    ".....hhhhhh.....",
    "....hhhhhhhh....",
    "...hhhhhhhhhh...",
    "...hhsssssshh...",
    "...hssssssssh...",
    "...ssessssess...",
    "...ssssssssss...",
    "....sssmmsss....",
    ".....ssssss.....",
    "...ggggccgggg...",
    "..gggggggggggg..",
    ".gggggGGGGggggg.",
    ".gggggggggggggg.",
    "..ggg......ggg..",
    "................",
  ];
  const colors = {
    h: "#3b2b3b",
    s: "#e8b796",
    e: "#1a1c2c",
    m: "#b13e53",
    g: "#38b764",
    G: "#257179",
    c: "#f4f4f4",
  };
  const px = size / 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#29366f";
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const ch = map[y][x];
      if (ch === ".") continue;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
  return canvas.toDataURL("image/png");
}
