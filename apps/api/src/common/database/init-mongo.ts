import { MongoClient } from 'mongodb';
import { config } from 'dotenv';
import { COLLECTION_DEFINITIONS } from './collection-definitions';

config({ path: '.env' });

async function main() {
  const uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/fleger_warehouse';
  const client = new MongoClient(uri);

  await client.connect();
  const db = client.db();
  const existingCollections = new Set((await db.listCollections().toArray()).map((collection) => collection.name));

  for (const definition of COLLECTION_DEFINITIONS) {
    if (!existingCollections.has(definition.name)) {
      await db.createCollection(definition.name);
      console.log(`created collection: ${definition.name}`);
    } else {
      console.log(`collection exists: ${definition.name}`);
    }

    const collection = db.collection(definition.name);
    const existingIndexes = await collection.indexes();

    for (const index of definition.indexes) {
      const matchingIndex = existingIndexes.find(
        (existingIndex) => JSON.stringify(existingIndex.key) === JSON.stringify(index.key)
      );

      if (matchingIndex) {
        console.log(`index exists: ${definition.name}.${matchingIndex.name}`);
        continue;
      }

      const options = {
        ...(index.name ? { name: index.name } : {}),
        ...(typeof index.unique === 'boolean' ? { unique: index.unique } : {}),
        ...(typeof index.sparse === 'boolean' ? { sparse: index.sparse } : {}),
        ...(typeof index.expireAfterSeconds === 'number' ? { expireAfterSeconds: index.expireAfterSeconds } : {})
      };

      await collection.createIndex(index.key, options);
      console.log(`created index: ${definition.name}.${index.name}`);
    }
  }

  await client.close();
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
