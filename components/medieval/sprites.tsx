import { MEDIEVAL as C } from "./tokens";

/**
 * Original code-drawn pixel sprites. Each row is a string; each character is one pixel looked up
 * in the sprite's palette ("." is transparent). Swappable later for drawn art at the same sizes.
 */
type Sprite = { rows: string[]; palette: Record<string, string> };

const IRON = { i: C.stoneEdge, I: "#B9BEC9", h: "#E3E6EC" };

export const SPRITES = {
  knight: {
    rows: [
      ".....gg.....",
      "....gGg.....",
      "...iiiiii...",
      "..iIIhhIIi..",
      ".iIIhIIIIIi.",
      ".iIkkkkkkIi.",
      ".iIIIIIIIIi.",
      ".iIIkIIkIIi.",
      ".iIIIIIIIIi.",
      "..iIIIIIIi..",
      "...iiiiii...",
      "..rrRRRRrr.."
    ],
    palette: { ...IRON, k: "#111014", g: C.goldDark, G: C.gold, r: "#7A1E25", R: "#B8323C" }
  },
  coin: {
    rows: ["..oooo..", ".oyyyyo.", "oyywyyyo", "oywyyyyo", "oyyyyyyo", "oyyyyyyo", ".oyyyyo.", "..oooo.."],
    palette: { o: C.goldDark, y: C.gold, w: "#FFF3C4" }
  },
  gem: {
    rows: ["..dddd..", ".dlllgd.", "dllggggd", "dggggggd", ".dggggd.", "..dggd..", "...dd..."],
    palette: { d: "#1A5C32", l: "#B8F5C8", g: C.emerald }
  },
  tree: {
    rows: ["....dd....", "...dGGd...", "..dGGgGd..", ".dGGgGGGd.", "..dGGGGd..", ".dGgGGGGd.", "dGGGGGgGGd", ".dddGGddd.", "....bb....", "....bb....", "...bbbb..."],
    palette: { d: "#1E6B3A", G: "#3FA862", g: "#8BE29E", b: C.oak }
  },
  castle: {
    rows: ["ss.ss..ss.ss", "ssssssssssss", "sSSSSSSSSSSs", "sSSSSrrSSSSs", "sSSSSrrSSSSs", "sSSSddddSSSs", "sSSddddddSSs", "sSSdkdkdkSSs", "sSSdkdkdkSSs", "sSSdkdkdkSSs", "ssssssssssss"],
    palette: { s: "#3C3A47", S: "#8A8F9C", d: "#16131C", k: "#5A5E6B", r: "#B8323C" }
  },
  lock: {
    rows: ["..iiii..", ".i....i.", ".i....i.", "gggggggg", "gGGGGGGg", "gGGddGGg", "gGGddGGg", "gggggggg"],
    palette: { i: "#B9BEC9", g: C.goldDark, G: C.gold, d: C.stoneEdge }
  },
  check: {
    rows: ["......gg", ".....ggd", "g...ggd.", "gg.ggd..", ".gggd...", "..gd...."],
    palette: { g: C.emerald, d: "#1A5C32" }
  },
  cross: {
    rows: ["rr....rr", ".rr..rr.", "..rrrr..", "..rrrr..", ".rr..rr.", "rr....rr"],
    palette: { r: C.ruby }
  },
  scroll: {
    rows: [".oooooooo.", "oppppppppo", ".pkkkkkkp.", ".pppppppp.", ".pkkkkkp..", ".pppppppp.", ".pkkkkkkp.", "oppppppppo", ".oooooooo."],
    palette: { o: C.oakLight, p: C.parchment, k: C.inkMuted }
  },
  sword: {
    rows: [".......h", "......hI", ".....hI.", "....hI..", ".g.hI...", "..gI....", "..bg....", ".b..g..."],
    palette: { h: "#E3E6EC", I: "#9AA0AD", g: C.gold, b: C.oak }
  },
  banner: {
    rows: ["kRRRRRR.", "kRRGRRRR", "kRRRRRR.", "kRRRR...", "kRR.....", "k.......", "k.......", "kk......"],
    palette: { k: C.oakLight, R: "#B8323C", G: C.gold }
  }
} satisfies Record<string, Sprite>;

export type SpriteName = keyof typeof SPRITES;

/** Renders a sprite as crisp SVG rects; horizontal runs of one colour become one rect. */
export function PixelSprite({ name, scale = 4, title, className }: { name: SpriteName; scale?: number; title?: string; className?: string }) {
  const { rows, palette } = SPRITES[name] as Sprite;
  const width = Math.max(...rows.map((row) => row.length));
  const rects: React.ReactNode[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const key = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === key) end++;
      if (key !== "." && palette[key]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} fill={palette[key]} />);
      x = end;
    }
  });
  const labelled = Boolean(title);
  return (
    <svg
      className={className}
      width={width * scale}
      height={rows.length * scale}
      viewBox={`0 0 ${width} ${rows.length}`}
      shapeRendering="crispEdges"
      role={labelled ? "img" : undefined}
      aria-label={title}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      {rects}
    </svg>
  );
}
