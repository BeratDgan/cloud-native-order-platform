class InMemoryOrderRepository {
  constructor({ firstId = 1000 } = {}) {
    this.kind = "memory";
    this.orders = new Map();
    this.nextId = firstId;
  }

  async create(order) {
    const stored = { ...order, id: String(this.nextId++) };
    this.orders.set(stored.id, structuredClone(stored));
    return structuredClone(stored);
  }

  async findById(id) {
    const order = this.orders.get(String(id));
    return order ? structuredClone(order) : null;
  }

  async list() {
    return [...this.orders.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((order) => structuredClone(order));
  }

  async isReady() {
    return true;
  }
}

module.exports = { InMemoryOrderRepository };
