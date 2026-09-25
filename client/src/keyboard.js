// Game keys must not act while the player types in a form field, for example a username that contains "w" or "1".
export function isTypingInFormField(event) {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
}
