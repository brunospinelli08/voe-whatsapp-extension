/**
 * Normaliza telefone para E.164 sem "+" (ex: "5511947386974").
 * Espelha a mesma lógica de app.voeops.com/src/lib/phoneUtils.ts
 * e voe-backend/src/lib/phone-utils.ts.
 */
export function normalizeToE164(phone: string | null | undefined): string | null {
    if (!phone) return null;

    const digits = phone.replace(/\D/g, "");
    if (!digits) return null;

    // 13 digitos com DDI 55 — já canonico BR celular
    if (digits.length === 13 && digits.startsWith("55")) return digits;

    // 12 digitos com DDI 55 — celular sem 9o digito ou fixo
    if (digits.length === 12 && digits.startsWith("55")) {
        const afterDDD = digits.slice(4);
        if (/^[6-9]/.test(afterDDD)) {
            return `${digits.slice(0, 4)}9${afterDDD}`;
        }
        return digits;
    }

    // 11 digitos sem DDI — BR celular (DDD + 9 + 8 digitos)
    if (digits.length === 11) return `55${digits}`;

    // 10 digitos sem DDI — celular sem 9o digito ou fixo
    if (digits.length === 10) {
        const afterDDD = digits.slice(2);
        if (/^[6-9]/.test(afterDDD)) {
            return `55${digits.slice(0, 2)}9${afterDDD}`;
        }
        return `55${digits}`;
    }

    return null;
}

/**
 * Gera variantes do telefone para busca flexivel
 * (com/sem DDI 55, com/sem 9o digito).
 */
export function phoneVariants(phone: string | null | undefined): string[] {
    const e164 = normalizeToE164(phone);
    const set = new Set<string>();

    if (e164) {
        set.add(e164);
        // sem DDI
        if (e164.startsWith("55") && e164.length >= 12) set.add(e164.slice(2));
        // sem 9o digito (13 digitos → 12)
        if (e164.length === 13 && e164.startsWith("55")) {
            set.add(e164.slice(0, 4) + e164.slice(5));
        }
    }

    const raw = (phone ?? "").replace(/\D/g, "");
    if (raw) set.add(raw);

    return Array.from(set);
}
