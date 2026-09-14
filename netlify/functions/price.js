// Looks up closing prices from Yahoo Finance for NSE/BSE tickers.
//
// mode=asof&ticker=RELIANCE&date=2026-09-12
//   -> latest completed trading-day close on or before that date (never a future bar)
// mode=latest&ticker=RELIANCE
//   -> latest completed trading-day close (drops today's bar if the market hasn't closed yet)
//
// Tries NSE (.NS) first, falls back to BSE (.BO), unless `exchange` is passed explicitly.

const MARKET_CLOSE_HOUR = 15;
const MARKET_CLOSE_MIN = 30;

function getIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return {
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  };
}

function barDateIST(epochSeconds) {
  return getIST(new Date(epochSeconds * 1000)).dateStr;
}

function epochForISTDateEnd(dateStr) {
  return Math.floor(new Date(`${dateStr}T23:59:59+05:30`).getTime() / 1000);
}

function epochDaysBefore(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00+05:30`);
  d.setDate(d.getDate() - days);
  return Math.floor(d.getTime() / 1000);
}

function resolveSymbol(ticker, exchange) {
  const suffix = exchange === 'BSE' ? '.BO' : '.NS';
  return `${ticker.trim().toUpperCase()}${suffix}`;
}

async function fetchYahooDaily(symbol, period1, period2) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) throw new Error(`yahoo_http_${res.status}`);
  const json = await res.json();
  const result = json && json.chart && json.chart.result && json.chart.result[0];
  if (!result || !result.timestamp) return { notFound: true };
  const timestamps = result.timestamp || [];
  const closes = (result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
  const bars = timestamps
    .map((t, i) => ({ t, close: closes[i] }))
    .filter((b) => b.close != null);
  return { bars };
}

async function getPriceOnOrBefore(ticker, exchange, dateStr) {
  const symbol = resolveSymbol(ticker, exchange);
  const period2 = epochForISTDateEnd(dateStr);
  const period1 = epochDaysBefore(dateStr, 20); // buffer for long holiday stretches
  const { bars, notFound } = await fetchYahooDaily(symbol, period1, period2);
  if (notFound) return { status: 'invalid_ticker' };
  const eligible = bars.filter((b) => barDateIST(b.t) <= dateStr);
  if (eligible.length === 0) return { status: 'no_data' };
  const last = eligible[eligible.length - 1];
  return { status: 'ok', price: last.close, priceDate: barDateIST(last.t), symbol };
}

async function getLatestCompletedClose(ticker, exchange) {
  const symbol = resolveSymbol(ticker, exchange);
  const ist = getIST();
  const period2 = epochForISTDateEnd(ist.dateStr);
  const period1 = epochDaysBefore(ist.dateStr, 10);
  const { bars, notFound } = await fetchYahooDaily(symbol, period1, period2);
  if (notFound) return { status: 'invalid_ticker' };
  if (bars.length === 0) return { status: 'no_data' };
  let last = bars[bars.length - 1];
  const lastDate = barDateIST(last.t);
  const marketClosed = ist.hour > MARKET_CLOSE_HOUR || (ist.hour === MARKET_CLOSE_HOUR && ist.minute >= MARKET_CLOSE_MIN);
  if (lastDate === ist.dateStr && !marketClosed) {
    if (bars.length < 2) return { status: 'no_data' };
    last = bars[bars.length - 2];
  }
  return { status: 'ok', price: last.close, priceDate: barDateIST(last.t), symbol };
}

exports.handler = async (event) => {
  const { ticker, mode, date, exchange } = event.queryStringParameters || {};

  if (!ticker || !mode) {
    return {
      statusCode: 400,
      body: JSON.stringify({ status: 'error', message: 'ticker and mode are required' }),
    };
  }
  if (mode === 'asof' && !date) {
    return {
      statusCode: 400,
      body: JSON.stringify({ status: 'error', message: 'date is required for mode=asof' }),
    };
  }

  try {
    const exchanges = exchange ? [exchange] : ['NSE', 'BSE'];
    let result = { status: 'invalid_ticker' };
    for (const ex of exchanges) {
      result = mode === 'asof'
        ? await getPriceOnOrBefore(ticker, ex, date)
        : await getLatestCompletedClose(ticker, ex);
      if (result.status === 'ok') {
        result.exchange = ex;
        break;
      }
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: String((err && err.message) || err) }),
    };
  }
};
