import { beforeEach } from 'vitest';

// Las preferencias se guardan en localStorage: cada prueba empieza con el teléfono "recién instalado".
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-tema');
});
