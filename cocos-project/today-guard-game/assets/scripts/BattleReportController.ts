import { _decorator, Button, CCString, Color, Component, Graphics, Label, Node, UITransform } from 'cc';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';
import { SaveDataManager, SaveData, UpgradeKey } from './SaveDataManager';
import { SkillRuntimeState } from './SkillRuntimeState';

const { ccclass, property } = _decorator;

export type BattleReportResult = 'victory' | 'failure';

export type BattleReportData = {
    result: BattleReportResult;
    killCount: number;
    currentHp: number;
    maxHp: number;
    currentWave: number;
    maxWave: number;
    restartText?: string;
    onRestart?: () => void;
};

type BattleReportImageData = {
    hookText: string;
    title: string;
    subtitle: string;
    statsText: string;
    statusTitle: string;
    statusText: string;
    rankText: string;
};

type RunSettlementData = {
    waveCleared: number;
    runCoins: number;
    totalCoins: number;
    bestWave: number;
    isNewRecord: boolean;
};

type EndlessEvaluation = {
    tier: string;
    percent: number;
};

type UpgradeViewItem = {
    key: UpgradeKey;
    title: string;
    desc: string;
};

@ccclass('BattleReportController')
export class BattleReportController extends Component {
    private static readonly IMAGE_WIDTH = 720;
    private static readonly IMAGE_HEIGHT = 560;
    private static readonly IMAGE_SCALE = 2;

    @property({ type: [CCString] })
    public victoryHooks: string[] = [
        '系统通知：你今天没有被现实击穿',
        '你居然真的撑到了下班（异常记录）',
        '今天你不是在打工，你是在硬扛现实',
    ];

    @property({ type: [CCString] })
    public failureHooks: string[] = [
        '系统提示：你的精神值已被现实清空',
        '今天不是没守住，是压力版本更新了',
        '你不是输给了怪物，是输给了星期一',
    ];

    @property({ type: [CCString] })
    public failureSubtitles: string[] = [
        '精神值归零，但班还没下',
        '你被内耗打穿了',
        '今天的你，被工作做掉了',
        '不是你不行，是破事太多',
    ];

    @property({ type: [CCString] })
    public victoryStatusTexts: string[] = [
        '今天强得像没上过班。',
        '人还在，魂有点飘。',
        '看似守住了，其实已经碎了。',
        '靠最后一口气硬撑到下班。',
    ];

    @property({ type: [CCString] })
    public failureDiagnosisTexts: string[] = [
        '刚上班就碎了，建议先喝口水。',
        '甩锅怪太硬，你输出不够。',
        '催活怪冲太快，你没挡住。',
        '就差一点点，今天差点守住。',
    ];
    @property
    public maxScore = 166;

    @property
    public gameLink = 'https://game-link-placeholder';

    private _lastCopyText = '';
    private _lastImageData: BattleReportImageData | null = null;
    private _onRestart: (() => void) | null = null;
    private _restartButton: Button | null = null;
    private _upgradeButton: Button | null = null;
    private _copyButton: Button | null = null;
    private _lastUpgradeMessage = '';
    private _confirmResetSave = false;

    private readonly upgradeItems: UpgradeViewItem[] = [
        { key: 'keyboard', title: '键盘强化', desc: '键帽打得更痛。' },
        { key: 'coffee', title: '咖啡补给', desc: '守卫出手更快。' },
        { key: 'desk', title: '精神工位', desc: '精神值上限更高。' },
    ];

    protected onDisable(): void {
        this._restartButton?.node.off(Button.EventType.CLICK, this.handleRestartClicked, this);
        this._upgradeButton?.node.off(Button.EventType.CLICK, this.handleUpgradeClicked, this);
        this._copyButton?.node.off(Button.EventType.CLICK, this.handleCopyClicked, this);
        this._restartButton = null;
        this._upgradeButton = null;
        this._copyButton = null;
    }

    public show(data: BattleReportData): void {
        this._onRestart = data.onRestart ?? null;
        this.node.active = true;
        this.clearReportNodes();

        const canvasSize = this.getReferenceSize();
        this.setNodeSize(this.node, canvasSize.width, canvasSize.height);
        this.drawScreenDimmer(canvasSize.width, canvasSize.height);

        const card = this.createNode('BattleReportCard', this.node, 0, 0, 720, 520);
        this.drawCard(card);
        const settlement = this.settleRun(data);

        const hookText = data.result === 'victory'
            ? this.pick(this.victoryHooks)
            : this.pick(this.failureHooks);
        const title = data.result === 'victory' ? '今天守住了' : '今天没守住';
        const subtitle = data.result === 'victory'
            ? '你居然真的撑到了下班'
            : this.pick(this.failureSubtitles);
        const statusText = data.result === 'victory'
            ? this.getVictoryStatus(data.currentHp, data.maxHp)
            : this.getFailureDiagnosis(data.currentWave);
        const evaluation = this.getEndlessEvaluation(data);
        const statusTitle = data.result === 'victory' ? '状态评价' : '失败诊断';
        const rankText = `系统评估：${evaluation.tier}｜超过了 ${evaluation.percent}% 的打工人`;
        const newRecordText = settlement.isNewRecord ? '\n新的摸鱼纪录！' : '';
        const statsText = `守住波数：${settlement.waveCleared}\n击退内耗：${data.killCount}\n本局摸鱼币：${settlement.runCoins}\n总摸鱼币：${settlement.totalCoins}\n历史最佳：第 ${settlement.bestWave} 波${newRecordText}`;

        this._lastCopyText = this.createShareText(data, statusText, settlement);
        this._lastImageData = {
            hookText,
            title,
            subtitle,
            statsText,
            statusTitle,
            statusText,
            rankText,
        };

        this.createLabel(card, 'ReportHookLabel', hookText, 0, 208, 640, 34, 22, 30, new Color(255, 224, 116, 255));
        this.createLabel(card, 'ReportTitleLabel', title, 0, 158, 620, 54, 40, 48, new Color(255, 255, 255, 255));
        this.createLabel(card, 'ReportSubtitleLabel', subtitle, 0, 114, 620, 34, 23, 30, new Color(226, 235, 255, 255));

        const statsBox = this.createNode('ReportStatsBox', card, -178, 10, 300, 180);
        this.drawBox(statsBox, new Color(255, 255, 255, 238));
        this.createLabel(statsBox, 'ReportStatsTitle', '本局数据', 0, 68, 260, 30, 22, 28, new Color(30, 36, 48, 255));
        this.createLabel(statsBox, 'ReportStatsText', statsText, 0, -18, 260, 132, 17, 23, new Color(44, 50, 64, 255));

        const statusBox = this.createNode('ReportStatusBox', card, 178, 10, 300, 180);
        this.drawBox(statusBox, new Color(255, 248, 220, 242));
        this.createLabel(statusBox, 'ReportStatusTitle', statusTitle, 0, 68, 260, 30, 22, 28, new Color(38, 38, 42, 255));
        this.createLabel(statusBox, 'ReportStatusText', statusText, 0, -18, 260, 132, 20, 28, new Color(55, 42, 36, 255));

        const rankBox = this.createNode('ReportRankBox', card, 0, -150, 620, 56);
        this.drawBox(rankBox, new Color(34, 44, 66, 235));
        this.createLabel(
            rankBox,
            'ReportRankText',
            rankText,
            0,
            0,
            560,
            36,
            23,
            30,
            new Color(255, 255, 255, 255),
        );

        this._restartButton = this.createButton(card, 'ReportRestartButton', data.restartText ?? '再来一局', -230, -218, 210, 56, new Color(74, 154, 255, 255));
        this._upgradeButton = this.createButton(card, 'ReportUpgradeButton', '升级工位', 0, -218, 190, 56, new Color(82, 186, 160, 255));
        this._copyButton = this.createButton(card, 'ReportCopyButton', '复制战报', 220, -218, 190, 56, new Color(255, 184, 76, 255));

        this._restartButton.node.on(Button.EventType.CLICK, this.handleRestartClicked, this);
        this._upgradeButton.node.on(Button.EventType.CLICK, this.handleUpgradeClicked, this);
        this._copyButton.node.on(Button.EventType.CLICK, this.handleCopyClicked, this);
        this.node.setSiblingIndex((this.node.parent?.children.length ?? 1) - 1);
    }

    public hide(): void {
        this.node.active = false;
    }

    public shareAsImage(): void {
        this.node.active = true;
        this.node.setScale(1, 1, 1);
        this.forcePanelLayout();
        this.scheduleOnce(() => this.exportReportPng(), 0);
    }

    private exportReportPng(): void {
        this.node.active = true;
        this.node.setScale(1, 1, 1);
        this.forcePanelLayout();

        const browser = globalThis as unknown as {
            document?: {
                createElement?: (tagName: string) => {
                    width?: number;
                    height?: number;
                    getContext?: (contextId: string) => {
                        fillStyle?: string;
                        font?: string;
                        textAlign?: string;
                        textBaseline?: string;
                        lineWidth?: number;
                        strokeStyle?: string;
                        scale?: (x: number, y: number) => void;
                        beginPath?: () => void;
                        moveTo?: (x: number, y: number) => void;
                        lineTo?: (x: number, y: number) => void;
                        quadraticCurveTo?: (cpx: number, cpy: number, x: number, y: number) => void;
                        closePath?: () => void;
                        fill?: () => void;
                        stroke?: () => void;
                        fillRect?: (x: number, y: number, width: number, height: number) => void;
                        fillText?: (text: string, x: number, y: number) => void;
                    } | null;
                    toDataURL?: (type?: string) => string;
                    href?: string;
                    download?: string;
                    click?: () => void;
                };
                body?: {
                    appendChild?: (node: unknown) => void;
                    removeChild?: (node: unknown) => void;
                };
            };
        };

        const imageData = this._lastImageData;
        if (!imageData) {
            console.warn('[BattleReportController] 没有可导出的战报数据。');
            return;
        }

        const canvas = browser.document?.createElement?.('canvas');
        const context = canvas?.getContext?.('2d');
        if (!canvas || !context) {
            console.warn('[BattleReportController] 当前环境无法创建离屏 Canvas，不能导出战报 PNG。');
            return;
        }

        canvas.width = BattleReportController.IMAGE_WIDTH * BattleReportController.IMAGE_SCALE;
        canvas.height = BattleReportController.IMAGE_HEIGHT * BattleReportController.IMAGE_SCALE;
        context.scale?.(BattleReportController.IMAGE_SCALE, BattleReportController.IMAGE_SCALE);
        this.drawReportImage(context, imageData);

        const dataUrl = canvas.toDataURL?.('image/png') ?? '';
        if (!dataUrl) {
            console.warn('[BattleReportController] 当前环境无法导出战报 PNG。');
            return;
        }

        const link = browser.document?.createElement?.('a');
        if (!link) {
            console.warn('[BattleReportController] 已生成 PNG 数据，但当前环境无法创建下载链接。', dataUrl);
            return;
        }

        link.href = dataUrl;
        link.download = 'today-guard-battle-report.png';
        browser.document?.body?.appendChild?.(link);
        link.click?.();
        browser.document?.body?.removeChild?.(link);
    }

    private forcePanelLayout(): void {
        const panelTransform = getOrAddComponent(this.node, UITransform);
        const size = this.getReferenceSize();
        panelTransform.setContentSize(size.width, size.height);

        const card = this.node.getChildByName('BattleReportCard');
        if (card) {
            card.active = true;
            card.setScale(1, 1, 1);
            this.setNodeSize(card, 720, 520);
        }
    }

    private handleRestartClicked(): void {
        this.hide();
        this._onRestart?.();
    }

    private handleUpgradeClicked(): void {
        this.showUpgradePanel();
    }

    private handleCopyClicked(): void {
        this.copyText(this._lastCopyText);
        this.shareAsImage();
    }

    private showUpgradePanel(): void {
        let overlay = this.node.getChildByName('ReportUpgradePanel');
        if (!overlay) {
            overlay = new Node('ReportUpgradePanel');
            overlay.layer = this.node.layer;
            this.node.addChild(overlay);
        }

        overlay.active = true;
        overlay.setPosition(0, 0, 0);
        overlay.setSiblingIndex((this.node.children.length ?? 1) - 1);
        this.clearNodeChildren(overlay);

        const canvasSize = this.getReferenceSize();
        this.setNodeSize(overlay, canvasSize.width, canvasSize.height);
        this.drawUpgradeOverlay(overlay, 840, 590);

        const saveData = SaveDataManager.load();
        this.createLabel(overlay, 'UpgradeTitle', '升级工位', 0, 244, 660, 42, 30, 38, new Color(255, 244, 200, 255));
        this.createLabel(overlay, 'UpgradeCoinLabel', `当前摸鱼币：${saveData.totalCoins}`, 0, 206, 620, 32, 22, 30, new Color(255, 255, 255, 255));
        this.createLabel(
            overlay,
            'UpgradeMessageLabel',
            this._lastUpgradeMessage || '升级会立即存档，下一局开始生效。',
            0,
            174,
            660,
            30,
            18,
            24,
            this._lastUpgradeMessage ? new Color(120, 255, 194, 255) : new Color(208, 220, 240, 255),
        );

        this.upgradeItems.forEach((item, index) => {
            const y = 88 - index * 112;
            const level = saveData.upgrades[item.key] ?? 0;
            const cost = SaveDataManager.getUpgradeCost(item.key);
            const infoBox = this.createNode(`${item.key}UpgradeInfo`, overlay, -96, y, 520, 92);
            this.drawBox(infoBox, new Color(255, 249, 232, 244));
            this.createLabel(
                infoBox,
                `${item.key}UpgradeInfoLabel`,
                `${item.title}  Lv.${level}\n${item.desc}\n${this.getUpgradeEffectText(item.key, level)}`,
                0,
                0,
                480,
                82,
                18,
                24,
                new Color(40, 44, 56, 255),
            );

            const buttonText = saveData.totalCoins >= cost ? `升级 ${cost}` : `缺 ${cost}`;
            const button = this.createButton(
                overlay,
                `${item.key}UpgradeButton`,
                buttonText,
                280,
                y,
                150,
                60,
                saveData.totalCoins >= cost ? new Color(255, 184, 76, 255) : new Color(118, 124, 138, 255),
            );
            button.interactable = saveData.totalCoins >= cost;
            button.node.on(Button.EventType.CLICK, () => {
                const result = SaveDataManager.upgrade(item.key);
                if (result.success) {
                    const nextLevel = result.data.upgrades[item.key] ?? level + 1;
                    this._lastUpgradeMessage = `${item.title} 升到 Lv.${nextLevel}：${this.getUpgradePlainEffectText(item.key, nextLevel)}`;
                }
                this.showUpgradePanel();
            });
        });

        this.createButton(
            overlay,
            'UpgradeResetSaveButton',
            this._confirmResetSave ? '确认清除' : '清除存档',
            -270,
            -254,
            150,
            46,
            this._confirmResetSave ? new Color(210, 88, 88, 255) : new Color(92, 98, 112, 255),
        ).node.on(Button.EventType.CLICK, () => {
            if (!this._confirmResetSave) {
                this._confirmResetSave = true;
                this._lastUpgradeMessage = '再点一次“确认清除”会重置摸鱼币、历史最佳和升级等级。';
                this.showUpgradePanel();
                return;
            }

            SaveDataManager.reset();
            this._confirmResetSave = false;
            this._lastUpgradeMessage = '存档已清除，已回到初始状态。';
            this.showUpgradePanel();
        });

        this.createButton(overlay, 'UpgradeBackToReportButton', '返回', 0, -254, 190, 52, new Color(74, 154, 255, 255))
            .node.on(Button.EventType.CLICK, () => {
                this._confirmResetSave = false;
                overlay.active = false;
            });
    }

    private getUpgradeEffectText(key: UpgradeKey, level: number): string {
        const currentLevel = Math.max(0, Math.floor(level));
        const nextLevel = currentLevel + 1;
        if (key === 'keyboard') {
            return `子弹伤害：+${currentLevel} → +${nextLevel}`;
        }

        if (key === 'coffee') {
            return `攻击间隔：缩短 ${currentLevel * 5}% → ${nextLevel * 5}%`;
        }

        return `最大精神值：+${currentLevel * 10} → +${nextLevel * 10}`;
    }

    private getUpgradePlainEffectText(key: UpgradeKey, level: number): string {
        const safeLevel = Math.max(0, Math.floor(level));
        if (key === 'keyboard') {
            return `子弹伤害 +${safeLevel}`;
        }

        if (key === 'coffee') {
            return `攻击间隔缩短 ${safeLevel * 5}%`;
        }

        return `最大精神值 +${safeLevel * 10}`;
    }

    private drawReportImage(context: {
        fillStyle?: string;
        font?: string;
        textAlign?: string;
        textBaseline?: string;
        lineWidth?: number;
        strokeStyle?: string;
        scale?: (x: number, y: number) => void;
        beginPath?: () => void;
        moveTo?: (x: number, y: number) => void;
        lineTo?: (x: number, y: number) => void;
        quadraticCurveTo?: (cpx: number, cpy: number, x: number, y: number) => void;
        closePath?: () => void;
        fill?: () => void;
        stroke?: () => void;
        fillRect?: (x: number, y: number, width: number, height: number) => void;
        fillText?: (text: string, x: number, y: number) => void;
    }, data: BattleReportImageData): void {
        context.fillStyle = '#111827';
        context.fillRect?.(0, 0, 720, 560);
        this.drawRoundRect(context, 16, 16, 688, 528, 24, '#1f2937');
        this.drawRoundRect(context, 30, 30, 660, 500, 20, 'rgba(255,255,255,0.08)');

        this.drawText(context, data.hookText, 360, 56, 22, '#ffe074', 30);
        this.drawText(context, data.title, 360, 110, 42, '#ffffff', 50);
        this.drawText(context, data.subtitle, 360, 154, 24, '#e2ebff', 32);

        this.drawRoundRect(context, 58, 178, 292, 174, 16, '#fff7e6');
        this.drawText(context, '本局数据', 204, 210, 22, '#1f2937', 28);
        this.drawMultilineText(context, data.statsText, 204, 286, 17, '#374151', 24, 250);

        this.drawRoundRect(context, 370, 178, 292, 174, 16, '#fff2c6');
        this.drawText(context, data.statusTitle, 516, 210, 22, '#2f2930', 28);
        this.drawMultilineText(context, data.statusText, 516, 286, 18, '#473225', 28, 250);

        this.drawRoundRect(context, 58, 368, 604, 54, 16, '#243044');
        this.drawMultilineText(context, data.rankText, 360, 395, 23, '#ffffff', 28, 560);

        this.drawRoundRect(context, 72, 438, 180, 50, 14, '#4a9aff');
        this.drawText(context, '再来一局', 162, 463, 20, '#ffffff', 28);
        this.drawRoundRect(context, 270, 438, 180, 50, 14, '#52baa0');
        this.drawText(context, '升级工位', 360, 463, 20, '#ffffff', 28);
        this.drawRoundRect(context, 468, 438, 180, 50, 14, '#ffb84c');
        this.drawText(context, '复制战报', 558, 463, 20, '#ffffff', 28);

        this.drawText(context, '《今天也要守住》', 360, 516, 18, '#cbd5e1', 24);
    }

    private drawRoundRect(
        context: {
            fillStyle?: string;
            beginPath?: () => void;
            moveTo?: (x: number, y: number) => void;
            lineTo?: (x: number, y: number) => void;
            quadraticCurveTo?: (cpx: number, cpy: number, x: number, y: number) => void;
            closePath?: () => void;
            fill?: () => void;
        },
        x: number,
        y: number,
        width: number,
        height: number,
        radius: number,
        color: string,
    ): void {
        context.fillStyle = color;
        context.beginPath?.();
        context.moveTo?.(x + radius, y);
        context.lineTo?.(x + width - radius, y);
        context.quadraticCurveTo?.(x + width, y, x + width, y + radius);
        context.lineTo?.(x + width, y + height - radius);
        context.quadraticCurveTo?.(x + width, y + height, x + width - radius, y + height);
        context.lineTo?.(x + radius, y + height);
        context.quadraticCurveTo?.(x, y + height, x, y + height - radius);
        context.lineTo?.(x, y + radius);
        context.quadraticCurveTo?.(x, y, x + radius, y);
        context.closePath?.();
        context.fill?.();
    }

    private drawText(
        context: {
            fillStyle?: string;
            font?: string;
            textAlign?: string;
            textBaseline?: string;
            fillText?: (text: string, x: number, y: number) => void;
        },
        text: string,
        x: number,
        y: number,
        fontSize: number,
        color: string,
        lineHeight: number,
    ): void {
        context.fillStyle = color;
        context.font = `700 ${fontSize}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        this.drawMultilineText(context, text, x, y, fontSize, color, lineHeight);
    }

    private drawMultilineText(
        context: {
            fillStyle?: string;
            font?: string;
            textAlign?: string;
            textBaseline?: string;
            fillText?: (text: string, x: number, y: number) => void;
        },
        text: string,
        x: number,
        y: number,
        fontSize: number,
        color: string,
        lineHeight: number,
        maxWidth = 620,
    ): void {
        context.fillStyle = color;
        context.font = `600 ${fontSize}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const lines = text.split('\n');
        const startY = y - ((lines.length - 1) * lineHeight) * 0.5;
        lines.forEach((line, index) => {
            context.fillText?.(this.truncateText(line, maxWidth, fontSize), x, startY + index * lineHeight);
        });
    }

    private truncateText(text: string, maxWidth: number, fontSize: number): string {
        const maxChars = Math.max(6, Math.floor(maxWidth / Math.max(10, fontSize)));
        if (text.length <= maxChars) {
            return text;
        }

        return `${text.slice(0, Math.max(0, maxChars - 1))}?`;
    }

    private createShareText(data: BattleReportData, statusText: string, settlement: RunSettlementData): string {
        return [
            `我在《今天也要守住》里撑到了第${settlement.waveCleared}波`,
            `击退内耗${data.killCount}个`,
            `剩余精神值${Math.max(0, data.currentHp)}`,
            `本局摸鱼币${settlement.runCoins}`,
            `历史最佳第${settlement.bestWave}波`,
            '',
            statusText,
            '',
            `游戏链接：${this.gameLink}`,
        ].join('\n');
    }

    private copyText(text: string): void {
        const browser = globalThis as unknown as {
            navigator?: { clipboard?: { writeText?: (value: string) => Promise<void> } };
            document?: {
                body?: { appendChild?: (node: unknown) => void; removeChild?: (node: unknown) => void };
                createElement?: (tagName: string) => {
                    value?: string;
                    style?: Record<string, string>;
                    select?: () => void;
                };
                execCommand?: (command: string) => boolean;
            };
        };
        const clipboard = browser.navigator?.clipboard;

        if (clipboard?.writeText) {
            clipboard.writeText(text).catch((error) => {
                console.warn('[BattleReportController] 复制战报失败，请手动复制。', error, text);
            });
            return;
        }

        const document = browser.document;
        const textArea = document?.createElement?.('textarea');
        if (textArea && document?.body?.appendChild && document.body.removeChild && document.execCommand) {
            textArea.value = text;
            textArea.style = {
                position: 'fixed',
                left: '-9999px',
                top: '-9999px',
            };
            document.body.appendChild(textArea);
            textArea.select?.();
            const success = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (success) {
                return;
            }
        }

        console.warn('[BattleReportController] 当前运行环境不支持一键复制，请手动复制：', text);
    }

    private clearReportNodes(): void {
        for (const child of [...this.node.children]) {
            if (child.name.startsWith('BattleReport') || child.name.startsWith('Report')) {
                child.destroy();
            }
        }
    }

    private getVictoryStatus(currentHp: number, maxHp: number): string {
        const rate = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
        if (rate >= 80) return this.victoryStatusTexts[0] ?? '';
        if (rate >= 50) return this.victoryStatusTexts[1] ?? '';
        if (rate >= 20) return this.victoryStatusTexts[2] ?? '';
        return this.victoryStatusTexts[3] ?? '';
    }

    private getFailureDiagnosis(currentWave: number): string {
        if (currentWave <= 2) return this.failureDiagnosisTexts[0] ?? '';
        if (currentWave === 3) return this.failureDiagnosisTexts[1] ?? '';
        if (currentWave === 4) return this.failureDiagnosisTexts[2] ?? '';
        return this.failureDiagnosisTexts[3] ?? '';
    }

    private getEndlessEvaluation(data: BattleReportData): EndlessEvaluation {
        const waveCleared = this.getWaveCleared(data);
        const score = waveCleared * 22 + Math.max(0, data.killCount) * 0.6;
        const percent = Math.round(99 * (1 - Math.exp(-score / 260)));

        return {
            tier: this.getEndlessTier(waveCleared),
            percent: Math.max(1, Math.min(99, percent)),
        };
    }

    private getEndlessTier(waveCleared: number): string {
        if (waveCleared >= 30) return '传说级工位守护者';
        if (waveCleared >= 20) return '公司还没倒，你先变异了';
        if (waveCleared >= 15) return '精神钢筋人';
        if (waveCleared >= 10) return '办公室幸存者';
        if (waveCleared >= 7) return '抗压老油条';
        if (waveCleared >= 4) return '合格摸鱼员工';
        return '试用期打工人';
    }

    private settleRun(data: BattleReportData): RunSettlementData {
        const waveCleared = this.getWaveCleared(data);
        const runCoins = this.calculateRunCoins(waveCleared, data.killCount);
        const saveData = SaveDataManager.load();
        const isNewRecord = waveCleared > saveData.bestWave;
        const nextData: SaveData = {
            ...saveData,
            totalCoins: Math.max(0, saveData.totalCoins + runCoins),
            bestWave: isNewRecord ? waveCleared : saveData.bestWave,
        };
        SaveDataManager.save(nextData);

        return {
            waveCleared,
            runCoins,
            totalCoins: nextData.totalCoins,
            bestWave: nextData.bestWave,
            isNewRecord,
        };
    }

    private getWaveCleared(data: BattleReportData): number {
        if (data.result === 'victory') {
            return Math.max(0, Math.floor(data.maxWave));
        }

        return Math.max(0, Math.floor(data.currentWave - 1));
    }

    private calculateRunCoins(waveCleared: number, killCount: number): number {
        let pressureBonus = 0;
        for (let wave = 5; wave <= waveCleared; wave += 5) {
            pressureBonus += wave * 2;
        }

        const baseCoins = Math.max(0, Math.floor(killCount)) + waveCleared * 5 + pressureBonus;
        return Math.max(0, Math.floor(baseCoins * (1 + SkillRuntimeState.coinBonusRate)));
    }

    private pick(items: string[]): string {
        if (items.length === 0) {
            return '';
        }
        return items[Math.floor(Math.random() * items.length)];
    }

    private createButton(parent: Node, name: string, text: string, x: number, y: number, width: number, height: number, color: Color): Button {
        const node = this.createNode(name, parent, x, y, width, height);
        const graphics = getOrAddComponent(node, Graphics);
        graphics.clear();
        graphics.fillColor = color;
        graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 14);
        graphics.fill();

        const label = this.createLabel(node, `${name}Label`, text, 0, 0, width - 24, height - 14, 24, 30, new Color(255, 255, 255, 255));
        label.enableWrapText = false;
        label.overflow = Label.Overflow.SHRINK;
        return getOrAddComponent(node, Button);
    }

    private createLabel(
        parent: Node,
        name: string,
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number,
        lineHeight: number,
        color: Color,
    ): Label {
        const node = this.createNode(name, parent, x, y, width, height);
        const label = getOrAddComponent(node, Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.enableWrapText = true;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    private createNode(name: string, parent: Node, x: number, y: number, width: number, height: number): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(x, y, 0);
        this.setNodeSize(node, width, height);
        return node;
    }

    private drawScreenDimmer(width: number, height: number): void {
        const graphics = getOrAddComponent(this.node, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(8, 10, 16, 176);
        graphics.rect(-width * 0.5, -height * 0.5, width, height);
        graphics.fill();
    }

    private drawCard(node: Node): void {
        const transform = getExistingComponent(node, UITransform);
        const width = transform?.width ?? 720;
        const height = transform?.height ?? 520;
        const graphics = getOrAddComponent(node, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(22, 28, 42, 246);
        graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 24);
        graphics.fill();
        graphics.fillColor = new Color(255, 255, 255, 26);
        graphics.roundRect(-width * 0.5 + 10, -height * 0.5 + 10, width - 20, height - 20, 20);
        graphics.fill();
    }

    private drawBox(node: Node, color: Color): void {
        const transform = getExistingComponent(node, UITransform);
        const width = transform?.width ?? 300;
        const height = transform?.height ?? 150;
        const graphics = getOrAddComponent(node, Graphics);
        graphics.clear();
        graphics.fillColor = color;
        graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 16);
        graphics.fill();
    }

    private drawUpgradeOverlay(node: Node, cardWidth: number, cardHeight: number): void {
        const transform = getExistingComponent(node, UITransform);
        const width = transform?.width ?? 1280;
        const height = transform?.height ?? 720;
        const graphics = getOrAddComponent(node, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(8, 10, 16, 190);
        graphics.rect(-width * 0.5, -height * 0.5, width, height);
        graphics.fill();
        graphics.fillColor = new Color(28, 34, 48, 248);
        graphics.roundRect(-cardWidth * 0.5, -cardHeight * 0.5, cardWidth, cardHeight, 22);
        graphics.fill();
        graphics.fillColor = new Color(255, 255, 255, 24);
        graphics.roundRect(-cardWidth * 0.5 + 10, -cardHeight * 0.5 + 10, cardWidth - 20, cardHeight - 20, 18);
        graphics.fill();
    }

    private clearNodeChildren(node: Node): void {
        for (const child of [...node.children]) {
            child.destroy();
        }
    }

    private setNodeSize(node: Node, width: number, height: number): void {
        const transform = getOrAddComponent(node, UITransform);
        transform.setContentSize(width, height);
    }

    private getReferenceSize(): { width: number; height: number } {
        const transform = getExistingComponent(this.node, UITransform);
        if (transform && transform.width > 0 && transform.height > 0) {
            return { width: transform.width, height: transform.height };
        }

        const canvas = this.findAncestorByName(this.node, 'Canvas');
        const canvasTransform = getExistingComponent(canvas, UITransform);
        if (canvasTransform) {
            return {
                width: Math.max(canvasTransform.width, 960),
                height: Math.max(canvasTransform.height, 640),
            };
        }

        return { width: 1280, height: 720 };
    }

    private findAncestorByName(node: Node | null, name: string): Node | null {
        let current: Node | null = node;
        while (current) {
            if (current.name === name) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }
}
