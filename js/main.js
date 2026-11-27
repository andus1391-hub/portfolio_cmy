'use strict';
// 모든 미리보기는 data-video만 교체. 비디오가 없는 영역은 placeholder 유지.
const play = video => { if (video) video.play().catch(() => { }); };
function makeVideo(src) {
  const video = document.createElement('video');
  video.src = src; video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'metadata';
  return video;
}
document.querySelectorAll('[data-preview], [data-autoplay]').forEach(container => {
  const src = container.dataset.video;
  if (!src) return;
  let video = container.querySelector('video');
  if (!video) {
    video = makeVideo(src);
    const poster = container.querySelector('img');
    if (poster) video.poster = poster.getAttribute('src');
    container.append(video);
  }
  container.classList.add('has-preview-video');
  if (container.hasAttribute('data-autoplay')) { video.autoplay = true; play(video); return; }
  let hovering = false, focused = false;
  const sync = () => { if (hovering || focused) play(video); else { video.pause(); video.currentTime = 0; } };
  container.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovering = true; sync(); } });
  container.addEventListener('pointerleave', () => { hovering = false; sync(); });
  container.addEventListener('focus', () => { focused = true; sync(); });
  container.addEventListener('blur', () => { focused = false; sync(); });
});
// 가로 드래그 공통 처리: 작은 손떨림은 클릭으로, 실제 드래그는 클릭과 분리합니다.
function enableHorizontalDrag(surface, { nativeTouch = false, start, move, end }) {
  let gesture = null;
  let suppressClickUntil = 0;
  surface.addEventListener('dragstart', event => event.preventDefault());
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0 || (nativeTouch && event.pointerType === 'touch')) return;
    suppressClickUntil = 0;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dragging: false };
  });
  window.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    if (!gesture.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) { gesture = null; return; }
      gesture.dragging = true;
      surface.setPointerCapture(event.pointerId);
      surface.classList.add('is-dragging');
      start?.();
    }
    event.preventDefault();
    gesture.dx = dx;
    move(dx);
  }, { passive: false });
  function finish(event, cancelled = false) {
    if (!gesture || (event.pointerId !== undefined && event.pointerId !== gesture.id)) return;
    const finished = gesture;
    gesture = null;
    if (surface.hasPointerCapture(finished.id)) surface.releasePointerCapture(finished.id);
    surface.classList.remove('is-dragging');
    if (finished.dragging) {
      suppressClickUntil = performance.now() + 500;
      end?.(finished.dx, cancelled);
    }
  }
  window.addEventListener('pointerup', event => finish(event));
  window.addEventListener('pointercancel', event => finish(event, true));
  window.addEventListener('blur', event => finish(event, true));
  surface.addEventListener('lostpointercapture', event => finish(event, true));
  surface.addEventListener('click', event => {
    if (event.detail !== 0 && performance.now() < suppressClickUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

// 각각의 브랜딩 섹션 내부 카드만 이동. 자동 넘김 없음.
document.querySelectorAll('.branding').forEach(section => {
  const track = section.querySelector('.branding__track');
  const prev = section.querySelector('[data-project-prev]'), next = section.querySelector('[data-project-next]');
  function sync() { prev.disabled = track.scrollLeft < 2; next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 2; }
  function move(direction) {
    const card = track.querySelector('.project-card');
    if (!card) return;
    const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap);
    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const target = Math.max(0, Math.min(maxScroll, track.scrollLeft + direction * step));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    track.scrollTo({ left: target, behavior: reduceMotion ? 'instant' : 'smooth' });
  }
  prev.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
  let dragStartScroll = 0;
  enableHorizontalDrag(track, {
    nativeTouch: true, // 터치 기기는 브라우저 기본 가로 스크롤 사용
    start: () => { dragStartScroll = track.scrollLeft; track.scrollTo({ left: dragStartScroll, behavior: 'instant' }); },
    move: dx => { track.scrollLeft = dragStartScroll - dx; },
    end: () => { sync(); }
  });
  track.addEventListener('scroll', sync, { passive: true }); new ResizeObserver(sync).observe(track); sync();
});
// Artwork 전용: 이전/다음/페이지 버튼으로 선택한 슬라이드를 가운데(0)에 배치.
// 자동 재생 없이 클릭할 때만 CSS transition으로 부드럽게 이동합니다.
(() => {
  const section = document.querySelector('#section3');
  if (!section) return;
  const slides = [...section.querySelectorAll('.artwork__slide')];
  const dots = section.querySelector('.artwork__dots');
  const prev = section.querySelector('[data-art-prev]');
  const next = section.querySelector('[data-art-next]');
  const status = section.querySelector('[data-art-status]');
  if (!slides.length) { prev.disabled = next.disabled = true; return; }
  let activeIndex = Math.min(2, slides.length - 1);
  dots.replaceChildren();
  const dotButtons = slides.map((slide, index) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `${index + 1}번 슬라이드`);
    dot.addEventListener('click', () => selectSlide(index));
    dots.append(dot);
    return dot;
  });
  function selectSlide(index) {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      // 현재 항목을 0으로 놓고 앞뒤 항목을 순환 배치합니다.
      let offset = (slideIndex - activeIndex + slides.length) % slides.length;
      if (offset > slides.length / 2) offset -= slides.length;
      slide.hidden = Math.abs(offset) > 2;
      slide.dataset.position = String(offset);
      slide.classList.toggle('is-active', offset === 0);
      slide.setAttribute('aria-current', String(offset === 0));
      dotButtons[slideIndex].setAttribute('aria-current', String(offset === 0));
    });
    status.textContent = `${activeIndex + 1} / ${slides.length}`;
    prev.disabled = next.disabled = slides.length < 2;
  }
  prev.addEventListener('click', () => selectSlide(activeIndex - 1));
  next.addEventListener('click', () => selectSlide(activeIndex + 1));
  const stage = section.querySelector('.artwork__stage');
  enableHorizontalDrag(stage, {
    move: dx => stage.style.setProperty('--drag-x', `${Math.max(-stage.clientWidth / 2, Math.min(stage.clientWidth / 2, dx))}px`),
    end: (dx, cancelled) => {
      stage.style.removeProperty('--drag-x');
      const threshold = Math.min(80, stage.clientWidth * .15);
      if (!cancelled && Math.abs(dx) >= threshold) selectSlide(activeIndex + (dx < 0 ? 1 : -1));
    }
  });
  selectSlide(activeIndex);
})();
// 공용 dialog: ESC, 닫기 버튼, 배경 클릭 지원. 닫을 때 영상 및 스크롤 상태 정리.
const dialog = document.querySelector('.media-dialog');
const dialogBody = dialog.querySelector('.media-dialog__body');
let returnFocus = null;
let playingBeforeDialog = [];

// 이미지 팝업: HTML template 내부 img 목록을 읽습니다. 미리보기 영상과 독립적입니다.
function renderImageGallery(trigger) {
  const template = document.getElementById(trigger.dataset.gallery);
  const images = template?.content ? [...template.content.querySelectorAll('img')] : [];
  const gallery = document.createElement('div');
  gallery.className = 'popup-gallery';
  const frame = document.createElement('div');
  frame.className = 'popup-gallery__frame';
  const controls = document.createElement('div');
  controls.className = 'popup-gallery__controls';
  const previous = document.createElement('button');
  previous.type = 'button'; previous.textContent = '이전'; previous.dataset.galleryPrev = '';
  previous.setAttribute('aria-label', '팝업 이전 이미지');
  const counter = document.createElement('span');
  counter.setAttribute('aria-live', 'polite'); counter.setAttribute('aria-atomic', 'true');
  const next = document.createElement('button');
  next.type = 'button'; next.textContent = '다음'; next.dataset.galleryNext = '';
  next.setAttribute('aria-label', '팝업 다음 이미지');
  let index = 0;
  function show() {
    frame.replaceChildren();
    previous.disabled = images.length < 2 || index === 0;
    next.disabled = images.length < 2 || index === images.length - 1;
    counter.textContent = images.length ? `${index + 1} / ${images.length}` : '0 / 0';
    if (!images.length) {
      const message = document.createElement('p');
      message.textContent = '이미지 준비 중입니다.';
      frame.append(message); return;
    }
    const image = document.createElement('img');
    image.alt = images[index].alt || `${trigger.dataset.title} ${index + 1}`;
    image.addEventListener('error', () => {
      const message = document.createElement('p');
      message.textContent = '이미지를 불러오지 못했습니다.';
      image.replaceWith(message);
    }, { once: true });
    image.src = images[index].getAttribute('src');
    frame.append(image);
  }
  previous.addEventListener('click', () => { if (index > 0) { index--; show(); } });
  next.addEventListener('click', () => { if (index < images.length - 1) { index++; show(); } });
  controls.append(previous, counter, next);
  gallery.append(frame, controls);
  dialogBody.append(gallery);
  show();
}
dialog.addEventListener('keydown', event => {
  if (!dialog.open || !dialogBody.querySelector('.popup-gallery')) return;
  const selector = event.key === 'ArrowLeft' ? '[data-gallery-prev]' : event.key === 'ArrowRight' ? '[data-gallery-next]' : null;
  if (selector) { event.preventDefault(); dialogBody.querySelector(selector)?.click(); }
});

document.querySelectorAll('[data-action]').forEach(trigger => {
  trigger.addEventListener('click', () => {
    if (trigger.dataset.action.trim() === 'link') {
      // HTML의 data-url에 실제 주소를 입력하세요. 빈 주소는 팝업으로 전환하지 않습니다.
      const address = trigger.dataset.url?.trim();
      if (!address) return;
      try {
        const url = new URL(address, location.href);
        if (['https:', 'http:'].includes(url.protocol)) window.open(url.href, '_blank', 'noopener,noreferrer');
      } catch {
        // 잘못된 주소는 열지 않습니다. data-url의 오타를 확인하세요.
      }
      return;
    }
    returnFocus = trigger;
    playingBeforeDialog = [...document.querySelectorAll('video')].filter(video => !video.paused);
    playingBeforeDialog.forEach(video => video.pause());
    dialog.querySelector('#dialog-title').textContent = trigger.dataset.title || '작품 보기';
    dialogBody.replaceChildren();
    const src = trigger.dataset.src || trigger.dataset.video;
    if (trigger.dataset.kind === 'gallery') {
      renderImageGallery(trigger);
    } else if (!src) {
      const message = document.createElement('p'); message.textContent = '콘텐츠 준비 중입니다.'; dialogBody.append(message);
    } else if (trigger.dataset.kind === 'video') {
      const video = makeVideo(src); video.controls = true; video.loop = false; video.muted = false;
      dialogBody.append(video); play(video);
    } else {
      const image = document.createElement('img'); image.src = src; image.alt = trigger.dataset.title || '작품'; dialogBody.append(image);
    }
    dialog.showModal(); document.body.classList.add('is-modal-open');
  });
});
dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => {
  dialogBody.querySelectorAll('video').forEach(video => { video.pause(); video.removeAttribute('src'); video.load(); });
  dialogBody.replaceChildren(); document.body.classList.remove('is-modal-open');
  playingBeforeDialog.filter(video => video.matches('.hero__video, [data-autoplay] video')).forEach(play);
  returnFocus?.focus();
});

// TOP: 메인 영상의 하단이 뷰포트 위로 사라지면 표시합니다.
(() => {
  const hero = document.querySelector('#home');
  const button = document.querySelector('.back-to-top');
  if (!hero || !button) return;
  let scheduled = false;
  function updateVisibility() {
    button.hidden = hero.getBoundingClientRect().bottom > 0;
    scheduled = false;
  }
  function scheduleUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(updateVisibility);
  }
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate);
  new ResizeObserver(scheduleUpdate).observe(hero);
  button.addEventListener('click', () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' });
    // 사라질 버튼에 포커스를 남기지 않습니다.
    document.querySelector('.site-nav a')?.focus({ preventScroll: true });
  });
  updateVisibility();
})();
