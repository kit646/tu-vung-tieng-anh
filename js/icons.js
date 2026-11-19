/**
 * Bộ icon SVG đồng nhất (nét 1.75px, không dùng emoji làm icon hệ thống).
 */

function svg(pathMarkup, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathMarkup}</svg>`;
}

export function iconHome(size = 20) {
  return svg(
    '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>',
    size
  );
}

export function iconBook(size = 20) {
  return svg(
    '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    size
  );
}

export function iconCards(size = 20) {
  return svg(
    '<rect x="3" y="5" width="14" height="16" rx="2"/><path d="M7 3h12a2 2 0 0 1 2 2v13"/>',
    size
  );
}

export function iconCheckSquare(size = 20) {
  return svg(
    '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    size
  );
}

export function iconAward(size = 20) {
  return svg(
    '<circle cx="12" cy="8.5" r="5.5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/>',
    size
  );
}

export function iconBarChart(size = 20) {
  return svg(
    '<path d="M4 20h16"/><rect x="6" y="12" width="3" height="6" rx="1"/><rect x="10.5" y="7" width="3" height="11" rx="1"/><rect x="15" y="4" width="3" height="14" rx="1"/>',
    size
  );
}

export function iconVolume(size = 20) {
  return svg(
    '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    size
  );
}

export function iconSearch(size = 18) {
  return svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', size);
}

export function iconClose(size = 18) {
  return svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', size);
}

export function iconSun(size = 20) {
  return svg(
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/>',
    size
  );
}

export function iconMoon(size = 20) {
  return svg('<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/>', size);
}

export function iconArrowLeft(size = 18) {
  return svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>', size);
}

export function iconArrowRight(size = 18) {
  return svg('<path d="m12 5 7 7-7 7"/><path d="M5 12h14"/>', size);
}

export function iconFlame(size = 18) {
  return svg(
    '<path d="M12 2c.5 3.5-2.5 5.5-2.5 8.5a2.5 2.5 0 0 0 5 0c0-1.5-.5-2.5-1-3.5 3 1.5 5 4.5 5 8a6.5 6.5 0 1 1-13 0c0-4.5 3.5-8.5 6.5-13Z"/>',
    size
  );
}

export function iconSync(size = 18) {
  return svg(
    '<path d="M21 12a9 9 0 0 0-15.5-6.3L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15.5 6.3L21 16"/><path d="M16 16h5v5"/>',
    size
  );
}

export function iconCopy(size = 18) {
  return svg(
    '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    size
  );
}
