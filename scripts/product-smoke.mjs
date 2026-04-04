import { spawn } from "child_process";
import crypto, { randomUUID } from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { setTimeout as delay } from "timers/promises";
import mongoose from "mongoose";
import { encode } from "next-auth/jwt";
import WebSocket from "ws";
import User from "../app/api/models/user.mjs";
import { connectToDatabase } from "../src/db.mjs";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3001";
const SERVER_PORT = new URL(BASE_URL).port || "3001";
const CDP_PORT = Number(process.env.SMOKE_CDP_PORT || "9222");
const CORTEX_GRAPHQL_URL =
    process.env.SMOKE_CORTEX_GRAPHQL_URL ||
    process.env.CORTEX_GRAPHQL_API_URL ||
    "http://127.0.0.1:4000/graphql";
const MEDIA_HELPER_URL =
    process.env.SMOKE_MEDIA_HELPER_URL ||
    process.env.CORTEX_MEDIA_API_URL ||
    "http://127.0.0.1:7071/media-helper";
const COOKIE_NAME = "authjs.session-token";
const COOKIE_SALT = COOKIE_NAME;
const SMOKE_USER_ID = "codex-smoke-user";
const SMOKE_USER_EMAIL = "codex-smoke@example.com";
const CHROME_CANDIDATES = [
    process.env.SMOKE_CHROME_BIN,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "google-chrome",
    "chromium-browser",
    "chromium",
].filter(Boolean);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function log(message) {
    console.log(`[smoke] ${message}`);
}

function attachPrefixedLogs(processHandle, prefix) {
    const write = (streamName, chunk) => {
        const text = chunk.toString().trim();
        if (!text) return;
        for (const line of text.split("\n")) {
            console.log(`[${prefix}:${streamName}] ${line}`);
        }
    };

    processHandle.stdout?.on("data", (chunk) => write("stdout", chunk));
    processHandle.stderr?.on("data", (chunk) => write("stderr", chunk));
}

async function waitForUrl(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, { redirect: "manual" });
            if (
                response.ok ||
                response.status === 302 ||
                response.status === 307
            ) {
                return;
            }
        } catch {
            // Ignore until timeout.
        }

        await delay(500);
    }

    throw new Error(`Timed out waiting for ${url}`);
}

async function isUrlReachable(url) {
    try {
        const response = await fetch(url, { redirect: "manual" });
        return (
            response.ok || response.status === 302 || response.status === 307
        );
    } catch {
        return false;
    }
}

async function hasHttpResponse(url) {
    try {
        const response = await fetch(url, { redirect: "manual" });
        return Number.isInteger(response.status);
    } catch {
        return false;
    }
}

async function waitForService(name, url, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (await hasHttpResponse(url)) {
            log(`${name} reachable at ${url}`);
            return;
        }
        await delay(500);
    }

    throw new Error(
        `${name} is not reachable at ${url}. Start the local service before running smoke.`,
    );
}

function startServer() {
    const child = spawn("npm", ["start"], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            PORT: SERVER_PORT,
        },
        stdio: ["ignore", "pipe", "pipe"],
    });

    attachPrefixedLogs(child, "server");
    return child;
}

async function stopProcess(processHandle, signal = "SIGTERM") {
    if (!processHandle || processHandle.killed) {
        return;
    }

    processHandle.kill(signal);

    await new Promise((resolve) => {
        const timer = setTimeout(resolve, 5_000);
        processHandle.once("exit", () => {
            clearTimeout(timer);
            resolve();
        });
    });
}

async function ensureSmokeSessionToken() {
    await connectToDatabase();

    try {
        const user = await User.findOneAndUpdate(
            { userId: SMOKE_USER_ID },
            {
                $set: {
                    userId: SMOKE_USER_ID,
                    username: SMOKE_USER_EMAIL,
                    name: "Codex Smoke",
                    role: "admin",
                    contextId: randomUUID(),
                    contextKey: crypto.randomBytes(32).toString("hex"),
                    aiName: "Enntity",
                    blocked: false,
                },
                $unset: {
                    agentModel: "",
                    profilePicture: "",
                    profilePictureBlobPath: "",
                    profilePictureFilename: "",
                },
            },
            {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
            },
        );

        const token = await encode({
            secret: process.env.AUTH_SECRET,
            salt: COOKIE_SALT,
            token: {
                sub: SMOKE_USER_ID,
                userId: SMOKE_USER_ID,
                email: SMOKE_USER_EMAIL,
                name: "Codex Smoke",
            },
        });

        return {
            token,
            contextId: user.contextId,
        };
    } finally {
        await mongoose.disconnect().catch(() => {});
    }
}

function authHeaders(token) {
    return {
        Cookie: `${COOKIE_NAME}=${token}`,
    };
}

async function requestWithAuth(pathname, token, init = {}) {
    return fetch(new URL(pathname, BASE_URL), {
        ...init,
        headers: {
            ...(init.headers || {}),
            ...authHeaders(token),
        },
    });
}

async function expectHttpStatus(pathname, expectedStatus, token) {
    const url = new URL(pathname, BASE_URL);
    const response = await fetch(url, {
        headers: authHeaders(token),
        redirect: "manual",
    });

    assert(
        response.status === expectedStatus,
        `${pathname} expected ${expectedStatus}, got ${response.status}`,
    );
    log(`${pathname} returned ${response.status}`);
}

async function expectHttpOk(pathname, token, expectedFinalPath = pathname) {
    const url = new URL(pathname, BASE_URL);
    const response = await fetch(url, {
        headers: authHeaders(token),
        redirect: "follow",
    });

    assert(response.ok, `${pathname} expected 200, got ${response.status}`);

    const finalPath = new URL(response.url).pathname;
    assert(
        finalPath === expectedFinalPath,
        `${pathname} expected final path ${expectedFinalPath}, got ${finalPath}`,
    );

    log(`${pathname} resolved to ${finalPath} with ${response.status}`);
}

async function deleteFolderPrefix(prefix, token) {
    const url = new URL(MEDIA_HELPER_URL);
    url.searchParams.set("prefix", prefix);

    const response = await fetch(url, {
        method: "DELETE",
        headers: authHeaders(token),
    });

    assert(
        response.ok,
        `Failed to delete folder prefix ${prefix}: ${response.status}`,
    );
}

async function listFolder({ contextId, fileScope, token }) {
    const url = new URL("/media-helper", BASE_URL);
    url.searchParams.set("operation", "listFolder");
    url.searchParams.set("contextId", contextId);
    url.searchParams.set("userId", contextId);
    url.searchParams.set("fileScope", fileScope);

    const response = await fetch(url, {
        headers: authHeaders(token),
    });

    assert(
        response.ok,
        `Failed to list ${fileScope} folder: ${response.status}`,
    );

    const data = await response.json();
    assert(
        Array.isArray(data),
        `${fileScope} listFolder did not return an array`,
    );
    return data;
}

function buildTinyPngBlob() {
    return new Blob(
        [
            Buffer.from(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2l9fQAAAAASUVORK5CYII=",
                "base64",
            ),
        ],
        { type: "image/png" },
    );
}

async function exerciseFileContract(contextId, token) {
    const uniqueSuffix = Date.now();
    const uploadFilename = `smoke-folder-file-${uniqueSuffix}.txt`;
    const renamedFilename = `smoke-folder-file-renamed-${uniqueSuffix}.txt`;

    await deleteFolderPrefix(`${contextId}/global/`, token);
    await deleteFolderPrefix(`${contextId}/profile/`, token);

    const formData = new FormData();
    formData.append("contextId", contextId);
    formData.append("userId", contextId);
    formData.append("fileScope", "global");
    formData.append(
        "file",
        new Blob(["smoke folder file"], { type: "text/plain" }),
        uploadFilename,
    );

    const response = await requestWithAuth("/media-helper", token, {
        method: "POST",
        body: formData,
    });

    assert(response.ok, `Failed to upload smoke file: ${response.status}`);

    const uploadData = await response.json();
    assert(
        typeof uploadData.url === "string" &&
            /^https?:\/\//.test(uploadData.url),
        "Global upload did not return a signed/public URL",
    );
    assert(
        uploadData.blobPath === `${contextId}/global/${uploadFilename}`,
        `Global upload stored at unexpected path ${uploadData.blobPath}`,
    );

    let globalFiles = await listFolder({
        contextId,
        fileScope: "global",
        token,
    });
    const uploadedEntry = globalFiles.find(
        (file) => file.filename === uploadFilename,
    );
    assert(uploadedEntry, "Uploaded global file was not listed in /global");
    assert(
        uploadedEntry.blobPath === `${contextId}/global/${uploadFilename}`,
        `Global file stored at unexpected path ${uploadedEntry.blobPath}`,
    );

    const renameResponse = await requestWithAuth("/api/files/rename", token, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contextId,
            fileScope: "global",
            blobPath: uploadedEntry.blobPath,
            newFilename: renamedFilename,
        }),
    });
    assert(
        renameResponse.ok,
        `Failed to rename smoke file: ${renameResponse.status}`,
    );

    globalFiles = await listFolder({
        contextId,
        fileScope: "global",
        token,
    });
    const renamedEntry = globalFiles.find(
        (file) => file.filename === renamedFilename,
    );
    assert(renamedEntry, "Renamed global file was not listed in /global");
    assert(
        !globalFiles.some((file) => file.filename === uploadFilename),
        "Original global filename still exists after rename",
    );

    const deleteResponse = await requestWithAuth(
        `/api/files/delete?contextId=${encodeURIComponent(contextId)}&fileScope=global&blobPath=${encodeURIComponent(renamedEntry.blobPath)}`,
        token,
        {
            method: "DELETE",
        },
    );
    assert(
        deleteResponse.ok,
        `Failed to delete renamed smoke file: ${deleteResponse.status}`,
    );

    globalFiles = await listFolder({
        contextId,
        fileScope: "global",
        token,
    });
    assert(
        !globalFiles.some((file) => file.filename === renamedFilename),
        "Renamed global file still exists after deletion",
    );

    const pictureFormData = new FormData();
    pictureFormData.append("file", buildTinyPngBlob(), "smoke-profile.png");

    const profileUploadResponse = await requestWithAuth(
        "/api/users/me/profile-picture",
        token,
        {
            method: "POST",
            body: pictureFormData,
        },
    );
    assert(
        profileUploadResponse.ok,
        `Failed to upload smoke profile picture: ${profileUploadResponse.status}`,
    );

    const profileUploadData = await profileUploadResponse.json();
    assert(
        profileUploadData.blobPath?.startsWith(`${contextId}/profile/`),
        `Profile picture stored at unexpected path ${profileUploadData.blobPath}`,
    );

    const meAfterUpload = await requestWithAuth("/api/users/me", token);
    assert(meAfterUpload.ok, "Failed to fetch user after profile upload");
    const meAfterUploadData = await meAfterUpload.json();
    assert(
        meAfterUploadData.profilePictureBlobPath === profileUploadData.blobPath,
        "User profile picture path did not persist after upload",
    );

    let profileFiles = await listFolder({
        contextId,
        fileScope: "profile",
        token,
    });
    assert(
        profileFiles.some(
            (file) => file.blobPath === profileUploadData.blobPath,
        ),
        "Uploaded profile picture was not listed in /profile",
    );

    const profileDeleteResponse = await requestWithAuth(
        "/api/users/me/profile-picture",
        token,
        {
            method: "DELETE",
        },
    );
    assert(
        profileDeleteResponse.ok,
        `Failed to delete smoke profile picture: ${profileDeleteResponse.status}`,
    );

    const meAfterDelete = await requestWithAuth("/api/users/me", token);
    assert(meAfterDelete.ok, "Failed to fetch user after profile delete");
    const meAfterDeleteData = await meAfterDelete.json();
    assert(
        !meAfterDeleteData.profilePicture &&
            !meAfterDeleteData.profilePictureBlobPath,
        "User profile picture fields were not cleared after delete",
    );

    profileFiles = await listFolder({
        contextId,
        fileScope: "profile",
        token,
    });
    assert(
        !profileFiles.some(
            (file) => file.blobPath === profileUploadData.blobPath,
        ),
        "Profile picture still exists in /profile after delete",
    );

    log("Exercised real file upload/list/rename/delete/profile contract");
}

class CdpClient {
    constructor(ws) {
        this.ws = ws;
        this.nextId = 1;
        this.pending = new Map();
        this.listeners = [];

        ws.on("message", (raw) => {
            const message = JSON.parse(raw.toString());

            if (typeof message.id === "number") {
                const deferred = this.pending.get(message.id);
                if (!deferred) return;

                this.pending.delete(message.id);

                if (message.error) {
                    deferred.reject(
                        new Error(
                            message.error.message ||
                                `CDP error for ${deferred.method}`,
                        ),
                    );
                } else {
                    deferred.resolve(message.result || {});
                }

                return;
            }

            for (const listener of [...this.listeners]) {
                if (listener.method !== message.method) continue;
                if (
                    listener.sessionId &&
                    listener.sessionId !== message.sessionId
                ) {
                    continue;
                }
                if (
                    listener.predicate &&
                    !listener.predicate(message.params || {}, message)
                ) {
                    continue;
                }

                clearTimeout(listener.timer);
                this.listeners = this.listeners.filter(
                    (item) => item !== listener,
                );
                listener.resolve(message.params || {});
            }
        });
    }

    send(method, params = {}, sessionId) {
        const id = this.nextId++;
        const payload = { id, method, params };

        if (sessionId) {
            payload.sessionId = sessionId;
        }

        const promise = new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject, method });
        });

        this.ws.send(JSON.stringify(payload));
        return promise;
    }

    waitFor(method, sessionId, timeoutMs = 15_000, predicate = null) {
        return new Promise((resolve, reject) => {
            const listener = {
                method,
                predicate,
                sessionId,
                resolve,
                reject,
                timer: setTimeout(() => {
                    this.listeners = this.listeners.filter(
                        (item) => item !== listener,
                    );
                    reject(new Error(`Timed out waiting for ${method}`));
                }, timeoutMs),
            };

            this.listeners.push(listener);
        });
    }

    async close() {
        if (this.ws.readyState === WebSocket.OPEN) {
            await new Promise((resolve) => {
                this.ws.once("close", resolve);
                this.ws.close();
            });
        }
    }
}

function findChromeBinary() {
    for (const candidate of CHROME_CANDIDATES) {
        if (candidate.includes(path.sep)) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        } else {
            return candidate;
        }
    }

    throw new Error("No Chrome-compatible browser binary found for smoke test");
}

async function startChrome() {
    const chromePath = findChromeBinary();
    const userDataDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "enntity-smoke-chrome-"),
    );

    const child = spawn(
        chromePath,
        [
            `--remote-debugging-port=${CDP_PORT}`,
            `--user-data-dir=${userDataDir}`,
            "--headless=new",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-sandbox",
            "about:blank",
        ],
        {
            stdio: ["ignore", "pipe", "pipe"],
        },
    );

    attachPrefixedLogs(child, "chrome");
    await waitForUrl(`http://127.0.0.1:${CDP_PORT}/json/version`, 30_000);

    return { child, userDataDir };
}

async function connectBrowserCdp() {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    assert(response.ok, "Failed to fetch Chrome debugger version");

    const { webSocketDebuggerUrl } = await response.json();
    assert(webSocketDebuggerUrl, "Chrome debugger WebSocket URL missing");

    const ws = new WebSocket(webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
        ws.once("open", resolve);
        ws.once("error", reject);
    });

    return new CdpClient(ws);
}

async function createBrowserPage(browser, token) {
    const { targetId } = await browser.send("Target.createTarget", {
        url: "about:blank",
    });

    const { sessionId } = await browser.send("Target.attachToTarget", {
        targetId,
        flatten: true,
    });

    await browser.send("Page.enable", {}, sessionId);
    await browser.send("Runtime.enable", {}, sessionId);
    await browser.send("Network.enable", {}, sessionId);

    const { success } = await browser.send(
        "Network.setCookie",
        {
            name: COOKIE_NAME,
            value: token,
            url: BASE_URL,
        },
        sessionId,
    );

    assert(success, "Failed to set authenticated browser cookie");

    return { targetId, sessionId };
}

async function navigate(browser, sessionId, pathname) {
    const loadPromise = browser.waitFor("Page.loadEventFired", sessionId);
    const responsePromise = browser.waitFor(
        "Network.responseReceived",
        sessionId,
        15_000,
        (params) =>
            params.type === "Document" &&
            new URL(params.response.url).pathname === pathname,
    );

    await browser.send(
        "Page.navigate",
        { url: new URL(pathname, BASE_URL).toString() },
        sessionId,
    );

    const [, responseEvent] = await Promise.all([loadPromise, responsePromise]);
    await delay(1_000);
    return responseEvent.response.status;
}

async function evaluate(browser, sessionId, expression) {
    const { result, exceptionDetails } = await browser.send(
        "Runtime.evaluate",
        {
            expression,
            returnByValue: true,
            awaitPromise: true,
        },
        sessionId,
    );

    if (exceptionDetails) {
        throw new Error(`Runtime evaluation failed: ${exceptionDetails.text}`);
    }

    return result.value;
}

async function waitForEvaluation(
    browser,
    sessionId,
    expression,
    timeoutMs = 15_000,
) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (await evaluate(browser, sessionId, expression)) {
            return;
        }
        await delay(250);
    }

    throw new Error(`Timed out waiting for browser condition: ${expression}`);
}

async function runBrowserChecks(token) {
    const chrome = await startChrome();
    let browser;
    let page;

    try {
        browser = await connectBrowserCdp();
        page = await createBrowserPage(browser, token);

        const mediaStatus = await navigate(browser, page.sessionId, "/media");
        await waitForEvaluation(
            browser,
            page.sessionId,
            'window.location.pathname === "/media"',
        );
        const mediaState = await evaluate(
            browser,
            page.sessionId,
            `
                (() => ({
                    pathname: window.location.pathname,
                    htmlLength: document.documentElement.outerHTML.length,
                    bodyText: document.body.innerText,
                }))()
            `,
        );
        assert(
            mediaState.pathname === "/media",
            `Media page navigation ended at ${mediaState.pathname}`,
        );
        assert(mediaStatus === 200, `Media page returned ${mediaStatus}`);
        assert(
            mediaState.htmlLength > 1_000,
            "Media route rendered an unexpectedly small document in browser",
        );
        assert(
            !mediaState.bodyText.includes("Manage Apps"),
            "Removed app management text still present on media page",
        );
        log("Browser verified media page");

        const chatStatus = await navigate(browser, page.sessionId, "/chat");
        await waitForEvaluation(
            browser,
            page.sessionId,
            'window.location.pathname === "/chat"',
        );
        const chatState = await evaluate(
            browser,
            page.sessionId,
            `
                (() => ({
                    pathname: window.location.pathname,
                    htmlLength: document.documentElement.outerHTML.length,
                    bodyText: document.body.innerText,
                    hasFilesButton: Array.from(document.querySelectorAll("button")).some(
                        (button) => button.innerText && button.innerText.includes("Files"),
                    ),
                }))()
            `,
        );
        assert(chatStatus === 200, `Chat page returned ${chatStatus}`);
        assert(
            chatState.htmlLength > 1_000,
            "Chat route rendered an unexpectedly small document in browser",
        );
        assert(
            !/not found|404/i.test(chatState.bodyText),
            "Chat route rendered a not-found page in browser",
        );
        if (chatState.hasFilesButton) {
            log("Browser verified chat page with files affordance");
        } else {
            log("Browser verified chat page");
        }

        const adminStatus = await navigate(
            browser,
            page.sessionId,
            "/admin/queues",
        );
        await waitForEvaluation(
            browser,
            page.sessionId,
            'window.location.pathname === "/admin/queues"',
        );
        const adminState = await evaluate(
            browser,
            page.sessionId,
            `
                (() => ({
                    pathname: window.location.pathname,
                    htmlLength: document.documentElement.outerHTML.length,
                    bodyText: document.body.innerText,
                }))()
            `,
        );
        assert(
            adminState.pathname === "/admin/queues",
            `Admin queues navigation ended at ${adminState.pathname}`,
        );
        assert(
            adminStatus === 200,
            `Admin queues page returned ${adminStatus}`,
        );
        assert(
            adminState.htmlLength > 1_000,
            "Admin queues route rendered an unexpectedly small document in browser",
        );
        assert(
            !/not found|404/i.test(adminState.bodyText),
            "Admin queues route rendered a not-found page in browser",
        );
        log("Browser verified admin queues page");

        const removedRouteStatus = await navigate(
            browser,
            page.sessionId,
            "/workspaces",
        );
        const removedRouteState = await evaluate(
            browser,
            page.sessionId,
            `
                (() => ({
                    pathname: window.location.pathname,
                    htmlLength: document.documentElement.outerHTML.length,
                }))()
            `,
        );
        assert(
            removedRouteState.pathname === "/workspaces",
            `Removed route navigation ended at ${removedRouteState.pathname}`,
        );
        assert(
            removedRouteStatus === 404,
            `Removed /workspaces route returned ${removedRouteStatus} in browser`,
        );
        assert(
            removedRouteState.htmlLength > 1_000,
            "Removed /workspaces route rendered an unexpectedly small document in browser",
        );
        log("Browser verified removed /workspaces route is a 404");
    } finally {
        if (browser && page) {
            await browser
                .send("Target.closeTarget", { targetId: page.targetId })
                .catch(() => {});
        }

        await browser?.close().catch(() => {});
        await stopProcess(chrome.child).catch(() => {});
        fs.rmSync(chrome.userDataDir, { recursive: true, force: true });
    }
}

async function main() {
    let serverProcess = null;
    const loginUrl = new URL("/auth/login", BASE_URL).toString();

    try {
        await waitForService("Cortex GraphQL", CORTEX_GRAPHQL_URL);
        await waitForService("Cortex File Handler", MEDIA_HELPER_URL);

        if (!(await isUrlReachable(loginUrl))) {
            log(`Starting application server at ${BASE_URL}`);
            serverProcess = startServer();
            await waitForUrl(loginUrl);
        } else {
            log(`Reusing existing server at ${BASE_URL}`);
        }

        const { token, contextId } = await ensureSmokeSessionToken();
        log("Provisioned authenticated admin smoke session");
        await exerciseFileContract(contextId, token);

        await expectHttpOk("/chat", token);
        await expectHttpOk("/media", token);
        await expectHttpOk("/admin", token);
        await expectHttpOk("/admin/queues", token);

        for (const pathname of [
            "/workspaces",
            "/apps",
            "/translate",
            "/video",
            "/transcribe",
            "/write",
            "/code/jira",
            "/code/jira/create",
        ]) {
            await expectHttpStatus(pathname, 404, token);
        }

        await runBrowserChecks(token);

        log("All product smoke checks passed");
    } finally {
        await stopProcess(serverProcess).catch(() => {});
    }
}

main().catch((error) => {
    console.error(`[smoke] FAILED: ${error.message}`);
    process.exit(1);
});
