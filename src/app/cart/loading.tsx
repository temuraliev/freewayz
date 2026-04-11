export default function CartLoading() {
    return (
        <div className="min-h-screen pb-48 animate-pulse">
            {/* Header Skeleton */}
            <div className="sticky top-0 z-40 border-b border-border bg-background/80">
                <div className="flex h-14 items-center justify-between px-4">
                    <div className="h-5 w-20 rounded bg-secondary" />
                    <div className="h-6 w-24 rounded bg-secondary" />
                    <div className="w-16" />
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Count / Clear Skeleton */}
                <div className="flex items-center justify-between">
                    <div className="h-4 w-16 rounded bg-secondary" />
                    <div className="h-4 w-24 rounded bg-secondary" />
                </div>

                {/* Cart Items Skeletons */}
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-4 rounded-2xl border border-border bg-card p-3">
                        <div className="h-24 w-20 rounded-xl bg-secondary" />
                        <div className="flex flex-1 flex-col justify-between py-1">
                            <div className="space-y-2">
                                <div className="h-4 w-16 rounded bg-secondary" />
                                <div className="h-5 w-3/4 rounded bg-secondary" />
                                <div className="h-4 w-1/2 rounded bg-secondary" />
                            </div>
                            <div className="flex items-center justify-between mt-4">
                                <div className="h-6 w-20 rounded bg-secondary" />
                                <div className="h-8 w-24 rounded-full bg-secondary" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
