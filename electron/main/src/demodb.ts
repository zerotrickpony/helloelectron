import {BaseDB, ScalarResult} from './util/db';
import {RecipeRow} from './common/schema';
import {Logger} from './logger';

// A simple demo database class
export class DemoDB extends BaseDB {
  protected async install() {
    await this.transact(async x => {
      await this.runStatement(`
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
    await this.transact(async x => {
      await this.runStatement(`DELETE FROM Recipes where name = ?`, [name]);
      await this.runStatement(`INSERT INTO Recipes VALUES (NULL, ?, ?)`, [name, text]);
    });
    Logger.log(`Inserted recipe [${name}] -> "${text}"`);
  }

  // Returns true if we have the given recipe name.
  async hasRecipe(name: string): Promise<boolean> {
    return await this.transact(async x => {
      const row: ScalarResult<number> = await this.getOne(`
        SELECT COUNT(name) as result FROM Recipes WHERE name = ?
      `, [name.toLowerCase()]);
      const z = !!row && !!row['result'] && row['result'] > 0;
      return z;
    });
  }

  // Returns the text of one recipe, if any.
  async getRecipe(name: string): Promise<string|undefined> {
    return await this.transact(async x => {
      const row: RecipeRow = await this.getOne(`
        SELECT text FROM Recipes WHERE name = ? LIMIT 1
      `, [name.toLowerCase()]);
      return row && row['text'] ? row['text'] : undefined;
    });
  }

  // Returns all known recipes
  async getRecipes(): Promise<RecipeRow[]> {
    return await this.transact(async x => {
      return await this.getAll(`SELECT * FROM Recipes`);
    });
  }
}
