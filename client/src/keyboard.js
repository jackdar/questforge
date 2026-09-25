// Game keys must not act while the player types in a form field, for example a username that contains "w" or "1".
// A volume slider or a settings checkbox takes no typing, so Esc can still close the game menu after the player
// uses one.
const INPUT_TYPES_WITHOUT_TYPING = ['range', 'checkbox'];

export function isTypingInFormField(event) {
  const isTextInput =
    event.target instanceof HTMLInputElement && !INPUT_TYPES_WITHOUT_TYPING.includes(event.target.type);
  return isTextInput || event.target instanceof HTMLTextAreaElement;
}
