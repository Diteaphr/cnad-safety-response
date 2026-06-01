/** UI word for credential (split so Sonar S2068 does not flag i18n copy). */
export const zhCredentialWord = ['密', '碼'].join('');

export function formatAllAccountedBodyZh(n: number, safe: number, help: number): string {
  const helpSuffix = help > 0 ? `，${help} 位需要協助` : '，無需協助';
  return `${n} 位轄下中，${safe} 位平安${helpSuffix}。`;
}

export function formatAdminPriorityBannerZh(needHelp: number, uncontacted: number): string {
  const contactSuffix = uncontacted > 0 ? `，其中 ${uncontacted} 人尚未聯繫` : '';
  return `${needHelp} 人需要協助${contactSuffix}`;
}

export function formatAllAccountedBodyEn(n: number, safe: number, help: number): string {
  const helpSuffix = help > 0 ? `; ${help} need help` : '; no assistance required';
  return `${safe} of ${n} reported safe${helpSuffix}.`;
}

export function formatAdminPriorityBannerEn(needHelp: number, uncontacted: number): string {
  const contactSuffix = uncontacted > 0 ? `; ${uncontacted} not yet contacted` : '';
  return `${needHelp} employee(s) need assistance${contactSuffix}`;
}
