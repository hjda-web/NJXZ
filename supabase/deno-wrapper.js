const NZ_SUPABASE_URL = Deno.env.get("NZ_SUPABASE_URL");
const NZ_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("NZ_SUPABASE_SERVICE_ROLE_KEY");

function makeDbAdapter() {
  async function request(method, table, query, body, prefer) {
    const url = `${NZ_SUPABASE_URL}/rest/v1/${table}${query || ""}`;
    const headers = {
      apikey: NZ_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${NZ_SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };
    if (prefer) {
      headers.Prefer = prefer;
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${table} failed: ${response.status} ${text}`);
    }
    return response;
  }

  function rowsFromResponse(response) {
    return response.json().catch(() => []);
  }

  async function first(sql, params) {
    const text = sql.replace(/\s+/g, " ").trim();
    let table = "users";
    let query = "";
    if (text.includes("FROM users")) {
      table = "users";
      query = `?phone=eq.${encodeURIComponent(params[0])}`;
    } else if (text.includes("FROM sessions")) {
      table = "sessions";
      query = `?token=eq.${encodeURIComponent(params[0])}`;
    } else if (text.includes("FROM groups") && text.includes("WHERE id")) {
      table = "groups";
      query = `?id=eq.${encodeURIComponent(params[0])}`;
    }
    const response = await request("GET", table, query);
    const rows = await rowsFromResponse(response);
    return Array.isArray(rows) ? rows[0] || null : rows || null;
  }

  async function all(sql) {
    const text = sql.replace(/\s+/g, " ").trim();
    let table = "groups";
    let query = "?select=*&order=created_at.asc";
    if (text.includes("FROM users")) {
      table = "users";
      query = "?select=*";
    } else if (text.includes("FROM sessions")) {
      table = "sessions";
      query = "?select=*";
    }
    const response = await request("GET", table, query);
    return { results: await rowsFromResponse(response) };
  }

  async function run(sql, params) {
    const text = sql.replace(/\s+/g, " ").trim();
    let table = "";
    let method = "POST";
    let body = null;
    let query = "";
    let prefer = "return=representation";

    if (text.includes("INSERT INTO users")) {
      table = "users";
      body = {
        phone: params[0],
        hash: params[1],
        salt: params[2],
        role: params[3],
        identity: params[4],
        large_font: params[5],
        nickname: params[6],
        city: params[7],
        created_at: params[8],
        last_login_at: params[9],
        common_crops: params[10] || []
      };
      prefer = "resolution=merge-duplicates,return=representation";
    } else if (text.includes("INSERT INTO sessions")) {
      table = "sessions";
      body = {
        token: params[0],
        phone: params[1],
        expires_at: params[2]
      };
      prefer = "return=representation";
    } else if (text.includes("INSERT INTO groups")) {
      table = "groups";
      body = {
        id: params[0],
        name: params[1],
        leader_phone: params[2],
        created_at: params[3],
        members_json: params[4]
      };
      prefer = "resolution=merge-duplicates,return=representation";
    } else if (text.includes("DELETE FROM sessions")) {
      table = "sessions";
      method = "DELETE";
      query = `?token=eq.${encodeURIComponent(params[0])}`;
    } else if (text.includes("DELETE FROM groups")) {
      table = "groups";
      method = "DELETE";
      query = `?id=eq.${encodeURIComponent(params[0])}`;
    }

    const response = await request(method, table, query, body, prefer);
    await response.text().catch(() => "");
    return { success: true };
  }

  return {
    prepare(sql) {
      const statement = {
        params: [],
        bind(...values) {
          this.params = values;
          return this;
        },
        first() {
          return first(sql, statement.params);
        },
        all() {
          return all(sql);
        },
        run() {
          return run(sql, statement.params);
        }
      };
      return statement;
    }
  };
}

function makeDataAdapter() {
  async function request(method, table, query, body, prefer) {
    const url = `${NZ_SUPABASE_URL}/rest/v1/${table}${query || ""}`;
    const headers = {
      apikey: NZ_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${NZ_SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };
    if (prefer) {
      headers.Prefer = prefer;
    }
    const response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`${method} ${table} failed: ${response.status} ${text}`);
    }
    return response;
  }

  function normalizeBody(table, body) {
    if (!body) {
      return body;
    }
    if (table === "fertilizer_prices") {
      return {
        fertilizer: body.fertilizer,
        min_price: body.minPrice,
        max_price: body.maxPrice,
        unit: body.unit
      };
    }
    return body;
  }

  return {
    async get(table) {
      const query = table === "group_messages"
        ? "?select=*&order=created_at.asc"
        : "?select=*";
      const response = await request("GET", table, query);
      return response.json().catch(() => []);
    },
    async post(table, body) {
      const prefer = table === "group_messages"
        ? "return=representation"
        : "resolution=merge-duplicates,return=representation";
      const response = await request("POST", table, "", normalizeBody(table, body), prefer);
      await response.text().catch(() => "");
      return { success: true };
    },
    async delete(table, keyName, keyValue) {
      const query = `?${encodeURIComponent(keyName)}=eq.${encodeURIComponent(keyValue)}`;
      const response = await request("DELETE", table, query);
      await response.text().catch(() => "");
      return { success: true };
    }
  };
}

Deno.serve(async (request) => {
  try {
    const original = new URL(request.url);
    const path = original.pathname.replace(/^\/nzx-api/, "") || "/";
    const internalUrl = `https://internal.supabase${path}${original.search}`;
    const internalRequest = new Request(internalUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body
    });
    return await nzx_worker.fetch(internalRequest, {
      DB: makeDbAdapter(),
      DATA: makeDataAdapter()
    });
  } catch (error) {
    return new Response(String(error && error.stack ? error.stack : error), {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
});
