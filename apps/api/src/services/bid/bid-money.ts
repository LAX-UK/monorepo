import type { Lot } from "@auction/types";
import {
  addMoneyStrings,
  minMoneyStrings,
  minorUnitsToMoneyString,
  moneyGte,
  moneyLt,
  numberToMinorUnits,
  numberToMoneyString,
  parseMoneyToMinorUnits,
} from "@auction/validators";

export function lotMinIncrementMoney(lot: Lot): string {
  const n = Number.parseFloat(lot.minBidIncrement);
  if (Number.isFinite(n) && n > 0) return numberToMoneyString(n);
  return "0.01";
}

export function lotDefaultAutoBidStepMin(lot: Lot): string {
  const stepMin = lot.autoBidStepMin ? Number.parseFloat(lot.autoBidStepMin) : Number.NaN;
  const lotMin = lotMinIncrementMoney(lot);
  if (Number.isFinite(stepMin) && stepMin > 0) {
    const stepStr = numberToMoneyString(stepMin);
    return moneyGte(stepStr, lotMin) ? stepStr : lotMin;
  }
  return lotMin;
}

export function effectiveBidderStepMoney(
  lot: Lot,
  autoBidStepAmount: string | null | undefined,
): string {
  const lotMin = lotMinIncrementMoney(lot);
  if (autoBidStepAmount != null && autoBidStepAmount.trim() !== "") {
    return moneyGte(autoBidStepAmount, lotMin) ? autoBidStepAmount : lotMin;
  }
  return lotDefaultAutoBidStepMin(lot);
}

export function minBidAmountMoney(currentPrice: string, increment: string): string {
  return addMoneyStrings(currentPrice, increment);
}

export function bidAmountBelowMinimum(
  bidAmount: number,
  currentPrice: string,
  increment: string,
): boolean {
  const minMinor = parseMoneyToMinorUnits(minBidAmountMoney(currentPrice, increment));
  return numberToMinorUnits(bidAmount) < minMinor;
}

export function settleProxyPrice(params: {
  winnerCeiling: string;
  runnerUpCeiling: string | null;
  winnerStep: string;
  currentPrice: string;
}): string | null {
  const winnerCeilingStr = params.winnerCeiling;
  const currentMinor = parseMoneyToMinorUnits(params.currentPrice);
  const winnerCeilingMinor = parseMoneyToMinorUnits(winnerCeilingStr);

  if (params.runnerUpCeiling == null) {
    return null;
  }

  const runnerUpStr = params.runnerUpCeiling;
  const runnerUpMinor = parseMoneyToMinorUnits(runnerUpStr);

  if (winnerCeilingMinor > runnerUpMinor) {
    const oneStepAboveRunner = addMoneyStrings(runnerUpStr, params.winnerStep);
    return minMoneyStrings(winnerCeilingStr, oneStepAboveRunner);
  }

  if (winnerCeilingMinor === runnerUpMinor) {
    return winnerCeilingMinor > currentMinor ? winnerCeilingStr : null;
  }

  return null;
}

export function moneyStringGtCurrent(money: string, currentPrice: string): boolean {
  return moneyLt(currentPrice, money);
}

export { minorUnitsToMoneyString, numberToMoneyString, moneyGte, moneyLt };
