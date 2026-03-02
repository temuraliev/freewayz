export default function ProductLoading() {
    return (
        <div className="min-h-screen animate-pulse pb-32">
            {/* Carousel Skeleton */}
            <div className="aspect-square bg-secondary" />

            {/* Content Skeleton */}
            <div className="space-y-6 p-4">
                <div>
                    <div className="mb-2 h-4 w-20 rounded bg-secondary" />
                    <div className="h-8 w-3/4 rounded bg-secondary" />
                    <div className="mt-4 flex gap-3">
                        <div className="h-8 w-24 rounded bg-secondary" />
                        <div className="h-6 w-16 rounded-full bg-secondary" />
                    </div>
                </div>

                <div>
                    <div className="mb-2 h-4 w-24 rounded bg-secondary" />
                    <div className="space-y-2">
                        <div className="h-4 w-full rounded bg-secondary" />
                        <div className="h-4 w-5/6 rounded bg-secondary" />
                        <div className="h-4 w-4/6 rounded bg-secondary" />
                    </div>
                </div>

                <div>
                    <div className="mb-3 h-4 w-12 rounded bg-secondary" />
                    <div className="flex gap-2">
                        <div className="h-10 w-12 rounded-lg bg-secondary" />
                        <div className="h-10 w-12 rounded-lg bg-secondary" />
                        <div className="h-10 w-12 rounded-lg bg-secondary" />
                        <div className="h-10 w-12 rounded-lg bg-secondary" />
                    </div>
                </div>

                <div>
                    <div className="mb-3 h-4 w-16 rounded bg-secondary" />
                    <div className="flex gap-3">
                        <div className="h-10 w-10 rounded-full bg-secondary" />
                        <div className="h-10 w-10 rounded-full bg-secondary" />
                    </div>
                </div>
            </div>
        </div>
    );
}
