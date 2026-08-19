window.utils = window.utils || {};
window.__apiCache = { data: {}, promises: {} };

const firebaseConfig = {
  apiKey: "AIzaSyB-qFo-HY_eDPW9wEkagdanBhbU_FqdXfU",
  authDomain: "shiridi-sai-nilayam.firebaseapp.com",
  projectId: "shiridi-sai-nilayam",
  storageBucket: "shiridi-sai-nilayam.firebasestorage.app",
  messagingSenderId: "892062872658",
  appId: "1:892062872658:web:a8abe10a47fa2734af5b8b",
  measurementId: "G-RZM0MBYS7R"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
db.settings({ experimentalForceLongPolling: true });

window.utils.sha256 = async (message) => {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

window.utils.getCurrentMonthStr = () => {
  const d = new Date();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${d.getFullYear()}-${m}`;
};

window.utils.withRetry = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      const isNetworkError = error?.code === 'unavailable' || error?.message?.toLowerCase().includes('network');
      if (!isNetworkError || i === maxRetries - 1) throw error;
      await new Promise(res => setTimeout(res, 1000 * Math.pow(2, i))); 
    }
  }
};

window.utils.fetchWithCache = async (cacheKey, fetchFn, force = false) => {
  if (!force && window.__apiCache.data[cacheKey]) {
    return JSON.parse(JSON.stringify(window.__apiCache.data[cacheKey])); 
  }
  if (!force && window.__apiCache.promises[cacheKey]) {
    const res = await window.__apiCache.promises[cacheKey];
    return JSON.parse(JSON.stringify(res));
  }
  
  const promise = window.utils.withRetry(fetchFn).then(data => {
    window.__apiCache.data[cacheKey] = data;
    delete window.__apiCache.promises[cacheKey];
    return data;
  }).catch(err => {
    delete window.__apiCache.promises[cacheKey];
    throw err;
  });
  
  window.__apiCache.promises[cacheKey] = promise;
  const res = await promise;
  return JSON.parse(JSON.stringify(res));
};

window.utils.invalidateCache = (prefix) => {
  Object.keys(window.__apiCache.data).forEach(k => {
    if (k.startsWith(prefix)) delete window.__apiCache.data[k];
  });
};

window.utils.formatDbError = (operation, error) => {
  console.error(`🔴 Technical Database Error [${operation}]:`, error);
  const err = new Error(error?.message || 'Database connection failed');
  err.operation = operation;
  err.rawError = error;
  return err;
};

const mapSnapshot = (snapshot) => {
  return snapshot.docs.map(doc => ({
    objectId: doc.id,
    objectData: doc.data()
  }));
};

window.api = {
  getFlats: async () => {
    try {
      return await window.utils.fetchWithCache('flats', async () => {
        const snapshot = await db.collection('flats').get();
        const items = mapSnapshot(snapshot);
        return items.sort((a, b) => {
          const numA = parseInt(a.objectData?.flat_no) || 0;
          const numB = parseInt(b.objectData?.flat_no) || 0;
          return numA - numB;
        });
      });
    } catch (error) {
      throw window.utils.formatDbError('getFlats()', error);
    }
  },
  saveFlat: async (flatData, objectId = null) => {
    try {
      window.utils.invalidateCache('flats');
      if (objectId) {
        await db.collection('flats').doc(objectId).set(flatData, { merge: true });
        return { objectId, objectData: flatData };
      }
      const ref = await db.collection('flats').add(flatData);
      return { objectId: ref.id, objectData: flatData };
    } catch (error) {
      throw window.utils.formatDbError('saveFlat()', error);
    }
  },
  deleteFlat: async (objectId) => {
    try {
      window.utils.invalidateCache('flats');
      await db.collection('flats').doc(objectId).delete();
      return true;
    } catch (error) {
      throw window.utils.formatDbError('deleteFlat()', error);
    }
  },

  getWaterReadings: async (month) => {
    try {
      return await window.utils.fetchWithCache(`water_readings_${month || 'all'}`, async () => {
        let query = db.collection('water_readings');
        if (month && month !== 'test') {
          query = query.where('month', '==', month);
        }
        const snapshot = await query.get();
        return mapSnapshot(snapshot);
      });
    } catch (error) {
      throw window.utils.formatDbError('getWaterReadings', error);
    }
  },
  saveWaterReading: async (data, objectId = null) => {
    try {
      window.utils.invalidateCache('water_readings');
      if (objectId) {
        await db.collection('water_readings').doc(objectId).set(data, { merge: true });
        return { objectId, objectData: data };
      }
      const ref = await db.collection('water_readings').add(data);
      return { objectId: ref.id, objectData: data };
    } catch (error) {
      throw window.utils.formatDbError('saveWaterReading()', error);
    }
  },

  getWaterTankers: async (month) => {
    try {
      return await window.utils.fetchWithCache(`water_tankers_${month || 'all'}`, async () => {
        let query = db.collection('water_tankers');
        if (month && month !== 'test') {
          query = query.where('month', '==', month);
        }
        const snapshot = await query.get();
        return mapSnapshot(snapshot);
      });
    } catch (error) {
      throw window.utils.formatDbError('getWaterTankers', error);
    }
  },
  saveWaterTanker: async (data, objectId = null) => {
    try {
      window.utils.invalidateCache('water_tankers');
      if (objectId) {
        await db.collection('water_tankers').doc(objectId).set(data, { merge: true });
        return { objectId, objectData: data };
      }
      const ref = await db.collection('water_tankers').add(data);
      return { objectId: ref.id, objectData: data };
    } catch (error) {
      throw window.utils.formatDbError('saveWaterTanker()', error);
    }
  },
  deleteWaterTanker: async (objectId) => {
    try {
      window.utils.invalidateCache('water_tankers');
      await db.collection('water_tankers').doc(objectId).delete();
      return true;
    } catch (error) {
      throw window.utils.formatDbError('deleteWaterTanker()', error);
    }
  },

  getExpenses: async (month) => {
    try {
      return await window.utils.fetchWithCache(`expenses_${month || 'all'}`, async () => {
        const snapshot = await db.collection('expenses').get();
        const items = mapSnapshot(snapshot);
        return items.filter(item => {
          if (!item.objectData.date) return false;
          if (month === 'test') return true;
          return item.objectData.date.startsWith(month);
        });
      });
    } catch (error) {
      throw window.utils.formatDbError('getExpenses()', error);
    }
  },
  saveExpense: async (data, objectId = null) => {
    try {
      window.utils.invalidateCache('expenses');
      if (objectId) {
        await db.collection('expenses').doc(objectId).set(data, { merge: true });
        return { objectId, objectData: data };
      }
      const ref = await db.collection('expenses').add(data);
      return { objectId: ref.id, objectData: data };
    } catch (error) {
      throw window.utils.formatDbError('saveExpense()', error);
    }
  },
  deleteExpense: async (objectId) => {
    try {
      window.utils.invalidateCache('expenses');
      await db.collection('expenses').doc(objectId).delete();
      return true;
    } catch (error) {
      throw window.utils.formatDbError('deleteExpense()', error);
    }
  },

  getAllMonthlySummaries: async () => {
    try {
      return await window.utils.fetchWithCache('monthly_summaries_all', async () => {
        const snapshot = await db.collection('monthly_summary').get();
        return mapSnapshot(snapshot);
      });
    } catch (error) {
      throw window.utils.formatDbError('getAllMonthlySummaries()', error);
    }
  },
  getMonthlySummary: async (month) => {
    try {
      return await window.utils.fetchWithCache(`monthly_summary_${month}`, async () => {
        let query = db.collection('monthly_summary');
        if (month && month !== 'test') {
          query = query.where('month', '==', month);
        }
        const snapshot = await query.get();
        const items = mapSnapshot(snapshot);
        return items.length > 0 ? items[0] : null;
      });
    } catch (error) {
      throw window.utils.formatDbError('getMonthlySummary', error);
    }
  },
  saveMonthlySummary: async (data, objectId = null) => {
    try {
      window.utils.invalidateCache('monthly_summary');
      if (objectId) {
        await db.collection('monthly_summary').doc(objectId).set(data, { merge: true });
        return { objectId, objectData: data };
      }
      const ref = await db.collection('monthly_summary').add(data);
      return { objectId: ref.id, objectData: data };
    } catch (error) {
      throw window.utils.formatDbError('saveMonthlySummary()', error);
    }
  },

  getMonthlyBills: async (month) => {
    try {
      return await window.utils.fetchWithCache(`monthly_bills_${month}`, async () => {
        let query = db.collection('monthly_bills');
        if (month) {
          query = query.where('month', '==', month);
        }
        const snapshot = await query.get();
        return mapSnapshot(snapshot);
      });
    } catch (error) {
      throw window.utils.formatDbError('getMonthlyBills()', error);
    }
  },
  saveMonthlyBill: async (data, objectId = null) => {
    try {
      window.utils.invalidateCache('monthly_bills');
      if (objectId) {
        await db.collection('monthly_bills').doc(objectId).set(data, { merge: true });
        return { objectId, objectData: data };
      }
      const ref = await db.collection('monthly_bills').add(data);
      return { objectId: ref.id, objectData: data };
    } catch (error) {
      throw window.utils.formatDbError('saveMonthlyBill()', error);
    }
  },
  
  // Expose firestore db for custom use like auth
  getAdminSettings: async () => {
    try {
      const snapshot = await db.collection('admin_settings').get();
      return mapSnapshot(snapshot);
    } catch (err) {
      throw window.utils.formatDbError('getAdminSettings()', err);
    }
  }
};