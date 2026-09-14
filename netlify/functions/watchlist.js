const { createClient } = require('@supabase/supabase-js');

function client() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

// Fields that may be set when an entry is first created — includes the
// once-only reference price, since it is written at creation time.
const INSERT_FIELDS = [
  'analysis_date', 'analyzer_name', 'ticker', 'category', 'strategy_timeframe',
  'rationale', 'exchange', 'reference_price', 'reference_price_date',
  'current_price', 'current_price_asof', 'price_status', 'price_error_message',
];

// Fields that may change after creation. Deliberately excludes ticker,
// analysis_date, exchange, reference_price and reference_price_date —
// those define the historical record and must never be edited.
const UPDATE_FIELDS = [
  'analyzer_name', 'category', 'strategy_timeframe', 'rationale',
  'current_price', 'current_price_asof', 'price_status', 'price_error_message',
];

function pick(body, allowed) {
  const out = {};
  for (const key of allowed) {
    if (body[key] !== undefined) out[key] = body[key];
  }
  return out;
}

exports.handler = async (event) => {
  const supabase = client();

  try {
    if (event.httpMethod === 'GET') {
      const { data, error } = await supabase
        .from('watchlist_entries')
        .select('*')
        .order('analysis_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return json(200, data);
    }

    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      if (!body.analysis_date || !body.ticker || !body.category || !body.strategy_timeframe) {
        return json(400, { message: 'analysis_date, ticker, category, and strategy_timeframe are required' });
      }
      const { data, error } = await supabase
        .from('watchlist_entries')
        .insert([pick(body, INSERT_FIELDS)])
        .select()
        .single();
      if (error) throw error;
      return json(200, data);
    }

    if (event.httpMethod === 'PATCH') {
      const body = JSON.parse(event.body || '{}');
      if (!body.id) return json(400, { message: 'id is required' });
      const fields = pick(body, UPDATE_FIELDS);
      fields.updated_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('watchlist_entries')
        .update(fields)
        .eq('id', body.id)
        .select()
        .single();
      if (error) throw error;
      return json(200, data);
    }

    if (event.httpMethod === 'DELETE') {
      const body = JSON.parse(event.body || '{}');
      if (!body.id) return json(400, { message: 'id is required' });
      const { error } = await supabase.from('watchlist_entries').delete().eq('id', body.id);
      if (error) throw error;
      return json(200, { ok: true });
    }

    return json(405, { message: 'method not allowed' });
  } catch (err) {
    return json(500, {
      message: String((err && err.message) || err),
      debug: {
        hasUrl: !!process.env.SUPABASE_URL,
        urlPreview: (process.env.SUPABASE_URL || '').slice(0, 40),
        urlLength: (process.env.SUPABASE_URL || '').length,
        hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        keyLength: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
        keyPrefix: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 8),
        errName: err && err.name,
        errStack: err && err.stack ? String(err.stack).split('\n').slice(0, 4) : null,
      },
    });
  }
};
