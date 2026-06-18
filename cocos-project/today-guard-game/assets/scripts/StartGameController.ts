import { _decorator, AudioClip, Button, Color, Component, Graphics, Label, Node, resources, UITransform } from 'cc';
import { ArtSpriteHelper } from './ArtSpriteHelper';
import { FeedbackController } from './FeedbackController';
import { SfxController } from './SfxController';
import { getExistingComponent, getOrAddComponent } from './ComponentLookup';

const { ccclass, property } = _decorator;

type StartableWaveController = Component & {
    prepareForStartScreen?: () => void;
    startFirstWaveFromStartScreen?: () => void;
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
    private _preloadedFirstWaveAssets = false;

    protected start(): void {
        this.setupStartPanel();
    }

    protected onEnable(): void {
        this.bindStartButton();
    }

    protected onDisable(): void {
        this.unbindStartButton();
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

        this.titleLabel = this.titleLabel ?? this.getOrCreateLabel(
            'TitleLabel',
            '今天也要守住',
            38,
            48,
            panelSize.height * 0.18,
            Math.min(panelSize.width - 120, 680),
            68,
        );
        this.descLabel = this.descLabel ?? this.getOrCreateLabel(
            'DescLabel',
            '守住小屋，击退压力怪。\n每波结束选择一个办法，撑过 5 波就算胜利。',
            22,
            34,
            24,
            Math.min(panelSize.width - 120, 720),
            116,
        );
        this.startButton = this.startButton ?? this.getOrCreateStartButton();

        this.getWaveController()?.prepareForStartScreen?.();
        this.preloadFirstWaveAssets();
        this.bindStartButton();
    }

    private handleStartClicked(): void {
        FeedbackController.getForNode(this.node)?.playClickFeedback(this.startButton?.node ?? this.node);
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
        let buttonNode = panel.getChildByName('StartButton');
        if (!buttonNode) {
            buttonNode = new Node('StartButton');
            buttonNode.layer = panel.layer;
            panel.addChild(buttonNode);
        }

        const panelSize = this.getStartPanelSize(panel);
        buttonNode.setPosition(0, -panelSize.height * 0.22, 0);
        this.setNodeSize(buttonNode, 240, 72);
        this.drawButtonBackground(buttonNode);

        const button = getOrAddComponent(buttonNode, Button);
        button.interactable = true;

        let labelNode = buttonNode.getChildByName('Label');
        if (!labelNode) {
            labelNode = new Node('Label');
            labelNode.layer = panel.layer;
            buttonNode.addChild(labelNode);
        }

        labelNode.setPosition(0, 0, 0);
        this.setNodeSize(labelNode, 220, 60);
        const label = getOrAddComponent(labelNode, Label);
        label.string = '开始守住';
        label.fontSize = 26;
        label.lineHeight = 34;
        label.color = new Color(255, 255, 255, 255);
        label.horizontalAlign = 1;
        label.verticalAlign = 1;

        return button;
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

    private drawButtonBackground(buttonNode: Node): void {
        const graphics = getOrAddComponent(buttonNode, Graphics);
        graphics.clear();
        graphics.fillColor = new Color(82, 132, 255, 255);
        graphics.roundRect(-120, -36, 240, 72, 10);
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
