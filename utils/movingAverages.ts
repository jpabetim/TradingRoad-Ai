import { UTCTimestamp } from 'lightweight-charts';

interface CandleData {
  time: UTCTimestamp;
  close: number;
}

interface LineData {
  time: UTCTimestamp;
  value: number;
}

export function calculateMA(data: CandleData[], period: number): LineData[] {
  if (data.length < period) return [];
  
  const result: LineData[] = [];
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    const average = sum / period;
    
    result.push({
      time: data[i].time,
      value: average
    });
  }
  
  return result;
}

export function calculateEMA(data: CandleData[], period: number): LineData[] {
  if (data.length < period) return [];
  
  const result: LineData[] = [];
  const multiplier = 2 / (period + 1);
  
  // Calculate the first EMA value using SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  
  result.push({
    time: data[period - 1].time,
    value: ema
  });
  
  // Calculate subsequent EMA values
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({
      time: data[i].time,
      value: ema
    });
  }
  
  return result;
}
