import { notFound } from "next/navigation";
import KitBuilder from "../../../components/builder/KitBuilder";
import { cookies } from "next/headers";

async function getKit(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return null;

  try {
    const res = await fetch(`http://localhost:5000/kits/${id}`, {
      headers: {
        Cookie: `token=${token}`,
      },
      // In Next.js App Router, SSR fetching with dynamic cookies
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

export default async function KitPage({ params }: { params: { id: string } }) {
  const kitDoc = await getKit(params.id);

  if (!kitDoc) {
    notFound();
  }

  if (kitDoc.status !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 space-y-4">
        <h1 className="text-3xl font-bold">Kit is generating...</h1>
        <p className="text-gray-500">Your interview prep kit is being built. This takes about 90 seconds.</p>
        {/* Real app would poll or use websockets here */}
        <a 
          href={`/kits/${params.id}`}
          className="mt-4 px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800"
        >
          Refresh Page
        </a>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pt-8 pb-20">
      <KitBuilder initialKit={kitDoc.kit_data} kitId={kitDoc._id} />
    </main>
  );
}
