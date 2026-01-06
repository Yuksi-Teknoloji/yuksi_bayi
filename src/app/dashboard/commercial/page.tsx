//src/app/dashboard/commercial/page.tsx
'use client';

import * as React from 'react';
import { getAuthToken } from '@/src/utils/auth';

/* ========= Helpers ========= */
async function readJson<T = any>(res: Response): Promise<T> {
    const t = await res.text();
    try {
        return t ? JSON.parse(t) : (null as any);
    } catch {
        return t as any;
    }
}
const pickMsg = (d: any, fb: string) => d?.error?.message || d?.message || d?.detail || d?.title || fb;

function collectErrors(x: any): string {
    const msgs: string[] = [];
    if (x?.message) msgs.push(String(x.message));
    if (x?.data?.message) msgs.push(String(x.data.message));
    const err = x?.errors || x?.error || x?.detail;

    if (Array.isArray(err)) {
        for (const it of err) {
            if (typeof it === 'string') msgs.push(it);
            else if (it && typeof it === 'object') {
                const loc = Array.isArray((it as any).loc) ? (it as any).loc.join('.') : (it as any).loc ?? '';
                const m = (it as any).msg || (it as any).message || (it as any).detail;
                if (loc && m) msgs.push(`${loc}: ${m}`);
                else if (m) msgs.push(String(m));
            }
        }
    } else if (err && typeof err === 'object') {
        for (const [k, v] of Object.entries(err)) {
            if (Array.isArray(v)) (v as any[]).forEach((m) => msgs.push(`${k}: ${m}`));
            else if (v) msgs.push(`${k}: ${v}`);
        }
    }
    return msgs.join('\n');
}

const toNum = (v: unknown) => {
    if (typeof v === 'number') return v;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

function buildQuery(params: Record<string, any>) {
    const usp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        const s = String(v).trim();
        if (!s) continue;
        usp.set(k, s);
    }
    const q = usp.toString();
    return q ? `?${q}` : '';
}
/* ========= File helpers ========= */
type FileMeta = {
    file_id: string;
    file_url?: string | null;
    file_name?: string | null;
};

function parseUserIdFromJwt(tok: string | null): string | null {
    if (!tok) return null;
    const p = tok.split('.');
    if (p.length < 2) return null;
    try {
        const json = atob(p[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(p[1].length / 4) * 4, '='));
        const payload = JSON.parse(json);
        // olası alanlar
        return (
            payload?.user_id ||
            payload?.userId ||
            payload?.uid ||
            payload?.sub || // bazı sistemlerde sub=userId
            null
        );
    } catch {
        return null;
    }
}

function normalizeFileUploadResponse(j: any): FileMeta[] {
    // Swagger “string” gösteriyor, ama backend bazen object döner.
    // Bu yüzden her şeyi tolere ediyoruz.
    const out: FileMeta[] = [];

    const pushOne = (x: any) => {
        if (!x) return;

        // string ise: ya url ya file_id
        if (typeof x === 'string') {
            if (/^https?:\/\//i.test(x)) out.push({ file_id: x, file_url: x });
            else out.push({ file_id: x });
            return;
        }

        // object ise: olası alan adları
        const fid = x.file_id || x.id || x.fileId || x.uuid;
        const url = x.file_url || x.url || x.fileUrl || x.path || x.location;
        const name = x.file_name || x.name || x.filename || x.original_name;

        if (fid || url) out.push({ file_id: String(fid || url), file_url: url ? String(url) : null, file_name: name ? String(name) : null });
    };

    if (Array.isArray(j)) {
        j.forEach(pushOne);
        return out;
    }

    if (j?.data && Array.isArray(j.data)) {
        j.data.forEach(pushOne);
        return out;
    }

    // tek item
    pushOne(j?.data ?? j);
    return out;
}

function normalizeFileGetResponse(j: any): { url: string | null; name?: string | null } {
    // GET /file/{file_id} swagger “string” gösteriyor
    if (typeof j === 'string') {
        return { url: /^https?:\/\//i.test(j) ? j : null, name: null };
    }
    const x = j?.data ?? j;
    if (typeof x === 'string') return { url: /^https?:\/\//i.test(x) ? x : null, name: null };

    const url = x?.file_url || x?.url || x?.fileUrl || x?.path || x?.location || null;
    const name = x?.file_name || x?.name || x?.filename || x?.original_name || null;
    return { url: url ? String(url) : null, name: name ? String(name) : null };
}

/* ========= Listing image helper ========= */
function normalizeListingImages(images: any): Array<{
    id?: string;
    file_id?: string;
    order_index?: number;
    file_url?: string | null;
    file_name?: string | null;
}> {
    if (!images) return [];
    if (Array.isArray(images)) return images;

    if (typeof images === 'string') {
        const s = images.trim();
        if (!s) return [];
        try {
            const parsed = JSON.parse(s);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}

/* ========= Types (lightweight) ========= */
type ListingStatus = 'in_review' | 'approved' | 'rejected' | 'sold' | string;

type ListingBase = {
    id: string;
    title?: string;
    brand?: string;
    model?: string;
    year?: number;
    km?: number;
    engine_size?: number;
    price?: number;
    location?: string;
    fuel_type?: string;
    transmission?: string;
    body_type?: string;
    color?: string;
    condition?: string;
    heavy_damage_recorded?: boolean;
    source?: string;
    plate?: string;
    nationality?: string;
    phone?: string;
    description?: string;
    status?: ListingStatus;
    created_at?: string;
    updated_at?: string;
    owner_type?: string;
    main_image_url?: string | null;
    images?: Array<{
        id?: string;
        file_id?: string;
        order_index?: number;
        file_url?: string | null;
        file_name?: string | null;
    }>;
};

type CreateListingBody = {
    title: string;
    description: string;
    brand: string;
    model: string;
    year: number;
    km: number;
    engine_size: number;
    fuel_type: string;
    transmission: string;
    body_type: string;
    color: string;
    condition: string;
    heavy_damage_recorded: boolean;
    source: string;
    plate: string;
    nationality: string;
    price: number;
    location: string;
    phone: string;
    image_file_ids: string[];
};

type TabKey = 'featured' | 'search' | 'mine' | 'create';

function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }) {
    const cls =
        tone === 'ok'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : tone === 'warn'
                ? 'border-amber-200 bg-amber-50 text-amber-700'
                : tone === 'bad'
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-neutral-200 bg-neutral-50 text-neutral-700';
    return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

function StatLine({ k, v }: { k: string; v?: React.ReactNode }) {
    if (v === undefined || v === null || v === '') return null;
    return (
        <div className="flex items-start justify-between gap-4 text-sm">
            <span className="text-neutral-500">{k}</span>
            <span className="text-neutral-900 text-right whitespace-pre-line">{v}</span>
        </div>
    );
}

function statusTone(s?: string) {
    const x = String(s || '').toLowerCase();
    if (x === 'approved') return 'ok';
    if (x === 'in_review') return 'warn';
    if (x === 'rejected') return 'bad';
    if (x === 'sold') return 'neutral';
    return 'neutral';
}
/* ========= Options ========= */
const FUEL_TYPES = ['gasoline', 'diesel', 'electric', 'hybrid', 'lpg'] as const;
const CONDITIONS = ['new', 'second_hand', 'damaged'] as const;
const TRANSMISSIONS = ['manual', 'automatic', 'semi_automatic'] as const;
const SOURCES = ['user', 'sahibinden', 'gallery', 'other'] as const;
const BODY_TYPES = ['motorsiklet', 'minivan', 'panelvan', 'kamyonet', 'kamyon'] as const;

/* ========= Page ========= */
export default function CommercialListingsPage() {
    const token = React.useMemo(getAuthToken, []);
    const authHeaders = React.useMemo<HeadersInit>(
        () => ({
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        }),
        [token],
    );

    const [tab, setTab] = React.useState<TabKey>('featured');

    const [okMsg, setOkMsg] = React.useState<string | null>(null);
    const [errMsg, setErrMsg] = React.useState<string | null>(null);

    /* ===== Featured ===== */
    const [featured, setFeatured] = React.useState<ListingBase[]>([]);
    const [featuredLoading, setFeaturedLoading] = React.useState(false);
    const [featuredLimit, setFeaturedLimit] = React.useState(50);

    /* ===== Search ===== */
    const [searchLoading, setSearchLoading] = React.useState(false);
    const [searchResults, setSearchResults] = React.useState<ListingBase[]>([]);
    const [searchLimit, setSearchLimit] = React.useState(20);
    const [searchOffset, setSearchOffset] = React.useState(0);

    const [qSearch, setQSearch] = React.useState('');
    const [qBrand, setQBrand] = React.useState('');
    const [qModel, setQModel] = React.useState('');
    const [qMinYear, setQMinYear] = React.useState('');
    const [qMaxYear, setQMaxYear] = React.useState('');
    const [qMinKm, setQMinKm] = React.useState('');
    const [qMaxKm, setQMaxKm] = React.useState('');
    const [qMinPrice, setQMinPrice] = React.useState('');
    const [qMaxPrice, setQMaxPrice] = React.useState('');
    const [qFuel, setQFuel] = React.useState('');
    const [qTransmission, setQTransmission] = React.useState('');
    const [qBody, setQBody] = React.useState('');
    const [qColor, setQColor] = React.useState('');
    const [qLocation, setQLocation] = React.useState('');
    const [qCondition, setQCondition] = React.useState('');
    const [qSortBy, setQSortBy] = React.useState('created_at');
    const [qSortOrder, setQSortOrder] = React.useState<'asc' | 'desc'>('desc');
    const [qSource, setQSource] = React.useState('');

    /* ===== My Listings ===== */
    const [mineLoading, setMineLoading] = React.useState(false);
    const [myListings, setMyListings] = React.useState<ListingBase[]>([]);
    const [myLimit, setMyLimit] = React.useState(200);
    const [myOffset, setMyOffset] = React.useState(0);

    /* ===== Detail modal ===== */
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [detailLoading, setDetailLoading] = React.useState(false);
    const [detailErr, setDetailErr] = React.useState<string | null>(null);
    const [detail, setDetail] = React.useState<ListingBase | null>(null);
    const [detailMode, setDetailMode] = React.useState<'public' | 'mine'>('public');

    /* ===== File Upload / Resolve ===== */
    const userIdFromToken = React.useMemo(() => parseUserIdFromJwt(token), [token]);
    const [uploadUserId, setUploadUserId] = React.useState<string>(userIdFromToken || '');
    const [uploadBusy, setUploadBusy] = React.useState(false);
    const [uploadFiles, setUploadFiles] = React.useState<FileList | null>(null);
    const [uploaded, setUploaded] = React.useState<FileMeta[]>([]);

    // file_id -> url cache
    const [fileUrlMap, setFileUrlMap] = React.useState<Record<string, string>>({});

    /* ===== Create / Edit ===== */
    const emptyForm: CreateListingBody = React.useMemo(
        () => ({
            title: '',
            description: '',
            brand: '',
            model: '',
            year: 2020,
            km: 0,
            engine_size: 0,
            fuel_type: 'gasoline',
            transmission: 'manual',
            body_type: 'motorsiklet',
            color: '',
            condition: 'new',
            heavy_damage_recorded: false,
            source: 'user',
            plate: '',
            nationality: '',
            price: 0,
            location: '',
            phone: '',
            image_file_ids: [],
        }),
        [],
    );

    const [createBusy, setCreateBusy] = React.useState(false);
    const [form, setForm] = React.useState<CreateListingBody>(emptyForm);

    // Edit flow
    const [editId, setEditId] = React.useState<string | null>(null);
    const [editOpen, setEditOpen] = React.useState(false);
    const [editBusy, setEditBusy] = React.useState(false);

    // Edit images state (edit modal içinde yönetilecek)
    const [editImages, setEditImages] = React.useState<
        Array<{ id?: string; file_id?: string; order_index?: number; file_url?: string | null; file_name?: string | null }>
    >([]);

    const [editImgFileId, setEditImgFileId] = React.useState('');
    const [editImgOrderIndex, setEditImgOrderIndex] = React.useState('0');
    const [editImgBusy, setEditImgBusy] = React.useState(false);

    // Add image flow (requires file_id from your upload service)
    const [imgOpen, setImgOpen] = React.useState(false);
    const [imgBusy, setImgBusy] = React.useState(false);
    const [imgListingId, setImgListingId] = React.useState<string>('');
    const [imgFileId, setImgFileId] = React.useState<string>('');
    const [imgOrderIndex, setImgOrderIndex] = React.useState<string>('0');

    /* ========= API calls ========= */
    async function apiGet(path: string, auth = false) {
        const res = await fetch(path, {
            method: 'GET',
            cache: 'no-store',
            headers: auth ? authHeaders : { Accept: 'application/json' },
        });
        const j = await readJson(res);
        if (!res.ok || (j && (j as any).success === false)) {
            throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
        }
        return j;
    }

    async function apiSend(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: any, auth = true) {
        const res = await fetch(path, {
            method,
            cache: 'no-store',
            headers: {
                ...(auth ? authHeaders : { Accept: 'application/json' }),
                ...(method === 'POST' || method === 'PUT' ? { 'Content-Type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
        });
        const j = await readJson(res);
        if (!res.ok || (j && (j as any).success === false)) {
            throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
        }
        return j;
    }
    async function fileGetById(file_id: string) {
        const fid = String(file_id || '').trim();
        if (!fid) throw new Error('file_id boş.');
        const j = await apiGet(`/yuksi/file/${encodeURIComponent(fid)}`, true); // auth’lı deniyoruz, token yoksa apiGet zaten Accept ile gider
        return normalizeFileGetResponse(j);
    }

    async function fileGetByUser(user_id: string) {
        const uid = String(user_id || '').trim();
        if (!uid) throw new Error('user_id boş.');
        const j = await apiGet(`/yuksi/file/user/${encodeURIComponent(uid)}`, true);
        return normalizeFileUploadResponse(j);
    }

    async function fileUploadSingle(user_id: string, file: File) {
        const uid = String(user_id || '').trim();
        if (!uid) throw new Error('user_id zorunlu.');
        if (!file) throw new Error('file zorunlu.');

        const fd = new FormData();
        fd.append('user_id', uid);
        fd.append('file', file);

        const res = await fetch('/yuksi/file/upload', {
            method: 'POST',
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: fd,
        });

        const j = await readJson(res);
        if (!res.ok || (j && (j as any).success === false)) {
            throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
        }
        return normalizeFileUploadResponse(j);
    }

    async function fileUploadMultiple(user_id: string, files: FileList | File[]) {
        const uid = String(user_id || '').trim();
        const arr = Array.isArray(files) ? files : Array.from(files || []);
        if (!uid) throw new Error('user_id zorunlu.');
        if (!arr.length) throw new Error('files zorunlu.');

        const fd = new FormData();
        fd.append('user_id', uid);
        // swagger: files = array[string(binary)] -> name muhtemelen "files"
        arr.forEach((f) => fd.append('files', f));

        const res = await fetch('/yuksi/file/upload-multiple', {
            method: 'POST',
            cache: 'no-store',
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: fd,
        });

        const j = await readJson(res);
        if (!res.ok || (j && (j as any).success === false)) {
            throw new Error(collectErrors(j) || pickMsg(j, `HTTP ${res.status}`));
        }
        return normalizeFileUploadResponse(j);
    }

    async function ensureFileUrl(file_id: string) {
        const fid = String(file_id || '').trim();
        if (!fid) return null;
        if (fileUrlMap[fid]) return fileUrlMap[fid];

        const r = await fileGetById(fid);
        if (r.url) {
            setFileUrlMap((p) => ({ ...p, [fid]: r.url as string }));
            return r.url;
        }
        return null;
    }

    /* ========= Loaders ========= */
    const loadFeatured = React.useCallback(async () => {
        setFeaturedLoading(true);
        setErrMsg(null);
        try {
            const j = await apiGet(`/yuksi/ticarim/ilan/featured${buildQuery({ limit: featuredLimit })}`, false);
            const arr: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
            setFeatured(arr as ListingBase[]);
        } catch (e: any) {
            setErrMsg(e?.message || 'Öne çıkan ilanlar alınamadı.');
        } finally {
            setFeaturedLoading(false);
        }
    }, [featuredLimit]);

    const runSearch = React.useCallback(
        async (opts?: { resetOffset?: boolean }) => {
            setSearchLoading(true);
            setErrMsg(null);
            try {
                const off = opts?.resetOffset ? 0 : searchOffset;
                const qs = buildQuery({
                    search: qSearch,
                    brand: qBrand,
                    model: qModel,
                    min_year: qMinYear,
                    max_year: qMaxYear,
                    min_km: qMinKm,
                    max_km: qMaxKm,
                    min_price: qMinPrice,
                    max_price: qMaxPrice,
                    fuel_type: qFuel,
                    transmission: qTransmission,
                    source: qSource,
                    body_type: qBody,
                    color: qColor,
                    location: qLocation,
                    condition: qCondition,
                    limit: searchLimit,
                    offset: off,
                    sort_by: qSortBy,
                    sort_order: qSortOrder,
                });
                const j = await apiGet(`/yuksi/ticarim/ilan/search${qs}`, false);
                const list = j?.data?.listings ?? j?.listings ?? j?.data ?? j;
                const arr: any[] = Array.isArray(list) ? list : [];
                setSearchResults(arr as ListingBase[]);
                if (opts?.resetOffset) setSearchOffset(0);
            } catch (e: any) {
                setErrMsg(e?.message || 'Arama başarısız.');
            } finally {
                setSearchLoading(false);
            }
        },
        [
            qSearch,
            qBrand,
            qModel,
            qMinYear,
            qMaxYear,
            qMinKm,
            qMaxKm,
            qMinPrice,
            qMaxPrice,
            qFuel,
            qTransmission,
            qSource,
            qBody,
            qColor,
            qLocation,
            qCondition,
            searchLimit,
            searchOffset,
            qSortBy,
            qSortOrder,
        ],
    );

    const loadMine = React.useCallback(async () => {
        setMineLoading(true);
        setErrMsg(null);
        try {
            const qs = buildQuery({ limit: myLimit, offset: myOffset });
            const j = await apiGet(`/yuksi/ticarim/ilan/my-listings${qs}`, true);
            const arr: any[] = Array.isArray(j?.data) ? j.data : Array.isArray(j) ? j : [];
            setMyListings(arr as ListingBase[]);
        } catch (e: any) {
            setErrMsg(e?.message || 'İlanlarım alınamadı.');
        } finally {
            setMineLoading(false);
        }
    }, [myLimit, myOffset, authHeaders]);

    React.useEffect(() => {
        // initial
        loadFeatured();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        if (tab === 'mine') loadMine();
    }, [tab, loadMine]);

    /* ========= Detail ========= */
    const openDetail = async (id: string, mode: 'public' | 'mine') => {
        setDetailOpen(true);
        setDetailLoading(true);
        setDetailErr(null);
        setDetail(null);
        setDetailMode(mode);

        try {
            const j =
                mode === 'mine'
                    ? await apiGet(`/yuksi/ticarim/ilan/my-listings/${id}`, true)
                    : await apiGet(`/yuksi/ticarim/ilan/${id}`, false);

            const d = (j?.data && typeof j.data === 'object' ? j.data : j) as ListingBase;

            // images bazen JSON-string geliyor -> normalize
            const normalizedImages = normalizeListingImages((d as any).images);
            const dFixed: ListingBase = { ...d, images: normalizedImages };

            setDetail(dFixed);

            // images içinde file_url yoksa file_id ile resolve et
            const imgs = dFixed.images || [];
            const need = imgs.filter((im) => im?.file_id && !im?.file_url).map((im) => String(im.file_id));
            if (need.length) {
                // paralel resolve
                await Promise.all(
                    Array.from(new Set(need)).map(async (fid) => {
                        try {
                            const url = await ensureFileUrl(fid);
                            if (!url) return;
                            setDetail((prev) => {
                                if (!prev) return prev;
                                const prevImgs = normalizeListingImages((prev as any).images);
                                const nextImages = prevImgs.map((im) =>
                                    im?.file_id === fid && !im?.file_url ? { ...im, file_url: url } : im
                                );
                                return { ...prev, images: nextImages };
                            });
                        } catch {
                            // sessiz geç
                        }
                    }),
                );
            }
        } catch (e: any) {
            setDetailErr(e?.message || 'Detay alınamadı.');
        } finally {
            setDetailLoading(false);
        }
    };

    /* ========= Create ========= */
    async function submitCreate(e: React.FormEvent) {
        e.preventDefault();
        setOkMsg(null);
        setErrMsg(null);

        if (!form.title.trim() || !form.brand.trim() || !form.model.trim()) {
            setErrMsg('Başlık, marka ve model zorunlu.');
            return;
        }
        if (!form.location.trim() || !form.phone.trim()) {
            setErrMsg('Konum ve telefon zorunlu.');
            return;
        }

        setCreateBusy(true);
        try {
            const body: CreateListingBody = {
                ...form,
                year: Math.max(1950, toNum(form.year)),
                km: Math.max(0, toNum(form.km)),
                engine_size: Math.max(0, toNum(form.engine_size)),
                price: Math.max(0, toNum(form.price)),
                image_file_ids: (form.image_file_ids || []).filter(Boolean),
            };

            const j = await apiSend('/yuksi/ticarim/ilan', 'POST', body, true);
            setOkMsg(j?.message || 'İlan oluşturuldu.');
            setForm(emptyForm);
            setTab('mine');
            // refresh my listings
            setMyOffset(0);
            await loadMine();
        } catch (e: any) {
            setErrMsg(e?.message || 'İlan oluşturulamadı.');
        } finally {
            setCreateBusy(false);
        }
    }

    /* ========= Edit ========= */
    const startEdit = async (id: string) => {
        setOkMsg(null);
        setErrMsg(null);
        setEditId(id);
        setEditOpen(true);

        // Prefill from my detail endpoint (safe)
        try {
            const j = await apiGet(`/yuksi/ticarim/ilan/my-listings/${id}`, true);
            const d = (j?.data && typeof j.data === 'object' ? j.data : j) as ListingBase;
            const imgs = normalizeListingImages((d as any).images);
            setEditImages(imgs);

            setForm((p) => ({
                ...p,
                title: String(d.title ?? ''),
                description: String(d.description ?? ''),
                brand: String(d.brand ?? ''),
                model: String(d.model ?? ''),
                year: toNum(d.year ?? p.year),
                km: toNum(d.km ?? p.km),
                engine_size: toNum((d as any).engine_size ?? p.engine_size),
                fuel_type: String((d as any).fuel_type ?? p.fuel_type),
                transmission: String((d as any).transmission ?? p.transmission),
                body_type: String((d as any).body_type ?? p.body_type),
                color: String((d as any).color ?? ''),
                condition: String((d as any).condition ?? p.condition),
                heavy_damage_recorded: Boolean((d as any).heavy_damage_recorded ?? false),
                source: String((d as any).source ?? p.source),
                plate: String((d as any).plate ?? ''),
                nationality: String((d as any).nationality ?? ''),
                price: toNum((d as any).price ?? 0),
                location: String((d as any).location ?? ''),
                phone: String((d as any).phone ?? ''),
                image_file_ids: [],
            }));
        } catch (e: any) {
            setErrMsg(e?.message || 'İlan detayı alınamadı (edit).');
        }
    };
    async function refreshEditImages(listingId: string) {
        const j = await apiGet(`/yuksi/ticarim/ilan/my-listings/${listingId}`, true);
        const d = (j?.data && typeof j.data === 'object' ? j.data : j) as ListingBase;
        setEditImages(normalizeListingImages((d as any).images));
    }

    async function editAddImage(listingId: string, file_id: string, order_index: number) {
        const body = { listing_id: listingId, file_id, order_index };
        return apiSend(`/yuksi/ticarim/ilan/${listingId}/images`, 'POST', body, true);
    }

    async function editDeleteImage(listingId: string, imageId: string) {
        return apiSend(`/yuksi/ticarim/ilan/${listingId}/images/${imageId}`, 'DELETE', undefined, true);
    }

    async function editSetMainImage(listingId: string, imageId: string) {
        const body = { image_id: imageId };
        return apiSend(`/yuksi/ticarim/ilan/${listingId}/images/${imageId}/main`, 'PUT', body, true);
    }
    async function addImageToEditListing(fileId: string, orderIndex?: number) {
        if (!editId) throw new Error('editId yok.');
        const fid = String(fileId || '').trim();
        if (!fid) throw new Error('file_id zorunlu.');

        const oi = Number.isFinite(orderIndex as any) ? (orderIndex as number) : toNum(editImgOrderIndex);

        await editAddImage(editId, fid, oi);
        await refreshEditImages(editId);
        await loadMine();
    }

    async function submitEdit(e: React.FormEvent) {
        e.preventDefault();
        if (!editId) return;

        setOkMsg(null);
        setErrMsg(null);
        setEditBusy(true);

        try {
            // ✅ editImages üzerinden file_id listesi üret
            const imageFileIds = Array.from(
                new Set(
                    (editImages || [])
                        .map((im) => String(im?.file_id || '').trim())
                        .filter(Boolean)
                )
            );

            if (imageFileIds.length === 0) {
                setErrMsg('Bu endpoint için en az 1 resim zorunlu. Önce resim ekleyip tekrar deneyin.');
                return;
            }

            const body: CreateListingBody = {
                ...form,
                year: Math.max(1950, toNum(form.year)),
                km: Math.max(0, toNum(form.km)),
                engine_size: Math.max(0, toNum(form.engine_size)),
                price: Math.max(0, toNum(form.price)),
                // ✅ burası kritik
                image_file_ids: imageFileIds,
            };

            const j = await apiSend(`/yuksi/ticarim/ilan/${editId}`, 'PUT', body, true);
            setOkMsg(j?.message || 'İlan güncellendi.');
            setEditOpen(false);
            setEditId(null);
            await loadMine();
        } catch (e: any) {
            setErrMsg(e?.message || 'Güncelleme başarısız.');
        } finally {
            setEditBusy(false);
        }
    }

    /* ========= Delete ========= */
    async function removeListing(id: string) {
        setOkMsg(null);
        setErrMsg(null);
        try {
            const j = await apiSend(`/yuksi/ticarim/ilan/${id}`, 'DELETE', undefined, true);
            setOkMsg(j?.message || 'İlan silindi.');
            await loadMine();
        } catch (e: any) {
            setErrMsg(e?.message || 'Silme başarısız.');
        }
    }

    /* ========= Mark sold ========= */
    async function markSold(id: string) {
        setOkMsg(null);
        setErrMsg(null);
        try {
            const j = await apiSend(`/yuksi/ticarim/ilan/${id}/mark-sold`, 'POST', undefined, true);
            setOkMsg(j?.message || 'İlan satıldı olarak işaretlendi.');
            await loadMine();
        } catch (e: any) {
            setErrMsg(e?.message || 'Satıldı işaretleme başarısız.');
        }
    }

    /* ========= Add image ========= */
    async function submitAddImage(e: React.FormEvent) {
        e.preventDefault();
        setOkMsg(null);
        setErrMsg(null);

        const listing_id = imgListingId.trim();
        const file_id = imgFileId.trim();
        const order_index = toNum(imgOrderIndex);

        if (!listing_id || !file_id) {
            setErrMsg('listing_id ve file_id zorunlu.');
            return;
        }

        setImgBusy(true);
        try {
            const body = { listing_id, file_id, order_index };
            const j = await apiSend(`/yuksi/ticarim/ilan/${listing_id}/images`, 'POST', body, true);
            setOkMsg(j?.message || 'Resim eklendi.');
            setImgOpen(false);
            setImgListingId('');
            setImgFileId('');
            setImgOrderIndex('0');
            await loadMine();
        } catch (e: any) {
            setErrMsg(e?.message || 'Resim eklenemedi.');
        } finally {
            setImgBusy(false);
        }
    }

    /* ========= UI helpers ========= */
    const tabs: Array<{ k: TabKey; t: string; d: string }> = [
        { k: 'featured', t: 'Öne Çıkanlar', d: 'Yeni onaylanmış ilanlar' },
        { k: 'search', t: 'Ara', d: 'Filtrele ve keşfet' },
        { k: 'mine', t: 'İlanlarım', d: 'Oluşturdukların ve durumları' },
        { k: 'create', t: 'İlan Oluştur', d: 'Yeni araç ilanı gir' },
    ];

    const Card = React.useCallback(({ children }: { children: React.ReactNode }) => (
        <section className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm">{children}</section>
    ), []);

    const ListingRow = ({
        x,
        mode,
        showActions,
    }: {
        x: ListingBase;
        mode: 'public' | 'mine';
        showActions?: boolean;
    }) => {
        const title = String(x.title ?? '(Başlıksız)');
        const subtitle = [
            x.brand ? String(x.brand) : '',
            x.model ? String(x.model) : '',
            x.year ? String(x.year) : '',
        ]
            .filter(Boolean)
            .join(' • ');

        const price = x.price != null ? `${toNum(x.price).toLocaleString('tr-TR')}₺` : '—';

        // ✅ thumb state row-local
        const [thumbUrl, setThumbUrl] = React.useState<string | null>(null);
        const [thumbBusy, setThumbBusy] = React.useState(false);

        React.useEffect(() => {
            let alive = true;

            async function run() {
                const main = x.main_image_url ? String(x.main_image_url) : null;

                // ✅ public/mine fark etmez: main_image_url varsa direkt bas
                if (main) {
                    if (alive) setThumbUrl(main);
                    return;
                }

                // images fallback
                const imgs = normalizeListingImages((x as any).images);
                const first = imgs.length > 0 ? imgs[0] : null;

                if (!first) {
                    if (alive) setThumbUrl(null);
                    return;
                }

                // file_url varsa direkt kullan (public/mine)
                if (first.file_url) {
                    if (alive) setThumbUrl(String(first.file_url));
                    return;
                }

                // ✅ file_id resolve işlemini sadece mine'da yap (auth gerekebilir)
                if (mode === 'mine' && first.file_id) {
                    try {
                        setThumbBusy(true);
                        const url = await ensureFileUrl(String(first.file_id));
                        if (alive) setThumbUrl(url ? String(url) : null);
                    } catch {
                        if (alive) setThumbUrl(null);
                    } finally {
                        if (alive) setThumbBusy(false);
                    }
                } else {
                    // public'da file_id var ama file_url yoksa boş geç
                    if (alive) setThumbUrl(null);
                }
            }

            run();
            return () => {
                alive = false;
            };
        }, [mode, x.id, x.main_image_url, x.images]);


        return (
            <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 p-4 hover:bg-neutral-50">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 gap-3">
                            <div className="shrink-0">
                                <div className="h-44 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
                                    {thumbUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={thumbUrl} alt="thumb" className="h-full w-full object-cover" />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[11px] text-neutral-500">
                                            {thumbBusy ? '…' : 'no img'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => openDetail(String(x.id), mode)}
                                className="truncate text-left text-sm font-semibold text-neutral-900 hover:underline"
                                title={title}
                            >
                                {title}
                            </button>
                            {x.status && <Badge tone={statusTone(x.status) as any}>{String(x.status)}</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-neutral-500">{subtitle || '—'}</div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                            {x.location ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{String(x.location)}</span> : null}
                            {x.km != null ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{toNum(x.km).toLocaleString('tr-TR')} km</span> : null}
                            {x.fuel_type ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{String(x.fuel_type)}</span> : null}
                            {x.transmission ? <span className="rounded-full bg-neutral-100 px-2 py-0.5">{String(x.transmission)}</span> : null}
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-neutral-900">{price}</div>
                        <div className="mt-1 text-xs text-neutral-500">{x.created_at ? String(x.created_at) : ''}</div>
                    </div>
                </div>

                {showActions && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => openDetail(String(x.id), 'mine')}
                            className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-800 hover:bg-neutral-50"
                        >
                            Detay
                        </button>

                        <button
                            type="button"
                            onClick={() => startEdit(String(x.id))}
                            className="rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                        >
                            Güncelle (PUT)
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setImgListingId(String(x.id));
                                setImgOpen(true);
                            }}
                            className="rounded-xl border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
                        >
                            Resim Ekle (POST /images)
                        </button>

                        <button
                            type="button"
                            onClick={() => markSold(String(x.id))}
                            className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                        >
                            Satıldı İşaretle
                        </button>

                        <button
                            type="button"
                            onClick={() => removeListing(String(x.id))}
                            className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                            Sil (DELETE)
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-neutral-900">Ticarim (Commercial)</h1>
                    <p className="mt-1 text-sm text-neutral-600">
                        İlan oluştur, listele, ara, detay incele.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2">
                    {tabs.map((x) => (
                        <button
                            key={x.k}
                            type="button"
                            onClick={() => {
                                setOkMsg(null);
                                setErrMsg(null);
                                setTab(x.k);
                            }}
                            className={[
                                'rounded-2xl px-4 py-2 text-sm font-semibold border shadow-sm transition',
                                tab === x.k
                                    ? 'bg-indigo-500 text-white border-indigo-500'
                                    : 'bg-white text-neutral-800 border-neutral-300 hover:bg-neutral-50',
                            ].join(' ')}
                            title={x.d}
                        >
                            {x.t}
                        </button>
                    ))}
                </div>
            </div>

            {okMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 whitespace-pre-line">
                    {okMsg}
                </div>
            )}
            {errMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line">
                    {errMsg}
                </div>
            )}

            {/* ===== Featured ===== */}
            {tab === 'featured' && (
                <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Öne Çıkan İlanlar</h2>
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-neutral-600">Limit</label>
                            <input
                                value={String(featuredLimit)}
                                onChange={(e) => setFeaturedLimit(Math.max(1, toNum(e.target.value)))}
                                className="w-24 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                            />
                            <button
                                type="button"
                                onClick={loadFeatured}
                                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                disabled={featuredLoading}
                            >
                                {featuredLoading ? 'Yükleniyor…' : 'Yenile'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                        {featuredLoading && <div className="text-sm text-neutral-500">Yükleniyor…</div>}
                        {!featuredLoading && featured.length === 0 && (
                            <div className="text-sm text-neutral-500">Kayıt yok.</div>
                        )}
                        {featured.map((x) => (
                            <ListingRow key={String(x.id)} x={x} mode="public" />
                        ))}
                    </div>
                </Card>
            )}

            {/* ===== Search ===== */}
            {tab === 'search' && (
                <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">İlan Ara</h2>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => runSearch({ resetOffset: true })}
                                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                disabled={searchLoading}
                            >
                                {searchLoading ? 'Aranıyor…' : 'Ara'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2 grid gap-3 sm:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Arama</label>
                                <input
                                    value={qSearch}
                                    onChange={(e) => setQSearch(e.target.value)}
                                    placeholder="Örn: civic, dizel, 2018…"
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Konum</label>
                                <input
                                    value={qLocation}
                                    onChange={(e) => setQLocation(e.target.value)}
                                    placeholder="Örn: Ankara"
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Marka</label>
                                <input
                                    value={qBrand}
                                    onChange={(e) => setQBrand(e.target.value)}
                                    placeholder="Örn: Honda"
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Model</label>
                                <input
                                    value={qModel}
                                    onChange={(e) => setQModel(e.target.value)}
                                    placeholder="Örn: Civic"
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Min Yıl</label>
                                    <input
                                        value={qMinYear}
                                        onChange={(e) => setQMinYear(e.target.value)}
                                        placeholder="1950+"
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Max Yıl</label>
                                    <input
                                        value={qMaxYear}
                                        onChange={(e) => setQMaxYear(e.target.value)}
                                        placeholder="2025"
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Min KM</label>
                                    <input
                                        value={qMinKm}
                                        onChange={(e) => setQMinKm(e.target.value)}
                                        placeholder="0"
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Max KM</label>
                                    <input
                                        value={qMaxKm}
                                        onChange={(e) => setQMaxKm(e.target.value)}
                                        placeholder="200000"
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Min Fiyat</label>
                                    <input
                                        value={qMinPrice}
                                        onChange={(e) => setQMinPrice(e.target.value)}
                                        placeholder="0"
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Max Fiyat</label>
                                    <input
                                        value={qMaxPrice}
                                        onChange={(e) => setQMaxPrice(e.target.value)}
                                        placeholder="1000000"
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Yakıt</label>
                                <select
                                    value={qFuel}
                                    onChange={(e) => setQFuel(e.target.value)}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    <option value="">(hepsi)</option>
                                    {FUEL_TYPES.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Vites</label>
                                <select
                                    value={qTransmission}
                                    onChange={(e) => setQTransmission(e.target.value)}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    <option value="">(hepsi)</option>
                                    {TRANSMISSIONS.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Kimden</label>
                                <select
                                    value={qSource}
                                    onChange={(e) => setQSource(e.target.value)}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    <option value="">(hepsi)</option>
                                    {SOURCES.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Kasa Tipi</label>
                                <select
                                    value={qBody}
                                    onChange={(e) => setQBody(e.target.value)}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    <option value="">(hepsi)</option>
                                    {BODY_TYPES.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Renk</label>
                                <input
                                    value={qColor}
                                    onChange={(e) => setQColor(e.target.value)}
                                    placeholder="Örn: beyaz"
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Araç Durumu</label>
                                <select
                                    value={qCondition}
                                    onChange={(e) => setQCondition(e.target.value)}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    <option value="">(hepsi)</option>
                                    {CONDITIONS.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Sort By</label>
                                    <input
                                        value={qSortBy}
                                        onChange={(e) => setQSortBy(e.target.value)}
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Sort Order</label>
                                    <select
                                        value={qSortOrder}
                                        onChange={(e) => setQSortOrder(e.target.value as any)}
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    >
                                        <option value="desc">desc</option>
                                        <option value="asc">asc</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                            <div className="text-sm font-semibold text-neutral-900">Sayfalama</div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-neutral-600">Limit</label>
                                    <input
                                        value={String(searchLimit)}
                                        onChange={(e) => setSearchLimit(Math.max(1, toNum(e.target.value)))}
                                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-neutral-600">Offset</label>
                                    <input
                                        value={String(searchOffset)}
                                        onChange={(e) => setSearchOffset(Math.max(0, toNum(e.target.value)))}
                                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none"
                                    />
                                </div>
                            </div>

                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchOffset((p) => Math.max(0, p - searchLimit));
                                        setTimeout(() => runSearch(), 0);
                                    }}
                                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                                    disabled={searchLoading}
                                >
                                    Geri
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchOffset((p) => p + searchLimit);
                                        setTimeout(() => runSearch(), 0);
                                    }}
                                    className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-neutral-50"
                                    disabled={searchLoading}
                                >
                                    İleri
                                </button>
                            </div>

                            <div className="mt-4 text-xs text-neutral-600 whitespace-pre-line">
                                Not: Onaylanmamış ilanlar için <code>GET /ilan/{`{listing_id}`}</code> 404/500 dönebilir.
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                        {searchLoading && <div className="text-sm text-neutral-500">Aranıyor…</div>}
                        {!searchLoading && searchResults.length === 0 && (
                            <div className="text-sm text-neutral-500">Sonuç yok.</div>
                        )}
                        {searchResults.map((x) => (
                            <ListingRow key={String(x.id)} x={x} mode="public" />
                        ))}
                    </div>
                </Card>
            )}

            {/* ===== Mine ===== */}
            {tab === 'mine' && (
                <Card>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">İlanlarım</h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <label className="text-sm text-neutral-600">Limit</label>
                            <input
                                value={String(myLimit)}
                                onChange={(e) => setMyLimit(Math.max(1, toNum(e.target.value)))}
                                className="w-28 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                            />
                            <label className="text-sm text-neutral-600">Offset</label>
                            <input
                                value={String(myOffset)}
                                onChange={(e) => setMyOffset(Math.max(0, toNum(e.target.value)))}
                                className="w-28 rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                            />
                            <button
                                type="button"
                                onClick={loadMine}
                                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                disabled={mineLoading}
                            >
                                {mineLoading ? 'Yükleniyor…' : 'Yenile'}
                            </button>
                        </div>
                    </div>

                    {!token && (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            Token bulunamadı. <code>Authorization: Bearer</code> gerektiren endpoint’ler çalışmayabilir.
                        </div>
                    )}

                    <div className="mt-5 grid gap-3">
                        {mineLoading && <div className="text-sm text-neutral-500">Yükleniyor…</div>}
                        {!mineLoading && myListings.length === 0 && <div className="text-sm text-neutral-500">Kayıt yok.</div>}
                        {myListings.map((x) => (
                            <ListingRow key={String(x.id)} x={x} mode="mine" showActions />
                        ))}
                    </div>
                </Card>
            )}
            {/* ===== Create ===== */}
            {tab === 'create' && (
                <Card>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold">Yeni İlan Oluştur</h2>
                            <p className="mt-1 text-sm text-neutral-600">
                                Yeni bir ilan oluşturmak için aşağıdaki formu doldurun.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={submitCreate} className="mt-5 grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Başlık</label>
                                <input
                                    value={form.title}
                                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Fiyat</label>
                                <input
                                    value={String(form.price)}
                                    onChange={(e) => setForm((p) => ({ ...p, price: toNum(e.target.value) }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Marka</label>
                                <input
                                    value={form.brand}
                                    onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Model</label>
                                <input
                                    value={form.model}
                                    onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Yıl</label>
                                    <input
                                        value={String(form.year)}
                                        onChange={(e) => setForm((p) => ({ ...p, year: toNum(e.target.value) }))}
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">KM</label>
                                    <input
                                        value={String(form.km)}
                                        onChange={(e) => setForm((p) => ({ ...p, km: toNum(e.target.value) }))}
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-semibold">Motor (cc)</label>
                                    <input
                                        value={String(form.engine_size)}
                                        onChange={(e) => setForm((p) => ({ ...p, engine_size: toNum(e.target.value) }))}
                                        className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Yakıt</label>
                                <select
                                    value={form.fuel_type}
                                    onChange={(e) => setForm((p) => ({ ...p, fuel_type: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    {FUEL_TYPES.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Vites</label>
                                <select
                                    value={form.transmission}
                                    onChange={(e) => setForm((p) => ({ ...p, transmission: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    {TRANSMISSIONS.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Kasa Tipi</label>
                                <select
                                    value={form.body_type}
                                    onChange={(e) => setForm((p) => ({ ...p, body_type: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    {BODY_TYPES.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">Renk</label>
                                <input
                                    value={form.color}
                                    onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Araç Durumu</label>
                                <select
                                    value={form.condition}
                                    onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    {CONDITIONS.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                                <input
                                    id="heavy_damage_recorded"
                                    type="checkbox"
                                    checked={!!form.heavy_damage_recorded}
                                    onChange={(e) => setForm((p) => ({ ...p, heavy_damage_recorded: e.target.checked }))}
                                    className="h-4 w-4"
                                />
                                <label htmlFor="heavy_damage_recorded" className="text-sm font-semibold">
                                    Ağır hasar kaydı var
                                </label>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Konum</label>
                                <input
                                    value={form.location}
                                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Telefon</label>
                                <input
                                    value={form.phone}
                                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Plaka</label>
                                <input
                                    value={form.plate}
                                    onChange={(e) => setForm((p) => ({ ...p, plate: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Uyruk</label>
                                <input
                                    value={form.nationality}
                                    onChange={(e) => setForm((p) => ({ ...p, nationality: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Kimden</label>
                                <select
                                    value={form.source}
                                    onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                >
                                    {SOURCES.map((x) => (
                                        <option key={x} value={x}>
                                            {x}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold">Açıklama</label>
                                <textarea
                                    rows={5}
                                    value={form.description}
                                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm font-semibold text-neutral-900">Resimler</div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                setErrMsg(null);
                                                const uid = (uploadUserId || userIdFromToken || '').trim();
                                                if (!uid) return setErrMsg('Upload için user_id gerekli (token’dan gelmiyorsa elle gir).');

                                                setUploadBusy(true);
                                                const list = await fileGetByUser(uid);
                                                setUploaded(list);
                                                setOkMsg('Kullanıcının yüklediği dosyalar getirildi.');
                                            } catch (e: any) {
                                                setErrMsg(e?.message || 'Dosyalar alınamadı.');
                                            } finally {
                                                setUploadBusy(false);
                                            }
                                        }}
                                        className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-60"
                                        disabled={uploadBusy}
                                        title="GET /yuksi/file/user/{user_id}"
                                    >
                                        {uploadBusy ? '…' : 'Dosyalarım'}
                                    </button>
                                </div>

                                <div className="mt-1 text-xs text-neutral-600 whitespace-pre-line">
                                    Upload: <code>POST /yuksi/file/upload</code> veya <code>POST /yuksi/file/upload-multiple</code>
                                    {'\n'}
                                    Sonra ilan body’sine: <code>image_file_ids</code> (file_id listesi)
                                </div>

                                <div className="mt-3 grid gap-2 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-neutral-600">user_id (UUID)</label>
                                        <input
                                            value={uploadUserId}
                                            onChange={(e) => setUploadUserId(e.target.value)}
                                            placeholder={userIdFromToken ? `token: ${userIdFromToken}` : 'Token’dan gelmiyorsa buraya gir'}
                                            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                                        />
                                        {userIdFromToken && (
                                            <div className="mt-1 text-[11px] text-neutral-500">
                                                Token’dan okunan: <code className="rounded bg-neutral-100 px-1">{userIdFromToken}</code>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-xs font-semibold text-neutral-600">Dosya seç</label>
                                        <input
                                            type="file"
                                            multiple
                                            onChange={(e) => setUploadFiles(e.target.files)}
                                            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                                        />
                                        <div className="mt-2 flex gap-2">
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    try {
                                                        setErrMsg(null);
                                                        setOkMsg(null);
                                                        const uid = (uploadUserId || userIdFromToken || '').trim();
                                                        if (!uid) return setErrMsg('Upload için user_id gerekli.');
                                                        if (!uploadFiles || uploadFiles.length === 0) return setErrMsg('Dosya seçmedin.');

                                                        setUploadBusy(true);
                                                        const items =
                                                            uploadFiles.length === 1
                                                                ? await fileUploadSingle(uid, uploadFiles[0])
                                                                : await fileUploadMultiple(uid, uploadFiles);

                                                        setUploaded((p) => [...items, ...p]);

                                                        // form.image_file_ids içine otomatik ekle
                                                        const ids = items.map((x) => x.file_id).filter(Boolean);
                                                        setForm((p) => ({
                                                            ...p,
                                                            image_file_ids: Array.from(new Set([...(p.image_file_ids || []), ...ids])),
                                                        }));

                                                        setOkMsg(`Upload tamam: ${ids.length} dosya eklendi.`);
                                                    } catch (e: any) {
                                                        setErrMsg(e?.message || 'Upload başarısız.');
                                                    } finally {
                                                        setUploadBusy(false);
                                                    }
                                                }}
                                                className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                                disabled={uploadBusy}
                                                title="POST /yuksi/file/upload-multiple"
                                            >
                                                {uploadBusy ? 'Yükleniyor…' : 'Upload'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setUploadFiles(null);
                                                    setUploaded([]);
                                                    setFileUrlMap({});
                                                }}
                                                className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                                                disabled={uploadBusy}
                                            >
                                                Sıfırla
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <label className="mb-1 block text-xs font-semibold text-neutral-600">image_file_ids (auto + manual)</label>
                                    <textarea
                                        rows={5}
                                        value={(form.image_file_ids || []).join('\n')}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                image_file_ids: e.target.value
                                                    .split('\n')
                                                    .map((s) => s.trim())
                                                    .filter(Boolean),
                                            }))
                                        }
                                        placeholder="file_id1\nfile_id2\n…"
                                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                                    />
                                </div>

                                {uploaded.length > 0 && (
                                    <div className="mt-4">
                                        <div className="text-xs font-semibold text-neutral-700">Yüklenenler</div>
                                        <div className="mt-2 grid gap-2">
                                            {uploaded.slice(0, 10).map((f, idx) => (
                                                <div key={`${f.file_id}-${idx}`} className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white p-2">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-xs text-neutral-900">
                                                            <span className="font-semibold">file_id:</span> {f.file_id}
                                                        </div>
                                                        {f.file_name && <div className="truncate text-[11px] text-neutral-500">{f.file_name}</div>}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setForm((p) => ({
                                                                ...p,
                                                                image_file_ids: Array.from(new Set([...(p.image_file_ids || []), f.file_id])),
                                                            }));
                                                        }}
                                                        className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-neutral-50"
                                                    >
                                                        +Ekle
                                                    </button>
                                                </div>
                                            ))}
                                            {uploaded.length > 10 && <div className="text-[11px] text-neutral-500">(+{uploaded.length - 10} daha…)</div>}
                                        </div>
                                    </div>
                                )}

                                <div className="mt-3 text-xs text-neutral-600">
                                    Ayrıca sonra: <code>POST /yuksi/ticarim/ilan/{`{listing_id}`}/images</code>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setForm(emptyForm)}
                                className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                                disabled={createBusy}
                            >
                                Temizle
                            </button>
                            <button
                                type="submit"
                                className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                disabled={createBusy}
                            >
                                {createBusy ? 'Gönderiliyor…' : 'Oluştur'}
                            </button>
                        </div>
                    </form>
                </Card>
            )}

            {/* ===== Detail Modal ===== */}
            {detailOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">
                                    İlan Detayı {detailMode === 'mine' ? '(My)' : '(Public)'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDetailOpen(false)}
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                            >
                                Kapat
                            </button>
                        </div>

                        <div className="p-5">
                            {detailLoading && <div className="text-sm text-neutral-500">Yükleniyor…</div>}
                            {detailErr && (
                                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 whitespace-pre-line">
                                    {detailErr}
                                </div>
                            )}

                            {!detailLoading && detail && (
                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="space-y-2">
                                        <div className="text-lg font-semibold text-neutral-900">{detail.title || '—'}</div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {detail.status && <Badge tone={statusTone(detail.status) as any}>{String(detail.status)}</Badge>}
                                            {detail.owner_type && <Badge>{String(detail.owner_type)}</Badge>}
                                        </div>

                                        <div className="rounded-2xl border border-neutral-200 p-4 space-y-2">
                                            <StatLine k="Marka" v={detail.brand} />
                                            <StatLine k="Model" v={detail.model} />
                                            <StatLine k="Yıl" v={detail.year} />
                                            <StatLine k="KM" v={detail.km != null ? `${toNum(detail.km).toLocaleString('tr-TR')} km` : undefined} />
                                            <StatLine k="Motor" v={(detail as any).engine_size != null ? `${toNum((detail as any).engine_size)} cc` : undefined} />
                                            <StatLine k="Yakıt" v={(detail as any).fuel_type} />
                                            <StatLine k="Vites" v={(detail as any).transmission} />
                                            <StatLine k="Kasa" v={(detail as any).body_type} />
                                            <StatLine k="Renk" v={(detail as any).color} />
                                            <StatLine k="Durum" v={(detail as any).condition} />
                                            <StatLine
                                                k="Ağır Hasar"
                                                v={(detail as any).heavy_damage_recorded != null ? String(Boolean((detail as any).heavy_damage_recorded)) : undefined}
                                            />
                                            <StatLine k="Fiyat" v={(detail as any).price != null ? `${toNum((detail as any).price).toLocaleString('tr-TR')}₺` : undefined} />
                                            <StatLine k="Konum" v={(detail as any).location} />
                                            <StatLine k="Telefon" v={(detail as any).phone} />
                                            <StatLine k="Açıklama" v={(detail as any).description} />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="text-sm font-semibold text-neutral-900">Resimler</div>
                                        <div className="mt-3 grid gap-3">
                                            {(detail.main_image_url || null) && (
                                                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={String(detail.main_image_url)} alt="main" className="h-48 w-full object-cover" />
                                                </div>
                                            )}

                                            {Array.isArray(detail.images) && detail.images.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-3">
                                                    {detail.images.map((im, idx) => {
                                                        const url = im.file_url || null;
                                                        return (
                                                            <div key={im.id || im.file_id || idx} className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                                                                {url ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={String(url)} alt={im.file_name || 'image'} className="h-32 w-full object-cover" />
                                                                ) : (
                                                                    <div className="flex h-32 items-center justify-center text-xs text-neutral-500">file_url yok</div>
                                                                )}
                                                                <div className="border-t border-neutral-200 p-2 text-xs text-neutral-600">
                                                                    <div>file_id: {im.file_id || '—'}</div>
                                                                    <div>order_index: {im.order_index ?? '—'}</div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
                                                    Resim bulunamadı.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Edit Modal ===== */}
            {editOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-6xl rounded-2xl border border-neutral-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">İlan Güncelle</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setEditOpen(false);
                                    setEditId(null);
                                }}
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                            >
                                Kapat
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto">
                            <form onSubmit={submitEdit} className="grid gap-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Başlık</label>
                                        <input
                                            value={form.title}
                                            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Fiyat</label>
                                        <input
                                            value={String(form.price)}
                                            onChange={(e) => setForm((p) => ({ ...p, price: toNum(e.target.value) }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Marka</label>
                                        <input
                                            value={form.brand}
                                            onChange={(e) => setForm((p) => ({ ...p, brand: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Model</label>
                                        <input
                                            value={form.model}
                                            onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 md:col-span-2">
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold">Yıl</label>
                                            <input
                                                value={String(form.year)}
                                                onChange={(e) => setForm((p) => ({ ...p, year: toNum(e.target.value) }))}
                                                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold">KM</label>
                                            <input
                                                value={String(form.km)}
                                                onChange={(e) => setForm((p) => ({ ...p, km: toNum(e.target.value) }))}
                                                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                            />
                                        </div>
                                        <div>
                                            <label className="mb-1 block text-sm font-semibold">Motor (cc)</label>
                                            <input
                                                value={String(form.engine_size)}
                                                onChange={(e) => setForm((p) => ({ ...p, engine_size: toNum(e.target.value) }))}
                                                className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Yakıt</label>
                                        <select
                                            value={form.fuel_type}
                                            onChange={(e) => setForm((p) => ({ ...p, fuel_type: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {FUEL_TYPES.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Vites</label>
                                        <select
                                            value={form.transmission}
                                            onChange={(e) => setForm((p) => ({ ...p, transmission: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {TRANSMISSIONS.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Kasa Tipi</label>
                                        <select
                                            value={form.body_type}
                                            onChange={(e) => setForm((p) => ({ ...p, body_type: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {BODY_TYPES.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Renk</label>
                                        <input
                                            value={form.color}
                                            onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Araç Durumu</label>
                                        <select
                                            value={form.condition}
                                            onChange={(e) => setForm((p) => ({ ...p, condition: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        >
                                            {CONDITIONS.map((x) => (
                                                <option key={x} value={x}>
                                                    {x}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
                                        <input
                                            id="heavy_damage_recorded_edit"
                                            type="checkbox"
                                            checked={!!form.heavy_damage_recorded}
                                            onChange={(e) => setForm((p) => ({ ...p, heavy_damage_recorded: e.target.checked }))}
                                            className="h-4 w-4"
                                        />
                                        <label htmlFor="heavy_damage_recorded_edit" className="text-sm font-semibold">
                                            Ağır hasar kaydı var
                                        </label>
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Konum</label>
                                        <input
                                            value={form.location}
                                            onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block text-sm font-semibold">Telefon</label>
                                        <input
                                            value={form.phone}
                                            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-1 block text-sm font-semibold">Açıklama</label>
                                        <textarea
                                            rows={5}
                                            value={form.description}
                                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                                            className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                        />
                                    </div>

                                    {/* ===== Edit: Images Management ===== */}
                                    <div className="md:col-span-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="text-sm font-semibold text-neutral-900">Resimler (Edit)</div>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!editId) return;
                                                    try {
                                                        setErrMsg(null);
                                                        await refreshEditImages(editId);
                                                        setOkMsg('Resimler yenilendi.');
                                                    } catch (e: any) {
                                                        setErrMsg(e?.message || 'Resimler yenilenemedi.');
                                                    }
                                                }}
                                                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                                            >
                                                Yenile
                                            </button>
                                        </div>

                                        {/* Add image (POST) */}
                                        {/* ===== Edit: Create-like Upload + File Picker ===== */}
                                        <div className="mt-3 rounded-2xl border border-neutral-200 bg-white p-4">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-sm font-semibold text-neutral-900">Resim Ekle (Upload)</div>

                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            setErrMsg(null);
                                                            setOkMsg(null);

                                                            const uid = (uploadUserId || userIdFromToken || '').trim();
                                                            if (!uid) return setErrMsg('Upload için user_id gerekli (token’dan gelmiyorsa elle gir).');

                                                            setUploadBusy(true);
                                                            const list = await fileGetByUser(uid);
                                                            setUploaded(list);
                                                            setOkMsg('Kullanıcının yüklediği dosyalar getirildi.');
                                                        } catch (e: any) {
                                                            setErrMsg(e?.message || 'Dosyalar alınamadı.');
                                                        } finally {
                                                            setUploadBusy(false);
                                                        }
                                                    }}
                                                    className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-60"
                                                    disabled={uploadBusy}
                                                    title="GET /yuksi/file/user/{user_id}"
                                                >
                                                    {uploadBusy ? '…' : 'Dosyalarım'}
                                                </button>
                                            </div>

                                            <div className="mt-3 grid gap-2 md:grid-cols-3">
                                                <div className="md:col-span-2">
                                                    <label className="mb-1 block text-xs font-semibold text-neutral-600">user_id (UUID)</label>
                                                    <input
                                                        value={uploadUserId}
                                                        onChange={(e) => setUploadUserId(e.target.value)}
                                                        placeholder={userIdFromToken ? `token: ${userIdFromToken}` : 'Token’dan gelmiyorsa buraya gir'}
                                                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                                                    />
                                                    {userIdFromToken && (
                                                        <div className="mt-1 text-[11px] text-neutral-500">
                                                            Token’dan okunan: <code className="rounded bg-neutral-100 px-1">{userIdFromToken}</code>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="mb-1 block text-xs font-semibold text-neutral-600">order_index</label>
                                                    <input
                                                        value={editImgOrderIndex}
                                                        onChange={(e) => setEditImgOrderIndex(e.target.value)}
                                                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                                                    />
                                                    <div className="mt-1 text-[11px] text-neutral-500">(+Ekle / Upload sonrası default)</div>
                                                </div>

                                                <div className="md:col-span-3">
                                                    <label className="mb-1 block text-xs font-semibold text-neutral-600">Dosya seç</label>
                                                    <input
                                                        type="file"
                                                        multiple
                                                        onChange={(e) => setUploadFiles(e.target.files)}
                                                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                                                    />

                                                    <div className="mt-2 flex flex-wrap gap-2 justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                try {
                                                                    setErrMsg(null);
                                                                    setOkMsg(null);

                                                                    const uid = (uploadUserId || userIdFromToken || '').trim();
                                                                    if (!uid) return setErrMsg('Upload için user_id gerekli.');
                                                                    if (!uploadFiles || uploadFiles.length === 0) return setErrMsg('Dosya seçmedin.');
                                                                    if (!editId) return setErrMsg('editId yok.');

                                                                    setUploadBusy(true);

                                                                    const items =
                                                                        uploadFiles.length === 1
                                                                            ? await fileUploadSingle(uid, uploadFiles[0])
                                                                            : await fileUploadMultiple(uid, uploadFiles);

                                                                    setUploaded((p) => [...items, ...p]);

                                                                    // ✅ Create'den farkı: editte upload sonrası otomatik ilana ekliyoruz
                                                                    const ids = items.map((x) => x.file_id).filter(Boolean);

                                                                    for (const fid of ids) {
                                                                        await addImageToEditListing(fid, toNum(editImgOrderIndex));
                                                                    }

                                                                    setOkMsg(`Upload + ekleme tamam: ${ids.length} resim ilana eklendi.`);
                                                                } catch (e: any) {
                                                                    setErrMsg(e?.message || 'Upload/ekleme başarısız.');
                                                                } finally {
                                                                    setUploadBusy(false);
                                                                }
                                                            }}
                                                            className="rounded-xl bg-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                                            disabled={uploadBusy || editImgBusy}
                                                            title="POST /yuksi/file/upload-multiple + POST /ticarim/ilan/{id}/images"
                                                        >
                                                            {uploadBusy ? 'Yükleniyor…' : 'Upload + İlana Ekle'}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setUploadFiles(null);
                                                                setUploaded([]);
                                                                setFileUrlMap({});
                                                            }}
                                                            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
                                                            disabled={uploadBusy}
                                                        >
                                                            Sıfırla
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Manual file_id + add (create'deki textarea mantığına benzer) */}
                                            <div className="mt-4 grid gap-2 md:grid-cols-3">
                                                <div className="flex items-end">
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            try {
                                                                setErrMsg(null);
                                                                setOkMsg(null);
                                                                setEditImgBusy(true);

                                                                await addImageToEditListing(editImgFileId.trim(), toNum(editImgOrderIndex));
                                                                setOkMsg('Resim ilana eklendi.');
                                                                setEditImgFileId('');
                                                            } catch (e: any) {
                                                                setErrMsg(e?.message || 'Resim eklenemedi.');
                                                            } finally {
                                                                setEditImgBusy(false);
                                                            }
                                                        }}
                                                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-60"
                                                        disabled={editImgBusy}
                                                        title="POST /yuksi/ticarim/ilan/{listing_id}/images"
                                                    >
                                                        {editImgBusy ? '…' : '+Ekle'}
                                                    </button>
                                                </div>
                                            </div>

                                            {uploaded.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold text-neutral-700">Yüklenenler</div>
                                                    <div className="mt-2 grid gap-2">
                                                        {uploaded.slice(0, 10).map((f, idx) => (
                                                            <div
                                                                key={`${f.file_id}-${idx}`}
                                                                className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-2"
                                                            >
                                                                <div className="min-w-0">
                                                                    <div className="truncate text-xs text-neutral-900">
                                                                        <span className="font-semibold">file_id:</span> {f.file_id}
                                                                    </div>
                                                                    {f.file_name && <div className="truncate text-[11px] text-neutral-500">{f.file_name}</div>}
                                                                </div>

                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        try {
                                                                            setErrMsg(null);
                                                                            setOkMsg(null);
                                                                            setEditImgBusy(true);

                                                                            await addImageToEditListing(f.file_id, toNum(editImgOrderIndex));
                                                                            setOkMsg('Resim ilana eklendi.');
                                                                        } catch (e: any) {
                                                                            setErrMsg(e?.message || 'Resim eklenemedi.');
                                                                        } finally {
                                                                            setEditImgBusy(false);
                                                                        }
                                                                    }}
                                                                    className="shrink-0 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-semibold hover:bg-neutral-50 disabled:opacity-60"
                                                                    disabled={editImgBusy}
                                                                >
                                                                    +Ekle
                                                                </button>
                                                            </div>
                                                        ))}

                                                        {uploaded.length > 10 && <div className="text-[11px] text-neutral-500">(+{uploaded.length - 10} daha…)</div>}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Existing images list + actions (PUT main / DELETE) */}
                                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                            {editImages.length === 0 ? (
                                                <div className="sm:col-span-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600">
                                                    Resim yok.
                                                </div>
                                            ) : (
                                                editImages.map((im, idx) => {
                                                    const imageId = String(im.id || '');
                                                    const url = im.file_url || null;

                                                    return (
                                                        <div key={im.id || im.file_id || idx} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                                                            <div className="h-32 w-full bg-neutral-50">
                                                                {url ? (
                                                                    // eslint-disable-next-line @next/next/no-img-element
                                                                    <img src={String(url)} alt={im.file_name || 'image'} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <div className="flex h-full items-center justify-center text-xs text-neutral-500">file_url yok</div>
                                                                )}
                                                            </div>

                                                            <div className="border-t border-neutral-200 p-2 text-xs text-neutral-700">
                                                                <div>image_id: {im.id || '—'}</div>
                                                                <div>file_id: {im.file_id || '—'}</div>
                                                                <div>order_index: {im.order_index ?? '—'}</div>
                                                            </div>

                                                            <div className="flex gap-2 border-t border-neutral-200 p-2">
                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (!editId) return;
                                                                        if (!imageId) return setErrMsg('image_id bulunamadı.');

                                                                        try {
                                                                            setErrMsg(null);
                                                                            setOkMsg(null);
                                                                            setEditImgBusy(true);

                                                                            const j = await editSetMainImage(editId, imageId);
                                                                            setOkMsg(j?.message || 'Ana resim güncellendi.');

                                                                            await refreshEditImages(editId);
                                                                            await loadMine();
                                                                        } catch (e: any) {
                                                                            setErrMsg(e?.message || 'Ana resim belirlenemedi.');
                                                                        } finally {
                                                                            setEditImgBusy(false);
                                                                        }
                                                                    }}
                                                                    className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                                                                    disabled={editImgBusy}
                                                                    title="PUT /yuksi/ticarim/ilan/{listing_id}/images/{image_id}/main"
                                                                >
                                                                    Ana Yap
                                                                </button>

                                                                <button
                                                                    type="button"
                                                                    onClick={async () => {
                                                                        if (!editId) return;
                                                                        if (!imageId) return setErrMsg('image_id bulunamadı.');

                                                                        try {
                                                                            setErrMsg(null);
                                                                            setOkMsg(null);
                                                                            setEditImgBusy(true);

                                                                            const j = await editDeleteImage(editId, imageId);
                                                                            setOkMsg(j?.message || 'Resim silindi.');

                                                                            await refreshEditImages(editId);
                                                                            await loadMine();
                                                                        } catch (e: any) {
                                                                            setErrMsg(e?.message || 'Resim silinemedi.');
                                                                        } finally {
                                                                            setEditImgBusy(false);
                                                                        }
                                                                    }}
                                                                    className="w-full rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
                                                                    disabled={editImgBusy}
                                                                    title="DELETE /yuksi/ticarim/ilan/{listing_id}/images/{image_id}"
                                                                >
                                                                    Sil
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setEditOpen(false);
                                            setEditId(null);
                                        }}
                                        className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                                        disabled={editBusy}
                                    >
                                        İptal
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                        disabled={editBusy}
                                    >
                                        {editBusy ? 'Güncelleniyor…' : 'Kaydet'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== Add Image Modal ===== */}
            {imgOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
                    <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-neutral-900 truncate">Resim Ekle</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setImgOpen(false)}
                                className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                            >
                                Kapat
                            </button>
                        </div>

                        <form onSubmit={submitAddImage} className="p-5 space-y-3">
                            <div>
                                <label className="mb-1 block text-sm font-semibold">listing_id</label>
                                <input
                                    value={imgListingId}
                                    onChange={(e) => setImgListingId(e.target.value)}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">file_id</label>
                                <input
                                    value={imgFileId}
                                    onChange={(e) => setImgFileId(e.target.value)}
                                    placeholder="Upload servisinden gelen file id"
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>
                            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                                <div className="text-xs font-semibold text-neutral-700">Hızlı Upload (single)</div>
                                <div className="mt-2 grid gap-2">
                                    <input
                                        type="file"
                                        onChange={async (e) => {
                                            try {
                                                setErrMsg(null);
                                                setOkMsg(null);
                                                const f = e.target.files?.[0];
                                                if (!f) return;

                                                const uid = (uploadUserId || userIdFromToken || '').trim();
                                                if (!uid) return setErrMsg('Upload için user_id gerekli.');

                                                setUploadBusy(true);
                                                const items = await fileUploadSingle(uid, f);
                                                const first = items[0];
                                                if (first?.file_id) {
                                                    setImgFileId(first.file_id);
                                                    setOkMsg('Upload tamam, file_id otomatik dolduruldu.');
                                                } else {
                                                    setErrMsg('Upload response içinde file_id bulunamadı.');
                                                }
                                            } catch (ex: any) {
                                                setErrMsg(ex?.message || 'Upload başarısız.');
                                            } finally {
                                                setUploadBusy(false);
                                            }
                                        }}
                                        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-xs outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-semibold">order_index</label>
                                <input
                                    value={imgOrderIndex}
                                    onChange={(e) => setImgOrderIndex(e.target.value)}
                                    className="w-full rounded-xl border border-neutral-300 bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-white"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setImgOpen(false)}
                                    className="rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50"
                                    disabled={imgBusy}
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-indigo-500 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                                    disabled={imgBusy}
                                >
                                    {imgBusy ? 'Gönderiliyor…' : 'Ekle'}
                                </button>
                            </div>

                            <div className="text-xs text-neutral-500 whitespace-pre-line">
                                Body örneği:
                                {'\n'}
                                <code className="rounded bg-neutral-100 px-1">{`{ listing_id, file_id, order_index }`}</code>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
