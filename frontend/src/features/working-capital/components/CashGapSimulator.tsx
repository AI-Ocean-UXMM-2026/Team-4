import { useState } from "react";

export function CashGapSimulator({ simulate }: { simulate: <T>(type: string, assumptions: Record<string, unknown>) => Promise<T> }) {
  const [dio, setDio] = useState(30), [dso, setDso] = useState(12), [extension, setExtension] = useState(15); const [result, setResult] = useState<unknown>();
  return <section><h2>Step 2: Cash Gap Simulator</h2><p>Current (observed or demo estimate) versus if assumptions hold. CCC is days, not MMK.</p><label>DIO {dio}<input type="range" min="0" max="180" value={dio} onChange={(e) => setDio(Number(e.target.value))} /></label><label>DSO {dso}<input type="range" min="0" max="180" value={dso} onChange={(e) => setDso(Number(e.target.value))} /></label><label>Requested supplier extension {extension} days<input type="range" min="0" max="90" value={extension} onChange={(e) => setExtension(Number(e.target.value))} /></label><button onClick={() => void simulate<unknown>("cash_gap", { dio_days: dio, dso_days: dso, dpo_days: 25, supplier_extension_days: extension, demo_estimate: true }).then(setResult)}>Compare projected CCC</button>{result !== undefined && <pre>{JSON.stringify(result, null, 2)}</pre>}</section>;
}
