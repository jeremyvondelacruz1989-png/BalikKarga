import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getBytes } from "@/lib/storage";

// Serves an uploaded file to: its owner, an admin, or (for delivery photos) either party to the booking.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const { id } = await params;
  const file = await db.storedFile.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });

  let allowed = user.role === "ADMIN" || file.ownerId === user.id;
  if (!allowed && file.bookingId) {
    const b = await db.booking.findUnique({ where: { id: file.bookingId }, select: { shipperId: true, truckerId: true } });
    allowed = !!b && (b.shipperId === user.id || b.truckerId === user.id);
  }
  if (!allowed) return new Response("Not found", { status: 404 });

  const bytes = await getBytes(file.storageKey);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${file.filename.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
