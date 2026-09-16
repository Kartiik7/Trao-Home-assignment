import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plus, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";

async function getKits() {
  const cookieStore = cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    redirect("/login");
  }

  try {
    const res = await fetch("http://localhost:5000/kits", {
      headers: { Cookie: `token=${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 401) redirect("/login");
      return [];
    }

    const data = await res.json();
    return data.kits || [];
  } catch (err) {
    console.error("Dashboard fetch error:", err);
    return [];
  }
}

export default async function DashboardPage() {
  const kits = await getKits();

  return (
    <main className="min-h-screen bg-gray-50 pt-12 pb-20 px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Your Prep Kits</h1>
            <p className="text-gray-500 mt-1">Manage and study your interview kits.</p>
          </div>
          <Link 
            href="/kits/new" 
            className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors shadow-sm"
          >
            <Plus size={18} /> Create New Kit
          </Link>
        </div>

        {kits.length === 0 ? (
          <div className="bg-white border rounded-2xl p-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No kits found</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              You haven't generated any interview prep kits yet. Create your first one to start studying!
            </p>
            <Link 
              href="/kits/new" 
              className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors"
            >
              <Plus size={18} /> Create New Kit
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {kits.map((kit: any) => (
              <Link 
                href={`/kits/${kit._id}`} 
                key={kit._id}
                className="group bg-white border rounded-2xl p-6 shadow-sm hover:shadow-md transition-all hover:border-black flex flex-col h-full relative overflow-hidden"
              >
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <StatusBadge status={kit.status} />
                    <span className="text-xs text-gray-400 font-medium">
                      {new Date(kit.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {kit.kit_data ? (
                    <>
                      <h2 className="text-xl font-bold text-gray-900 line-clamp-2 leading-tight">
                        {kit.kit_data.role.title}
                      </h2>
                      <p className="text-gray-500 font-medium mt-1">
                        @ {kit.kit_data.source.company}
                      </p>
                    </>
                  ) : (
                    <h2 className="text-xl font-bold text-gray-400 italic">
                      Generation in progress...
                    </h2>
                  )}
                </div>
                
                <div className="mt-6 pt-4 border-t flex items-center justify-between text-sm font-medium text-gray-500 group-hover:text-black transition-colors">
                  <span>View Details</span>
                  <span>&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        )}

      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
        <CheckCircle2 size={12} /> Ready
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
        <XCircle size={12} /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <Loader2 size={12} className="animate-spin" /> Processing
    </span>
  );
}
