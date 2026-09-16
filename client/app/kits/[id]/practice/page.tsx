import { notFound } from "next/navigation";
import PracticeSession from "../../../../components/practice/PracticeSession";
import { cookies } from "next/headers";

async function getPracticeData(id: string) {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) return null;

  try {
    const res = await fetch(`http://localhost:5000/kits/${id}/practice`, {
      headers: { Cookie: `token=${token}` },
      cache: "no-store", 
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error(`Failed to fetch practice data: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error("Fetch error:", err);
    return null;
  }
}

export default async function PracticePage({ params }: { params: { id: string } }) {
  const data = await getPracticeData(params.id);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col pt-12 pb-20 px-6">
      <PracticeSession 
        flashcards={data.ordered_flashcards} 
        stats={data.stats} 
        kitId={params.id} 
      />
    </main>
  );
}
