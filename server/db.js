const { MongoClient, ObjectId } = require('mongodb');
const config = require('./config');

let client = null;
let db = null;

// Lightweight in-memory fallback collection for offline/invalid credentials dev
class InMemoryCollection {
  constructor(name) {
    this.name = name;
    this.docs = [];
  }

  async createIndex() {
    return true;
  }

  async insertOne(doc) {
    const _id = doc._id || new ObjectId();
    const newDoc = { ...doc, _id };
    this.docs.push(newDoc);
    return { insertedId: _id, acknowledged: true };
  }

  async findOne(query) {
    return (
      this.docs.find((d) => {
        return Object.keys(query).every((k) => {
          if (k === '$or') {
            return query.$or.some((subQ) =>
              Object.keys(subQ).every((subK) => String(d[subK]) === String(subQ[subK]))
            );
          }
          return String(d[k]) === String(query[k]);
        });
      }) || null
    );
  }

  find(query = {}) {
    let results = this.docs.filter((d) => {
      return Object.keys(query).every((k) => String(d[k]) === String(query[k]));
    });

    return {
      sort: () => ({
        toArray: async () => results,
      }),
      toArray: async () => results,
    };
  }

  async updateOne(filter, update, options = {}) {
    let doc = await this.findOne(filter);
    if (!doc && options.upsert) {
      const newDoc = { ...(filter || {}), ...(update.$set || {}) };
      await this.insertOne(newDoc);
      return { acknowledged: true, upsertedId: newDoc._id };
    }
    if (doc && update.$set) {
      Object.assign(doc, update.$set);
      return { acknowledged: true, modifiedCount: 1 };
    }
    return { acknowledged: true, modifiedCount: 0 };
  }

  async deleteOne(filter) {
    const idx = this.docs.findIndex((d) =>
      Object.keys(filter).every((k) => String(d[k]) === String(filter[k]))
    );
    if (idx !== -1) {
      this.docs.splice(idx, 1);
      return { deletedCount: 1 };
    }
    return { deletedCount: 0 };
  }

  async deleteMany(filter) {
    const initialLen = this.docs.length;
    this.docs = this.docs.filter(
      (d) => !Object.keys(filter).every((k) => String(d[k]) === String(filter[k]))
    );
    return { deletedCount: initialLen - this.docs.length };
  }
}

class InMemoryDb {
  constructor() {
    this.collections = {};
  }
  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = new InMemoryCollection(name);
    }
    return this.collections[name];
  }
}

async function connectDB() {
  if (db) return db;

  if (config.MONGODB_URI) {
    try {
      client = new MongoClient(config.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      });

      await client.connect();
      db = client.db(config.MONGODB_DATABASE);
      console.log(`[Database] Successfully connected to MongoDB Atlas: ${config.MONGODB_DATABASE}`);

      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('users').createIndex({ googleId: 1 }, { unique: true, sparse: true });
      await db.collection('plans').createIndex({ id: 1 }, { unique: true });
      await db.collection('plans').createIndex({ userId: 1 });
      await db.collection('playlists').createIndex({ youtube_playlist_id: 1 }, { unique: true });
      await db.collection('progress').createIndex({ plan_id: 1, youtube_video_id: 1 }, { unique: true });

      return db;
    } catch (error) {
      console.warn(`[Database] Cloud MongoDB connection notice (${error.message}).`);
      console.warn(`[Database] Switching to in-memory local fallback store for seamless local execution.`);
      if (client) {
        try { await client.close(); } catch {}
        client = null;
      }
    }
  }

  db = new InMemoryDb();
  return db;
}

function getDb() {
  if (!db) {
    db = new InMemoryDb();
  }
  return db;
}

async function closeDB() {
  if (client) {
    await client.close();
    client = null;
  }
  db = null;
}

module.exports = {
  connectDB,
  getDb,
  closeDB,
};
