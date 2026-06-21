import { _decorator, AudioClip, Button, Color, Component, Graphics, Label, Node, resources, UITransform } from 'cc';
import { ArtSpriteHelper } from './ArtSpriteHelper';
import { FeedbackController } from './FeedbackController';
import { SfxController } from './SfxController';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';
import { SaveDataManager, UpgradeKey } from './SaveDataManager';

const { ccclass, property } = _decorator;

type StartableWaveController = Component & {
    prepareForStartScreen?: () => void;
    startFirstWaveFromStartScreen?: () => void;
};

type UpgradeViewItem = {
    key: UpgradeKey;
    title: string;
    desc: string;
};

@ccclass('StartGameController')
export class StartGameController extends Component {
    @property(Node)
    public startPanel: Node | null = null;

    @property(Button)
    public startButton: Button | null = null;

    @property(Label)
    public titleLabel: Label | null = null;

    @property(Label)
    public descLabel: Label | null = null;

    @property(Component)
    public waveController: Component | null = null;

    @property
    public backgroundPath = 'art/ui/start_panel_bg';

    @property
    public battleBackgroundPath = 'art/ui/battle_bg';

    private _buttonBound = false;
    private _upgradeButton: Button | null = null;
    private _tutorialButton: Button | null = null;
    private _upgradeButtonBound = false;
    private _tutorialButtonBound = false;
    private _preloadedFirstWaveAssets = false;
    private _lastUpgradeMessage = '';
    private _confirmResetSave = false;

    private readonly upgradeItems: UpgradeViewItem[] = [
        { key: 'keyboard', title: '键盘强化', desc: '键帽打得更痛。' },
        { key: 'coffee', title: '咖啡补给', desc: '守卫出手更快。' },
        { key: 'desk', title: '精神工位', desc: '精神值上限更高。' },
    ];

    protected start(): void {
        this.setupStartPanel();
    }

    protected onEnable(): void {
        this.bindStartButton();
    }

    protected onDisable(): void {
        this.unbindStartButton();
        this.unbindMenuButtons();
    }

    public initializeFromWaveController(waveController: Component, startPanel: Node): void {
        this.waveController = this.waveController ?? waveController;
        this.startPanel = this.startPanel ?? startPanel;
        this.setupStartPanel();
    }

    private setupStartPanel(): void {
        const panel = this.getStartPanel();
        const panelSize = this.getStartPanelSize(panel);
        panel.active = true;
        panel.setSiblingIndex((panel.parent?.children.length ?? 1) - 1);
        this.setNodeSize(panel, panelSize.width, panelSize.height);
        this.drawPanelBackground(panel);
        this.ensureBattleLayerBackdrop(panel);

        this.titleLabel = this.getOrCreateLabel(
            'TitleLabel',
            '今天也要守住',
            38,
            48,
            panelSize.height * 0.18,
            Math.min(panelSize.width - 120, 680),
            68,
        );
        this.descLabel = this.getOrCreateLabel(
            'DescLabel',
            '守住小屋，击退压力怪。\n每波结束选择一个办法，看看今天能撑到第几波。',
            22,
            34,
            24,
            Math.min(panelSize.width - 120, 720),
            116,
        );
        this.startButton = this.getOrCreateStartButton();
        this.getOrCreateMenuButtons();

        this.getWaveController()?.prepareForStartScreen?.();
        this.preloadFirstWaveAssets();
        this.bindStartButton();
        this.bindMenuButtons();
    }

    private handleStartClicked(): void {
        FeedbackController.getForNode(this.node)?.playClickFeedback(this.startButton?.node ?? this.node);
        this.applySavedUpgradesBeforeBattle();
        this.unbindStartButton();
        this.getStartPanel().active = false;
        this.scheduleOnce(() => {
            this.getWaveController()?.startFirstWaveFromStartScreen?.();
        }, 0.12);
    }

    private preloadFirstWaveAssets(): void {
        if (this._preloadedFirstWaveAssets) {
            return;
        }

        this._preloadedFirstWaveAssets = true;
        [
            this.backgroundPath,
            this.battleBackgroundPath,
            'art/base/spirit_base',
            'art/player/player_guard',
            'art/player/player_guard_attack',
            'art/monsters/monster_neihao',
            'art/monsters/monster_cui_huo',
            'art/monsters/monster_shuai_guo',
            'art/projectiles/projectile_keycap_esc',
        ].forEach((path) => {
            if (path) {
                ArtSpriteHelper.preloadSprite(path);
            }
        });

        [
            'audio/wave_start',
            'audio/attack_1',
            'audio/attack_2',
            'audio/attack_3',
            'audio/hit',
            'audio/kill_ok',
        ].forEach((path) => resources.preload(path, AudioClip));

        const sfxController = SfxController.getForNode(this.node);
        ['wave_start', 'attack', 'kill', 'monster_intro_neihao'].forEach((name) => sfxController?.preloadSfx(name));
    }

    private bindStartButton(): void {
        if (!this.startButton || this._buttonBound) {
            return;
        }

        this.startButton.node.on(Button.EventType.CLICK, this.handleStartClicked, this);
        this._buttonBound = true;
    }

    private unbindStartButton(): void {
        if (!this.startButton || !this._buttonBound) {
            return;
        }

        this.startButton.node.off(Button.EventType.CLICK, this.handleStartClicked, this);
        this._buttonBound = false;
    }

    private bindMenuButtons(): void {
        if (this._upgradeButton && !this._upgradeButtonBound) {
            this._upgradeButton.node.on(Button.EventType.CLICK, this.handleUpgradeClicked, this);
            this._upgradeButtonBound = true;
        }

        if (this._tutorialButton && !this._tutorialButtonBound) {
            this._tutorialButton.node.on(Button.EventType.CLICK, this.handleTutorialClicked, this);
            this._tutorialButtonBound = true;
        }
    }

    private unbindMenuButtons(): void {
        if (this._upgradeButton && this._upgradeButtonBound) {
            this._upgradeButton.node.off(Button.EventType.CLICK, this.handleUpgradeClicked, this);
            this._upgradeButtonBound = false;
        }

        if (this._tutorialButton && this._tutorialButtonBound) {
            this._tutorialButton.node.off(Button.EventType.CLICK, this.handleTutorialClicked, this);
            this._tutorialButtonBound = false;
        }
    }

    private handleUpgradeClicked(): void {
        FeedbackController.getForNode(this.node)?.playClickFeedback(this._upgradeButton?.node ?? this.node);
        this.showUpgradePanel();
    }

    private handleTutorialClicked(): void {
        FeedbackController.getForNode(this.node)?.playClickFeedback(this._tutorialButton?.node ?? this.node);
        this.showTutorialPanel();
    }

    private getStartPanel(): Node {
        this.startPanel = this.startPanel ?? this.node;
        return this.startPanel;
    }

    private getWaveController(): StartableWaveController | null {
        return this.waveController as StartableWaveController | null;
    }

    private getOrCreateLabel(
        name: string,
        text: string,
        fontSize: number,
        lineHeight: number,
        y: number,
        width: number,
        height: number,
    ): Label {
        const panel = this.getStartPanel();
        let labelNode = panel.getChildByName(name);
        if (!labelNode) {
            labelNode = new Node(name);
            labelNode.layer = panel.layer;
            panel.addChild(labelNode);
        }

        labelNode.setPosition(0, y, 0);
        this.setNodeSize(labelNode, width, height);

        const label = getOrAddComponent(labelNode, Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = 1;
        label.verticalAlign = 1;
        return label;
    }

    private getOrCreateStartButton(): Button {
        const panel = this.getStartPanel();
        const panelSize = this.getStartPanelSize(panel);
        return this.getOrCreateMenuButton('StartButton', '开始上班', 0, -panelSize.height * 0.24, 220, 66, new Color(82, 132, 255, 255));
    }

    private getOrCreateMenuButtons(): void {
        const panel = this.getStartPanel();
        const panelSize = this.getStartPanelSize(panel);
        const y = -panelSize.height * 0.24;
        this._upgradeButton = this.getOrCreateMenuButton('UpgradeButton', '升级工位', -245, y, 200, 62, new Color(255, 184, 76, 255));
        this._tutorialButton = this.getOrCreateMenuButton('TutorialButton', '玩法说明', 245, y, 200, 62, new Color(82, 186, 160, 255));
    }

    private getOrCreateMenuButton(name: string, text: string, x: number, y: number, width: number, height: number, color: Color): Button {
        const panel = this.getStartPanel();
        let buttonNode = panel.getChildByName(name);
        if (!buttonNode) {
            buttonNode = new Node(name);
            buttonNode.layer = panel.layer;
            panel.addChild(buttonNode);
        }

        buttonNode.setPosition(x, y, 0);
        this.setNodeSize(buttonNode, width, height);
        this.drawButtonBackground(buttonNode, width, height, color);

        const button = getOrAddComponent(buttonNode, Button);
        button.interactable = true;

        let labelNode = buttonNode.getChildByName('Label');
        if (!labelNode) {
            labelNode = new Node('Label');
            labelNode.layer = panel.layer;
            buttonNode.addChild(labelNode);
        }

        labelNode.setPosition(0, 0, 0);
        this.setNodeSize(labelNode, width - 20, height - 12);
        const label = getOrAddComponent(labelNode, Label);
        label.string = text;
        label.fontSize = name === 'StartButton' ? 26 : 23;
        label.lineHeight = 32;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = 1;
        label.verticalAlign = 1;

        return button;
    }

    private showUpgradePanel(): void {
        const overlay = this.getOrCreateOverlay('UpgradePanel');
        this.clearChildren(overlay);
        this.drawOverlayBackground(overlay, 840, 590);

        const saveData = SaveDataManager.load();
        this.createPanelLabel(overlay, 'UpgradeTitle', '升级工位', 0, 244, 660, 42, 30, 38, new Color(255, 244, 200, 255));
        this.createPanelLabel(
            overlay,
            'UpgradeCoinLabel',
            `当前摸鱼币：${saveData.totalCoins}`,
            0,
            206,
            620,
            32,
            22,
            30,
            new Color(255, 255, 255, 255),
        );
        this.createPanelLabel(
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
            this.createPanelLabel(
                overlay,
                `${item.key}Info`,
                `${item.title}  Lv.${level}\n${item.desc}\n${this.getUpgradeEffectText(item.key, level)}`,
                -96,
                y,
                520,
                92,
                18,
                24,
                new Color(40, 44, 56, 255),
                new Color(255, 249, 232, 244),
            );

            const buttonText = saveData.totalCoins >= cost ? `升级 ${cost}` : `缺 ${cost}`;
            const button = this.createPanelButton(
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
                    this._lastUpgradeMessage = `${item.title} 升到 Lv.${nextLevel}，${this.getUpgradePlainEffectText(item.key, nextLevel)}`;
                }
                this.showUpgradePanel();
            });
        });

        this.createPanelButton(
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

        this.createPanelButton(overlay, 'UpgradeCloseButton', '返回', 0, -254, 180, 52, new Color(82, 132, 255, 255))
            .node.on(Button.EventType.CLICK, () => {
                this._confirmResetSave = false;
                overlay.active = false;
            });
    }

    private showTutorialPanel(): void {
        const overlay = this.getOrCreateOverlay('TutorialPanel');
        this.clearChildren(overlay);
        this.drawOverlayBackground(overlay, 680, 420);

        SaveDataManager.markTutorialSeen();
        this.createPanelLabel(overlay, 'TutorialTitle', '玩法说明', 0, 148, 560, 42, 30, 38, new Color(255, 244, 200, 255));
        this.createPanelLabel(
            overlay,
            'TutorialText',
            '守住左侧工位，击退从右侧涌来的情绪怪。\n每波结束后选择一个办法继续撑下去。\n精神值归零就下班失败；撑得越久，结算获得的摸鱼币越多。\n摸鱼币可以用来升级工位，后续会逐步接入战斗加成。',
            0,
            20,
            560,
            190,
            22,
            34,
            new Color(255, 255, 255, 255),
        );

        this.createPanelButton(overlay, 'TutorialCloseButton', '知道了', 0, -148, 180, 52, new Color(82, 132, 255, 255))
            .node.on(Button.EventType.CLICK, () => {
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
            return `每发子弹伤害 +${safeLevel}`;
        }

        if (key === 'coffee') {
            return `攻击间隔缩短 ${safeLevel * 5}%`;
        }

        return `最大精神值 +${safeLevel * 10}`;
    }

    private applySavedUpgradesBeforeBattle(): void {
        const battleLayer = this.getStartPanel().parent?.getChildByName('BattleLayer') ?? null;
        const homeBase = battleLayer?.getChildByName('HomeBase') ?? null;
        const player = battleLayer?.getChildByName('Player') ?? null;

        this.callFirstComponentMethod(homeBase, 'applyPersistentUpgrades', [true]);
        this.callFirstComponentMethod(player, 'applyPersistentUpgrades');
    }

    private callFirstComponentMethod(node: Node | null, methodName: string, args: unknown[] = []): void {
        if (!node) {
            return;
        }

        for (const component of node.components) {
            const candidate = component as Component & Record<string, unknown>;
            const method = candidate[methodName];
            if (typeof method === 'function') {
                method.apply(component, args);
                return;
            }
        }
    }

    private getOrCreateOverlay(name: string): Node {
        const panel = this.getStartPanel();
        let overlay = panel.getChildByName(name);
        if (!overlay) {
            overlay = new Node(name);
            overlay.layer = panel.layer;
            panel.addChild(overlay);
        }

        const panelSize = this.getStartPanelSize(panel);
        overlay.active = true;
        overlay.setPosition(0, 0, 0);
        overlay.setSiblingIndex((panel.children.length ?? 1) - 1);
        this.setNodeSize(overlay, panelSize.width, panelSize.height);
        return overlay;
    }

    private drawOverlayBackground(overlay: Node, cardWidth: number, cardHeight: number): void {
        const transform = getExistingComponent(overlay, UITransform);
        const width = transform?.width ?? 1280;
        const height = transform?.height ?? 720;
        const graphics = getOrAddComponent(overlay, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(8, 10, 16, 178);
        graphics.rect(-width * 0.5, -height * 0.5, width, height);
        graphics.fill();
        graphics.fillColor = new Color(28, 34, 48, 248);
        graphics.roundRect(-cardWidth * 0.5, -cardHeight * 0.5, cardWidth, cardHeight, 20);
        graphics.fill();
        graphics.fillColor = new Color(255, 255, 255, 24);
        graphics.roundRect(-cardWidth * 0.5 + 10, -cardHeight * 0.5 + 10, cardWidth - 20, cardHeight - 20, 16);
        graphics.fill();
    }

    private createPanelLabel(
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
        backgroundColor?: Color,
    ): Label {
        const node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(x, y, 0);
        this.setNodeSize(node, width, height);

        let labelNode = node;
        if (backgroundColor) {
            const graphics = getOrAddComponent(node, Graphics);
            graphics.clear();
            graphics.fillColor = backgroundColor;
            graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 12);
            graphics.fill();

            labelNode = new Node(`${name}Label`);
            labelNode.layer = parent.layer;
            node.addChild(labelNode);
            labelNode.setPosition(0, 0, 0);
            this.setNodeSize(labelNode, width - 24, height - 10);
        }

        const label = getOrAddComponent(labelNode, Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
        label.color = color;
        label.horizontalAlign = 1;
        label.verticalAlign = 1;
        label.enableWrapText = true;
        label.overflow = Label.Overflow.SHRINK;
        return label;
    }

    private createPanelButton(parent: Node, name: string, text: string, x: number, y: number, width: number, height: number, color: Color): Button {
        const node = new Node(name);
        node.layer = parent.layer;
        parent.addChild(node);
        node.setPosition(x, y, 0);
        this.setNodeSize(node, width, height);
        this.drawButtonBackground(node, width, height, color);

        const labelNode = new Node('Label');
        labelNode.layer = parent.layer;
        node.addChild(labelNode);
        labelNode.setPosition(0, 0, 0);
        this.setNodeSize(labelNode, width - 20, height - 10);
        const label = getOrAddComponent(labelNode, Label);
        label.string = text;
        label.fontSize = 21;
        label.lineHeight = 28;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = 1;
        label.verticalAlign = 1;

        return getOrAddComponent(node, Button);
    }

    private drawPanelBackground(panel: Node): void {
        const graphics = getOrAddComponent(panel, Graphics);
        const transform = getExistingComponent(panel, UITransform);
        const width = transform?.width ?? 1280;
        const height = transform?.height ?? 720;
        graphics.clear();
        graphics.fillColor = new Color(28, 34, 48, 248);
        graphics.rect(-width * 0.5, -height * 0.5, width, height);
        graphics.fill();

        graphics.fillColor = new Color(52, 62, 82, 255);
        graphics.roundRect(-390, -215, 780, 430, 18);
        graphics.fill();

        if (this.backgroundPath) {
            ArtSpriteHelper.applyFullscreenBackground(panel, 'StartPanelBackground', this.backgroundPath);
        }

        this.drawTextBackdrop(panel, width, height);
    }

    private drawTextBackdrop(panel: Node, width: number, height: number): void {
        let backdrop = panel.getChildByName('StartTextBackdrop');
        if (!backdrop) {
            backdrop = new Node('StartTextBackdrop');
            backdrop.layer = panel.layer;
            panel.addChild(backdrop);
        }

        backdrop.setPosition(0, height * 0.07, 0);
        backdrop.setSiblingIndex(1);
        const backdropWidth = Math.min(width - 120, 760);
        const backdropHeight = 250;
        this.setNodeSize(backdrop, backdropWidth, backdropHeight);
        const graphics = getOrAddComponent(backdrop, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(18, 22, 32, 180);
        graphics.roundRect(-backdropWidth * 0.5, -backdropHeight * 0.5, backdropWidth, backdropHeight, 18);
        graphics.fill();
    }

    private ensureBattleLayerBackdrop(panel: Node): void {
        const battleLayer = panel.parent?.getChildByName('BattleLayer') ?? null;
        if (!battleLayer) {
            console.warn('[StartGameController] BattleLayer not found, cannot create BattleBackdrop.');
            return;
        }

        this.ensureVisibleBattleNode(battleLayer);
        const size = ArtSpriteHelper.getReferenceSize(panel);
        let backdrop = battleLayer.getChildByName('BattleBackground');
        if (!backdrop) {
            backdrop = new Node('BattleBackground');
            backdrop.layer = battleLayer.layer;
            battleLayer.addChild(backdrop);
        }

        this.ensureVisibleBattleNode(backdrop);
        backdrop.setPosition(0, 0, 0);
        backdrop.setSiblingIndex(0);
        this.setNodeSize(backdrop, size.width, size.height);
        const graphics = getOrAddComponent(backdrop, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(32, 36, 45, 255);
        graphics.rect(-size.width * 0.5, -size.height * 0.5, size.width, size.height);
        graphics.fill();
        graphics.fillColor = new Color(54, 62, 70, 255);
        graphics.rect(-size.width * 0.5, -120, size.width, 190);
        graphics.fill();

        if (this.battleBackgroundPath) {
            ArtSpriteHelper.applySprite(backdrop, this.battleBackgroundPath, size.width, size.height);
        }

        this.raiseBattleContentAboveBackdrop(battleLayer);
    }

    private raiseBattleContentAboveBackdrop(battleLayer: Node): void {
        const backgroundNodeNames = ['BattleBackground', 'BattleBackdrop', 'BattleColorBlocks'];
        for (const nodeName of backgroundNodeNames) {
            const child = battleLayer.getChildByName(nodeName);
            if (child) {
                this.ensureVisibleBattleNode(child);
                child.setSiblingIndex(0);
            }
        }

        const contentNodeNames = ['HomeBase', 'MonsterLayer', 'BulletLayer', 'Player', 'MonsterSpawner'];
        contentNodeNames.forEach((nodeName, index) => {
            const child = battleLayer.getChildByName(nodeName);
            if (child) {
                this.ensureVisibleBattleNode(child);
                child.setSiblingIndex(index + 1);
            }
        });
    }

    private ensureVisibleBattleNode(node: Node): void {
        node.active = true;

        const scale = node.scale;
        if (scale.x === 0 || scale.y === 0 || scale.z === 0) {
            node.setScale(scale.x === 0 ? 1 : scale.x, scale.y === 0 ? 1 : scale.y, scale.z === 0 ? 1 : scale.z);
        }

    }

    private clearChildren(node: Node): void {
        for (const child of [...node.children]) {
            child.destroy();
        }
    }

    private drawButtonBackground(buttonNode: Node, width: number, height: number, color: Color): void {
        const graphics = getOrAddComponent(buttonNode, Graphics);
        graphics.clear();
        graphics.fillColor = color;
        graphics.roundRect(-width * 0.5, -height * 0.5, width, height, 10);
        graphics.fill();
    }

    private setNodeSize(node: Node, width: number, height: number): void {
        const transform = getOrAddComponent(node, UITransform);
        transform.setContentSize(width, height);
    }

    private getStartPanelSize(panel: Node): { width: number; height: number } {
        const parentTransform = getExistingComponent(panel.parent, UITransform);
        const panelTransform = getExistingComponent(panel, UITransform);
        return {
            width: Math.max(parentTransform?.width ?? panelTransform?.width ?? 1280, 960),
            height: Math.max(parentTransform?.height ?? panelTransform?.height ?? 720, 640),
        };
    }
}
