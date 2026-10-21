// صفحة «سند» التعريفية: شريط علوي عند التمرير، ظهور تدريجي، تبويبات الأقسام، ومشهد الجوال المتحرك
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // الشريط العلوي
  const top = document.getElementById("top");
  const onScroll = () => top.classList.toggle("scrolled", window.scrollY > 20);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  document.getElementById("year").textContent = new Date().getFullYear();

  // ظهور تدريجي
  const items = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 80}ms`;
      io.observe(el);
    });
  }

  // تبويبات الأقسام
  const tabs = [...document.querySelectorAll(".tab")];
  const select = (tab) => {
    tabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
    document.querySelectorAll(".dept").forEach((d) => d.classList.toggle("on", d.id === `dept-${tab.dataset.tab}`));
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      const dir = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0; // اتجاه عربي
      if (!dir) return;
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });

  // مشهد الجوال: يتنقل بين ثلاث لقطات من يوم عمل
  const feed = document.getElementById("feed");
  const phoneIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';
  const scenes = [
    [
      { cls: "card-call", html: `<span class="ic">${phoneIc}</span><div><strong>مكالمة فائتة — رد عليها سند</strong>أبو خالد يسأل عن شحنة الكريب، ويريد أن تعاود الاتصال قبل العصر.<br /><em>وصلك الملخص</em></div>` },
      { cls: "msg me", html: "طيب ذكّرني الساعة ٢ أكلمه" },
      { cls: "msg bot", html: "تمام ✅ وأضفت لك ملخص آخر محادثة معه حتى تكون جاهز." },
    ],
    [
      { cls: "msg me", html: "إيه اللي فاتني في الواتساب والإيميل؟" },
      { cls: "typing", html: "<i></i><i></i><i></i>" },
      { cls: "msg bot", html: "<b>٣ أمور مهمة:</b><br />١) عميل جملة ينتظر عرض سعر ٣٠٠ عباية<br />٢) المورد يطلب زيادة ٨٪<br />٣) البنك أرسل كشف الحساب" },
    ],
    [
      { cls: "msg me", html: "تابع مع مؤسسة النور على عرض السعر" },
      { cls: "msg bot", html: "أرسلت لهم وأتابع الردود أولًا بأول 👌" },
      { cls: "card-call", html: `<span class="ic">${phoneIc.replace(/<path[^>]*\/>/, '<path d="M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3"/>')}</span><div><strong>تقرير المتابعة</strong>وافقوا على الكمية، ويطلبون التسليم خلال أسبوعين.<br /><em>اكتملت</em></div>` },
    ],
  ];

  let si = 0;
  const play = () => {
    const scene = scenes[si % scenes.length];
    feed.innerHTML = "";
    scene.forEach((m, i) => {
      const el = document.createElement("div");
      el.className = m.cls;
      el.innerHTML = m.html;
      el.style.animationDelay = reduce ? "0s" : `${0.4 + i * 1.1}s`;
      feed.appendChild(el);
      // مؤشر الكتابة يختفي حين يصل الرد
      if (m.cls === "typing" && !reduce) setTimeout(() => el.remove(), (0.4 + (i + 1) * 1.1) * 1000);
    });
    si += 1;
  };
  play();
  if (!reduce) setInterval(play, 7000);
})();
