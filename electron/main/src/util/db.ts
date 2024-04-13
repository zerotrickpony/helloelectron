import bs3 from 'better-sqlite3';
import {Mutex, AsyncFN} from '../common/commonutil';

export interface ScalarResult<X> {
  result: X;
}

// A SQLite wrapper base class with some locking fetures.
export abstract class BaseDB {
  filename: string;  // the full path to the database on disk
  db?: bs3.Database;  // set on connect

  // Set this to true if you want journaling. NOTE: depending on your application, journal
  // files can be a hassle. They are faster under concurrency and failures, but if your
  // database files are going to be seen/managed by users with external programs like
  // Finder/Explorer, then the user will have to be careful to keep the blah.wal and blah.shm
  // files together on disk. And if they erase them it will inflict random data loss.
  walMode = false;

  // Prepared statement cache
  statements = new Map<string, bs3.Statement>();

  // Execution guards. There must be exactly one transaction at all times.
  startMutex = new Mutex();
  txMutex = new Mutex();
  inTransaction = false;

  // Creates a not-yet-connected database.
  constructor(filename: string) {
    this.filename = filename;

  }

  isConnected(): boolean {
    return !!this.db;
  }

  // Installs or upgrades the schema. Override this; see dbupgrader.
  protected async install(): Promise<void> {}

  // Connects to the database.
  async connect(): Promise<void> {
    await this.startMutex.run(async x => {
      if (this.db) {
        return;  // Already connected
      }

      this.db = bs3(this.filename);
      if (this.walMode) {
        this.db.pragma('journal_mode = WAL');
      }
      await this.install();
    });
  }

  // Disconnects from the database.
  async close(): Promise<void> {
    return await this.startMutex.run(async x => {
      return await this.txMutex.run(async x => {
        if (!this.db) {
          return;  // already closed
        }
        try {
          await this.db.close();
          this.db = undefined;
          this.statements.clear();
        } catch (e) {
          BaseDB.rethrow(e);
        }
      });
    });
  }

  // Returns the prepared statement for this query string.
  private prepare(q: string): bs3.Statement {
    if (!this.db) {
      throw new Error(`No database connected`);
    }
    let s = this.statements.get(q);
    if (!s) {
      s = this.db.prepare(q);
      this.statements.set(q, s);
    }
    return s;
  }

  // Runs a transaction
  async transact<X>(fn: AsyncFN<X>): Promise<X> {
    return await this.txMutex.run(async x => {
      if (this.inTransaction) {
        throw new Error(`Already in transaction`);
      }
      let success = false;
      try {
        this.inTransaction = true;
        await this.runStatement('BEGIN TRANSACTION');
        const result = await fn();
        await this.runStatement('COMMIT');
        success = true;
        return result;
      } catch (e) {
        throw e;
      } finally {
        try {
          if (!success) {
            await this.runStatement('ROLLBACK');
          }
        } finally {
          this.inTransaction = false;
        }
      }
    });
  }

  // Runs a statement and gives a nicer stack trace for it.
  protected async runStatement(sql: string, ...args: any[]): Promise<void> {
    if (!this.inTransaction) {
      throw new Error(`All dbops must be in a transaction: ${sql}`);
    }

    try {
      const s = this.prepare(sql);
      s.run(...args);
    } catch (e) {
      BaseDB.rethrow(e);
    }
  }

  // Like above, but does db.all for multi-line result statements.
  protected async getAll(sql: string, ...args: any[]): Promise<any[]> {
    if (!this.inTransaction) {
      throw new Error(`All dbops must be in a transaction: ${sql}`);
    }

    try {
      const s = this.prepare(sql);
      return s.all(...args);
    } catch (e) {
      BaseDB.rethrow(e);
    }
  }

  // Like above, but does db.get for single-line result statements.
  protected async getOne<X>(sql: string, ...args: any[]): Promise<X> {
    if (!this.inTransaction) {
      throw new Error(`All dbops must be in a transaction: ${sql}`);
    }

    try {
      const s = this.prepare(sql);
      return s.get(...args) as X;
    } catch (e) {
      BaseDB.rethrow(e);
    }
  }

  // Gives us a better stack trace if this is a SQLITE error
  private static rethrow(e: Error): never {
    const eString = `${e}`;
    if (eString.indexOf('SQLITE_ERROR') != -1) {
      throw new Error(eString);  // Rethrow so that we get a proper stack trace
    } else {
      throw e;
    }
  }
}
