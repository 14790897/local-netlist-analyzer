/**
 * AI Analysis module — config management + chat launcher
 */
interface AIConfig {
    endpoint: string;
    key: string;
    model: string;
    systemPrompt: string;
}

const CONFIG_KEY = '__ai_config';

function defaultConfig(): AIConfig {
    return {
        endpoint: 'https://api.openai.com/v1',
        key: '',
        model: 'gpt-4o-mini',
        systemPrompt: '你是一个资深的电子电路设计专家。用户会提供原理图的网表数据（包含元件位号和引脚网络连接关系），请根据网表分析电路的功能、结构和工作原理。用中文回答。'
    };
}

function loadConfig(): AIConfig {
    try {
        var raw = eda.sys_Storage.getExtensionUserConfig(CONFIG_KEY);
        if (raw) return JSON.parse(raw);
    } catch (_) {}
    return defaultConfig();
}

function saveConfig(cfg: AIConfig): void {
    try { eda.sys_Storage.setExtensionUserConfig(CONFIG_KEY, JSON.stringify(cfg)); } catch (_) {}
}

/** Open settings IFrame — user configures API key/endpoint/model */
export function openSettings(): void {
    try {
        eda.sys_IFrame.openIFrame('/iframe/settings.html', 520, 480, 'ai-settings', {
            title: 'AI 设置',
        });
    } catch (_) {
        showInfo('无法打开设置面板');
    }
}

/** Open AI chat IFrame — sends netlist context to AI for analysis */
export function openAIChat(): void {
    // Check if API key is configured
    var cfg = loadConfig();
    if (!cfg.key) {
        eda.sys_IFrame.openIFrame('/iframe/settings.html', 520, 480, 'ai-settings', {
            title: 'AI 设置 — 请先配置 API Key',
        });
        return;
    }

    try {
        eda.sys_IFrame.openIFrame('/iframe/chat.html', 700, 560, 'ai-chat', {
            title: 'AI 电路分析',
            maximizeButton: true,
        });
    } catch (_) {
        showInfo('无法打开 AI 对话');
    }
}

function showInfo(msg: string): void {
    try { eda.sys_Dialog.showInformationMessage(msg); } catch (_) {}
}
