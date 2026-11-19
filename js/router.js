/**
 * Hash router nhẹ cho SPA không cần build.
 * Hỗ trợ: #/home, #/library, #/library/:level/:unit, #/word/:id,
 * #/flashcards, #/practice, #/test, #/progress.
 */

export function parseRoute(hashString = window.location.hash) {
  const raw = (hashString || "").replace(/^#/, "");
  const [pathPart, queryPart = ""] = raw.split("?");
  const query = new URLSearchParams(queryPart);
  const cleanPath = pathPart.replace(/\/+$/, "") || "/home";
  const segments = cleanPath.replace(/^\//, "").split("/").filter(Boolean);

  if (segments.length === 0 || segments[0] === "home") {
    return { name: "home", navKey: "home", params: {}, query };
  }

  if (segments[0] === "library") {
    if (segments.length >= 3) {
      return {
        name: "library-unit",
        navKey: "library",
        params: {
          level: decodeURIComponent(segments[1]).toUpperCase(),
          unit: Number(segments[2]),
        },
        query,
      };
    }
    return { name: "library", navKey: "library", params: {}, query };
  }

  if (segments[0] === "word" && segments[1]) {
    return {
      name: "word-detail",
      navKey: "library",
      params: { id: decodeURIComponent(segments[1]) },
      query,
    };
  }

  if (segments[0] === "flashcards") {
    return { name: "flashcards", navKey: "flashcards", params: {}, query };
  }

  if (segments[0] === "practice") {
    return { name: "practice", navKey: "practice", params: {}, query };
  }

  if (segments[0] === "test") {
    return { name: "test", navKey: "test", params: {}, query };
  }

  if (segments[0] === "progress") {
    return { name: "progress", navKey: "progress", params: {}, query };
  }

  return { name: "home", navKey: "home", params: {}, query };
}

export function navigateTo(hashPath) {
  const target = hashPath.startsWith("#") ? hashPath : `#${hashPath}`;
  if (window.location.hash === target) {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = target;
  }
}

export function startRouter(onRoute) {
  const handle = () => onRoute(parseRoute(window.location.hash));
  window.addEventListener("hashchange", handle);
  if (!window.location.hash) {
    window.history.replaceState(null, "", "#/home");
  }
  handle();
  return () => window.removeEventListener("hashchange", handle);
}
