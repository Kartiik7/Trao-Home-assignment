import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import KitLoaderWrapper from "./KitLoaderWrapper";

async function getKit(id: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return null;

  try {
    const res = await fetch(`http://localhost:5000/kits/${id}`, {
      headers: { Cookie: `token=${token}` },
      cache: "no-store", 
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch kit: ${res.status}`);
    }

    const data = await res.json();
    return data.kit;
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

export default async function KitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const kitDoc = await getKit(id);

  if (!kitDoc) {
    notFound();
  }

  // Delegate entirely to a Client Component to handle optimistic swaps
  return (
    <main className="min-h-screen bg-gray-50 pt-8 pb-20">
      <KitLoaderWrapper initialKitDoc={kitDoc} kitId={id} />
    </main>
  );
}
