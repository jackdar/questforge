import { validateUsername, validatePassword } from 'questforge-shared/account-rules.js';
import { login, register } from './api-requests.js';

export function createLoginScreen(onLoggedIn) {
  const overlay = document.getElementById('login-screen');
  const form = overlay.querySelector('form');
  const usernameInput = form.elements.username;
  const passwordInput = form.elements.password;
  const errorElement = overlay.querySelector('.form-error');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(login);
  });

  overlay.querySelector('[data-action="register"]').addEventListener('click', () => {
    const problem = validateUsername(usernameInput.value) ?? validatePassword(passwordInput.value);
    if (problem) {
      showError(problem);
      return;
    }
    submit(register);
  });

  async function submit(sendAccountRequest) {
    setBusy(true);
    showError('');
    const result = await sendAccountRequest(usernameInput.value, passwordInput.value);
    setBusy(false);

    if (!result.ok) {
      showError(result.error);
      return;
    }
    passwordInput.value = '';
    overlay.hidden = true;
    onLoggedIn(result.account);
  }

  function setBusy(isBusy) {
    for (const button of overlay.querySelectorAll('button')) button.disabled = isBusy;
  }

  function showError(message) {
    errorElement.textContent = message;
  }

  function show() {
    overlay.hidden = false;
    usernameInput.focus();
  }

  return { show };
}
