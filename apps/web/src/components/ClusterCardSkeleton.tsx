export default function ClusterCardSkeleton() {
  return (
    <div className="block bg-white border border-gray-200 shadow-sm p-5 rounded-lg animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-3/4 mb-3"></div>
      <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6 mb-4"></div>
      <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
      <div className="flex gap-2">
        <div className="w-6 h-6 bg-gray-200 rounded-sm"></div>
        <div className="w-6 h-6 bg-gray-200 rounded-sm"></div>
        <div className="w-6 h-6 bg-gray-200 rounded-sm"></div>
      </div>
    </div>
  );
}
