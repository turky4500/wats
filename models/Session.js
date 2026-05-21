const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true }
});

sessionSchema.index({ userId: 1, key: 1 }, { unique: true });
const AuthSession = mongoose.model('AuthSession', sessionSchema);

async function useMongoDBAuthState(userId) {
    const writeData = async (data, key) => {
        const serialized = JSON.parse(JSON.stringify(data, (k, v) => 
            typeof v === 'bigint' ? v.toString() + 'n' : v
        ));
        await AuthSession.findOneAndUpdate(
            { userId, key },
            { data: serialized },
            { upsert: true, new: true }
        );
    };

    const readData = async (key) => {
        const doc = await AuthSession.findOne({ userId, key });
        if (!doc) return null;
        return JSON.parse(JSON.stringify(doc.data), (k, v) => {
            if (typeof v === 'string' && v.endsWith('n') && v.length > 10 && !isNaN(v.slice(0, -1))) {
                return BigInt(v.slice(0, -1));
            }
            if (v && v.type === 'Buffer' && Array.isArray(v.data)) {
                return Buffer.from(v.data);
            }
            return v;
        });
    };

    const removeData = async (key) => { await AuthSession.deleteOne({ userId, key }); };

    const creds = await readData('creds') || {};
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async id => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = require('@whiskeysockets/baileys').proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? writeData(value, key) : removeData(key));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds')
    };
}
module.exports = { AuthSession, useMongoDBAuthState };
