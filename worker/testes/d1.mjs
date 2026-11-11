// Adaptador mínimo do D1 sobre node:sqlite (Node 22+), para testar a API sem a Cloudflare.
// Aplica as migrações em ordem num banco em memória.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
export function criarD1(migracoesDir) {
  const db = new DatabaseSync(':memory:');
  for (const f of fs.readdirSync(migracoesDir).sort()) db.exec(fs.readFileSync(migracoesDir + '/' + f, 'utf8'));
  class Stmt {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...a) { return new Stmt(this.sql, a); }
    _p() { return db.prepare(this.sql); }
    async all() { return { results: this._p().all(...this.args) }; }
    async first() { return this._p().get(...this.args) ?? null; }
    async run() { const r = this._p().run(...this.args); return { meta: { changes: r.changes } }; }
    _sync() { const p = this._p(); if (/^\s*(SELECT|WITH)|RETURNING/i.test(this.sql)) { const r = p.all(...this.args); return { results: r, meta: { changes: r.length } }; } const r = p.run(...this.args); return { results: [], meta: { changes: r.changes } }; }
  }
  return {
    prepare: (sql) => new Stmt(sql),
    batch: async (stmts) => { db.exec('BEGIN'); try { const r = stmts.map((s) => s._sync()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    exec: async (sql) => db.exec(sql),
  };
}
