// UI texts for the languages beyond de/bs/sr/en (features + extra dictionaries).
// Each file: { fx: {...}, extra: {...} } with the same keys as the English dictionaries.
import sq from "./sq.json";
import tr from "./tr.json";
import es from "./es.json";
import fr from "./fr.json";
import ru from "./ru.json";
import ja from "./ja.json";
import zh from "./zh.json";
import ko from "./ko.json";

export const MORE_LOCALES: Record<string, { fx: Record<string, unknown>; extra: Record<string, unknown> }> = { sq, tr, es, fr, ru, ja, zh, ko };
