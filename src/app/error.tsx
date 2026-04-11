"use client";

import { useEffect } from "react";
import { Button } from "@frontend/components/ui/button";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Global Error Boundary caught:", error);
    }, [error]);

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center p-4 text-center">
            <h2 className="mb-2 text-xl font-bold">Что-то пошло не так</h2>
            <p className="mb-6 text-sm text-muted-foreground">
                Произошла непредвиденная ошибка. Пожалуйста, попробуйте снова.
            </p>
            <Button onClick={() => reset()} variant="outline">
                Попробовать снова
            </Button>
        </div>
    );
}
