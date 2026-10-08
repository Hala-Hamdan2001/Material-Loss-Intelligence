import type { z } from "zod";
import type { GetCurrentAuthUserResponse } from "@workspace/api-zod";
export type AuthUser = NonNullable<z.infer<typeof GetCurrentAuthUserResponse>["user"]>;
