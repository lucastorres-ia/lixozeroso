// Login por R.A. (registro do aluno): o Supabase Auth exige um e-mail, então
// derivamos um endereço interno determinístico a partir do R.A. normalizado.
export const RA_DOMAIN = "ra.lixozero.app";
export const ADMIN_DOMAIN = "adm.lixozero.app";

export function normalizeRa(value: string) {
  return value.replace(/[^0-9a-zA-Z]/g, "").toLowerCase();
}

export function raToEmail(ra: string) {
  return `${normalizeRa(ra)}@${RA_DOMAIN}`;
}

export function adminUserToEmail(usuario: string) {
  return `${normalizeRa(usuario)}@${ADMIN_DOMAIN}`;
}
