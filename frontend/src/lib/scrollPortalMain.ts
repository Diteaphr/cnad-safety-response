/**
 * 入口 shell：桌機主內容在 `.app-frame > .content`，窄屏多半為文件／window 捲動。
 * 切換導覽或分頁時應兩者都歸零，否則會保留上一畫面的捲動位置。
 */
export function scrollPortalMainToTop() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  document.querySelector<HTMLElement>('.app-frame > .content')?.scrollTo({
    top: 0,
    left: 0,
    behavior: 'auto',
  });
}
