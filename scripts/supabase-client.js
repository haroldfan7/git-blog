(function () {
  const hasConfig = () =>
    window.supabaseConfig &&
    window.supabaseConfig.url &&
    window.supabaseConfig.anonKey &&
    window.supabase &&
    window.supabase.createClient;

  window.loadRemoteContent = async function () {
    if (!hasConfig()) return {};

    const client = window.supabase.createClient(
      window.supabaseConfig.url,
      window.supabaseConfig.anonKey,
    );

    const tables = [
      ["projects", "sort_order"],
      ["ai_notes", "sort_order"],
      ["tools", "sort_order"],
      ["articles", "published_at"],
    ];

    const entries = await Promise.all(
      tables.map(async ([table, orderColumn]) => {
        const { data, error } = await client.from(table).select("*").order(orderColumn);
        if (error || !data || data.length === 0) return null;
        return [toContentKey(table), normalizeRows(table, data)];
      }),
    );

    return Object.fromEntries(entries.filter(Boolean));
  };

  function toContentKey(table) {
    if (table === "ai_notes") return "aiNotes";
    return table;
  }

  function normalizeRows(table, rows) {
    if (table === "ai_notes") {
      return rows.map((row) => ({
        title: row.title,
        summary: row.summary,
      }));
    }

    if (table === "articles") {
      return rows.map((row) => ({
        slug: row.slug,
        date: row.published_at || "",
        category: row.category || "",
        title: row.title,
        summary: row.summary,
        readingTime: row.reading_time || "",
        featured: Boolean(row.featured),
        tags: row.tags || [],
        content: row.content || "",
        url: row.url || "#",
      }));
    }

    if (table === "tools") {
      return rows.map((row) => ({
        type: row.type || "",
        name: row.name,
        summary: row.summary,
        tags: row.tags || [],
      }));
    }

    return rows.map((row) => ({
      period: row.period || "",
      role: row.role || "",
      title: row.title,
      summary: row.summary,
      tags: row.tags || [],
    }));
  }
})();
