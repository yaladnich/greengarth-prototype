/* Green Garth+ · рух системи Likova (docs/design-system.md, §8).
   Без бібліотек сторінка лишається статичною і повною. Системне «зменшити рух» навмисно не враховується
   (BRIEF.md, інваріант про рух): рух однаковий за будь-яких налаштувань ОС.
   Службові параметри для знімків: ?p=0..1 — прогрес збирання напису, ?y=N — прокрутити на N px, ?nointro. */
(() => {
  const COARSE = matchMedia('(pointer: coarse)').matches;
  const Q = new URLSearchParams(location.search);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  // фото сюжету чекають на скрипт (CSS ховає їх під .js), щоб не забирати канал у першого екрана;
  // без бібліотек сюжет лишається звичайною стрічкою фото
  const story = $('[data-story]');
  if (story && typeof gsap === 'undefined') story.classList.add('story-plain');
  const NS = 'http://www.w3.org/2000/svg';
  // ---------- форма: без телефону не надсилається; працює й без бібліотек руху ----------
  const form = $('form.form');
  if (form) {
    form.noValidate = true;
    const tel = $('#f-tel', form), telW = $('#f-tel-w', form), agree = $('input[name="agree"]', form), agreeL = agree.closest('.agree'), sent = $('.sent', form);
    const telOk = () => tel.value.replace(/\D/g, '').length >= 10;
    tel.addEventListener('input', () => { if (telW.classList.contains('bad') && telOk()) { telW.classList.remove('bad'); tel.removeAttribute('aria-invalid'); } });
    agree.addEventListener('change', () => { if (agree.checked) { agreeL.classList.remove('bad'); agree.removeAttribute('aria-invalid'); } });
    form.addEventListener('submit', e => {
      e.preventDefault(); sent.hidden = true;
      const badTel = !telOk(), badAgree = !agree.checked;
      telW.classList.toggle('bad', badTel); badTel ? tel.setAttribute('aria-invalid', 'true') : tel.removeAttribute('aria-invalid');
      agreeL.classList.toggle('bad', badAgree); badAgree ? agree.setAttribute('aria-invalid', 'true') : agree.removeAttribute('aria-invalid');
      if (badTel) return tel.focus();
      if (badAgree) return agree.focus();
      sent.hidden = false; sent.focus();
    });
  }
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger, SplitText);

  // ---------- 8.1 плавний скрол (лише колесо миші) ----------
  let lenis = null;
  if (!COARSE && window.Lenis) {
    // Lenis 1.3 сам вимикає згладжування при системному «зменшити рух» — сайт це налаштування не враховує (BRIEF, №7)
    lenis = new Lenis({lerp: 0.05, respectReducedMotion: false}); // 0.05 — як на produx.design: 95 % шляху за ~1 с
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(t => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollTo = (target) => { if (lenis) lenis.scrollTo(target, {duration: 1.2}); else (typeof target === 'number' ? scrollTo0(target) : target.scrollIntoView({behavior: 'smooth'})); };
  const scrollTo0 = y => window.scrollTo({top: y, behavior: 'smooth'});

  // ---------- меню ----------
  const menu = $('#menu'), burger = $('button.burger');
  const openMenu = () => { menu.classList.add('open'); menu.setAttribute('aria-hidden', 'false'); burger.setAttribute('aria-expanded', 'true'); lenis?.stop(); setTimeout(() => menu.querySelector('a')?.focus(), 60); };
  const closeMenu = () => { if (!menu?.classList.contains('open')) return; menu.classList.remove('open'); menu.setAttribute('aria-hidden', 'true'); burger?.setAttribute('aria-expanded', 'false'); lenis?.start(); burger?.focus(); };
  if (menu && burger) {
    burger.addEventListener('click', openMenu);
    $('.x', menu).addEventListener('click', closeMenu);
    $('.shade', menu).addEventListener('click', closeMenu);
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (id.length < 2) return;
    const t = document.querySelector(id); if (!t) return;
    e.preventDefault(); closeMenu(); scrollTo(t); history.replaceState(null, '', id);
  }));

  // ---------- 8.11 шапка бере тему розділу під собою ----------
  const head = $('.head');
  $$('main section[data-theme], footer[data-theme]').forEach(sec => ScrollTrigger.create({
    trigger: sec, start: () => `top ${head.offsetHeight}`, end: () => `bottom ${head.offsetHeight}`,
    onToggle: self => { if (self.isActive) head.dataset.theme = sec.dataset.theme; },
  }));

  // ---------- 8.2, 8.14, 8.10 поява тексту й фото ----------
  {
    const st = el => ({trigger: el, start: 'top 88%', once: true});
    // смуга по рядках: прозорий → край --edge → колір тексту; --p веде позицію градієнта (CSS .sweep-line)
    $$('[data-reveal="sweep"]').forEach(el => {
      const fin = getComputedStyle(el).color;
      let done = false;
      SplitText.create(el, {type: 'lines', linesClass: 'sweep-line', autoSplit: true, onSplit: self => {
        // повторне розбиття після появи (зміна ширини) не має ховати текст знову
        if (done) { gsap.set(self.lines, {'--c-final': fin, '--p': 100}); return; }
        gsap.set(self.lines, {'--c-final': fin, '--p': 30});
        return gsap.to(self.lines, {'--p': 100, duration: 1.2, stagger: 0.1, ease: 'power1.inOut',
          scrollTrigger: {trigger: el, start: 'top 85%', once: true}, onComplete: () => { done = true; self.revert(); }});
      }});
    });
    $$('[data-reveal="mono"]').forEach(el => SplitText.create(el, {type: 'chars',
      onSplit: self => gsap.from(self.chars, {opacity: 0, duration: 0.01, stagger: 0.4 / Math.max(1, self.chars.length), ease: 'none', scrollTrigger: st(el)})}));
    $$('[data-reveal="photo"]').forEach(img => gsap.from(img, {filter: 'blur(20px)', scale: 1.08, duration: 1, ease: 'power2.out', scrollTrigger: {trigger: img, start: 'top 92%', once: true}}));
  }

  // ---------- 8.13 цифри: відлік один раз ----------
  $$('[data-count]').forEach(b => {
    const end = +b.dataset.count, pre = b.dataset.prefix || '', suf = b.dataset.suffix || '', o = {v: 0};
    b.textContent = pre + 0 + suf; // без цього до появи видно кінцеве число, а потім стрибок на 0
    gsap.to(o, {v: end, duration: 1.2, ease: 'power2.out', scrollTrigger: {trigger: b, start: 'top 92%', once: true}, onUpdate: () => { b.textContent = pre + Math.round(o.v) + suf; }});
  });

  // ---------- паралакс фото у «стовпах» ----------
  $$('.stovp > .media img').forEach(img => {
    gsap.set(img, {scale: 1.14});
    gsap.fromTo(img, {yPercent: -5}, {yPercent: 5, ease: 'none', scrollTrigger: {trigger: img.closest('.stovp'), start: 'top bottom', end: 'bottom top', scrub: true}});
  });

  // ---------- 8.9 фото збирається з квадратиків ----------
  function tiles(media) {
    const img = $('img', media); if (!img) return;
    const run = () => {
      const W = media.clientWidth, H = media.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight;
      if (!W || !nw) return;
      const k = Math.max(W / nw, H / nh) * 1.14, bw = nw * k, bh = nh * k, ox = (W - bw) / 2, oy = (H - bh) / 2;
      const C = innerWidth < 768 ? 5 : 8, Rn = innerWidth < 768 ? 7 : 6, tw = W / C, th = H / Rn, box = document.createElement('div'); box.className = 'tiles';
      for (let r = 0; r < Rn; r++) for (let c = 0; c < C; c++) {
        const t = document.createElement('i');
        Object.assign(t.style, {left: c * tw + 'px', top: r * th + 'px', width: Math.ceil(tw) + 1 + 'px', height: Math.ceil(th) + 1 + 'px',
          backgroundImage: `url("${img.currentSrc || img.src}")`, backgroundSize: `${bw}px ${bh}px`, backgroundPosition: `${ox - c * tw}px ${oy - r * th}px`});
        box.appendChild(t);
      }
      media.appendChild(box); gsap.set(img, {opacity: 0});
      gsap.from(box.children, {x: () => gsap.utils.random(-140, 140), y: () => gsap.utils.random(-140, 140), rotation: () => gsap.utils.random(-10, 10),
        opacity: 0, filter: 'blur(8px)', duration: 1.2, ease: 'power3.out', stagger: {each: 0.02, from: 'center', grid: [Rn, C]},
        onComplete: () => { gsap.set(img, {opacity: 1}); box.remove(); }});
    };
    ScrollTrigger.create({trigger: media.closest('.stovp'), start: 'top 70%', once: true, onEnter: () => (img.complete ? Promise.resolve() : img.decode().catch(() => {})).then(run)});
  }
  $$('[data-tiles]').forEach(tiles);

  // ---------- 8.15 рядок послуги: фото біля курсора ----------
  const peek = $('.peek');
  if (peek && !COARSE) {
    const pimg = $('img', peek), qx = gsap.quickTo(peek, 'x', {duration: 0.35, ease: 'power3'}), qy = gsap.quickTo(peek, 'y', {duration: 0.35, ease: 'power3'});
    // показ за тим, що зараз під курсором: при прокрутці колесом рядок їде з-під курсора без mouseleave
    let cur = null, px = -1, py = -1;
    const sync = () => {
      const a = px < 0 ? null : document.elementFromPoint(px, py)?.closest('a[data-row]') || null;
      if (a === cur) return;
      cur = a;
      if (a) { pimg.src = a.dataset.row; gsap.to(peek, {opacity: 1, scale: 1, duration: 0.25, overwrite: true}); }
      else gsap.to(peek, {opacity: 0, scale: 0.92, duration: 0.2, overwrite: true});
    };
    addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; qx(px + 28); qy(py - 105); sync(); }, {passive: true});
    addEventListener('scroll', sync, {passive: true});
    document.addEventListener('pointerleave', () => { px = -1; sync(); });
  }

  // ---------- «Від проєкту до реального»: проліт над двором Світлопарку (Unreal), кадр = прогрес прокрутки ----------
  // Двір проявляється з білого серпанку, газони й кущі виростають, дерева піднімаються; камера закінчує в позі
  // фото NZ6_1894, тож фото лягає точно поверх останнього кадру (data-photo — його рамка в кадрі 1920×1080).
  const proj = $('[data-project]');
  if (proj) {
    const cv = $('canvas', proj), ctx = cv.getContext('2d');
    const N = +cv.dataset.frames, mob = innerWidth < 768, step = mob ? 2 : 1;
    const box = cv.dataset.photo.split(',').map(Number);
    const steps = $$('.stages li', proj), fin = $('.final', proj);
    const frames = new Array(N), photo = new Image();
    // AVIF (−25% до WebP); старі браузери без AVIF отримують WebP
    let ext = 'webp';
    const avif = new Promise(res => { const t = new Image(); t.onload = () => res(t.width > 0); t.onerror = () => res(false);
      t.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A='; });
    const src = i => `img/fly/${mob ? 'm' : 'f'}_${String(i).padStart(4, '0')}.${ext}`;
    let want = 0, p = 0, target = 0, raf = 0;
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const ready = i => frames[i]?.complete && frames[i].naturalWidth;
    const draw = () => {
      // між двома готовими сусідніми кадрами — змішування за дробовою частиною: рух без сходинок
      let i = Math.floor(want / step) * step;
      while (i > 0 && !ready(i)) i -= step;                          // поки потрібний кадр не прийшов — найближчий готовий
      if (!ready(i)) return;
      const j = Math.min(N - 1, i + step), f = ready(j) ? Math.min(1, Math.max(0, (want - i) / step)) : 0;
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      // object-fit: cover у координатах кадру 1920×1080
      const s = Math.max(w / 1920, h / 1080), ox = (w - 1920 * s) / 2, oy = (h - 1080 * s) / 2;
      ctx.globalAlpha = 1;
      ctx.drawImage(frames[i], ox, oy, 1920 * s, 1080 * s);
      if (f > 0.01) { ctx.globalAlpha = f; ctx.drawImage(frames[j], ox, oy, 1920 * s, 1080 * s); }
      const a = ss(0.88, 0.99, p);
      if (a > 0 && photo.complete && photo.naturalWidth) {
        const z = 1 + 0.04 * ss(0.95, 1, p);                           // наприкінці фото трохи ширше, щоб закрити краї кадру
        const pw = box[2] * z, ph = box[3] * z, px = box[0] - (pw - box[2]) / 2, py = box[1] - (ph - box[3]) / 2;
        ctx.globalAlpha = a;
        ctx.drawImage(photo, ox + px * s, oy + py * s, pw * s, ph * s);
      }
    };
    const load = async () => {
      ext = (await avif) ? 'avif' : 'webp';
      photo.src = 'img/svitlo/photo.webp';
      // спершу кожен 6-й кадр (швидкий ескіз прольоту), далі решта
      const order = [];
      for (let i = 0; i < N; i += step * 6) order.push(i);
      for (let i = 0; i < N; i += step) if (!order.includes(i)) order.push(i);
      order.forEach(i => { const im = new Image(); im.decoding = 'async'; im.src = src(i); im.onload = () => { if (Math.abs(i - want) <= step * 6) draw(); }; frames[i] = im; });
      frames[0].onload = () => { proj.classList.add('on'); ScrollTrigger.refresh(); draw(); };
    };
    // кадри (18 МБ на ПК, 4 МБ на телефоні) вантажаться лише після load і лише коли людина почала гортати
    // або розділ на підході — щоб не конкурували з першим екраном і не рахувались у PageSpeed
    let started = false, pageLoaded = document.readyState === 'complete', near = false;
    const start = () => { if (!started && pageLoaded) { started = true; load(); } };
    // старт лише від скролу людини: PageSpeed для знімка всієї сторінки розтягує вікно, і спостерігач спрацьовував би сам
    const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; }, {rootMargin: '80% 0px'});
    io.observe(proj);
    addEventListener('load', () => { pageLoaded = true; if (near && scrollY > 0) start(); }, {once: true});
    addEventListener('scroll', () => start(), {passive: true});
    // прогрес з інерцією: кадр доганяє скрол плавно, навіть коли колесо смикає
    const tick = () => {
      p += (target - p) * 0.16;
      if (Math.abs(target - p) < 0.0004) p = target;
      want = Math.min(N - 1, p / 0.97 * (N - 1));
      steps.forEach(li => li.classList.toggle('on', p >= +li.dataset.at));
      fin.classList.toggle('in', p >= 0.93);
      draw();
      raf = p === target ? 0 : requestAnimationFrame(tick);
    };
    ScrollTrigger.create({trigger: proj, start: 'top top', end: 'bottom bottom', onUpdate: self => {
      target = self.progress;
      if (!raf) raf = requestAnimationFrame(tick);
    }});
    addEventListener('resize', draw);
  }

  // ---------- «Від землі до саду»: кадри острівця на canvas, кадр = прогрес прокрутки розділу ----------
  const grow = $('[data-grow]');
  if (grow) {
    const N = +grow.dataset.grow, step = innerWidth < 768 ? 2 : 1;   // на телефоні кожен другий кадр — удвічі менше ваги
    const cv = $('canvas', grow), ctx = cv.getContext('2d'), tags = $$('.tags li', grow);
    let frames = new Array(N), seq = 'island';
    const want = {i: 0};
    // тло за прокруткою: свої кольори в кожної концепції (ґрунт, камінь, креслення → зелень саду)
    let STOPS = [[0, [27, 22, 16]], [0.3, [24, 30, 22]], [0.7, [14, 38, 30]], [1, [9, 40, 34]]];
    const bgAt = p => { let k = 1; while (k < STOPS.length - 1 && p > STOPS[k][0]) k++; const [p0, c0] = STOPS[k - 1], [p1, c1] = STOPS[k], t = Math.min(1, Math.max(0, (p - p0) / (p1 - p0))); return `rgb(${c0.map((v, n) => Math.round(v + (c1[n] - v) * t)).join(' ')})`; };
    const src = i => `img/island/${seq}_${String(i + 1).padStart(4, '0')}.webp`;
    const draw = () => {
      let i = want.i - (want.i % step);
      while (i > 0 && !frames[i]?.complete) i -= step;          // поки потрібний кадр не прийшов — найближчий готовий
      const im = frames[i]; if (!im?.complete || !im.naturalWidth) return;
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      ctx.clearRect(0, 0, w, h); ctx.drawImage(im, 0, 0, w, h);
    };
    const load = () => { for (let i = 0; i < N; i += step) { const im = new Image(); im.decoding = 'async'; im.src = src(i); im.onload = () => { if (Math.abs(i - want.i) <= step) draw(); }; frames[i] = im; } };
    // кадри вантажаться, коли розділ на підході, а не з першим екраном
    let started = false;
    const start = () => { if (!started) { started = true; load(); } };
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); start(); } }, {rootMargin: '150% 0px'});
    io.observe(grow);
    addEventListener('load', () => setTimeout(start, 2500), {once: true});   // запасний шлях, якщо спостерігач не спрацював
    grow.classList.add('on');
    ScrollTrigger.create({trigger: grow, start: 'top top', end: 'bottom bottom', onUpdate: self => {
      want.i = Math.min(N - 1, Math.round(self.progress * (N - 1)));
      tags.forEach(li => li.classList.toggle('in', want.i + 1 >= +li.dataset.from));
      grow.style.setProperty('--grow-bg', bgAt(self.progress));
      draw();
    }});
    addEventListener('resize', draw);

    // прототип: вибір концепції розділу (кадри, заголовок, виноски, кольори тла)
    const CONCEPTS = {
      island: {name: 'А «Острівець»', note: 'Шматок землі в повітрі обертається, на ньому з голої землі виростає сад — як камінь на produx.design.', title: 'Сад росте на очах',
        tags: [[14, 'Газон за день', 'svc-gazon'], [34, 'Доріжки й плитка', 'svc-blagoustrij'], [52, 'Самшит і туї з власних розсадників', 'svc-ozelenennya'], [78, 'Дерева-крупноміри', 'case-svitlo-park']],
        stops: [[0, [27, 22, 16]], [0.3, [24, 30, 22]], [0.7, [14, 38, 30]], [1, [9, 40, 34]]]},
      section: {name: 'Б «Розкладка шарів»', note: 'Основа саду шарами: щебінь, пісок, геотекстиль, ґрунт із трубами автополиву розходяться в повітрі й складаються, зверху росте газон і рослини.', title: 'Що під газоном',
        tags: [[8, 'Дренаж: щебінь, пісок, геотекстиль', 'svc-blagoustrij'], [24, 'Ґрунт і труби автополиву', 'svc-polyv'], [74, 'Рулонний газон', 'svc-gazon'], [88, 'Форсунки поливу й рослини', 'svc-ozelenennya']],
        stops: [[0, [30, 30, 28]], [0.45, [36, 30, 22]], [0.75, [16, 36, 28]], [1, [9, 40, 34]]]},
      plan: {name: 'В «Від креслення до саду»', note: 'Камера над кресленням ділянки; креслення тане, камера нахиляється, і сад виростає точно за планом.', title: 'Від креслення до саду',
        tags: [[4, 'Ландшафтний проєкт', 'svc-dyzajn'], [40, '3D-візуалізація', 'hero-b-aerial'], [56, 'Реалізація своїми бригадами', 'svc-blagoustrij'], [86, 'Догляд за садом', 'svc-gazon']],
        stops: [[0, [28, 38, 40]], [0.35, [30, 32, 26]], [0.7, [16, 36, 28]], [1, [9, 40, 34]]]},
      yard: {name: 'Г «Двір до і після»', note: 'Двір біля будинку: купи ґрунту й піддони зникають, з’являються тераса, газон, кулі самшиту, живопліт із туї й дерево.', title: 'Двір до і після',
        tags: [[10, 'Підготовка основи', 'svc-orenda'], [20, 'Тераса й доріжки з плитки', 'svc-blagoustrij'], [40, 'Рулонний газон', 'svc-gazon'], [56, 'Живопліт із туї й озеленення', 'svc-ozelenennya']],
        stops: [[0, [34, 30, 26]], [0.4, [28, 30, 24]], [1, [12, 36, 30]]]},
    };
    const IDEAS = 'Ще дві ідеї без анімації: Д «Політ крізь сад» — камера пролітає готовим об’єктом (сцена Світлопарку в Unreal уже є); Е «Одне дерево» — саджанець виростає в крупномір.';
    const setConcept = key => {
      const c = CONCEPTS[key]; if (!c) return;
      seq = key; STOPS = c.stops; frames = new Array(N);
      const h = $('#grow-t'); h.removeAttribute('data-reveal'); h.textContent = c.title;
      $('.intro .mono', grow).textContent = c.name;
      tags.forEach((li, n) => { li.dataset.from = c.tags[n][0]; $('span', li).innerHTML = `<b class="mono">0${n + 1}</b> ${c.tags[n][1]}`; $('i', li).style.setProperty('--img', `url(img/${c.tags[n][2]}.webp)`); });
      $('.poster', grow).src = `img/island/${key}_0120.webp`;
      if (started) load();
      ScrollTrigger.refresh(); draw();
    };
    const box = document.createElement('div'); box.className = 'concepts';
    box.innerHTML = `<label for="concept"><span class="mono">Концепція розділу нижче</span><select id="concept">${Object.entries(CONCEPTS).map(([k, c]) => `<option value="${k}">${c.name}</option>`).join('')}</select></label>
      <p class="note"></p><p class="ideas">${IDEAS}</p><button type="button" class="btn ghost">Скопіювати для Claude</button><output class="mono" aria-live="polite"></output>`;
    grow.before(box);
    const sel = $('select', box), note = $('.note', box);
    const sync = () => { note.textContent = CONCEPTS[sel.value].note; };
    sel.addEventListener('change', () => { setConcept(sel.value); sync(); });
    $('button', box).addEventListener('click', async () => {
      const text = `Green Garth+, розділ «Від землі до саду»: обираю концепцію ${CONCEPTS[sel.value].name}.`;
      let ok = false; try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { ok = document.execCommand('copy'); } catch (e2) {} ta.remove(); }
      $('output', box).textContent = ok ? 'Скопійовано' : text;
    });
    sync();
  }

  // ---------- 8.6 сюжет «від неба до саду» ----------
  if (story) {
    story.classList.add('story-on');
    const L = $$('.layer', story), intro = $('.intro', story);
    L.forEach((l, i) => { l.style.zIndex = i + 1; });
    intro.style.zIndex = 20;
    gsap.set(L[1], {autoAlpha: 0}); gsap.set(L.slice(2), {clipPath: 'circle(0% at 50% 62%)'}); gsap.set(L.slice(2).map(l => $('.tag', l)), {autoAlpha: 0, yPercent: 60});
    const tl = gsap.timeline({defaults: {ease: 'none'}, scrollTrigger: {trigger: story, start: 'top top', end: 'bottom bottom', scrub: 0.6}});
    tl.fromTo($('img', L[0]), {scale: 1, filter: 'blur(0px)'}, {scale: 2.6, filter: 'blur(6px)', ease: 'power1.in', duration: 3}, 0)
      .to(intro, {autoAlpha: 0, y: -50, duration: 1}, 1.4)
      .to(L[0], {autoAlpha: 0, duration: 0.9}, 2.3)
      .to(L[1], {autoAlpha: 1, duration: 0.9}, 2.3)
      .fromTo($('img', L[1]), {scale: 1.35, filter: 'blur(10px)'}, {scale: 1, filter: 'blur(0px)', duration: 1.6, ease: 'power2.out'}, 2.3);
    [2, 3, 4].forEach((k, i) => {
      const t0 = 4.1 + i * 2.1;
      tl.to(L[k], {clipPath: 'circle(80% at 50% 62%)', duration: 1.4, ease: 'power2.inOut'}, t0)
        .to($('.tag', L[k]), {autoAlpha: 1, yPercent: 0, duration: 0.8, ease: 'power2.out'}, t0 + 0.6);
    });
    tl.to({}, {duration: 0.8});
  }

  // ---------- 8.7, 8.8, 8.16 перший екран: розсунутий напис, жива G, збирання в лого шапки ----------
  const hero = $('.hero'), logoSvg = $('.head .logo svg');
  if (hero && logoSvg) heroLockup();
  else if (hero) hero.querySelector('.static-g')?.style.setProperty('visibility', 'visible');
  if (hero) TilesBg(hero);

  // ---------- тло першого екрана: плитка, під курсором плитки розступаються й проростає газон ----------
  // Квадратна дрібна плитка з тонкими швами; деформація дуже сильна (стиск 0,88 + зсув від курсора),
  // плитки швидко повертаються. Кольори лого (м'ята / смарагд). Малюється лише поки перший екран у кадрі.
  function TilesBg(sec) {
    const cv = document.createElement('canvas'); cv.className = 'tiles'; cv.setAttribute('aria-hidden', 'true');
    sec.prepend(cv);
    const ctx = cv.getContext('2d');
    const C = {bg: [244, 250, 246], tile: [[226, 243, 233], [238, 249, 242]], seam: [196, 228, 211], grass: [[45, 163, 126], [185, 236, 205]]};
    const SIZE = 24, GAP = 1, RAD = 170, SHRINK = 0.88, PUSH = 0.95 * SIZE, HEAL = 1.6;
    let W = 0, H = 0, tiles = [], mouse = null, cur = null, last = performance.now(), on = false, raf = 0;
    const rnd = (i, j) => { const x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); };
    const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
    const sm = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);
    function build() {
      const r = sec.getBoundingClientRect(), dpr = Math.min(1.5, devicePixelRatio || 1);
      W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      tiles = [];
      for (let j = 0, y = 0; y < H + SIZE; y += SIZE, j++) for (let i = 0, x = 0; x < W + SIZE; x += SIZE, i++)
        tiles.push({x, y, cx: x + SIZE / 2, cy: y + SIZE / 2, tone: rnd(j + 3, i + 7), ph: rnd(i, j), e: 0});
    }
    function frame(now) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (mouse) cur = cur ? {x: cur.x + (mouse.x - cur.x) * Math.min(1, dt * 16), y: cur.y + (mouse.y - cur.y) * Math.min(1, dt * 16)} : {...mouse};
      else cur = null;
      ctx.fillStyle = `rgb(${C.seam})`; ctx.fillRect(0, 0, W, H);
      const k0 = 1 - GAP / SIZE; let busy = false;
      for (const p of tiles) {
        const target = cur ? sm(1 - Math.hypot(p.cx - cur.x, p.cy - cur.y) / RAD) : 0;
        p.e += target > p.e ? (target - p.e) * Math.min(1, dt * 5) : (target - p.e) * Math.min(1, dt * HEAL);
        if (p.e < 0.002) p.e = 0; else busy = true;
        const e = p.e, h = SIZE / 2;
        if (e > 0.02) { ctx.fillStyle = `rgb(${mix(C.grass[0], C.grass[1], 0.3 + 0.5 * p.ph)})`; ctx.fillRect(p.x, p.y, SIZE, SIZE); }
        const k = k0 * (1 - SHRINK * e);
        let ox = 0, oy = 0;
        if (cur && e > 0.01) { const dx = p.cx - cur.x, dy = p.cy - cur.y, L = Math.hypot(dx, dy) || 1, f = e * (1 - e * 0.35) * PUSH; ox = dx / L * f; oy = dy / L * f; }
        ctx.fillStyle = `rgb(${mix(C.tile[0], C.tile[1], p.tone)})`;
        ctx.fillRect(p.cx - h * k + ox, p.cy - h * k + oy, 2 * h * k, 2 * h * k);
      }
      if (on && (busy || mouse)) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (on && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
    sec.addEventListener('pointermove', e => { const r = sec.getBoundingClientRect(); mouse = {x: e.clientX - r.left, y: e.clientY - r.top}; kick(); });
    sec.addEventListener('pointerleave', () => { mouse = null; kick(); });
    new IntersectionObserver(es => { on = es[0].isIntersecting; if (on) kick(); }, {threshold: 0}).observe(sec);
    addEventListener('resize', () => { build(); on = true; kick(); });
    build(); on = true; frame(performance.now());
  }

  function heroLockup() {
    const vb = logoSvg.viewBox.baseVal, gi = $('image, [data-ribbon]', logoSvg), ribbon = gi.hasAttribute('data-ribbon');
    const G = {x: +gi.getAttribute('x'), y: +gi.getAttribute('y'), w: +gi.getAttribute('width'), h: +gi.getAttribute('height')};
    const src = $$('path[data-l]', logoSvg).map(p => ({p, b: p.getBBox(), row: +p.dataset.row}));
    const base = $('path[data-base]', logoSvg);
    const ov = document.createElement('div'); ov.className = 'lockup'; ov.setAttribute('aria-hidden', 'true');
    const svg = document.createElementNS(NS, 'svg'); ov.appendChild(svg);
    // переливи літер (конюшина) живуть у defs лого шапки — накладці потрібна копія
    $$('defs', logoSvg).forEach(d => svg.appendChild(d.cloneNode(true)));
    const L = src.map(s => { const c = s.p.cloneNode(true); svg.appendChild(c); return {...s, c}; });
    const lcv = document.createElement('canvas'); lcv.className = 'lgrass'; ov.appendChild(lcv);
    const LT = new Float32Array(L.length * 3);          // перетворення кожної літери: масштаб, зсув x, y (px)
    const slot = document.createElement('div'); slot.className = 'gslot';
    slot.innerHTML = ribbon ? `<svg viewBox="${G.x} ${G.y} ${G.w} ${G.h}">${gi.outerHTML}</svg>` : `<svg viewBox="${G.x} ${G.y} ${G.w} ${G.h}" preserveAspectRatio="none"><path d="${base.getAttribute('d')}"/></svg><img src="${gi.getAttribute('href')}" alt=""><canvas></canvas>`;
    if (ribbon) hero.querySelector('.static-g')?.remove();
    ov.appendChild(slot); document.body.appendChild(ov);
    const poster = $('img', slot), silhouette = $('svg', slot); if (poster) gsap.set(poster, {opacity: 0});

    let lay = null, grass = null, lgrass = null, lgLive = false;
    const plate = $('.plate:not(.sr-only)', hero);
    function layout() {
      const vw = innerWidth, vh = innerHeight, gut = vw < 768 ? 24 : 48, hd = head.offsetHeight;
      const R = logoSvg.getBoundingClientRect(), sC = R.height / vb.height;
      const band = (plate ? plate.getBoundingClientRect().top + scrollY - hero.offsetTop : vh) - hd, pad = vw < 768 ? 12 : Math.min(32, band * 0.08);
      const Hs = Math.max(56, Math.min(vw < 768 ? Math.min(vh * 0.26, vw * 0.42) : Math.min(vh * 0.5, vw * 0.36), band - 2 * pad));
      const gs = Hs / G.h, gx = gut, gy = hd + Math.max(pad, (band - Hs) / 2);
      const cap = Math.max(...L.filter(l => l.row >= 0).map(l => l.b.height)), sS0 = (Hs * (vw < 768 ? 0.26 : 0.3)) / cap;
      const x0 = gx + G.w * gs + vw * 0.04, plus = L.find(l => l.row < 0), pw = plus ? plus.b.width * sS0 : 0, x1 = vw - gut - pw * 1.6;
      // на вузькому екрані «розсунутий» напис не влазить: зменшуємо літери, щоб між ними лишався проміжок ≥ 12 % висоти
      const fit = Math.min(...[0, 1].map(row => { const rl = L.filter(l => l.row === row); return (x1 - x0) / (rl.reduce((s, l) => s + l.b.width, 0) + cap * 0.12 * Math.max(0, rl.length - 1)); }));
      const sS = Math.min(sS0, fit), dy = cap * (sS0 - sS) / 2;
      const pos = new Map();
      for (const row of [0, 1]) {
        const rl = L.filter(l => l.row === row).sort((a, b) => a.b.x - b.b.x), tot = rl.reduce((s, l) => s + l.b.width * sS, 0), gap = (x1 - x0 - tot) / Math.max(1, rl.length - 1);
        let x = x0; const y = gy + Hs * (row ? 0.62 : 0.24) + dy;
        for (const l of rl) { pos.set(l, {x, y}); x += l.b.width * sS + gap; }
      }
      if (plus) pos.set(plus, {x: vw - gut - plus.b.width * sS, y: gy + Hs * 0.43 + dy});
      lay = {R, sC, sS, gs, gx, gy, pos, Gc: {x: R.left + (G.x - vb.x) * sC, y: R.top + (G.y - vb.y) * sC, s: sC}};
      slot.style.width = G.w * gs + 'px'; slot.style.height = G.h * gs + 'px';
    }
    const lerp = (a, b, t) => a + (b - a) * t;
    let P = 0;
    function draw(p) {
      if (!lay) return;
      P = p; const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      for (const l of L) {
        const sp = lay.pos.get(l), s = lerp(lay.sS, lay.sC, e);
        const tx = lerp(sp.x, lay.R.left + (l.b.x - vb.x) * lay.sC, e), ty = lerp(sp.y, lay.R.top + (l.b.y - vb.y) * lay.sC, e);
        l.c.setAttribute('transform', `matrix(${s} 0 0 ${s} ${tx - l.b.x * s} ${ty - l.b.y * s})`);
        const k = L.indexOf(l); LT[k * 3] = s; LT[k * 3 + 1] = tx - l.b.x * s; LT[k * 3 + 2] = ty - l.b.y * s;
      }
      // поки трава жива, літери утворює лише вона (контур прозорий); коли напис збирається в лого шапки,
      // трава тане, а темні контури літер повертаються
      const gk = lgLive ? 1 - Math.min(1, Math.max(0, (p - 0.45) / 0.4)) : 0;
      lcv.style.opacity = gk;
      ov.style.setProperty('--lf', `rgb(11 31 28 / ${(1 - gk).toFixed(3)})`);
      const gsc = lerp(1, lay.Gc.s / lay.gs, e);
      slot.style.transform = `translate(${lerp(lay.gx, lay.Gc.x, e)}px, ${lerp(lay.gy, lay.Gc.y, e)}px) scale(${gsc})`;
      const done = p >= 0.995;
      ov.style.visibility = done ? 'hidden' : 'visible';
      document.body.classList.toggle('gathering', !done);
      grass?.setActive(!done && !document.hidden);
      lgrass?.setActive(!done && !document.hidden && P < 0.85);
    }
    layout(); draw(0);
    addEventListener('resize', () => { layout(); draw(P); });
    if (Q.has('p')) {
      draw(Math.min(1, Math.max(0, +Q.get('p'))));
    } else ScrollTrigger.create({trigger: hero, start: 'top top', end: () => '+=' + innerHeight * 0.7, scrub: true, onUpdate: self => draw(self.progress), onRefresh: self => { layout(); draw(self.progress); }});

    // заставка: при кожному відкритті сторінки, поверх уже видимого першого кадру, ≤ 1,5 с
    const intro = !Q.has('nointro') && !Q.has('p');
    if (intro) {
      gsap.from(L.map(l => l.c), {opacity: 0, y: 60, filter: 'blur(10px)', duration: 0.9, stagger: 0.06, ease: 'power3.out'});
      gsap.from(silhouette, {opacity: 0, scale: 0.92, transformOrigin: '50% 100%', duration: 0.8, ease: 'power3.out'});
    } else if (poster) gsap.set(poster, {opacity: 1});
    const t0 = performance.now();
    const startGrass = () => {
      if (ribbon) return;
      if (!window.WebGL2RenderingContext || typeof earcut === 'undefined') { gsap.to(poster, {opacity: 1, duration: 0.6}); return; }
      const fallback = setTimeout(() => gsap.to(poster, {opacity: 1, duration: 0.6}), 2500);
      fetch('grass.json').then(r => r.json()).then(D => {
        clearTimeout(fallback);
        const grow = intro && performance.now() - t0 < 2500;
        grass = Grass($('canvas', slot), D, slot, {grow, onReady: () => slot.classList.add('live'), onSlow: () => { slot.classList.remove('live'); gsap.to(poster, {opacity: 1, duration: 0.4}); }});
        grass?.setActive(P < 0.995);
        lgrass = LetterGrass(lcv, D, L, LT, lay ? lay.gs / lay.sS : 1, {grow,
          onReady: () => { lgLive = true; draw(P); }, onSlow: () => { lgLive = false; draw(P); }});
        lgrass?.setActive(P < 0.85);
      }).catch(() => gsap.to(poster, {opacity: 1, duration: 0.6}));
    };
    if (document.readyState === 'complete') startGrass(); else addEventListener('load', startGrass, {once: true});
    document.addEventListener('visibilitychange', () => { grass?.setActive(!document.hidden && P < 0.995); lgrass?.setActive(!document.hidden && P < 0.85); });
  }

  // ---------- трава на літерах REEN / ARTH / «+»: ті самі травинки, що на G, «засаджені» в контур кожної літери ----------
  // Контур літери растеризується в маску; у випадкові точки маски ставляться копії справжніх травинок G
  // (форма, нахил, кольори), зменшені так, щоб на екрані були того ж розміру, що й на G. Ріст знизу вгору хвилею
  // зліва направо, вітер і курсор — як у G. Кожна літера має своє перетворення (u_L), бо напис збирається в шапку.
  function LetterGrass(cv, D, L, LT, fScale, opt) {
    const gl = cv.getContext('webgl2', {antialias: true, premultipliedAlpha: true, alpha: true});
    if (!gl || L.length > 16) return null;
    const hexRgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255);
    const GRAD = Object.fromEntries(Object.entries(D.gradients).map(([k, v]) => [k, [hexRgb(v[0]), hexRgb(v[1])]]));
    const rnd = (i => () => (i = (i * 16807) % 2147483647) / 2147483647)(11);
    const flatten = d => {
      const subs = []; let cur = null, x = 0, y = 0;
      for (let i = 0; i < d.length;) {
        const op = d[i++];
        if (op === 0) { x = d[i]; y = d[i + 1]; i += 2; cur = [x, y]; subs.push(cur); }
        else if (op === 1) { x = d[i]; y = d[i + 1]; i += 2; cur.push(x, y); }
        else if (op === 2) { const [x1, y1, x2, y2, x3, y3] = d.slice(i, i + 6); i += 6; for (let k = 1; k <= 4; k++) { const t = k / 4, m = 1 - t; cur.push(m * m * m * x + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3, m * m * m * y + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3); } x = x3; y = y3; }
      }
      return subs.map(s => { const n = s.length; if (n > 6 && Math.abs(s[0] - s[n - 2]) < 1e-3 && Math.abs(s[1] - s[n - 1]) < 1e-3) s.length = n - 2; return s; }).filter(s => s.length >= 6);
    };
    // густота як на G: травинок на одиницю площі маски G (маска — найбільша фігура D.shapes)
    const R = 3;
    const maskOf = (d, b) => {
      const w = Math.ceil(b.width * R) + 2, h = Math.ceil(b.height * R) + 2, c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.setTransform(R, 0, 0, R, (1 - b.x) * R, (1 - b.y) * R); x.fill(new Path2D(d));
      const a = x.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h); let n = 0;
      for (let i = 0; i < m.length; i++) if (a[i * 4 + 3] > 127) { m[i] = 1; n++; }
      return {m, w, h, n};
    };
    const gM = D.mark, gb = {x: gM[0], y: gM[1], width: gM[2] - gM[0], height: gM[3] - gM[1]};
    const toD = ops => { let s = '', i = 0; while (i < ops.length) { const op = ops[i++]; if (op === 0) { s += `M${ops[i]} ${ops[i + 1]}`; i += 2; } else if (op === 1) { s += `L${ops[i]} ${ops[i + 1]}`; i += 2; } else { s += `C${ops.slice(i, i + 6).join(' ')}`; i += 6; } } return s + 'Z'; };
    let gArea = 0; for (const sh of D.shapes) { const mm = maskOf(toD(sh), gb); gArea = Math.max(gArea, mm.n); }
    // тонкі лінії літер: травинки дрібніші, ніж на G, інакше кінчики розмивають контур
    const f = Math.min(0.6, Math.max(0.22, fScale * (opt.blade || 0.55))), dens = D.blades.length / Math.max(1, gArea) / (f * f) * (opt.density || 1.7);
    const NA = 14, verts = [], idx = [];
    const order = L.map((l, i) => i).sort((a, b) => L[a].b.x - L[b].b.x);
    L.forEach((l, li) => {
      const mk = maskOf(l.p.getAttribute('d'), l.b), wave = order.indexOf(li) / Math.max(1, L.length - 1);
      const n = Math.min(7000, Math.round(mk.n * dens));
      for (let k = 0, tries = 0; k < n && tries < n * 30; tries++) {
        const px = Math.floor(rnd() * mk.w), py = Math.floor(rnd() * mk.h);
        // основа травинки — не ближче ~0.8 одиниці до краю літери (перевірка чотирьох сусідів), щоб контур лишався чітким
        const e = Math.max(1, Math.round(0.8 * R)), at = (x, y) => x >= 0 && y >= 0 && x < mk.w && y < mk.h && mk.m[y * mk.w + x];
        if (!at(px, py) || !at(px - e, py) || !at(px + e, py) || !at(px, py - e) || !at(px, py + e)) continue;
        k++;
        const X = l.b.x - 1 + (px + rnd()) / R, Y = l.b.y - 1 + (py + rnd()) / R;
        const a = D.blades[Math.floor(rnd() * D.blades.length)];
        const [s, g0x, g0y, g1x, g1y] = a, c = GRAD[s];
        const subs = flatten(a.slice(5)).map(sp => sp.map((v, i) => i % 2 ? Y + (v - g0y) * f : X + (v - g0x) * f));
        const G1x = X + (g1x - g0x) * f, G1y = Y + (g1y - g0y) * f;
        let ux = G1x - X, uy = G1y - Y; const gl2 = ux * ux + uy * uy || 1, ul = Math.sqrt(gl2); ux /= ul; uy /= ul;
        let pmin = 1e9, pmax = -1e9, bx = X, by = Y;
        for (const sp of subs) for (let i = 0; i < sp.length; i += 2) { const q = (sp[i] - X) * ux + (sp[i + 1] - Y) * uy; if (q < pmin) { pmin = q; bx = sp[i]; by = sp[i + 1]; } if (q > pmax) pmax = q; }
        const Lb = Math.max(0.5, pmax - pmin);
        const delay = 0.55 * (l.b.y + l.b.height - by) / l.b.height + 0.45 * wave + 0.2 * rnd(), ph = rnd() * 6.283, flex = 0.6 + 0.8 * rnd();
        for (const sp of subs) {
          const b0 = verts.length / NA;
          for (let i = 0; i < sp.length; i += 2) {
            const x = sp[i], y = sp[i + 1], h = ((x - X) * ux + (y - Y) * uy - pmin) / Lb;
            const t = Math.min(1, Math.max(0, ((x - X) * (G1x - X) + (y - Y) * (G1y - Y)) / gl2 / 0.9951));
            verts.push(x, y, bx, by, -uy, ux, h * h * Lb, c[0][0] + (c[1][0] - c[0][0]) * t, c[0][1] + (c[1][1] - c[0][1]) * t, c[0][2] + (c[1][2] - c[0][2]) * t, delay, ph, flex, li);
          }
          for (const q of earcut(sp)) idx.push(b0 + q);
        }
      }
    });
    const VS = `#version 300 es
in vec2 a_pos; in vec2 a_base; in vec2 a_n; in float a_hl; in vec3 a_col; in vec3 a_rnd; in float a_li;
uniform float u_t, u_grow, u_push, u_dpr; uniform vec2 u_mouse, u_view; uniform vec3 u_L[16];
out vec3 v_col;
float backEase(float t) { t = clamp(t, 0., 1.) - 1.; return 1. + 2.7 * t * t * t + 1.7 * t * t; }
float wind(vec2 p) { float k = .012, w = 1.6; float b = .55 + .45 * sin(p.x * k - u_t * w) * sin(p.x * k * .37 - u_t * w * .53 + 1.3); return .45 * (b + .18 * sin((p.x * .6 + p.y * .4) * k * 2.3 - u_t * w * 1.7)); }
void main() {
  vec3 T = u_L[int(a_li + .5)];
  float grow = u_grow > .5 ? backEase((u_t - .15 - a_rnd.x * 1.2) / .8) : 1.;
  vec2 m = (u_mouse - T.yz) / T.x;
  vec2 W = vec2(wind(a_base), 0.), d = a_base - m; float r = length(d);
  float R = 70. / max(T.x, .01) * .35;
  W += d / max(r, 1.) * u_push * 1.1 * smoothstep(R, 0., r);
  float bend = (dot(W, a_n) + .063 * sin(u_t * 7. + a_rnd.y)) * a_rnd.z;
  vec2 p = a_base + (a_pos - a_base) * grow + a_n * bend * a_hl * grow;
  vec2 s = p * T.x + T.yz;
  gl_Position = vec4(s.x / u_view.x * 2. - 1., 1. - s.y / u_view.y * 2., 0., 1.);
  v_col = a_col;
}`;
    const FS = `#version 300 es
precision mediump float; in vec3 v_col; out vec4 o; void main() { o = vec4(v_col, 1.); }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    [['a_pos', 2, 0], ['a_base', 2, 2], ['a_n', 2, 4], ['a_hl', 1, 6], ['a_col', 3, 7], ['a_rnd', 3, 10], ['a_li', 1, 13]].forEach(([n, size, off]) => { const l = gl.getAttribLocation(prog, n); if (l < 0) return; gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, NA * 4, off * 4); });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    const U = Object.fromEntries(['u_t', 'u_grow', 'u_push', 'u_mouse', 'u_view', 'u_L'].map(n => [n, gl.getUniformLocation(prog, n)]));
    const N = idx.length, LU = new Float32Array(16 * 3);
    const mouse = {x: -1e4, y: -1e4, push: 0, target: 0};
    addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.target = 1; });
    document.addEventListener('pointerleave', () => { mouse.target = 0; });
    let active = false, raf = 0, start = performance.now(), frames = 0, slowAcc = 0, readyCalled = false, last = 0;
    const frame = now => {
      raf = 0; if (!active) return;
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      mouse.push += (mouse.target - mouse.push) * 0.08;
      gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      LU.set(LT);
      gl.uniform1f(U.u_t, (now - start) / 1000); gl.uniform1f(U.u_grow, opt.grow ? 1 : 0); gl.uniform1f(U.u_push, mouse.push);
      gl.uniform2f(U.u_mouse, mouse.x, mouse.y); gl.uniform2f(U.u_view, innerWidth, innerHeight); gl.uniform3fv(U.u_L, LU);
      gl.drawElements(gl.TRIANGLES, N, gl.UNSIGNED_INT, 0);
      if (!readyCalled) { readyCalled = true; opt.onReady?.(); }
      if (frames++ > 10 && frames < 100) slowAcc += Math.max(0, (now - (last || now)) - 22);
      last = now;
      if (frames === 100 && COARSE && slowAcc / 90 > 4) { active = false; opt.onSlow?.(); return; }
      raf = requestAnimationFrame(frame);
    };
    return {blades: idx.length, setActive(on) { if (on === active) return; active = on; if (on && !raf) raf = requestAnimationFrame(frame); }};
  }

  // ---------- жива трава: 11 тисяч травинок на відеокарті ----------
  function Grass(cv, D, slot, opt) {
    const gl = cv.getContext('webgl2', {antialias: true, premultipliedAlpha: true, alpha: true});
    if (!gl) return null;
    const M = D.mark, hexRgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255);
    const GRAD = Object.fromEntries(Object.entries(D.gradients).map(([k, v]) => [k, [hexRgb(v[0]), hexRgb(v[1])]]));
    const flatten = d => {
      const subs = []; let cur = null, x = 0, y = 0;
      for (let i = 0; i < d.length;) {
        const op = d[i++];
        if (op === 0) { x = d[i]; y = d[i + 1]; i += 2; cur = [x, y]; subs.push(cur); }
        else if (op === 1) { x = d[i]; y = d[i + 1]; i += 2; cur.push(x, y); }
        else if (op === 2) { const [x1, y1, x2, y2, x3, y3] = d.slice(i, i + 6); i += 6; for (let k = 1; k <= 5; k++) { const t = k / 5, m = 1 - t; cur.push(m * m * m * x + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3, m * m * m * y + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3); } x = x3; y = y3; }
      }
      return subs.map(s => { const n = s.length; if (n > 6 && Math.abs(s[0] - s[n - 2]) < 1e-3 && Math.abs(s[1] - s[n - 1]) < 1e-3) s.length = n - 2; return s; }).filter(s => s.length >= 6);
    };
    const NA = 13, verts = [], idx = [], rnd = (i => () => (i = (i * 16807) % 2147483647) / 2147483647)(7);
    // підкладка G — темна заливка під травою, без згину
    const shapes = D.shapes.map(d => ({d, a: 0}));
    let baseD = shapes[0].d, best = 0;
    for (const s of shapes) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const sp of flatten(s.d)) for (let i = 0; i < sp.length; i += 2) { x0 = Math.min(x0, sp[i]); x1 = Math.max(x1, sp[i]); y0 = Math.min(y0, sp[i + 1]); y1 = Math.max(y1, sp[i + 1]); } const a = (x1 - x0) * (y1 - y0); if (a > best) { best = a; baseD = s.d; } }
    const ink = hexRgb(D.ink), gy0 = M[1], gy1 = M[3];
    for (const sp of flatten(baseD)) { const b = verts.length / NA; for (let i = 0; i < sp.length; i += 2) verts.push(sp[i], sp[i + 1], sp[i], sp[i + 1], 0, 0, 0, ...ink, 0, 0, 0); for (const k of earcut(sp)) idx.push(b + k); }
    for (const a of D.blades) {
      const [s, g0x, g0y, g1x, g1y] = a, subs = flatten(a.slice(5)), c = GRAD[s];
      let ux = g1x - g0x, uy = g1y - g0y; const gl2 = ux * ux + uy * uy || 1, ul = Math.sqrt(gl2); ux /= ul; uy /= ul;
      let pmin = 1e9, pmax = -1e9, bx = 0, by = 0;
      for (const sp of subs) for (let i = 0; i < sp.length; i += 2) { const p = (sp[i] - g0x) * ux + (sp[i + 1] - g0y) * uy; if (p < pmin) { pmin = p; bx = sp[i]; by = sp[i + 1]; } if (p > pmax) pmax = p; }
      const Lb = Math.max(1, pmax - pmin), delay = 0.85 * (gy1 - by) / (gy1 - gy0) + 0.25 * rnd(), ph = rnd() * 6.283, flex = 0.6 + 0.8 * rnd();
      for (const sp of subs) {
        const b = verts.length / NA;
        for (let i = 0; i < sp.length; i += 2) {
          const x = sp[i], y = sp[i + 1], h = ((x - g0x) * ux + (y - g0y) * uy - pmin) / Lb;
          const t = Math.min(1, Math.max(0, ((x - g0x) * (g1x - g0x) + (y - g0y) * (g1y - g0y)) / gl2 / 0.9951));
          verts.push(x, y, bx, by, -uy, ux, h * h * Lb, c[0][0] + (c[1][0] - c[0][0]) * t, c[0][1] + (c[1][1] - c[0][1]) * t, c[0][2] + (c[1][2] - c[0][2]) * t, delay, ph, flex);
        }
        for (const k of earcut(sp)) idx.push(b + k);
      }
    }
    const VS = `#version 300 es
in vec2 a_pos; in vec2 a_base; in vec2 a_n; in float a_hl; in vec3 a_col; in vec3 a_rnd;
uniform float u_t, u_grow, u_push; uniform vec2 u_mouse; uniform vec4 u_box;
out vec3 v_col;
float backEase(float t) { t = clamp(t, 0., 1.) - 1.; return 1. + 2.7 * t * t * t + 1.7 * t * t; }
float wind(vec2 p) { float k = .012, w = 1.6; float b = .55 + .45 * sin(p.x * k - u_t * w) * sin(p.x * k * .37 - u_t * w * .53 + 1.3); return .45 * (b + .18 * sin((p.x * .6 + p.y * .4) * k * 2.3 - u_t * w * 1.7)); }
void main() {
  float grow = u_grow > .5 ? backEase((u_t - .15 - a_rnd.x * 1.1) / .8) : 1.;
  if (a_hl == 0. && a_rnd.z == 0.) grow = 1.;
  vec2 W = vec2(wind(a_base), 0.), d = a_base - u_mouse; float r = length(d);
  W += d / max(r, 1.) * u_push * 1.1 * smoothstep(70., 0., r);
  float bend = (dot(W, a_n) + .063 * sin(u_t * 7. + a_rnd.y)) * a_rnd.z;
  vec2 p = a_base + (a_pos - a_base) * grow + a_n * bend * a_hl * grow;
  vec2 c = (p - u_box.xy) / (u_box.zw - u_box.xy);
  gl_Position = vec4(c.x * 2. - 1., 1. - c.y * 2., 0., 1.);
  v_col = a_col;
}`;
    const FS = `#version 300 es
precision mediump float; in vec3 v_col; out vec4 o; void main() { o = vec4(v_col, 1.); }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    [['a_pos', 2, 0], ['a_base', 2, 2], ['a_n', 2, 4], ['a_hl', 1, 6], ['a_col', 3, 7], ['a_rnd', 3, 10]].forEach(([n, size, off]) => { const l = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, NA * 4, off * 4); });
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
    const U = Object.fromEntries(['u_t', 'u_grow', 'u_push', 'u_mouse', 'u_box'].map(n => [n, gl.getUniformLocation(prog, n)]));
    const N = idx.length;
    const size = () => { const r = slot.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); const w = Math.round(parseFloat(slot.style.width) * dpr), h = Math.round(parseFloat(slot.style.height) * dpr); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } };
    // курсор у координатах лого; присутність згладжується, щоб трава поверталась плавно
    const mouse = {x: -1e4, y: -1e4, push: 0, target: 0};
    addEventListener('pointermove', e => { const r = slot.getBoundingClientRect(); if (!r.width) return; mouse.x = M[0] + (e.clientX - r.left) / r.width * (M[2] - M[0]); mouse.y = M[1] + (e.clientY - r.top) / r.height * (M[3] - M[1]); mouse.target = 1; });
    document.addEventListener('pointerleave', () => { mouse.target = 0; });
    let active = false, raf = 0, start = performance.now(), frames = 0, slowAcc = 0, readyCalled = false;
    const frame = now => {
      raf = 0; if (!active) return;
      size(); const t = (now - start) / 1000;
      mouse.push += (mouse.target - mouse.push) * 0.08;
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U.u_t, t); gl.uniform1f(U.u_grow, opt.grow ? 1 : 0); gl.uniform1f(U.u_push, mouse.push); gl.uniform2f(U.u_mouse, mouse.x, mouse.y); gl.uniform4f(U.u_box, M[0], M[1], M[2], M[3]);
      gl.drawElements(gl.TRIANGLES, N, gl.UNSIGNED_INT, 0);
      if (!readyCalled) { readyCalled = true; opt.onReady?.(); }
      // слабкий пристрій: якщо в середньому кадр довший за 22 мс — лишаємо нерухоме зображення
      if (frames++ > 10 && frames < 100) slowAcc += Math.max(0, (now - (frame.last || now)) - 22);
      frame.last = now;
      if (frames === 100 && COARSE && slowAcc / 90 > 4) { active = false; opt.onSlow?.(); return; }
      raf = requestAnimationFrame(frame);
    };
    return {setActive(on) { if (on === active) return; active = on; if (on && !raf) raf = requestAnimationFrame(frame); }};
  }

  // ---------- службовий ?grass=edge|meadow|seams|trail — трава на фоні, чотири напрями ----------
  // кольори з лого: пари «основа → кінчик» з вихідника, вага — скільки таких травинок у G
  const PAL = [['#4c8c3d', '#a7c82e', 29], ['#326836', '#a7c82e', 18], ['#395e33', '#81bb34', 18], ['#366033', '#81bb34', 18], ['#2e6c39', '#81bb34', 11], ['#326836', '#53a83c', 6]];
  const hexRgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16) / 255);
  const PALW = PAL.reduce((s, p) => s + p[2], 0);
  const pickPal = r => { let x = r * PALW; for (const p of PAL) if ((x -= p[2]) <= 0) return p; return PAL[0]; };
  const toWhite = (c, k) => c.map(v => v + (1 - v) * k);

  // одна травинка — смуга з 7 рівнів; тисячі екземплярів з одного буфера (instancing), згин і вітер у шейдері
  function GrassField(cv, opt) {
    const gl = cv.getContext('webgl2', {antialias: true, premultipliedAlpha: true, alpha: true});
    if (!gl) return null;
    const SEG = 6, mesh = [];
    for (let i = 0; i <= SEG; i++) mesh.push(-1, i / SEG, 1, i / SEG);
    const VS = `#version 300 es
in vec2 a_m; in vec4 a_i0; in vec4 a_i1; in vec3 a_c0; in vec3 a_c1;
uniform vec2 u_res; uniform float u_t, u_push, u_wind; uniform vec2 u_mouse;
out vec3 v_c; out float v_a;
float wind(float x, float t) { float k = .006; return .55 + .45 * sin(x * k - t * 1.6) * sin(x * k * .37 - t * .85 + 1.3); }
void main() {
  float v = a_m.y, age = u_t - a_i1.z, life = a_i1.w;
  float g = clamp(age / .8, 0., 1.), fade = 1.;
  if (life > 0.) { g = clamp(age / .35, 0., 1.); fade = 1. - clamp((age - life + .7) / .7, 0., 1.); }
  g = 1. - pow(1. - g, 3.);
  float h = a_i0.z * g * (life > 0. ? .35 + .65 * fade : 1.), w = a_i0.w * pow(1. - v, .8);
  vec2 root = a_i0.xy, d = root - u_mouse;
  float W = (wind(root.x, u_t) * u_wind + .05 * sin(u_t * 6. + a_i1.y)) * .4;
  float push = u_push * smoothstep(150., 0., length(d)) * (d.x < 0. ? -1. : 1.) * .9;
  vec2 p = root + vec2(a_m.x * w * .5 + (a_i1.x + W + push) * v * v * h, -v * h);
  vec2 c = p / u_res;
  gl_Position = vec4(c.x * 2. - 1., 1. - c.y * 2., 0., 1.);
  v_c = mix(a_c0, a_c1, v); v_a = fade;
}`;
    const FS = `#version 300 es
precision mediump float; in vec3 v_c; in float v_a; uniform float u_alpha; out vec4 o;
void main() { float a = v_a * u_alpha; o = vec4(v_c * a, a); }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STATIC_DRAW);
    const am = gl.getAttribLocation(prog, 'a_m'); gl.enableVertexAttribArray(am); gl.vertexAttribPointer(am, 2, gl.FLOAT, false, 0, 0);
    const NI = 14, ibuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ibuf);
    [['a_i0', 4, 0], ['a_i1', 4, 4], ['a_c0', 3, 8], ['a_c1', 3, 11]].forEach(([n, sz, off]) => { const l = gl.getAttribLocation(prog, n); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, sz, gl.FLOAT, false, NI * 4, off * 4); gl.vertexAttribDivisor(l, 1); });
    const U = Object.fromEntries(['u_res', 'u_t', 'u_push', 'u_wind', 'u_mouse', 'u_alpha'].map(n => [n, gl.getUniformLocation(prog, n)]));
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    let W = 0, H = 0, N = 0, data = null, start = performance.now();
    const now = () => (performance.now() - start) / 1000;
    const put = (i, x, y, h, w, lean, t0, life, c0, c1) => { const o = i * NI; data.set([x, y, h, w, lean, Math.random() * 6.28, t0, life, ...c0, ...c1], o); };
    const resize = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
      opt.place?.(cv);
      if (!r.width || (Math.round(r.width) === W && Math.round(r.height) === H)) return;
      W = Math.round(r.width); H = Math.round(r.height); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const items = opt.layout(W, H);
      if (items) { N = items.length; data = new Float32Array(Math.max(1, N) * NI); items.forEach((it, i) => put(i, ...it)); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); }
      else if (!data) { N = opt.cap; data = new Float32Array(N * NI); for (let i = 0; i < N; i++) put(i, -999, -999, 0, 0, 0, -99, 1, [0, 0, 0], [0, 0, 0]); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); }
    };
    // режим «слід»: кільцевий буфер, нові травинки дописуються на місце найстаріших
    let ring = 0;
    const spawn = (x, y) => {
      if (!data) return;
      const t = now(), p = pickPal(Math.random());
      put(ring, x + (Math.random() - .5) * 36, y + Math.random() * 10, 26 + Math.random() * 52, 3 + Math.random() * 3, (Math.random() - .5) * .5, t, 2.6, hexRgb(p[0]), hexRgb(p[1]));
      gl.bufferSubData(gl.ARRAY_BUFFER, ring * NI * 4, data, ring * NI, NI); ring = (ring + 1) % N;
    };
    const mouse = {x: -1e4, y: -1e4, push: 0, target: 0, lx: null, ly: null};
    const onMove = e => {
      const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      mouse.target = mouse.x >= 0 && mouse.y >= 0 && mouse.x <= r.width && mouse.y <= r.height ? 1 : 0;
      if (opt.trail && mouse.target) {
        const dist = mouse.lx === null ? 6 : Math.hypot(mouse.x - mouse.lx, mouse.y - mouse.ly);
        for (let k = 0, n = Math.min(10, Math.floor(dist / 5)); k < n; k++) spawn(mouse.x, mouse.y);
        if (dist >= 5) { mouse.lx = mouse.x; mouse.ly = mouse.y; }
      }
    };
    addEventListener('pointermove', onMove, {passive: true});
    let active = false, raf = 0, lastY = scrollY, vel = 0;
    const frame = () => {
      raf = 0; if (!active) return;
      resize();
      mouse.push += (mouse.target - mouse.push) * .08;
      const dy = Math.abs(scrollY - lastY); lastY = scrollY; vel += (Math.min(1, dy / 40) - vel) * .1;
      gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.u_res, W, H); gl.uniform1f(U.u_t, now()); gl.uniform1f(U.u_push, opt.trail ? 0 : mouse.push);
      gl.uniform1f(U.u_wind, (opt.wind || 1) + (opt.scrollWind ? vel * 3 : 0)); gl.uniform2f(U.u_mouse, mouse.x, mouse.y); gl.uniform1f(U.u_alpha, opt.alpha || 1);
      if (N) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (SEG + 1) * 2, N);
      raf = requestAnimationFrame(frame);
    };
    const io = new IntersectionObserver(([e]) => set(e.isIntersecting && !document.hidden)); io.observe(cv);
    const onVis = () => set(!document.hidden && cv.getBoundingClientRect().bottom > 0 && cv.getBoundingClientRect().top < innerHeight);
    document.addEventListener('visibilitychange', onVis);
    function set(on) { if (on === active) return; active = on; if (on && !raf) raf = requestAnimationFrame(frame); }
    return {destroy() { set(false); io.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onMove); gl.getExtension('WEBGL_lose_context')?.loseContext(); cv.remove(); }};
  }

  const rnd = Math.random;
  const MODES = {
    // кромка газону: густа смуга травинок уздовж низу першого екрана
    edge: {host: () => [$('.hero')], cls: 'gf gf-edge', opt: () => ({
      // на телефоні плашка закриває весь низ першого екрана — трава росте з її верхнього краю
      place: cv => { const pl = $('.hero .plate'), inn = $('.hero .in'); cv.style.top = innerWidth < 768 && pl && inn ? (inn.offsetTop + pl.offsetTop - cv.offsetHeight + 4) + 'px' : ''; },
      layout: (w, h) => {
      const n = Math.round(w * (w < 768 ? .9 : 1.25)), out = [];
      for (let i = 0; i < n; i++) { const p = pickPal(rnd()), y = h - rnd() * h * .14, s = .55 + .45 * (y / h);
        out.push([rnd() * w, y, h * (.35 + rnd() * .6) * s, 3 + rnd() * 4, (rnd() - .5) * .5, 0, 0, hexRgb(p[0]), hexRgb(p[1])]); }
      return out.sort((a, b) => a[1] - b[1]);
    }})},
    // луг: травинки по всьому першому екрану, далекі ряди менші й світліші — тануть у білому
    meadow: {host: () => [$('.hero')], cls: 'gf gf-meadow', opt: () => ({alpha: .9, layout: (w, h) => {
      const n = Math.round(w * h / (w < 768 ? 700 : 520)), out = [];
      // густота й розмір зростають донизу; далекі ряди короткі й майже білі, щоб не читались як дощ
      for (let i = 0; i < n; i++) { const s = Math.pow(rnd(), .38), y = h * (.4 + .6 * s), p = pickPal(rnd()), k = .88 * Math.pow(1 - s, .7);
        out.push([rnd() * w, y, 5 + 90 * Math.pow(s, 2.2), 2 + 4.5 * s, (rnd() - .5) * (.3 + .5 * s), 0, 0, toWhite(hexRgb(p[0]), k), toWhite(hexRgb(p[1]), k)]); }
      return out.sort((a, b) => a[1] - b[1]);
    }})},
    // межі: трава на стику світлого і темного розділу, від швидкої прокрутки гойдається сильніше
    seams: {host: () => [$('.hero'), $('#services'), $('#team')].filter(Boolean), cls: 'gf gf-seam', opt: () => ({scrollWind: true, layout: (w, h) => {
      const n = Math.round(w * .9), out = [];
      for (let i = 0; i < n; i++) { const p = pickPal(rnd());
        out.push([rnd() * w, h - rnd() * 6, 28 + rnd() * 70, 3 + rnd() * 3, (rnd() - .5) * .4, 0, 0, hexRgb(p[0]), hexRgb(p[1])]); }
      return out;
    }})},
    // слід: де веде курсор, проростають травинки й за 2,6 с в'януть
    trail: {host: () => [$('.hero')], cls: 'gf gf-trail', opt: () => ({trail: true, cap: 1400, layout: () => null})},
  };
  let fields = [];
  function setGrass(mode) {
    fields.forEach(f => f?.destroy()); fields = [];
    const m = MODES[mode]; if (!m || !window.WebGL2RenderingContext) return;
    for (const host of m.host()) {
      const cv = document.createElement('canvas'); cv.className = m.cls; cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
      const f = GrassField(cv, m.opt()); if (f) fields.push(f); else cv.remove();
    }
  }

  // трава на фоні в такому вигляді власнику не підійшла (16.10.2026); лишається для пошуку іншої форми
  if (Q.get('grass')) setGrass(Q.get('grass'));

  // службовий ?y= — прокрутка для знімків без колеса
  if (Q.has('y')) { const y = +Q.get('y'); requestAnimationFrame(() => { if (lenis) lenis.scrollTo(y, {immediate: true, force: true}); else window.scrollTo(0, y); ScrollTrigger.update(); }); }
})();
