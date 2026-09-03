import { Skeleton, TableSkeleton } from '@/components/ui/states'

export default function AdminLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <TableSkeleton />
    </div>
  )
}
