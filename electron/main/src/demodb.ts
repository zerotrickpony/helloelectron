import {BaseDB, ScalarResult} from './util/db';
import {RecipeRow} from './common/schema';
import {Logger} from './logger';

// A simple demo database class
export class DemoDB extends BaseDB {
  protected async install() {
    await this.transact(() => {
      this.runStatement(`
      CREATE TABLE IF NOT EXISTS Recipes (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        text TEXT NOT NULL
      )`);
    });
  }

  // Adds one recipe.
  async addRecipe(name: string, text: string): Promise<void> {
    name = name.toLowerCase();
    await this.transact(() => {
      this.runStatement(`DELETE FROM Recipes where name = ?`, [name]);
      this.runStatement(`INSERT INTO Recipes VALUES (NULL, ?, ?)`, [name, text]);
    });
    Logger.log(`Inserted recipe [${name}] -> "${text}"`);
  }

  // Returns true if we have the given recipe name.
  async hasRecipe(name: string): Promise<boolean> {
    return await this.transact(() => {
      const row = this.getOne<ScalarResult<number>>(`
        SELECT COUNT(name) as result FROM Recipes WHERE name = ?
      `, [name.toLowerCase()]);
      return !!row?.result && row.result > 0;
    });
  }

  // Returns the text of one recipe, if any.
  async getRecipe(name: string): Promise<string|undefined> {
    return await this.transact(() => {
      const row = this.getOne<RecipeRow>(`
        SELECT text FROM Recipes WHERE name = ? LIMIT 1
      `, [name.toLowerCase()]);
      return row?.text;
    });
  }

  // Returns all known recipes
  async getRecipes(): Promise<RecipeRow[]> {
    return await this.transact(() => {
      return this.getAll(`SELECT * FROM Recipes`) as RecipeRow[];
    });
  }
}
