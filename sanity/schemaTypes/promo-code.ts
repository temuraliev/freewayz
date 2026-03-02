import { defineType, defineField } from "sanity";

export const promoCodeType = defineType({
    name: "promoCode",
    title: "Промокод",
    type: "document",
    fields: [
        defineField({
            name: "code",
            title: "Код",
            type: "string",
            description: "Промокод (латиница, без пробелов, будет приведён к CAPS)",
            validation: (Rule) =>
                Rule.required()
                    .uppercase()
                    .custom((code) => {
                        if (!code) return true;
                        if (!/^[A-Z0-9]+$/.test(code)) return "Только латинские буквы и цифры";
                        return true;
                    }),
        }),
        defineField({
            name: "type",
            title: "Тип скидки",
            type: "string",
            options: {
                list: [
                    { title: "Процент", value: "percentage" },
                    { title: "Фиксированная сумма", value: "fixed" },
                ],
                layout: "radio",
            },
            initialValue: "percentage",
            validation: (Rule) => Rule.required(),
        }),
        defineField({
            name: "value",
            title: "Значение",
            type: "number",
            description:
                "Для процента — число от 1 до 100. Для фиксированной суммы — сумма в UZS.",
            validation: (Rule) => Rule.required().positive(),
        }),
        defineField({
            name: "minOrderAmount",
            title: "Мин. сумма заказа",
            type: "number",
            description: "Необязательно. Минимальная сумма заказа для активации промокода (UZS).",
        }),
        defineField({
            name: "maxUses",
            title: "Макс. использований",
            type: "number",
            description: "Необязательно. Лимит использований (0 = без лимита).",
            initialValue: 0,
        }),
        defineField({
            name: "usedCount",
            title: "Использовано",
            type: "number",
            initialValue: 0,
            readOnly: true,
        }),
        defineField({
            name: "isActive",
            title: "Активен",
            type: "boolean",
            initialValue: true,
        }),
        defineField({
            name: "expiresAt",
            title: "Истекает",
            type: "datetime",
            description: "Необязательно. Дата окончания действия.",
        }),
    ],
    preview: {
        select: {
            title: "code",
            type: "type",
            value: "value",
            isActive: "isActive",
        },
        prepare({ title, type, value, isActive }) {
            const suffix = type === "percentage" ? `${value}%` : `${value} UZS`;
            return {
                title: `${title} (${suffix})`,
                subtitle: isActive ? "✅ Активен" : "❌ Неактивен",
            };
        },
    },
});
