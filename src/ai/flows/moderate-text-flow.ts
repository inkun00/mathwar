'use server';
/**
 * @fileoverview A Genkit flow for moderating text content.
 *
 * This file defines a flow that uses an AI model to determine if a given
 * piece of text is appropriate for use as a nickname or country name in a game.
 *
 * - moderateText - An async function that takes text and returns a moderation result.
 * - ModerateTextInput - The Zod schema for the input to the flow.
 * - ModerateTextOutput - The Zod schema for the output of the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ModerateTextInputSchema = z.string();
export type ModerateTextInput = z.infer<typeof ModerateTextInputSchema>;

const ModerateTextOutputSchema = z.object({
  isAppropriate: z
    .boolean()
    .describe('Whether the text is appropriate or not.'),
  reason: z
    .string()
    .optional()
    .describe(
      'A brief explanation if the text is inappropriate, otherwise not provided.'
    ),
});
export type ModerateTextOutput = z.infer<typeof ModerateTextOutputSchema>;

export async function moderateText(
  text: ModerateTextInput
): Promise<ModerateTextOutput> {
  return await moderateTextFlow(text);
}

const moderationPrompt = ai.definePrompt({
  name: 'moderateTextPrompt',
  input: { schema: z.object({ text: ModerateTextInputSchema }) },
  output: { schema: ModerateTextOutputSchema },
  prompt: `You are a content moderator for a friendly, all-ages strategy game.
    Your task is to determine if the given text is appropriate for a user's nickname or a country's name.

    The text should be rejected if it contains any of the following:
    - Sexually explicit language, suggestions, or innuendos.
    - Violence, threats, or glorification of harm.
    - Hate speech, slurs, or discriminatory language based on race, ethnicity, religion, gender, sexual orientation, etc.
    - Personal attacks, harassment, or bullying.
    - References to illegal activities or substances.

    Analyze the following text: {{{text}}}

    Based on your analysis, determine if the text is appropriate. If it is inappropriate, provide a very brief, general reason (e.g., "Contains inappropriate language", "Potentially offensive content").`,
});

const moderateTextFlow = ai.defineFlow(
  {
    name: 'moderateTextFlow',
    inputSchema: ModerateTextInputSchema,
    outputSchema: ModerateTextOutputSchema,
  },
  async (text) => {
    const { output } = await moderationPrompt({ text });
    return output!;
  }
);
