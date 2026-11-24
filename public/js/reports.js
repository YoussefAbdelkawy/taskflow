/* global api, layout, ui, basecoat */
// FR7 Reports page (US7-1, US7-2): pick one of the projects I manage and a date range,
// then show the report from GET /api/projects/:id/report and export it as CSV.
(() => {
  const DEFAULT_DAYS = 30;
  const MS_PER_DAY = 86400000;
  const HTTP_UNAUTHORIZED = 401; // api.js is already opening the login page
  const form = document.getElementById('report-form');
  const projectSelect = document.getElementById('report-project');
  const fromInput = document.getElementById('report-from');
  const toInput = document.getElementById('report-to');
  const message = document.getElementById('report-message');
  const body = document.getElementById('report-body');
  const exportButton = document.getElementById('export-csv');
  const overdueBody = document.querySelector('#overdue-table tbody');
  const { el } = ui;
  const charts = [];

  const STATUS_COLORS = Object.freeze({
    TO_DO: 'var(--status-todo)',
    IN_PROGRESS: 'var(--status-progress)',
    DONE: 'var(--status-done)',
  });

  // The URL keeps the choice, so a report can be bookmarked or reloaded
  function readQuery() {
    const params = new URLSearchParams(location.search);
    const today = ui.todayIso();
    const monthAgo = ui.todayIso(new Date(Date.now() - (DEFAULT_DAYS - 1) * MS_PER_DAY));
    return {
      projectId: params.get('project'),
      from: params.get('from') ?? monthAgo,
      to: params.get('to') ?? today,
    };
  }

  function writeQuery({ projectId, from, to }) {
    history.replaceState(null, '', `?${new URLSearchParams({ project: projectId, from, to })}`);
  }

  const rangeQuery = () => `from=${fromInput.value}&to=${toInput.value}`;

  function showSummary(summary) {
    document.querySelectorAll('[data-summary]').forEach((cell) => {
      const value = summary[cell.dataset.summary];
      cell.textContent = cell.dataset.summary === 'completionRate' ? `${value}%` : String(value);
    });
    document
      .querySelector('[data-summary="overdue"]')
      .classList.toggle('text-status-blocked', summary.overdue > 0);
  }

  function drawCharts(report) {
    charts.splice(0).forEach((chart) => chart.destroy());
    const statusLabels = report.statusBreakdown.map((row) => ui.STATUS[row.status].label);
    charts.push(
      basecoat.chart('#chart-status', {
        type: 'bar',
        chartData: {
          labels: statusLabels,
          datasets: [
            {
              label: 'Tasks',
              data: report.statusBreakdown.map((row) => row.count),
              backgroundColor: report.statusBreakdown.map((row) => STATUS_COLORS[row.status]),
            },
          ],
        },
      }),
      basecoat.chart('#chart-trend', {
        type: 'line',
        options: { scales: { y: { beginAtZero: true, ticks: { display: true, precision: 0 } } } },
        chartData: {
          labels: report.completionTrend.map((row) => row.week.replace(/^\d{4}-/, '')),
          datasets: [
            {
              label: 'Completed',
              data: report.completionTrend.map((row) => row.count),
              borderColor: 'var(--primary)',
              backgroundColor: 'var(--primary)',
            },
          ],
        },
      }),
      basecoat.chart('#chart-workload', {
        type: 'bar',
        legend: true,
        options: {
          indexAxis: 'y',
          scales: {
            x: { stacked: true, ticks: { precision: 0 } },
            y: { stacked: true, ticks: { display: true } },
          },
        },
        chartData: {
          labels: report.workload.map((row) => row.name),
          datasets: [
            {
              label: 'Open',
              data: report.workload.map((row) => row.open),
              backgroundColor: 'var(--primary)',
            },
            {
              label: 'Done',
              data: report.workload.map((row) => row.done),
              backgroundColor: 'var(--status-done)',
            },
          ],
        },
      }),
    );
  }

  // Same columns as the CSV export (US7-2 AC3)
  function overdueRow(task) {
    return el(
      'tr',
      {},
      el('td', { className: 'font-mono text-xs text-muted-foreground', text: `TF-${task.id}` }),
      el(
        'td',
        {},
        el('a', {
          className: 'hover:underline',
          text: task.title,
          attrs: { href: `task.html?id=${task.id}` },
        }),
      ),
      el('td', { text: task.assigneeName ?? 'Unassigned' }),
      el('td', {}, ui.priorityBadge(task.priority)),
      el(
        'td',
        {},
        el(
          'span',
          { className: 'inline-flex items-center gap-2' },
          ui.statusDot(task.status),
          ui.STATUS[task.status].label,
        ),
      ),
      el('td', { className: 'font-mono text-xs text-muted-foreground', text: task.dueDate }),
      el('td', {
        className: 'text-right tabular-nums text-status-blocked',
        text: String(task.daysLate),
      }),
    );
  }

  function showOverdue(rows) {
    overdueBody.removeAttribute('aria-busy');
    if (rows.length === 0) {
      const cell = el('td', { attrs: { colspan: '7' } });
      overdueBody.replaceChildren(el('tr', {}, cell));
      ui.empty(cell, {
        icon: 'circle-check',
        title: 'Nothing overdue',
        body: 'Every open task in this range is on time.',
      });
      return;
    }
    overdueBody.replaceChildren(...rows.map(overdueRow));
  }

  function showReport(report) {
    showSummary(report.summary);
    showOverdue(report.overdue);
    if (report.isEmpty) {
      charts.splice(0).forEach((chart) => chart.destroy());
      ui.toast({
        category: 'info',
        title: 'No tasks in this range',
        description: 'Pick a wider date range to see charts.',
      });
      return;
    }
    drawCharts(report);
  }

  async function loadReport() {
    message.textContent = '';
    exportButton.disabled = true;
    overdueBody.setAttribute('aria-busy', 'true');
    const projectId = projectSelect.value;
    writeQuery({ projectId, from: fromInput.value, to: toInput.value });
    try {
      showReport(await api.get(`/projects/${projectId}/report?${rangeQuery()}`));
      exportButton.disabled = false;
    } catch (error) {
      message.textContent = error.message; // e.g. "A report covers at most 366 days"
      overdueBody.replaceChildren();
    }
  }

  async function exportCsv() {
    exportButton.disabled = true;
    try {
      const { blob, fileName } = await api.download(
        `/projects/${projectSelect.value}/report.csv?${rangeQuery()}`,
      );
      const link = el('a', { attrs: { href: URL.createObjectURL(blob), download: fileName } });
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(link.href);
      ui.toast({ category: 'success', title: 'Report exported', description: fileName });
    } catch (error) {
      ui.toast({ category: 'error', title: 'Export failed', description: error.message });
    } finally {
      exportButton.disabled = false;
    }
  }

  function showNotAManager() {
    form.hidden = true;
    exportButton.hidden = true;
    ui.empty(body, {
      icon: 'chart-column',
      title: 'Reports are for project managers',
      body: 'Ask the manager of your project for a report, or open your dashboard to see your own tasks.',
      action: el('a', {
        className: 'btn',
        text: 'Open dashboard',
        attrs: { href: 'index.html', 'data-size': 'sm', 'data-variant': 'outline' },
      }),
    });
  }

  // The chart scripts are deferred; wait for them before the first draw
  const scriptsReady = new Promise((resolve) => {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', resolve);
    else resolve();
  });

  async function init() {
    const [{ projects }] = await Promise.all([api.get('/dashboard'), scriptsReady]);
    // Declarative: only the projects I manage can be reported on
    const managed = projects.filter((project) => project.isManager);
    if (managed.length === 0) {
      showNotAManager();
      return;
    }
    const query = readQuery();
    projectSelect.append(...managed.map((project) => new Option(project.name, String(project.id))));
    if (managed.some((project) => String(project.id) === query.projectId))
      projectSelect.value = query.projectId;
    fromInput.value = query.from;
    toInput.value = query.to;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      loadReport();
    });
    projectSelect.addEventListener('change', loadReport);
    exportButton.addEventListener('click', exportCsv);
    await loadReport();
  }

  layout.userReady.then(init).catch((error) => {
    if (error.status !== HTTP_UNAUTHORIZED) ui.errorState(body, error, () => location.reload());
  });
})();
