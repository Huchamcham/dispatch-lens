const byId = (id) => document.getElementById(id);
const number = new Intl.NumberFormat();
const percent = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 });
const rowsPerPage = 10;
const maxFileBytes = 5 * 1024 * 1024;
let imported = { shipments: [], issues: [] };
let page = 0;
let importVersion = 0;

function formatRate(rate) {
  return rate === null ? '—' : percent.format(rate);
}

function regionShipments() {
  const region = byId('region').value;
  return region ? imported.shipments.filter((row) => row.region === region) : imported.shipments;
}

function filteredShipments() {
  const status = byId('status').value;
  const shipments = regionShipments();
  return status ? shipments.filter((row) => row.status === status) : shipments;
}

function drawChart(shipments) {
  const chart = byId('chart');
  chart.replaceChildren();
  const regions = DeliveryData.byRegion(shipments);
  if (!regions.length) chart.textContent = 'No shipments to chart.';
  for (const group of regions) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const name = document.createElement('span');
    name.textContent = group.region;
    const detail = document.createElement('strong');
    detail.className = 'bar-detail';
    detail.textContent = `${formatRate(group.onTimeRate)} · ${number.format(group.onTime)}/${number.format(group.completed)}`;
    bar.append(name, detail);
    if (group.onTimeRate !== null) {
      const meter = document.createElement('meter');
      meter.max = 1;
      meter.value = group.onTimeRate;
      meter.setAttribute('aria-label', `${group.region} on-time rate`);
      bar.append(meter);
    }
    chart.append(bar);
  }
}

function renderSummary() {
  const shipments = regionShipments();
  const totals = DeliveryData.summarize(shipments);
  byId('rate').textContent = formatRate(totals.onTimeRate);
  byId('rate-detail').textContent = `${number.format(totals.onTime)} of ${number.format(totals.completed)} delivered on time`;
  for (const field of ['total', 'late', 'open']) byId(field).textContent = number.format(totals[field]);
  drawChart(shipments);
}

function renderRows() {
  const shipments = filteredShipments();
  const start = page * rowsPerPage;
  const end = Math.min(start + rowsPerPage, shipments.length);
  byId('rows-label').textContent = shipments.length
    ? `${number.format(start + 1)}–${number.format(end)} of ${number.format(shipments.length)} shipments`
    : 'No shipments match the current filters.';
  byId('previous').disabled = page === 0;
  byId('next').disabled = end >= shipments.length;
  byId('download').disabled = !shipments.length;
  const table = byId('rows');
  table.replaceChildren();
  for (const shipment of shipments.slice(start, end)) {
    const row = table.insertRow();
    for (const field of ['shipment_id', 'region', 'dispatched_on', 'promised_on', 'delivered_on']) {
      row.insertCell().textContent = shipment[field] || '—';
    }
    const badge = document.createElement('span');
    badge.className = `badge ${shipment.status}`;
    badge.textContent = DeliveryData.statuses[shipment.status];
    row.insertCell().append(badge);
  }
}

function loadCsv(text, source) {
  imported = DeliveryData.importCsv(text);
  page = 0;
  byId('source-name').textContent = source;
  byId('message').textContent = '';
  const regions = Array.from(new Set(imported.shipments.map((row) => row.region))).sort((a, b) => a.localeCompare(b));
  byId('region').replaceChildren(new Option('All regions', ''), ...regions.map((region) => new Option(region, region)));
  byId('status').value = '';
  const { shipments, issues } = imported;
  byId('quality-summary').textContent = `${number.format(shipments.length)} accepted · ${number.format(issues.length)} excluded`;
  byId('quality-details').hidden = !issues.length;
  byId('quality-details').open = false;
  const issuesList = byId('issues');
  issuesList.replaceChildren();
  for (const { record, issue } of issues.slice(0, 100)) {
    const item = document.createElement('li');
    item.textContent = `Record ${number.format(record)} · ${issue}`;
    issuesList.append(item);
  }
  if (issues.length > 100) {
    const item = document.createElement('li');
    item.textContent = `Showing the first 100 of ${number.format(issues.length)} exclusions.`;
    issuesList.append(item);
  }
  renderSummary();
  renderRows();
}

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

byId('region').addEventListener('change', () => { page = 0; renderSummary(); renderRows(); });
byId('status').addEventListener('change', () => { page = 0; renderRows(); });
byId('previous').addEventListener('click', () => { page -= 1; renderRows(); });
byId('next').addEventListener('click', () => { page += 1; renderRows(); });
byId('sample-button').addEventListener('click', () => { importVersion += 1; loadCsv(sampleCsv, 'Demo dataset'); });
byId('download').addEventListener('click', () => download(DeliveryData.exportCsv(filteredShipments()), 'dispatch-lens-filtered.csv'));
byId('download-sample').addEventListener('click', () => download(sampleCsv, 'dispatch-lens-demo.csv'));
byId('csv-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  const version = ++importVersion;
  byId('message').textContent = `Reading ${file.name}…`;
  try {
    if (file.size > maxFileBytes) throw new Error('Choose a CSV file of 5 MB or less.');
    const text = await file.text();
    if (version !== importVersion) return;
    loadCsv(text, file.name);
    byId('message').textContent = `Imported ${file.name}.`;
  } catch (error) {
    if (version === importVersion) byId('message').textContent = `Could not import ${file.name}. ${error.message}`;
  }
});

loadCsv(sampleCsv, 'Demo dataset');
