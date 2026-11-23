const DeliveryData = (() => {
  const columns = ['shipment_id', 'region', 'dispatched_on', 'promised_on', 'delivered_on'];
  const statuses = { onTime: 'On time', late: 'Late', open: 'Open' };
  const maxRecords = 20000;

  function parseCsv(source) {
    const text = source.replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let cell = '';
    let state = 'start';
    const endCell = () => {
      row.push(cell);
      cell = '';
      state = 'start';
    };
    const endRow = () => {
      endCell();
      rows.push(row);
      row = [];
      if (rows.length > maxRecords + 1) throw new Error(`CSV exceeds ${maxRecords.toLocaleString()} data records.`);
    };

    for (let i = 0; i < text.length; i += 1) {
      const character = text[i];
      if (state === 'quoted') {
        if (character === '"' && text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else if (character === '"') {
          state = 'closed';
        } else {
          cell += character;
        }
      } else if (character === ',') {
        endCell();
      } else if (character === '\n' || character === '\r') {
        if (character === '\r' && text[i + 1] === '\n') i += 1;
        endRow();
      } else if (character === '"' && state === 'start') {
        state = 'quoted';
      } else if (state === 'closed' || character === '"') {
        throw new Error(`Invalid CSV quoting in record ${rows.length + 1}.`);
      } else {
        cell += character;
        state = 'plain';
      }
    }
    if (state === 'quoted') throw new Error(`Unclosed quote in record ${rows.length + 1}.`);
    if (row.length || state !== 'start') endRow();
    return rows;
  }

  function dateProblem(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return true;
    const time = Date.parse(`${value}T00:00:00Z`);
    return !Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value;
  }

  function validate(values, seen) {
    const { shipment_id: id, region, dispatched_on: dispatched, promised_on: promised, delivered_on: delivered } = values;
    if (!/^[A-Z0-9][A-Z0-9._-]{0,47}$/i.test(id)) return 'Invalid shipment ID';
    if (!region || region.length > 60 || /[\r\n\t]/.test(region)) return 'Invalid region';
    if (dateProblem(dispatched) || dateProblem(promised) || (delivered && dateProblem(delivered))) {
      return 'Use valid dates in YYYY-MM-DD format';
    }
    if (promised < dispatched || (delivered && delivered < dispatched)) return 'Date falls before dispatch';
    if (seen.has(id.toUpperCase())) return 'Duplicate shipment ID';
    return null;
  }

  function importCsv(text) {
    const [header, ...records] = parseCsv(text);
    if (!header) throw new Error('This CSV is empty.');
    const names = header.map((name) => name.trim().toLowerCase());
    const positions = columns.map((column) => names.indexOf(column));
    if (new Set(names).size !== names.length || positions.includes(-1)) {
      throw new Error(`Provide one column each for ${columns.join(', ')}.`);
    }

    const shipments = [];
    const issues = [];
    const seen = new Set();
    for (const [index, record] of records.entries()) {
      if (record.every((entry) => !entry.trim())) continue;
      const values = Object.fromEntries(columns.map((column, i) => [column, (record[positions[i]] ?? '').trim()]));
      const issue = record.length === names.length ? validate(values, seen) : 'Wrong number of columns';
      if (issue) {
        issues.push({ record: index + 2, issue });
        continue;
      }
      seen.add(values.shipment_id.toUpperCase());
      const status = values.delivered_on
        ? (values.delivered_on <= values.promised_on ? 'onTime' : 'late')
        : 'open';
      shipments.push({ ...values, status });
    }
    return { shipments, issues };
  }

  function summarize(shipments) {
    const counts = { onTime: 0, late: 0, open: 0 };
    for (const shipment of shipments) counts[shipment.status] += 1;
    const completed = counts.onTime + counts.late;
    return {
      ...counts,
      total: shipments.length,
      completed,
      onTimeRate: completed ? counts.onTime / completed : null,
    };
  }

  function byRegion(shipments) {
    const groups = new Map();
    for (const shipment of shipments) {
      if (!groups.has(shipment.region)) groups.set(shipment.region, []);
      groups.get(shipment.region).push(shipment);
    }
    return Array.from(groups, ([region, deliveries]) => ({ region, ...summarize(deliveries) }))
      .sort((a, b) => b.completed - a.completed || a.region.localeCompare(b.region));
  }

  function exportCsv(shipments) {
    const quote = (value) => {
      const safeValue = /^[=+\-@＝＋－＠]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    return [columns.join(','), ...shipments.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\r\n') + '\r\n';
  }

  return { importCsv, summarize, byRegion, exportCsv, statuses };
})();

if (typeof module !== 'undefined') module.exports = DeliveryData;
