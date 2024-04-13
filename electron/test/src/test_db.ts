import {BaseElectronTest} from './common/commontesting';
import {Logger} from '../../main/src/logger';
import {ok} from 'assert';
import {DemoDB} from '../../main/src/demodb';
import {join} from 'path';

class TestDatabase extends BaseElectronTest {
  async run(): Promise<void> {
    const path = join(__dirname, 'data/recipes.db');
    Logger.log(`About to open database: ${path}`);
    const db = new DemoDB(path);
    await db.connect();
    const recipes = await db.getRecipes();
    ok(recipes.length == 0);
    await db.addRecipe('Water', 'This recipe is just water. Have some water.');
    const recipes2 = await db.getRecipes();
    ok(recipes2.length == 1);
    const recipe = recipes2[0];
    Logger.log(`Loaded one recipe: ${JSON.stringify(recipe)}`);
    ok(recipe.name === 'water');
    ok(recipe.text.indexOf('just water') !== -1);
  }
}

new TestDatabase('test_db');
