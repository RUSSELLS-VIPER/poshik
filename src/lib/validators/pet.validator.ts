import { z } from "zod";

export const petSchema = z.object({
    name: z.string(),
    type: z.string(),
    breed: z.string(),
    age: z.number(),
});