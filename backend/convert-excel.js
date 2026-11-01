const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const inputPath = process.argv[2] || "dataset.xlsx";
const outputPath = process.argv[3] || "dataset.json";

const resolvedInput = path.resolve(process.cwd(), inputPath);
const resolvedOutput = path.resolve(process.cwd(), outputPath);

if (!fs.existsSync(resolvedInput)) {
  console.error(`Excel file not found: ${resolvedInput}`);
  process.exit(1);
}

const workbook = xlsx.readFile(resolvedInput);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: null });

const normalizedData = rawData.map((row, index) => {
  return {
    id: row.id || row.ID || index + 1,
    Platform: row.Platform || row.platform || row["App Name"] || row.app_name || row.AppName || row.app || row.name || "Unknown Platform",
    Year: row.Year || row.year || null,
    primary: row.primary || row.Primary || row.primary_color || row["Primary Color"] || row["Primary Color (HEX)"] || row.color || null,
    background: row.background || row.Background || row.bg || row.background_color || row["Background Color"] || null,
    text_color: row.text_color || row["Text Color"] || row.textColor || row.font_color || null
  };
});

fs.writeFileSync(resolvedOutput, JSON.stringify(normalizedData, null, 2), "utf8");
console.log(`Converted ${normalizedData.length} rows from ${resolvedInput} to ${resolvedOutput}`);
console.log("You can now upload the JSON file to the backend with /upload or use it as your dataset format.");
