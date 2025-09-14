import SignOut from "@/components/auth/sign-out";
import { getOptionalAuth } from "@/lib/auth-utils";

export default async function Home() {
  const session = await getOptionalAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900">
      <h1 className="text-4xl uppercase font-bold mb-8 text-gray-100">Home Page</h1>

      {session && <p className="text-gray-300 mb-4">Welcome back, {session.user.name}!</p>}

      <div className="flex flex-col gap-4">
        {session ? (
          <div className="flex flex-col gap-2">
            <a href="/dashboard" className="px-4 py-2 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition text-center">
              Go to Dashboard
            </a>
            <SignOut />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <a href="/owner-sign-in" className="px-4 py-2 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition text-center">
              Salon Owner Sign In
            </a>
            <a href="/sign-in" className="px-4 py-2 rounded-2xl bg-gray-600 text-white hover:bg-gray-700 transition text-center">
              Customer Sign In
            </a>
          </div>
        )}

        <a href="/luxe-lane/book" className="px-4 py-2 rounded-2xl bg-green-600 text-white hover:bg-green-700 transition text-center">
          Public Booking
        </a>
      </div>
    </div>
  );
}
