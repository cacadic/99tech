import z from "zod";

export const FormSchema = z.object({
  amountToSend: z.string(),
  amountToReceive: z.string(),
  sendCoin: z.string().min(1),
  receiveCoin: z.string().min(1),
});

export type FormSchemaData = z.infer<typeof FormSchema>;

export type FormValues = z.input<typeof FormSchema>;
