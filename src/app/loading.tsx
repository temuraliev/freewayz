export default function Loading() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="flex items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-sm text-muted-foreground animate-pulse">Загрузка...</span>
            </div>
        </div>
    );
}
