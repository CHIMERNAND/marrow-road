export type Art = {
  grass: HTMLImageElement;
  dirt: HTMLImageElement;
  shambler: HTMLImageElement;
  runner: HTMLImageElement;
  brute: HTMLImageElement;
  warden: HTMLImageElement;
  towers: HTMLImageElement;
  shots: HTMLImageElement;
  impact: HTMLImageElement;
  props: HTMLImageElement;
  chapel: HTMLImageElement;
  gate: HTMLImageElement;
};

const FILES: Record<keyof Art, string> = {
  grass: "/game/tiles/grass.jpg",
  dirt: "/game/tiles/dirt.jpg",
  shambler: "/game/sheets/shambler.png",
  runner: "/game/sheets/runner.png",
  brute: "/game/sheets/brute.png",
  warden: "/game/sheets/warden.png",
  towers: "/game/sheets/towers.png",
  shots: "/game/sheets/shots.png",
  impact: "/game/sheets/impact.png",
  props: "/game/sheets/props.png",
  chapel: "/game/sheets/chapel.png",
  gate: "/game/sheets/gate.png",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

export async function loadArt(): Promise<Art> {
  const entries = await Promise.all(
    (Object.keys(FILES) as Array<keyof Art>).map(async (key) => {
      const img = await loadImage(FILES[key]);
      return [key, img] as const;
    }),
  );
  return Object.fromEntries(entries) as Art;
}
