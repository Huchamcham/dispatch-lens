# Dispatch Lens

Dispatch Lens is a browser dashboard for reviewing delivery performance from CSV files. It validates records, shows on-time rates by region, and exports the filtered shipments. Imports are processed in the browser, and refreshing resets to the demo data.

## Run the demo

Open `index.html` in a modern browser. No installation or server is required. The fictional demo has 27 valid shipments and three excluded records. Explore **Import quality** to see why those rows were excluded.

1. Select **East** and compare its on-time rate with the full dataset.
2. Set the shipment table to **Late** and export the filtered results.
3. Download the example CSV from **CSV format** and import it again to try the full flow.

## CSV format

```csv
shipment_id,region,dispatched_on,promised_on,delivered_on
DL-1001,Central,2026-01-06,2026-01-08,2026-01-08
DL-1002,Central,2026-01-06,2026-01-09,
```

Use a UTF-8 CSV of up to 5 MB and 20,000 data records. A shipment ID identifies one record. The first valid row for an ID is kept. Dates use `YYYY-MM-DD`, and an empty `delivered_on` marks an open shipment. The on-time rate is shipments delivered by their promised date divided by all delivered shipments in the selected region. The status filter applies to the shipment table and its export.

## How it works

| File | Responsibilities |
| --- | --- |
| `delivery-data.js` | Parses CSV, validates shipments, aggregates metrics, and formats exports |
| `app.js` | Handles file imports, filters, counts, chart rendering, and pagination |
| `sample-data.js` | Provides the fictional dataset and CSV download |

## Tests

Use Node.js 20 or later to run the data tests.

```powershell
node --test tests/delivery-data.test.cjs
```

The tests cover quoted fields, duplicate and invalid rows, incomplete deliveries, regional aggregation, and exports.

## GitHub Pages

For a live demo, publish the repository's root folder using [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site). The app's scripts and styles use relative paths.
