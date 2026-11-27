'use strict';
// 기존 main.js는 수정하지 않습니다. 색상 토글과 메인 영상 교체만 담당합니다.
(() => {
  const toggle = document.querySelector('.theme-toggle');
  const hero = document.querySelector('.hero__video');
  if (!toggle || !hero) return;
  toggle.addEventListener('click', () => {
    const alternate = toggle.getAttribute('aria-checked') !== 'true';
    toggle.setAttribute('aria-checked', String(alternate));
    document.documentElement.dataset.theme = alternate ? 'alternate' : 'default';
    // 썸네일 영상은 변경하지 않습니다. 메인 영상 경로는 헤더 버튼의 data-*에서 설정합니다.
    const source = alternate ? toggle.dataset.alternateVideo : toggle.dataset.defaultVideo;
    if (!source || hero.getAttribute('src') === source) return;
    hero.pause();
    hero.setAttribute('src', source);
    hero.load();
    hero.play().catch(() => {});
  });
})();
