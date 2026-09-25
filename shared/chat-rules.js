export const CHAT_MAX_LENGTH = 255;

// Control characters, such as a new line or a tab, would break the chat layout, so each one becomes a space.
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/g;

export function cleanChatMessage(text) {
  if (typeof text !== 'string') return { error: 'A chat message must be text.' };

  const cleanedText = text.replace(CONTROL_CHARACTERS, ' ').trim();
  if (!cleanedText) return { error: 'A chat message cannot be empty.' };
  if (cleanedText.length > CHAT_MAX_LENGTH) {
    return { error: `A chat message can have at most ${CHAT_MAX_LENGTH} characters.` };
  }
  return { text: cleanedText };
}
