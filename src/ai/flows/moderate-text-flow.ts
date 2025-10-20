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
    .describe('주어진 텍스트가 적절한지 여부.'),
  reason: z
    .string()
    .optional()
    .describe(
      '텍스트가 부적절한 경우, 그에 대한 간단한 설명. 적절한 경우엔 제공되지 않음.'
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

    Based on your analysis, determine if the text is appropriate. If it is inappropriate, provide a very brief, general reason in KOREAN (e.g., "부적절한 언어를 포함하고 있습니다", "공격적인 내용을 담고 있습니다").`,
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

    