// Small settings store for the browser side.
//
// Inside the desktop app this goes through Electron (window.shortsStore) rather
// than localStorage. It has to: the server binds a free port on every launch,
// and browser storage is scoped to the origin — port included — so each launch
// would start with an empty store and the user would re-paste their API key
// every single time.
//
// In `npm run dev` there is no bridge, so fall back to localStorage.

interface ShortsStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
}

function bridge(): ShortsStore | null {
  if (typeof window === "undefined") return null;
  return (window as unknown as { shortsStore?: ShortsStore }).shortsStore ?? null;
}

export async function loadSetting(key: string): Promise<string | null> {
  const b = bridge();
  if (b) {
    try {
      return await b.get(key);
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export async function saveSetting(key: string, value: string): Promise<void> {
  const b = bridge();
  if (b) {
    try {
      await b.set(key, value);
    } catch {
      /* not worth interrupting the user over */
    }
    return;
  }
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch {
    /* private mode / storage disabled */
  }
}
