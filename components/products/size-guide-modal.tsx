"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const SIZE_DATA = [
  { size: "XS", chest: "84-88", waist: "68-72", hips: "88-92", eu: "42-44" },
  { size: "S", chest: "88-92", waist: "72-76", hips: "92-96", eu: "44-46" },
  { size: "M", chest: "92-96", waist: "76-80", hips: "96-100", eu: "46-48" },
  { size: "L", chest: "96-100", waist: "80-84", hips: "100-104", eu: "48-50" },
  { size: "XL", chest: "100-104", waist: "84-88", hips: "104-108", eu: "50-52" },
  { size: "XXL", chest: "104-108", waist: "88-92", hips: "108-112", eu: "52-54" },
];

export function SizeGuideButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
      >
        <Ruler className="h-3 w-3" />
        Размерная сетка
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Размерная сетка</SheetTitle>
          </SheetHeader>

          <p className="mt-2 text-xs text-muted-foreground">
            Все размеры указаны в сантиметрах. Замеры по телу, не по одежде.
            Товары под заказ — все размеры доступны.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2 pr-4 text-left font-medium">Размер</th>
                  <th className="pb-2 pr-4 text-left font-medium">Грудь</th>
                  <th className="pb-2 pr-4 text-left font-medium">Талия</th>
                  <th className="pb-2 pr-4 text-left font-medium">Бёдра</th>
                  <th className="pb-2 text-left font-medium">EU</th>
                </tr>
              </thead>
              <tbody>
                {SIZE_DATA.map((row) => (
                  <tr key={row.size} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-mono font-bold">{row.size}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.chest}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.waist}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">{row.hips}</td>
                    <td className="py-2.5 text-muted-foreground">{row.eu}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-2 text-xs text-muted-foreground">
            <p>
              <strong>Как измерить:</strong> Используйте мягкую рулетку.
              Грудь — по самой широкой части. Талия — по самой узкой.
              Бёдра — по самой широкой части.
            </p>
            <p>
              Если ваши замеры между размерами — выбирайте больший.
              Для оверсайз-посадки берите на 1 размер больше.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
