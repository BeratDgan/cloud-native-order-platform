function mapOrder(row) {
  const createdAt = row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString();

  return {
    id: String(row.id),
    product: row.product,
    quantity: row.quantity,
    status: row.status,
    user: row.user_data,
    version: row.version,
    servedBy: row.served_by,
    createdAt,
    persisted: true
  };
}

class PostgresOrderRepository {
  constructor(pool) {
    this.kind = "postgres";
    this.pool = pool;
  }

  async initialize() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGSERIAL PRIMARY KEY,
        product VARCHAR(80) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        status VARCHAR(32) NOT NULL,
        user_data JSONB NOT NULL,
        version VARCHAR(16) NOT NULL,
        served_by VARCHAR(64) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);
    await this.pool.query("CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC)");
  }

  async create(order) {
    const result = await this.pool.query(`
      INSERT INTO orders (product, quantity, status, user_data, version, served_by, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, product, quantity, status, user_data, version, served_by, created_at
    `, [
      order.product,
      order.quantity,
      order.status,
      order.user,
      order.version,
      order.servedBy,
      order.createdAt
    ]);

    return mapOrder(result.rows[0]);
  }

  async findById(id) {
    const result = await this.pool.query(`
      SELECT id, product, quantity, status, user_data, version, served_by, created_at
      FROM orders
      WHERE id = $1
    `, [String(id)]);

    return result.rows[0] ? mapOrder(result.rows[0]) : null;
  }

  async list() {
    const result = await this.pool.query(`
      SELECT id, product, quantity, status, user_data, version, served_by, created_at
      FROM orders
      ORDER BY created_at DESC, id DESC
    `);

    return result.rows.map(mapOrder);
  }

  async isReady() {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { PostgresOrderRepository, mapOrder };
