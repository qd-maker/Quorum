/**
 * Quorum Offline Store
 * IndexedDB 离线缓存层 — 零依赖，使用原生 indexedDB API
 * 
 * 支持：讨论记录离线存储 + 联网自动同步
 */

const DB_NAME = 'quorum-offline'
const DB_VERSION = 1
const STORE_DISCUSSIONS = 'discussions'
const STORE_PENDING = 'pending-sync'

interface OfflineDiscussion {
    id: string
    topic: string
    messages: any[]
    consensus: string
    roles: Record<string, string>
    timestamp: number
    synced: boolean
}

// ─── DB Init ──────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION)

        req.onupgradeneeded = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(STORE_DISCUSSIONS)) {
                db.createObjectStore(STORE_DISCUSSIONS, { keyPath: 'id' })
            }
            if (!db.objectStoreNames.contains(STORE_PENDING)) {
                db.createObjectStore(STORE_PENDING, { keyPath: 'id' })
            }
        }

        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}

// ─── Save Discussion Offline ──────────────────────

export async function saveDiscussionOffline(discussion: OfflineDiscussion): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_DISCUSSIONS, STORE_PENDING], 'readwrite')

        // 保存到主存储
        tx.objectStore(STORE_DISCUSSIONS).put(discussion)

        // 如果未同步，也放入待同步队列
        if (!discussion.synced) {
            tx.objectStore(STORE_PENDING).put({
                id: discussion.id,
                data: discussion,
                createdAt: Date.now(),
            })
        }

        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

// ─── Get All Offline Discussions ──────────────────

export async function getOfflineDiscussions(): Promise<OfflineDiscussion[]> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_DISCUSSIONS, 'readonly')
        const req = tx.objectStore(STORE_DISCUSSIONS).getAll()

        req.onsuccess = () => {
            const results = req.result as OfflineDiscussion[]
            // 按时间降序
            results.sort((a, b) => b.timestamp - a.timestamp)
            resolve(results)
        }
        req.onerror = () => reject(req.error)
    })
}

// ─── Sync Pending Discussions ─────────────────────

export async function syncPendingDiscussions(
    apiFetchFn: (url: string, init?: RequestInit) => Promise<Response>
): Promise<{ synced: number; failed: number }> {
    const db = await openDB()

    const pendingItems = await new Promise<any[]>((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING, 'readonly')
        const req = tx.objectStore(STORE_PENDING).getAll()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })

    if (pendingItems.length === 0) return { synced: 0, failed: 0 }

    let synced = 0
    let failed = 0

    for (const item of pendingItems) {
        try {
            const res = await apiFetchFn('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.data),
            })

            if (res.ok) {
                // 同步成功：从 pending 中移除，标记 discussion 为已同步
                const tx = db.transaction([STORE_PENDING, STORE_DISCUSSIONS], 'readwrite')
                tx.objectStore(STORE_PENDING).delete(item.id)

                const discussion = item.data as OfflineDiscussion
                discussion.synced = true
                tx.objectStore(STORE_DISCUSSIONS).put(discussion)

                synced++
            } else {
                failed++
            }
        } catch {
            failed++
        }
    }

    return { synced, failed }
}

// ─── Clear Synced Item ────────────────────────────

export async function clearSynced(id: string): Promise<void> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING, 'readwrite')
        tx.objectStore(STORE_PENDING).delete(id)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(tx.error)
    })
}

// ─── Get Pending Count ────────────────────────────

export async function getPendingCount(): Promise<number> {
    const db = await openDB()
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PENDING, 'readonly')
        const req = tx.objectStore(STORE_PENDING).count()
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
    })
}
