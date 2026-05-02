/** 取姓名縮寫（至多兩個英文字母），中文取末兩字首字元 */
export function initialsFromName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[parts.length - 1][0];
    if (a && b && /[a-z]/i.test(a) && /[a-z]/i.test(b)) return `${a}${b}`.toUpperCase();
  }
  if (trimmed.length >= 2) return trimmed.slice(0, 2).toUpperCase();
  return trimmed.slice(0, 1).toUpperCase();
}
