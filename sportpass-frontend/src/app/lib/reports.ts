// Report output without extra packages:
//  - downloadCSV(): a .csv file that opens in Excel
//  - openPrintableReport(): a clean page in a new tab; the browser's
//    Print dialog saves it as PDF ("Save as PDF" / "Microsoft Print to PDF").

export type Column<T> = { label: string; value: (row: T) => unknown };

export type ReportSection = {
  heading: string;
  columns: Column<any>[];
  rows: any[];
};

function cell(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function csvEscape(value: unknown) {
  const text = cell(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function htmlEscape(value: unknown) {
  return cell(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fileStamp() {
  return new Date().toISOString().slice(0, 10);
}

export function downloadCSV(filename: string, sections: ReportSection[]) {
  const lines: string[] = [];

  sections.forEach((section, i) => {
    if (sections.length > 1) {
      if (i > 0) lines.push("");
      lines.push(csvEscape(section.heading));
    }
    lines.push(section.columns.map((c) => csvEscape(c.label)).join(","));
    section.rows.forEach((row) => {
      lines.push(section.columns.map((c) => csvEscape(c.value(row))).join(","));
    });
  });

  // The BOM makes Excel read names with ñ and other accents correctly.
  const blob = new Blob(["﻿" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Open the tab right away (inside the click), then fill it once the data
// has loaded. Browsers block pop-ups opened after an await.
export function openReportWindow() {
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(
      "<p style=\"font-family:sans-serif;padding:24px\">Preparing report…</p>"
    );
  }
  return win;
}

export function renderPrintableReport(
  win: Window | null,
  title: string,
  subtitle: string,
  sections: ReportSection[],
  summary: { label: string; value: unknown }[] = []
) {
  if (!win) {
    alert("Allow pop-ups for this site to download the PDF report.");
    return;
  }

  const generated = new Date().toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const summaryHtml = summary.length
    ? `<div class="summary">${summary
        .map(
          (s) =>
            `<div><span>${htmlEscape(s.label)}</span><strong>${htmlEscape(s.value)}</strong></div>`
        )
        .join("")}</div>`
    : "";

  const sectionsHtml = sections
    .map(
      (section) => `
      <h2>${htmlEscape(section.heading)}</h2>
      ${
        section.rows.length === 0
          ? `<p class="empty">No records.</p>`
          : `<table>
        <thead><tr>${section.columns
          .map((c) => `<th>${htmlEscape(c.label)}</th>`)
          .join("")}</tr></thead>
        <tbody>${section.rows
          .map(
            (row) =>
              `<tr>${section.columns
                .map((c) => `<td>${htmlEscape(c.value(row))}</td>`)
                .join("")}</tr>`
          )
          .join("")}</tbody>
      </table>`
      }`
    )
    .join("");

  win.document.open();
  win.document.write(`<!doctype html>
<html><head><meta charset="utf-8"><title>${htmlEscape(title)}</title>
<style>
  body { font-family: "Segoe UI", Arial, sans-serif; color: #111827; margin: 32px; font-size: 12px; }
  header { border-bottom: 2px solid #1E3A6E; padding-bottom: 12px; margin-bottom: 16px; }
  .org { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #2563EB; font-weight: 700; }
  h1 { font-size: 20px; margin: 4px 0; }
  .meta { color: #4B5563; font-size: 11px; }
  h2 { font-size: 14px; margin: 20px 0 8px; color: #1E3A6E; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
  .summary div { border: 1px solid #D1D5DB; border-radius: 6px; padding: 8px 12px; min-width: 120px; }
  .summary span { display: block; color: #6B7280; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
  .summary strong { font-size: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #D1D5DB; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #EEF2FF; font-size: 11px; }
  tr:nth-child(even) td { background: #F9FAFB; }
  .empty { color: #6B7280; }
  .actions { margin-bottom: 16px; }
  .actions button { font: inherit; padding: 8px 14px; border-radius: 6px; border: 0; background: #2563EB; color: #fff; cursor: pointer; }
  @media print { .actions { display: none; } body { margin: 12mm; } thead { display: table-header-group; } tr { page-break-inside: avoid; } }
</style></head>
<body>
  <div class="actions"><button onclick="window.print()">Save as PDF / Print</button></div>
  <header>
    <div class="org">SPORTPASS · Cristal e-College Computer Studies</div>
    <h1>${htmlEscape(title)}</h1>
    <div class="meta">${htmlEscape(subtitle)} · Generated ${htmlEscape(generated)}</div>
  </header>
  ${summaryHtml}
  ${sectionsHtml}
</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}
