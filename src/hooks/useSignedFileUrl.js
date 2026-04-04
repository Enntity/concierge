"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { checkFileUrlExists } from "../components/files/chatFileUtils";
import { extractBlobPathFromUrl } from "../utils/storageTargets";

const DEFAULT_CACHE_TTL_MS = 55 * 60 * 1000;
const SHORT_CACHE_TTL_MS = 60 * 1000;

const resolvedUrlCache = new Map();
const pendingUrlLookups = new Map();

function inferManagedBlobPath(url) {
    if (!url || typeof url !== "string") {
        return null;
    }

    if (url.startsWith("gs://")) {
        return extractBlobPathFromUrl(url);
    }

    try {
        const parsed = new URL(url);
        if (
            parsed.hostname.includes("storage.googleapis.com") ||
            parsed.hostname.includes("storage.cloud.google.com")
        ) {
            return extractBlobPathFromUrl(url);
        }
    } catch {
        return null;
    }

    return null;
}

function hasSignedUrlParams(url) {
    if (!url || typeof url !== "string") {
        return false;
    }

    return (
        url.includes("X-Goog-Algorithm=") ||
        url.includes("X-Goog-Signature=") ||
        url.includes("GoogleAccessId=") ||
        url.includes("Signature=") ||
        url.includes("sig=")
    );
}

function shouldDeferManagedUrlRender(url, blobPath) {
    if (!url || !blobPath) {
        return false;
    }

    const inferredBlobPath = inferManagedBlobPath(url);
    if (!inferredBlobPath) {
        return false;
    }

    return !hasSignedUrlParams(url);
}

function getInitialRenderableUrl({ url, blobPath }) {
    if (shouldDeferManagedUrlRender(url, blobPath)) {
        return null;
    }

    return url || null;
}

function getLookupKey(url, blobPath) {
    return blobPath || url || "";
}

async function resolveSignedFileUrl({ url, blobPath, force = false } = {}) {
    const lookupKey = getLookupKey(url, blobPath);
    if (!lookupKey) {
        return null;
    }

    const now = Date.now();
    if (!force) {
        const cached = resolvedUrlCache.get(lookupKey);
        if (cached && cached.expiresAt > now) {
            return cached.url;
        }

        const pending = pendingUrlLookups.get(lookupKey);
        if (pending) {
            return pending;
        }
    }

    const lookupPromise = checkFileUrlExists({ url, blobPath })
        .then((result) => {
            if (!result?.exists) {
                return url || null;
            }

            const nextUrl = result.refreshedUrl || result.url || url || null;
            if (!nextUrl) {
                return null;
            }

            resolvedUrlCache.set(lookupKey, {
                url: nextUrl,
                expiresAt:
                    now +
                    (result.refreshedUrl
                        ? DEFAULT_CACHE_TTL_MS
                        : SHORT_CACHE_TTL_MS),
            });

            return nextUrl;
        })
        .catch(() => url || null)
        .finally(() => {
            pendingUrlLookups.delete(lookupKey);
        });

    pendingUrlLookups.set(lookupKey, lookupPromise);
    return lookupPromise;
}

export function __resetSignedFileUrlCacheForTests() {
    resolvedUrlCache.clear();
    pendingUrlLookups.clear();
}

export function useSignedFileUrl({
    url = null,
    blobPath = null,
    enabled = true,
    refreshOnMount = true,
} = {}) {
    const effectiveBlobPath = blobPath || inferManagedBlobPath(url);
    const [resolvedUrl, setResolvedUrl] = useState(() =>
        getInitialRenderableUrl({
            url,
            blobPath: effectiveBlobPath,
        }),
    );
    const errorRefreshAttemptedRef = useRef(false);

    useEffect(() => {
        setResolvedUrl(
            getInitialRenderableUrl({
                url,
                blobPath: effectiveBlobPath,
            }),
        );
        errorRefreshAttemptedRef.current = false;
    }, [url, effectiveBlobPath]);

    const refresh = useCallback(
        async ({ force = false } = {}) => {
            if (!enabled || !effectiveBlobPath) {
                return url || null;
            }

            const nextUrl = await resolveSignedFileUrl({
                url,
                blobPath: effectiveBlobPath,
                force,
            });

            if (nextUrl) {
                setResolvedUrl((currentUrl) =>
                    currentUrl === nextUrl ? currentUrl : nextUrl,
                );
            }

            return nextUrl;
        },
        [effectiveBlobPath, enabled, url],
    );

    useEffect(() => {
        if (!enabled || !refreshOnMount || !effectiveBlobPath) {
            return;
        }

        let cancelled = false;

        void refresh().then((nextUrl) => {
            if (!cancelled && nextUrl) {
                setResolvedUrl((currentUrl) =>
                    currentUrl === nextUrl ? currentUrl : nextUrl,
                );
            }
        });

        return () => {
            cancelled = true;
        };
    }, [effectiveBlobPath, enabled, refresh, refreshOnMount]);

    const refreshOnError = useCallback(async () => {
        if (
            !enabled ||
            !effectiveBlobPath ||
            errorRefreshAttemptedRef.current
        ) {
            return null;
        }

        errorRefreshAttemptedRef.current = true;
        return refresh({ force: true });
    }, [effectiveBlobPath, enabled, refresh]);

    return {
        url: resolvedUrl || null,
        refresh,
        refreshOnError,
    };
}
