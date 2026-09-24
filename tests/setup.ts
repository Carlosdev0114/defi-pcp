import { vi } from "vitest";

// `server-only` lève une erreur hors d'un bundle serveur Next. Les tests
// tournent côté Node, ce garde-fou n'a pas de sens ici.
vi.mock("server-only", () => ({}));
