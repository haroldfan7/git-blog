(async function () {
  const localContent = window.siteContent || {};
  const remoteContent =
    typeof window.loadRemoteContent === "function" ? await window.loadRemoteContent() : {};
  const content = {
    ...localContent,
    ...remoteContent,
  };
  const articles = content.articles || [];

  const $ = (selector) => document.querySelector(selector);
  const byRenderKey = (key) => $(`[data-render="${key}"]`);
  const page = document.body.dataset.page;

  const escapeHtml = (value) =>
    String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const getParams = () => new URLSearchParams(window.location.search);
  const articleUrl = (slug) => `article.html?slug=${encodeURIComponent(slug)}`;
  const tagUrl = (tag) => `tags.html?tag=${encodeURIComponent(tag)}`;

  const formatTags = (tags = []) =>
    tags
      .map((tag) => `<a class="tag-link" href="${tagUrl(tag)}">${escapeHtml(tag)}</a>`)
      .join("");

  const renderPostCard = (item) => `
    <article class="post-card">
      <p class="meta">${escapeHtml(item.date)} / ${escapeHtml(item.category)}</p>
      <div>
        <h3><a href="${articleUrl(item.slug)}">${escapeHtml(item.title)}</a></h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="post-tags">${formatTags(item.tags)}</div>
      </div>
    </article>
  `;

  const renderPlainItem = (item) => `
    <article class="plain-item">
      <p class="meta">${escapeHtml(item.period || item.type)} / ${escapeHtml(item.role || "")}</p>
      <div>
        <h3>${escapeHtml(item.title || item.name)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="post-tags">${formatTags(item.tags)}</div>
      </div>
    </article>
  `;

  const renderLegalAiItem = (item) => `
    <article class="tool-tile">
      <div class="tile-meta">
        <span>${escapeHtml(item.type || "Tool")}</span>
        <span>${escapeHtml(item.status || "Draft")}</span>
      </div>
      <h3>${escapeHtml(item.title || item.name)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="post-tags">${formatTags(item.tags)}</div>
    </article>
  `;

  const renderWritingTitle = (item) => `
    <article class="title-row">
      <a href="${articleUrl(item.slug)}">${escapeHtml(item.title)}</a>
      <span>${escapeHtml(item.date)}</span>
    </article>
  `;

  const renderShareItem = (item) => `
    <article class="share-row">
      <p class="meta">${escapeHtml(item.date)} / ${escapeHtml(item.kind || "Share")}</p>
      <h3>${
        item.slug
          ? `<a href="${articleUrl(item.slug)}">${escapeHtml(item.title)}</a>`
          : escapeHtml(item.title)
      }</h3>
      <p>${escapeHtml(item.summary)}</p>
    </article>
  `;

  const renderHome = () => {
    const legalAiTarget = byRenderKey("legalAi");
    const writingTarget = byRenderKey("writingLaw");
    const shareTarget = byRenderKey("share");
    const legalAiItems = content.legalAi || content.tools || [];

    if (legalAiTarget) legalAiTarget.innerHTML = legalAiItems.map(renderLegalAiItem).join("");
    if (writingTarget) {
      writingTarget.innerHTML = articles
        .filter((item) => item.category !== "Share")
        .slice(0, 3)
        .map(renderWritingTitle)
        .join("");
    }
    if (shareTarget) shareTarget.innerHTML = (content.share || []).map(renderShareItem).join("");
  };

  const renderArticle = () => {
    const target = byRenderKey("article");
    if (!target) return;

    const slug = getParams().get("slug") || articles[0]?.slug;
    const article = articles.find((item) => item.slug === slug);

    if (!article) {
      target.innerHTML = `
        <div class="empty-state">
          <h1>没有找到这篇文章</h1>
          <p>可以回到 <a href="index.html">首页</a> 查看全部文章。</p>
        </div>
      `;
      document.title = "文章未找到 · Jason7";
      return;
    }

    document.title = `${article.title} · Jason7`;
    target.innerHTML = `
      <header class="article-header">
        <p class="eyebrow">${escapeHtml(article.category)}</p>
        <h1>${escapeHtml(article.title)}</h1>
        <div class="article-meta-row">
          <span>${escapeHtml(article.date)}</span>
          <span>/</span>
          <span>${escapeHtml(article.readingTime || "约 3 分钟")}</span>
        </div>
        <div class="post-tags">${formatTags(article.tags)}</div>
      </header>
      <div class="article-body prose">${article.content || ""}</div>
      <nav class="article-nav" aria-label="文章导航">
        <a href="index.html">← 返回首页</a>
        <a href="tags.html">浏览标签 →</a>
      </nav>
    `;
  };

  const renderTags = () => {
    const target = byRenderKey("tags");
    if (!target) return;

    const selected = getParams().get("tag");
    const tagMap = new Map();
    for (const article of articles) {
      for (const tag of article.tags || []) {
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }

    const tags = [...tagMap.entries()].sort((a, b) => a[0].localeCompare(b[0], "zh-CN"));
    const filtered = selected
      ? articles.filter((article) => (article.tags || []).includes(selected))
      : articles;

    target.innerHTML = `
      <div class="tag-cloud" aria-label="标签列表">
        <a class="tag-pill ${selected ? "" : "is-active"}" href="tags.html">
          全部 <span class="tag-count">${articles.length}</span>
        </a>
        ${tags
          .map(
            ([tag, count]) => `
              <a class="tag-pill ${selected === tag ? "is-active" : ""}" href="${tagUrl(tag)}">
                ${escapeHtml(tag)} <span class="tag-count">${count}</span>
              </a>
            `,
          )
          .join("")}
      </div>
      <div class="tag-results post-list">
        ${filtered.length ? filtered.map(renderPostCard).join("") : '<p class="empty-state">暂无文章。</p>'}
      </div>
    `;
  };

  const setupTheme = () => {
    const button = $(".theme-toggle");
    const storedTheme = localStorage.getItem("theme");
    const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initialTheme = storedTheme || (preferredDark ? "dark" : "light");

    document.documentElement.dataset.theme = initialTheme;
    if (!button) return;

    const syncLabel = () => {
      const isDark = document.documentElement.dataset.theme === "dark";
      button.setAttribute("aria-label", isDark ? "切换到浅色模式" : "切换到深色模式");
      button.textContent = isDark ? "☼" : "◐";
    };

    button.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("theme", next);
      syncLabel();
    });

    syncLabel();
  };

  const setYear = () => {
    const year = $("#year");
    if (year) year.textContent = new Date().getFullYear();
  };

  if (page === "home") renderHome();
  if (page === "article") renderArticle();
  if (page === "tags") renderTags();
  setupTheme();
  setYear();
})();
