/**
 * ULID (https://github.com/ulid/spec): 48 bits de hora en ms + 80 bits de azar,
 * en base32 de Crockford → 26 caracteres que se ordenan por fecha de creación.
 */
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const PATRON = /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

export function ulid(ahora: number = Date.now()): string {
  let hora = '';
  let t = Math.floor(ahora);
  for (let i = 0; i < 10; i++) {
    hora = ALFABETO.charAt(t % 32) + hora;
    t = Math.floor(t / 32);
  }
  // 16 bytes aleatorios; de cada uno se usan 5 bits (32 = 256 / 8, sin sesgo).
  const azar = crypto.getRandomValues(new Uint8Array(16));
  return hora + Array.from(azar, (b) => ALFABETO.charAt(b % 32)).join('');
}

export function esUlid(texto: string): boolean {
  return PATRON.test(texto);
}
