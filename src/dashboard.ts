// ---------------------------------------------------------------------------
// dashboard.ts — Full dashboard HTML with integrated report input form
// ---------------------------------------------------------------------------

import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

export interface WeekEntry {
  week: string;
  htmlFile: string;
  pngFile: string;
}

/** Scan output directory for week folders. */
export async function scanWeeks(outputDir: string): Promise<WeekEntry[]> {
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
    if (!/^\d{4}-W\d{2}$/.test(name)) continue;

    entries.push({
      week: name,
      htmlFile: `/output/${name}/status.html`,
      pngFile: `/output/${name}/status.png`,
    });
  }

  entries.sort((a, b) => b.week.localeCompare(a.week));
  return entries;
}

/** Generate the full dashboard HTML page. */
export function buildDashboardHtml(
  entries: WeekEntry[],
  currentWeek: string,
): string {
  const entriesJson = JSON.stringify(entries);

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
  <style>
    .slide-panel { transform: translateX(100%); }
    .slide-panel.open { transform: translateX(0); }
    .backdrop { opacity: 0; pointer-events: none; }
    .backdrop.open { opacity: 1; pointer-events: auto; }
  </style>
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
        <button
          onclick="resetForm(); openPanel(false)"
          class="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold text-sm px-5 py-2.5 rounded-lg border border-white/20 transition-all shadow-sm hover:shadow"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
          </svg>
          New Report
        </button>
        <div class="hidden sm:flex items-center gap-4">
          <div class="flex flex-col items-end">
            <span class="text-lg font-bold text-white tracking-wide">GUBERTECH<sup class="text-[8px] align-super">&reg;</sup></span>
            <span class="text-[9px] text-brand-200 tracking-[0.12em] -mt-0.5">Subscription-Based IT Services</span>
          </div>
          <div class="w-px h-8 bg-brand-400/40"></div>
          <span class="text-xl font-extrabold text-white tracking-tight">amyris</span>
        </div>
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
      <div class="mb-4">
        <svg class="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
      </div>
      <p class="text-gray-400 text-lg">No reports found.</p>
      <p class="text-gray-400 text-sm mt-1">Click <strong>"New Report"</strong> to create your first one.</p>
    </div>

    <!-- Pagination -->
    <nav id="pagination" class="flex items-center justify-center gap-2 mt-10"></nav>
  </main>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- Slide-over Panel — New Report Form                                     -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <div id="backdrop" class="fixed inset-0 bg-black/40 z-40 backdrop transition-opacity duration-300" onclick="closePanel()"></div>

  <div id="slidePanel" class="slide-panel fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl transition-transform duration-300 flex flex-col">
    <!-- Panel Header -->
    <div class="bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-5 flex items-center justify-between shrink-0">
      <div>
        <h2 class="text-lg font-bold text-white">New Weekly Report</h2>
        <p class="text-xs text-brand-200 mt-0.5">Add projects, tasks, and risks</p>
      </div>
      <button onclick="closePanel()" class="text-white/70 hover:text-white transition">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- Panel Body (scrollable) -->
    <div class="flex-1 overflow-y-auto px-6 py-6" id="panelBody">
      <!-- Week + Client -->
      <div class="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Week</label>
          <input id="inp_week" type="text" value="${currentWeek}" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition" />
        </div>
        <div>
          <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Client</label>
          <input id="inp_client" type="text" value="Gubertech DevOps Team - Amyris" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition" />
        </div>
      </div>

      <!-- Highlights (global) -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-2">
          <label class="text-[11px] font-bold uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
            </svg>
            Highlights
          </label>
          <button onclick="addHighlight()" class="text-[11px] text-amber-600 hover:text-amber-800 font-semibold transition">+ Add</button>
        </div>
        <div id="highlightsContainer" class="space-y-1.5"></div>
      </div>

      <!-- Jira Board Screenshot -->
      <div class="mb-6">
        <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5 flex items-center gap-1.5">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
          </svg>
          Jira Board Screenshot
        </label>
        <div id="jiraDropZone" class="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center hover:border-brand-300 transition cursor-pointer" onclick="document.getElementById('jiraFileInput').click()">
          <div id="jiraPreviewArea">
            <svg class="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <p class="text-xs text-gray-400">Click to upload or paste (Ctrl+V / Cmd+V) a screenshot</p>
          </div>
        </div>
        <input type="file" id="jiraFileInput" accept="image/*" class="hidden" onchange="handleJiraFile(this.files[0])" />
      </div>

      <!-- Projects Container -->
      <div id="projectsContainer"></div>

      <!-- Add Project Button -->
      <button onclick="addProject()" class="mt-4 w-full py-2.5 rounded-lg border-2 border-dashed border-brand-200 text-brand-600 font-semibold text-sm hover:bg-brand-50 hover:border-brand-300 transition flex items-center justify-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        Add Project
      </button>
    </div>

    <!-- Panel Footer -->
    <div class="border-t border-gray-100 px-6 py-4 shrink-0 bg-gray-50">
      <button id="submitBtn" onclick="submitReport()" class="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-lg transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
        <svg id="submitIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
        </svg>
        <span id="submitLabel">Generate Report</span>
      </button>
      <p id="submitStatus" class="text-xs text-center text-gray-400 mt-2 hidden"></p>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- Footer                                                                 -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <footer class="border-t border-gray-100 mt-12">
    <div class="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
      <p class="text-[11px] text-gray-400 tracking-wider uppercase">Confidential and Proprietary.</p>
      <div class="flex items-center gap-3">
        <span class="text-[11px] font-bold text-gray-500 tracking-wide">GUBERTECH<sup class="text-[7px]">&reg;</sup></span>
        <span class="text-[14px] font-extrabold text-gray-600 tracking-tight">amyris</span>
      </div>
    </div>
  </footer>

  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <!-- JavaScript                                                             -->
  <!-- ═══════════════════════════════════════════════════════════════════════ -->
  <script>
    // ── Dashboard State ────────────────────────────────────────
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
        <div class="group bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md hover:border-brand-300 transition-all p-5">
          <div class="flex items-center justify-between mb-3">
            <span class="text-lg font-bold text-brand-700">\${e.week}</span>
            <span class="text-[10px] font-semibold uppercase tracking-widest text-brand-500 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-100">Report</span>
          </div>
          <div class="flex items-center gap-3">
            <a href="\${e.htmlFile}" class="text-xs text-brand-600 hover:underline font-medium">View HTML</a>
            <a href="\${e.pngFile}" class="text-xs text-gray-500 hover:underline font-medium">Download PNG</a>
            <button onclick="editReport('\${e.week}')" class="ml-auto text-xs text-amber-600 hover:text-amber-800 font-semibold transition flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit
            </button>
            <button onclick="deleteReport('\${e.week}')" class="text-xs text-red-500 hover:text-red-700 font-semibold transition flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
              Delete
            </button>
          </div>
        </div>
      \`).join('');

      // Pagination
      if (totalPages <= 1) { pagination.innerHTML = ''; return; }
      let btns = '';
      for (let i = 1; i <= totalPages; i++) {
        const active = i === currentPage;
        btns += \`<button onclick="goPage(\${i})" class="w-9 h-9 rounded-lg text-sm font-medium transition \${active ? 'bg-brand-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:bg-brand-50'}">\${i}</button>\`;
      }
      pagination.innerHTML = btns;
    }

    function goPage(n) { currentPage = n; render(); }

    render();

    // ── Slide-over Panel ───────────────────────────────────────
    let isEditMode = false;

    function openPanel(editMode) {
      isEditMode = !!editMode;
      document.getElementById('backdrop').classList.add('open');
      document.getElementById('slidePanel').classList.add('open');
      document.body.style.overflow = 'hidden';
      document.querySelector('#slidePanel h2').textContent = isEditMode ? 'Edit Weekly Report' : 'New Weekly Report';
      if (document.querySelectorAll('.project-block').length === 0) addProject();
    }

    function closePanel() {
      document.getElementById('backdrop').classList.remove('open');
      document.getElementById('slidePanel').classList.remove('open');
      document.body.style.overflow = '';
    }

    function resetForm() {
      document.getElementById('inp_week').value = '${currentWeek}';
      document.getElementById('inp_client').value = 'Gubertech DevOps Team - Amyris';
      document.getElementById('projectsContainer').innerHTML = '';
      document.getElementById('highlightsContainer').innerHTML = '';
      jiraDataUri = null;
      document.getElementById('jiraPreviewArea').innerHTML = \`
        <svg class="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
        </svg>
        <p class="text-xs text-gray-400">Click to upload or paste (Ctrl+V / Cmd+V) a screenshot</p>
      \`;
      projectCounter = 0;
      isEditMode = false;
    }
    // ── Jira Screenshot ────────────────────────────────────
    let jiraDataUri = null;

    function handleJiraFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        jiraDataUri = e.target.result;
        document.getElementById('jiraPreviewArea').innerHTML = \`
          <img src="\${jiraDataUri}" class="max-h-40 rounded-lg mx-auto border border-gray-200" />
          <button onclick="event.stopPropagation(); jiraDataUri=null; document.getElementById('jiraPreviewArea').innerHTML='<p class=\\\'text-xs text-gray-400\\\'>Removed. Click to upload again.</p>'" class="mt-2 text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
        \`;
      };
      reader.readAsDataURL(file);
    }

    document.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          handleJiraFile(item.getAsFile());
          break;
        }
      }
    });

    // ── Highlights ─────────────────────────────────────────
    function addHighlight(value) {
      const container = document.getElementById('highlightsContainer');
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      row.innerHTML = \`
        <input type="text" placeholder="Key highlight..." value="\${value || ''}"
          class="highlight-input flex-1 px-3 py-1.5 rounded-lg border border-amber-200 text-xs focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition bg-white"
        />
        <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500 transition shrink-0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      \`;
      container.appendChild(row);
      row.querySelector('input').focus();
    }

    // ── Edit Report ────────────────────────────────────────
    async function editReport(week) {
      try {
        const res = await fetch('/api/reports/' + week);
        if (!res.ok) throw new Error('Report data not found');
        const data = await res.json();

        resetForm();

        document.getElementById('inp_week').value = data.week || week;
        document.getElementById('inp_client').value = data.client || '';

        // Populate highlights
        if (Array.isArray(data.highlights)) {
          for (const h of data.highlights) addHighlight(h);
        }

        // Populate jira screenshot
        if (data.jiraScreenshot) {
          jiraDataUri = data.jiraScreenshot;
          document.getElementById('jiraPreviewArea').innerHTML = \`
            <img src="\${jiraDataUri}" class="max-h-40 rounded-lg mx-auto border border-gray-200" />
            <button onclick="event.stopPropagation(); jiraDataUri=null; document.getElementById('jiraPreviewArea').innerHTML='<p class=\\\'text-xs text-gray-400\\\'>Removed.</p>'" class="mt-2 text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
          \`;
        }

        // Populate projects
        if (Array.isArray(data.projects)) {
          for (const proj of data.projects) {
            addProject();
            const block = document.getElementById('project_' + projectCounter);
            block.querySelector('.proj-name').value = proj.project || '';
            if (Array.isArray(proj.done)) proj.done.forEach(v => addItem(projectCounter, 'done', v));
            if (Array.isArray(proj.doing)) proj.doing.forEach(v => addItem(projectCounter, 'doing', v));
            if (Array.isArray(proj.next)) proj.next.forEach(v => addItem(projectCounter, 'next', v));
            if (Array.isArray(proj.risks)) proj.risks.forEach(r => addRisk(projectCounter, r.title, r.severity));
          }
        }

        openPanel(true);
      } catch (err) {
        alert('Could not load report: ' + err.message);
      }
    }

    // ── Delete Report ────────────────────────────────────────────────────────
    async function deleteReport(week) {
      if (!confirm('Delete report for ' + week + '? This cannot be undone.')) return;
      try {
        const res = await fetch('/api/reports/' + week, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Server error');
        const idx = ALL_ENTRIES.findIndex(e => e.week === week);
        if (idx !== -1) ALL_ENTRIES.splice(idx, 1);
        filtered = filtered.filter(e => e.week !== week);
        render();
      } catch (err) {
        alert('Failed to delete: ' + err.message);
      }
    }

    // ── Dynamic Form ───────────────────────────────────────────
    let projectCounter = 0;

    function addProject() {
      projectCounter++;
      const id = projectCounter;
      const container = document.getElementById('projectsContainer');

      const block = document.createElement('div');
      block.className = 'project-block border border-gray-200 rounded-xl bg-gray-50/50 mb-4 overflow-hidden';
      block.id = 'project_' + id;
      block.innerHTML = \`
        <div class="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <input type="text" placeholder="Project name..." value=""
            class="proj-name text-sm font-semibold text-gray-800 bg-transparent border-none outline-none flex-1 placeholder-gray-400"
          />
          <button onclick="removeProject(\${id})" class="text-gray-400 hover:text-red-500 transition ml-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
        <div class="px-4 py-4 space-y-4">
          \${buildSection(id, 'done', 'Delivered', 'emerald')}
          \${buildSection(id, 'doing', 'In Progress', 'amber')}
          \${buildSection(id, 'next', 'Next', 'blue')}
          \${buildRiskSection(id)}
        </div>
      \`;
      container.appendChild(block);
    }

    function removeProject(id) {
      const el = document.getElementById('project_' + id);
      if (el) el.remove();
    }

    function buildSection(projectId, key, label, color) {
      return \`
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <h4 class="text-[10px] font-bold uppercase tracking-[0.15em] text-\${color}-600">\${label}</h4>
            <button onclick="addItem(\${projectId},'\${key}')" class="text-[11px] text-\${color}-600 hover:text-\${color}-800 font-semibold transition">+ Add</button>
          </div>
          <div id="items_\${projectId}_\${key}" class="space-y-1.5"></div>
        </div>
      \`;
    }

    function buildRiskSection(projectId) {
      return \`
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <h4 class="text-[10px] font-bold uppercase tracking-[0.15em] text-red-600">Risks</h4>
            <button onclick="addRisk(\${projectId})" class="text-[11px] text-red-600 hover:text-red-800 font-semibold transition">+ Add</button>
          </div>
          <div id="risks_\${projectId}" class="space-y-1.5"></div>
        </div>
      \`;
    }

    function addItem(projectId, key, value) {
      const container = document.getElementById('items_' + projectId + '_' + key);
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      row.innerHTML = \`
        <input type="text" placeholder="Describe the task..." value="\${value || ''}"
          class="item-input flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition bg-white"
        />
        <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500 transition shrink-0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      \`;
      container.appendChild(row);
      row.querySelector('input').focus();
    }

    function addRisk(projectId, title, severity) {
      const container = document.getElementById('risks_' + projectId);
      const row = document.createElement('div');
      row.className = 'flex items-center gap-2';
      row.innerHTML = \`
        <input type="text" placeholder="Risk description..." value="\${title || ''}"
          class="risk-title flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition bg-white"
        />
        <select class="risk-severity px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition">
          <option value="Low" \${severity === 'Low' ? 'selected' : ''}>Low</option>
          <option value="Medium" \${severity === 'Medium' || !severity ? 'selected' : ''}>Medium</option>
          <option value="High" \${severity === 'High' ? 'selected' : ''}>High</option>
        </select>
        <button onclick="this.parentElement.remove()" class="text-gray-400 hover:text-red-500 transition shrink-0">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      \`;
      container.appendChild(row);
      row.querySelector('input').focus();
    }

    // ── Form Submission ────────────────────────────────────────
    async function submitReport() {
      const btn = document.getElementById('submitBtn');
      const label = document.getElementById('submitLabel');
      const statusEl = document.getElementById('submitStatus');

      // Collect data
      const week = document.getElementById('inp_week').value.trim();
      const client = document.getElementById('inp_client').value.trim();

      if (!week) { alert('Please enter a week (e.g. 2026-W07)'); return; }
      if (!client) { alert('Please enter a client name'); return; }

      const projectBlocks = document.querySelectorAll('.project-block');
      if (projectBlocks.length === 0) { alert('Add at least one project'); return; }

      const projects = [];
      for (const block of projectBlocks) {
        const name = block.querySelector('.proj-name').value.trim();
        if (!name) { alert('Every project needs a name'); return; }

        const done = collectItems(block, 'done');
        const doing = collectItems(block, 'doing');
        const next = collectItems(block, 'next');
        const risks = collectRisks(block);

        projects.push({ project: name, done, doing, next, risks });
      }

      // Collect highlights
      const highlights = Array.from(document.querySelectorAll('#highlightsContainer .highlight-input'))
        .map(el => el.value.trim())
        .filter(v => v.length > 0);

      // UI: loading state
      btn.disabled = true;
      label.textContent = 'Generating...';
      statusEl.textContent = 'Running AI normalization + rendering slide...';
      statusEl.classList.remove('hidden');

      try {
        const res = await fetch('/api/reports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ week, client, projects, highlights, jiraScreenshot: jiraDataUri || undefined }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Server error');
        }

        statusEl.textContent = 'Done! Redirecting...';
        // Redirect to the generated report
        window.location.href = data.htmlPath;
      } catch (err) {
        statusEl.textContent = 'Error: ' + err.message;
        statusEl.classList.add('text-red-500');
        statusEl.classList.remove('text-gray-400');
        btn.disabled = false;
        label.textContent = 'Generate Report';
        setTimeout(() => {
          statusEl.classList.remove('text-red-500');
          statusEl.classList.add('text-gray-400');
        }, 5000);
      }
    }

    function collectItems(block, key) {
      const id = block.id.split('_')[1];
      const container = document.getElementById('items_' + id + '_' + key);
      if (!container) return [];
      return Array.from(container.querySelectorAll('.item-input'))
        .map(el => el.value.trim())
        .filter(v => v.length > 0);
    }

    function collectRisks(block) {
      const id = block.id.split('_')[1];
      const container = document.getElementById('risks_' + id);
      if (!container) return [];
      const rows = container.querySelectorAll('.flex');
      return Array.from(rows).map(row => ({
        title: row.querySelector('.risk-title')?.value.trim() || '',
        severity: row.querySelector('.risk-severity')?.value || 'Medium',
      })).filter(r => r.title.length > 0);
    }
  </script>

</body>
</html>`;
}
