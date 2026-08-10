import { selectChartHeaderInfo } from "context/SyntheticsStateContext/selectors/chartSelectors";
import { useSelector } from "context/SyntheticsStateContext/utils";
import { formatRatePercentage } from "lib/numbers";
import { getPositiveOrNegativeClass } from "lib/utils";

import MarketNetFee from "components/MarketNetFee/MarketNetFee";

export function NetRate1hTooltip() {
  const info = useSelector(selectChartHeaderInfo);

  if (info?.fundingRateLong === undefined || info?.fundingRateShort === undefined) return null;

  return (
    <div>
      <div className="mb-8 grid grid-cols-[auto_1fr] gap-x-12 gap-y-4 text-12">
        <span className="text-typography-secondary">Funding (long)</span>
        <span className={getPositiveOrNegativeClass(info.fundingRateLong)}>
          {formatRatePercentage(info.fundingRateLong)}
        </span>
        <span className="text-typography-secondary">Borrow (long)</span>
        <span className={getPositiveOrNegativeClass(info.borrowingRateLong)}>
          {formatRatePercentage(info.borrowingRateLong)}
        </span>
        <span className="text-typography-secondary">Funding (short)</span>
        <span className={getPositiveOrNegativeClass(info.fundingRateShort)}>
          {formatRatePercentage(info.fundingRateShort)}
        </span>
        <span className="text-typography-secondary">Borrow (short)</span>
        <span className={getPositiveOrNegativeClass(info.borrowingRateShort)}>
          {formatRatePercentage(info.borrowingRateShort)}
        </span>
      </div>
      <MarketNetFee
        borrowRateHourly={info.borrowingRateLong}
        fundingRateHourly={info.fundingRateLong}
        isLong={true}
      />
      <br />
      <MarketNetFee
        borrowRateHourly={info.borrowingRateShort}
        fundingRateHourly={info.fundingRateShort}
        isLong={false}
      />
    </div>
  );
}
