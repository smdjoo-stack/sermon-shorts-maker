import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { outPath } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = name.replace(/[^\w.\-]/g, "");
  const p = outPath(safe);
  if (!fs.existsSync(p)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const stat = fs.statSync(p);
  const range = req.headers.get("range");
  const download = req.nextUrl.searchParams.get("download");
  const dispo = download ? `attachment; filename="${safe}"` : "inline";

  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    if (m) {
      const start = Number(m[1]);
      const end = m[2] ? Number(m[2]) : stat.size - 1;
      const chunk = fs.createReadStream(p, { start, end });
      return new NextResponse(chunk as unknown as ReadableStream, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": String(end - start + 1),
          "Content-Type": "video/mp4",
          "Content-Disposition": dispo,
        },
      });
    }
  }

  const stream = fs.createReadStream(p);
  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Length": String(stat.size),
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Disposition": dispo,
    },
  });
}
