/**
 * v1.2.0 — WebSocket bridge for LLM/CI to drive EDA APIs without Playwright.
 *
 * Architecture: "reverse WebSocket" — the EDA extension acts as a WebSocket
 * CLIENT and dials out to ws://127.0.0.1:9050 (or 9051..9059 if 9050 busy).
 * External scripts run a small WS server (e.g. websocat) and send JSON-RPC
 * requests to invoke EDA APIs that are otherwise only accessible through
 * the in-page `window.eda` global — which Playwright often cannot see in
 * cll=debug mode or in nested blob: frames.
 *
 * Protocol (matches the jlc-eda-mcp / hyl64/jlcmcp conventions so existing
 * scripts work):
 *   client -> server: {"type":"hello","api":["sch_SelectControl",...],
 *                        "app":{"version":"3.2.148"}}
 *   server -> client: {"type":"request","id":"1","method":"sch_SelectControl.doSelectAll",
 *                        "params":[],"closeAfterResponse":false}
 *   client -> server: {"type":"response","id":"1","ok":true,"result":[...]}
 *
 * Usage from a script (uses `ws` Node module or websocat):
 *   websocat ws://127.0.0.1:9050
 *   > {"type":"request","id":"r1","method":"sch_SelectControl.doSelectAll","params":[]}
 *   < {"type":"response","id":"r1","ok":true,"result":["gge1",...]}
 *
 * Usage with the Node `ws` module:
 *   var ws = new WebSocket('ws://127.0.0.1:9050');
 *   ws.onmessage = (ev) => console.log(JSON.parse(ev.data));
 *   ws.send(JSON.stringify({type:'request',id:'r1',method:'sch_SelectControl.getAllSelectedPrimitives_PrimitiveId',params:[]}));
 */

declare const eda: any;

const BRIDGE_PORTS = [9050, 9051, 9052, 9053, 9054, 9055, 9056, 9057, 9058, 9059];
const BRIDGE_HOST = '127.0.0.1';
const APP_VERSION = (typeof eda !== 'undefined' && eda.sys_Environment && eda.sys_Environment.appVersion) || 'unknown';

var socket: WebSocket | null = null;
var port = -1;
var reconnectTimer: any = null;
var stopped = false;

/** Try to connect to one of the bridge ports. */
function tryConnect(idx: number) {
    if (stopped) return;
    if (idx >= BRIDGE_PORTS.length) {
        // try again in 3s from first port
        reconnectTimer = setTimeout(() => tryConnect(0), 3000);
        return;
    }
    port = BRIDGE_PORTS[idx];
    try {
        socket = new WebSocket('ws://' + BRIDGE_HOST + ':' + port);
    } catch (e) {
        tryConnect(idx + 1);
        return;
    }
    socket.onopen = () => onOpen();
    socket.onmessage = (ev) => onMessage(ev);
    socket.onerror = () => { /* ignore — will be followed by onclose */ };
    socket.onclose = () => onClose(idx);
}

function onOpen() {
    var apiKeys: string[] = [];
    if (typeof eda !== 'undefined' && eda) {
        try {
            apiKeys = Object.keys(eda).filter(function (k) {
                // Surface the most useful namespaces to the LLM.
                return /^(sch_|pcb_|sys_|dmt_|lib_)/.test(k);
            });
        } catch (_) {}
    }
    send({
        type: 'hello',
        bridge: 'local-netlist-analyzer',
        version: '1.2.0',
        app: { version: APP_VERSION },
        api: apiKeys,
        project: getProjectInfo(),
    });
}

function onClose(idx: number) {
    socket = null;
    if (stopped) return;
    // try next port
    tryConnect(idx + 1);
}

function send(obj: any) {
    if (!socket || socket.readyState !== 1 /* OPEN */) return;
    try {
        socket.send(JSON.stringify(obj));
    } catch (_) {}
}

async function onMessage(ev: MessageEvent) {
    var msg: any;
    try { msg = JSON.parse(ev.data as string); } catch (_) { return; }
    if (!msg || msg.type !== 'request') return;

    var id = msg.id;
    var method = msg.method;
    var params: any[] = Array.isArray(msg.params) ? msg.params : [];
    var closeAfter = !!msg.closeAfterResponse;

    try {
        var result = await invoke(method, params);
        send({ type: 'response', id: id, ok: true, result: result });
    } catch (e) {
        var err = e && (e as any).message || String(e);
        send({ type: 'response', id: id, ok: false, error: err });
    }

    if (closeAfter) {
        try { socket && socket.close(); } catch (_) {}
    }
}

/** Invoke an EDA API by dotted path (e.g. "sch_SelectControl.doSelectAll"). */
async function invoke(method: string, params: any[]): Promise<any> {
    if (typeof eda === 'undefined' || !eda) {
        throw new Error('EDA API not available on this page (cll=debug may be required)');
    }
    var parts = method.split('.');
    if (parts.length < 2) throw new Error('Method must be Class.method, got: ' + method);

    var clsName = parts[0];
    var methodName = parts.slice(1).join('.');
    var cls = eda[clsName];
    if (!cls) throw new Error('Unknown EDA class: ' + clsName);

    var fn = cls[methodName];
    if (typeof fn !== 'function') throw new Error('Not a function: ' + method);

    // Some EDA APIs return a Promise — always await.
    return await fn.apply(cls, params);
}

function getProjectInfo(): any {
    try {
        if (typeof eda === 'undefined' || !eda || !eda.dmt_DocumentManager) return {};
        var doc = eda.dmt_DocumentManager.getCurrentDocument && eda.dmt_DocumentManager.getCurrentDocument();
        if (!doc) return {};
        return {
            uuid: doc.uuid,
            name: doc.name,
            type: doc.documentType,
        };
    } catch (_) { return {}; }
}

/** Public entry — call from the extension's activate(). */
export function startBridge(): void {
    if (typeof WebSocket === 'undefined') return; // not a browser
    if (socket) return; // already started
    stopped = false;
    tryConnect(0);
}

export function stopBridge(): void {
    stopped = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (socket) { try { socket.close(); } catch (_) {} socket = null; }
}
