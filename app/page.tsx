export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-900">
      <h1 className="text-4xl uppercase font-bold mb-8 text-gray-100">Home Page</h1>

      <div className="flex flex-col gap-4">
        <a href="/dashboard" className="px-4 py-2 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 transition text-center">
          Dashboard
        </a>

        <a href="/luxe-lane/book" className="px-4 py-2 rounded-2xl bg-green-600 text-white hover:bg-green-700 transition text-center">
          Public Booking
        </a>
      </div>
    </div>
  );
}
