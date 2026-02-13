// ---------------------------------------------------------------------------
// indexBuilder.ts — Generates an index.html dashboard with pagination + search
// ---------------------------------------------------------------------------

import { readdir, stat, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

interface WeekEntry {
  week: string;
  htmlFile: string;
  pngFile: string;
  date: Date;
}

/**
 * Scan the output directory for week folders and build an index.html
 * with pagination and search capabilities.
 */
export async function buildIndex(outputDir: string): Promise<void> {
  const entries: WeekEntry[] = [];

  let children: string[];
  try {
    children = await readdir(outputDir);
  } catch {
    children = [];
  }

  for (const name of children) {
    const fullPath = resolve(outputDir, name);
    const s = await stat(fullPath).catch(() => null);
    if (!s?.isDirectory()) continue;

    // Check if it looks like a week folder (e.g. 2026-W07)
    if (!/^\d{4}-W\d{2}$/.test(name)) continue;

    const htmlFile = join(name, "status.html");
    const pngFile = join(name, "status.png");

    entries.push({
      week: name,
      htmlFile,
      pngFile,
      date: new Date(),
    });
  }

  // Sort descending (most recent week first)
  entries.sort((a, b) => b.week.localeCompare(a.week));

  const html = generateIndexHtml(entries);
  await writeFile(resolve(outputDir, "index.html"), html, "utf-8");
}

function generateIndexHtml(entries: WeekEntry[]): string {
  const entriesJson = JSON.stringify(
    entries.map((e) => ({ week: e.week, html: e.htmlFile, png: e.pngFile })),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DevOps Weekly Reports — Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            brand: {
              50:  '#f5f0ff',
              100: '#ede5ff',
              200: '#daccff',
              300: '#bfa3ff',
              400: '#9f6bff',
              500: '#7c3aed',
              600: '#6d28d9',
              700: '#5b21b6',
              800: '#4c1d95',
              900: '#3b0f7a',
              950: '#1e073f',
            }
          },
          fontFamily: {
            sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
          },
        },
      },
    }
  </script>
</head>
<body class="bg-gray-50 text-gray-800 font-sans antialiased min-h-screen">

  <!-- Header -->
  <header class="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-500 shadow-lg">
    <div class="max-w-6xl mx-auto px-8 py-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">DevOps Weekly Reports</h1>
        <p class="text-sm text-brand-200 mt-0.5">Gubertech DevOps Team &mdash; Amyris</p>
      </div>
      <div class="flex items-center gap-5">
        <div class="flex flex-col items-end">
          <span class="text-lg font-bold text-white tracking-wide">GUBERTECH<sup class="text-[8px] align-super">&reg;</sup></span>
          <span class="text-[9px] text-brand-200 tracking-[0.12em] -mt-0.5">Subscription-Based IT Services</span>
        </div>
        <div class="w-px h-8 bg-brand-400/40"></div>
        <span class="text-xl font-extrabold text-white tracking-tight">amyris</span>
      </div>
    </div>
  </header>

  <main class="max-w-6xl mx-auto px-8 py-10">
    <!-- Search + Stats -->
    <div class="flex items-center justify-between mb-8">
      <div class="relative">
        <input
          id="searchInput"
          type="text"
          placeholder="Search week (e.g. 2026-W07)..."
          class="w-80 pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition"
        />
        <svg class="absolute left-3 top-3 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
      </div>
      <p id="statsText" class="text-sm text-gray-400"></p>
    </div>

    <!-- Card Grid -->
    <div id="cardGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"></div>

    <!-- Empty state -->
    <div id="emptyState" class="hidden text-center py-20">
      <p class="text-gray-400 text-lg">No reports found.</p>
    </div>

    <!-- Pagination -->
    <nav id="pagination" class="flex items-center justify-center gap-2 mt-10"></nav>
  </main>

  <!-- Footer -->
  <footer class="border-t border-gray-100 mt-12">
    <div class="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
      <p class="text-[11px] text-gray-400 tracking-wider uppercase">Confidential and Proprietary.</p>
      <div class="flex items-center gap-3">
        <span class="text-[11px] font-bold text-gray-500 tracking-wide">GUBERTECH<sup class="text-[7px]">&reg;</sup></span>
        <span class="text-[14px] font-extrabold text-gray-600 tracking-tight">amyris</span>
      </div>
    </div>
  </footer>

  <script>
    const ALL_ENTRIES = ${entriesJson};
    const PER_PAGE = 9;
    let currentPage = 1;
    let filtered = [...ALL_ENTRIES];

    const searchInput = document.getElementById('searchInput');
    const cardGrid = document.getElementById('cardGrid');
    const pagination = document.getElementById('pagination');
    const emptyState = document.getElementById('emptyState');
    const statsText = document.getElementById('statsText');

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      filtered = ALL_ENTRIES.filter(e => e.week.toLowerCase().includes(q));
      currentPage = 1;
      render();
    });

    function render() {
      const total = filtered.length;
      const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
      if (currentPage > totalPages) currentPage = totalPages;

      const start = (currentPage - 1) * PER_PAGE;
      const page = filtered.slice(start, start + PER_PAGE);

      statsText.textContent = total + ' report' + (total !== 1 ? 's' : '') + ' found';

      if (page.length === 0) {
        cardGrid.innerHTML = '';
        emptyState.classList.remove('hidden');
        pagination.innerHTML = '';
        return;
      }

      emptyState.classList.add('hidden');

      cardGrid.innerHTML = page.map(e => \`
        <a href="\${e.html}" class="group block bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-brand-300 transition-all p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-lg font-bold text-brand-700">\${e.week}</span>
            <span class="text-[10px] font-semibold uppercase tracking-widest text-brand-500 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-100">Report</span>
          </div>
          <div class="flex gap-3">
            <a href="\${e.html}" class="text-xs text-brand-600 hover:underline font-medium">View HTML</a>
            <a href="\${e.png}" class="text-xs text-gray-500 hover:underline font-medium">Download PNG</a>
          </div>
        </a>
      \`).join('');

      // Pagination buttons
      if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
      }

      let btns = '';
      const addBtn = (label, pg, active) => {
        const cls = active
          ? 'bg-brand-600 text-white border-brand-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600';
        btns += \`<button onclick="goTo(\${pg})" class="px-3.5 py-1.5 rounded-lg text-sm font-medium border \${cls} transition">\${label}</button>\`;
      };

      if (currentPage > 1) addBtn('Prev', currentPage - 1, false);
      for (let i = 1; i <= totalPages; i++) addBtn(i, i, i === currentPage);
      if (currentPage < totalPages) addBtn('Next', currentPage + 1, false);

      pagination.innerHTML = btns;
    }

    window.goTo = function(pg) {
      currentPage = pg;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    render();
  </script>
</body>
</html>`;
}
