'use client';

export default function TestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Test Page</h1>
        <p className="text-lg">If you can see this, Next.js is working!</p>
        <p className="text-sm text-gray-500 mt-4">
          Server: Running ✅
        </p>
        <p className="text-sm text-gray-500">
          React: Rendering ✅
        </p>
      </div>
    </div>
  );
}
