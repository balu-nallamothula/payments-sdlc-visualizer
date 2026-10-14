// Trigger a browser download of `data` serialized as pretty JSON.
export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// yyyy-mm-dd for filenames.
export const todayStamp = () => new Date().toISOString().slice(0, 10);

// Read a File (from an <input type="file">) and resolve its parsed JSON.
// Rejects if the file can't be read or isn't valid JSON.
export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(String(reader.result))); }
      catch { reject(new Error("That file isn't valid JSON")); }
    };
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.readAsText(file);
  });
}
