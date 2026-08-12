import { TVChart } from "./TVChart";

import "./TVChart.scss";

export function Chart() {
  return (
    <div className="ExchangeChart tv Synthetics-chart flex flex-col">
      <div className="flex grow flex-col overflow-hidden rounded-8 border border-slate-800 bg-slate-750">
        <TVChart />
      </div>
    </div>
  );
}
