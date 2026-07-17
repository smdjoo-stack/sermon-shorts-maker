// Next.js calls register() once when the server boots.
//
// This is the safest possible moment to prune .data: no job exists yet, so
// nothing can be reading a file we are about to delete. The desktop app boots
// this on every launch, which is often enough to keep the folder in check.

export async function register() {
  // register() also runs on the edge runtime, which has no fs.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { cleanupData } = await import("./lib/cleanup");
  try {
    const { freedBytes, removed } = cleanupData();
    if (removed > 0) {
      console.log(`[cleanup] 오래된 파일 ${removed}개 정리, ${(freedBytes / 1048576).toFixed(0)}MB 확보`);
    }
  } catch (e) {
    // Housekeeping must never stop the app from starting.
    console.error("[cleanup] 정리 실패 (무시하고 계속):", (e as Error).message);
  }
}
